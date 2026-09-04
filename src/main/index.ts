import { join } from 'node:path'
import { app, BrowserWindow, globalShortcut, ipcMain, shell, Tray } from 'electron'
import { IpcChannels } from '../shared/ipc'
import { logger } from './logger'
import { ConfigStore } from './config-store'
import { createTray } from './tray'
import { createLcuConnection } from './lcu'
import { minimizeLeagueClientWindow, getForegroundProcessName } from './lcu/system'
import { registerLcuIpc } from './ipc/lcu-ipc'
import { createLiveClient } from './live'
import { registerLiveIpc } from './ipc/live-ipc'
import { createStaticData } from './staticdata'
import { registerStaticDataIpc } from './ipc/staticdata-ipc'
import { createCoach } from './engine/coach'
import { resolveBuildBook, refreshBuildBook } from './engine/build-book'
import { registerCoachIpc } from './ipc/coach-ipc'
import { Updater } from './updater'
import { registerUpdateIpc } from './ipc/update-ipc'
import { createOverlay, type Overlay } from './overlay'
import { registerOverlayIpc } from './ipc/overlay-ipc'
import { createFeedback, FeedbackStore, type Feedback } from './feedback'
import { registerFeedbackIpc } from './ipc/feedback-ipc'

const isDev = !!process.env['ELECTRON_RENDERER_URL']
const RESOURCES = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
const BUILD_DIR = app.isPackaged ? process.resourcesPath : join(__dirname, '../../build')
/** Bundles renderer buildés (out/renderer) — `__dirname` = out/main. */
const RENDERER_DIR = join(__dirname, '../renderer')
/** Raccourci global d'affichage/masquage de l'overlay. */
const OVERLAY_HOTKEY = 'CommandOrControl+Shift+O'

let win: BrowserWindow | null = null
let tray: Tray | null = null
let overlay: Overlay | null = null
let feedback: Feedback | null = null
let quitting = false

const config = new ConfigStore(join(app.getPath('userData'), 'config.json'))

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#010a13',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  window.on('ready-to-show', () => {
    if (!config.get('startMinimizedToTray')) window.show()
  })

  window.on('close', (event) => {
    if (!quitting && config.get('closeToTray')) {
      event.preventDefault()
      window.hide()
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Le process de rendu meurt (crash natif, OOM, GPU) → fenêtre noire.
  // On journalise et on recharge automatiquement pour éviter l'écran noir.
  window.webContents.on('render-process-gone', (_e, details) => {
    logger.warn('Renderer arrêté :', details.reason, details.exitCode)
    if (details.reason !== 'clean-exit' && !window.isDestroyed()) window.reload()
  })
  window.webContents.on('unresponsive', () => logger.warn('Renderer ne répond plus'))
  window.webContents.on('preload-error', (_e, path, err) =>
    logger.warn('preload:', path, String(err)),
  )

  if (isDev) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL'] as string)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function registerWindowControls(): void {
  ipcMain.handle(IpcChannels.windowMinimize, () => {
    win?.minimize()
  })
  ipcMain.handle(IpcChannels.windowToggleMaximize, () => {
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.handle(IpcChannels.windowClose, () => {
    win?.close()
  })
  ipcMain.handle(IpcChannels.windowIsMaximized, () => win?.isMaximized() ?? false)
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    win = createWindow()
    win.on('closed', () => {
      win = null
    })

    registerWindowControls()

    const updater = new Updater()
    registerUpdateIpc({ ipcMain, updater, getSender: () => win?.webContents ?? null })
    updater.on('state', (s) => logger.info('MàJ :', s.phase, s.version ?? ''))

    const lcu = createLcuConnection({ caPath: join(RESOURCES, 'riotgames.pem') })
    registerLcuIpc({
      ipcMain,
      connection: lcu,
      getSender: () => win?.webContents ?? null,
    })

    lcu.on('connected', () => {
      logger.info('LCU connectée')
      if (config.get('minimizeOfficialClientOnConnect')) void minimizeLeagueClientWindow()
    })
    lcu.on('disconnected', () => logger.info('LCU déconnectée'))
    lcu.on('error', (err) => logger.warn('LCU:', String(err)))
    lcu.start()

    const live = createLiveClient({ caPath: join(RESOURCES, 'riotgames.pem') })
    registerLiveIpc({
      ipcMain,
      poller: live,
      getSender: () => win?.webContents ?? null,
    })
    live.on('game-start', () => {
      logger.info('Partie détectée (Live Client Data API)')
      overlay?.setGameActive(true)
    })
    live.on('game-end', () => {
      logger.info('Partie terminée (Live Client Data API)')
      overlay?.setGameActive(false)
    })
    // Hors partie, la Live API refuse la connexion : bruit attendu, on le tait.
    live.on('poll-error', () => {})
    live.start()

    createStaticData({
      bundledSnapshotPath: join(RESOURCES, 'staticdata', 'snapshot.json'),
      cacheSnapshotPath: join(app.getPath('userData'), 'staticdata', 'snapshot.json'),
    })
      .then((staticData) => {
        registerStaticDataIpc({
          ipcMain,
          controller: staticData,
          getSender: () => win?.webContents ?? null,
        })
        const s = staticData.summary()
        logger.info(`Données statiques : patch ${s.version} (${s.source}), ${s.itemCount} items`)

        // Squelette de build (A4.3) : repli embarqué + cache rafraîchi depuis
        // une Release GitHub (fichier pré-agrégé par la CI, aucune clé côté client).
        const patchOf = (v: string): string => v.split('.').slice(0, 2).join('.')
        const buildsBundled = join(RESOURCES, 'builds.json')
        const buildsCache = join(app.getPath('userData'), 'builds.json')
        let buildBook = resolveBuildBook({
          bundledPath: buildsBundled,
          cachePath: buildsCache,
          currentPatch: patchOf(s.version),
        })
        const refreshBuilds = (version: string): void => {
          void refreshBuildBook({ cachePath: buildsCache, currentPatch: patchOf(version) })
            .then((book) => {
              if (book) buildBook = book
            })
            .catch(() => {})
        }
        refreshBuilds(s.version)

        staticData.onUpdated((meta) => {
          logger.info(`Données statiques rafraîchies : patch ${meta.version}`)
          refreshBuilds(meta.version)
        })

        // Moteur de coaching : poller Live + catalogue (+ squelette de build) → recommandation.
        const coach = createCoach({
          poller: live,
          getStaticData: () => staticData.data,
          getBuildBook: () => buildBook,
        })
        registerCoachIpc({ ipcMain, coach, getSender: () => win?.webContents ?? null })

        // Overlay in-game : même conseil, relayé à sa propre fenêtre.
        overlay = createOverlay({
          config,
          isDev,
          rendererUrl: process.env['ELECTRON_RENDERER_URL'],
          rendererDir: RENDERER_DIR,
          preloadPath: join(__dirname, '../preload/index.mjs'),
          getForegroundProcessName,
        })
        registerOverlayIpc({
          ipcMain,
          overlay,
          getSender: () => win?.webContents ?? null,
        })
        coach.on('advice', (advice) => overlay?.send(IpcChannels.coachAdvice, advice))

        // Signalements « item incohérent » : file locale puis envoi Supabase.
        feedback = createFeedback({
          config,
          store: new FeedbackStore(join(app.getPath('userData'), 'feedback', 'pending.jsonl')),
          appVersion: app.getVersion(),
          getLive: () => live.snapshot?.data ?? null,
          getAdvice: () => coach.advice,
          getPatch: () => patchOf(staticData.summary().version),
        })
        registerFeedbackIpc({
          ipcMain,
          feedback,
          getSenders: () => {
            const out = []
            if (win?.webContents) out.push(win.webContents)
            const ov = overlay?.webContents
            if (ov) out.push(ov)
            return out
          },
        })
        feedback.on('state', (st) => overlay?.send(IpcChannels.feedbackState, st))
        feedback.start()
        // La détection de premier plan ne tourne que pendant une partie.
        overlay.setGameActive(live.currentStatus === 'active')
        overlay.restore()

        if (!globalShortcut.register(OVERLAY_HOTKEY, () => overlay?.toggle())) {
          logger.warn(`Raccourci ${OVERLAY_HOTKEY} indisponible (déjà pris)`)
        }
      })
      .catch((err) => logger.warn('Données statiques indisponibles :', String(err)))

    try {
      tray = createTray({
        iconPath: join(BUILD_DIR, 'tray.png'),
        getWindow: () => win,
        onQuit: () => {
          quitting = true
          tray?.destroy()
          tray = null
          app.quit()
        },
      })
    } catch (err) {
      logger.warn('Tray indisponible', String(err))
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        win = createWindow()
        win.on('closed', () => {
          win = null
        })
      }
    })
  })
}

app.on('before-quit', () => {
  quitting = true
  globalShortcut.unregister(OVERLAY_HOTKEY)
  overlay?.dispose()
  overlay = null
  feedback?.dispose()
  feedback = null
})

app.on('window-all-closed', () => {
  // Avec closeToTray, la fenêtre est cachée (pas fermée) ; ce handler ne se
  // déclenche donc qu'après un vrai quit.
  if (process.platform !== 'darwin') app.quit()
})
