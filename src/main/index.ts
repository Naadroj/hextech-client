import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, shell, Tray } from 'electron'
import { IpcChannels } from '../shared/ipc'
import { logger } from './logger'
import { ConfigStore } from './config-store'
import { createTray } from './tray'
import { createLcuConnection } from './lcu'
import { minimizeLeagueClientWindow } from './lcu/system'
import { registerLcuIpc } from './ipc/lcu-ipc'

const isDev = !!process.env['ELECTRON_RENDERER_URL']
const RESOURCES = app.isPackaged ? process.resourcesPath : join(__dirname, '../../resources')
const BUILD_DIR = app.isPackaged ? process.resourcesPath : join(__dirname, '../../build')

let win: BrowserWindow | null = null
let tray: Tray | null = null
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
})

app.on('window-all-closed', () => {
  // Avec closeToTray, la fenêtre est cachée (pas fermée) ; ce handler ne se
  // déclenche donc qu'après un vrai quit.
  if (process.platform !== 'darwin') app.quit()
})
