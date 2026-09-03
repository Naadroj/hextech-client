import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { logger } from './logger'
import type { ConfigStore } from './config-store'
import {
  OVERLAY_DEFAULT_SIZE,
  type OverlayBounds,
  type OverlayState,
} from '../shared/overlay-types'

/**
 * Overlay in-game : `BrowserWindow` sans bordure, transparente, toujours
 * au-dessus, qui affiche le conseil du Coach par-dessus League.
 *
 * **Aucune injection** — c'est une fenêtre Electron ordinaire. Elle ne peut
 * donc pas passer devant un jeu en **plein écran exclusif** : League doit être
 * en mode « Sans bordure » (son défaut).
 *
 * Click-through : la fenêtre ignore la souris par défaut (`forward: true` pour
 * continuer à recevoir les `mousemove` côté renderer) ; le renderer rappelle
 * `setInteractive(true)` quand le curseur entre sur la carte, ce qui rend la
 * poignée de déplacement cliquable.
 *
 * Événement : `state` (`OverlayState`).
 */

export interface OverlayDeps {
  config: ConfigStore
  /** `true` en développement (charge l'URL du serveur Vite). */
  isDev: boolean
  /** URL du serveur de dev renderer (`ELECTRON_RENDERER_URL`). */
  rendererUrl?: string
  /** Racine des bundles renderer buildés (`out/renderer`). */
  rendererDir: string
  preloadPath: string
}

const clampToDisplay = (b: OverlayBounds): OverlayBounds => {
  const area = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea
  const width = Math.min(b.width, area.width)
  const height = Math.min(b.height, area.height)
  return {
    width,
    height,
    x: Math.min(Math.max(b.x, area.x), area.x + area.width - width),
    y: Math.min(Math.max(b.y, area.y), area.y + area.height - height),
  }
}

function defaultBounds(): OverlayBounds {
  const area = screen.getPrimaryDisplay().workArea
  return {
    width: OVERLAY_DEFAULT_SIZE.width,
    height: OVERLAY_DEFAULT_SIZE.height,
    x: area.x + area.width - OVERLAY_DEFAULT_SIZE.width - 24,
    y: area.y + 24,
  }
}

export class Overlay extends EventEmitter {
  private win: BrowserWindow | null = null
  private disposed = false

  constructor(private readonly deps: OverlayDeps) {
    super()
  }

  get state(): OverlayState {
    return {
      enabled: this.deps.config.get('overlayEnabled'),
      bounds: this.deps.config.get('overlayBounds'),
    }
  }

  /** Restaure l'état persisté au démarrage (sans forcer l'affichage). */
  restore(): void {
    if (this.deps.config.get('overlayEnabled')) this.setEnabled(true)
  }

  setEnabled(enabled: boolean): OverlayState {
    if (this.disposed) return this.state
    this.deps.config.set('overlayEnabled', enabled)
    if (enabled) this.ensureWindow()
    else this.destroyWindow()
    const next = this.state
    this.emit('state', next)
    return next
  }

  toggle(): OverlayState {
    return this.setEnabled(!this.deps.config.get('overlayEnabled'))
  }

  /** Click-through on/off (appelé par la fenêtre overlay au survol). */
  setInteractive(interactive: boolean): void {
    if (!this.win || this.win.isDestroyed()) return
    if (interactive) this.win.setIgnoreMouseEvents(false)
    else this.win.setIgnoreMouseEvents(true, { forward: true })
  }

  /** Relaie un message vers la fenêtre overlay (ex. `coach:advice`). */
  send(channel: string, payload: unknown): void {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload)
  }

  dispose(): void {
    this.disposed = true
    this.destroyWindow()
    this.removeAllListeners()
  }

  private destroyWindow(): void {
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  private ensureWindow(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.showInactive()
      return
    }
    const bounds = clampToDisplay(this.deps.config.get('overlayBounds') ?? defaultBounds())

    const win = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      hasShadow: false,
      webPreferences: {
        preload: this.deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    // Au-dessus même des fenêtres plein écran « sans bordure ».
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    // Click-through par défaut, en gardant les mousemove pour le hit-test.
    win.setIgnoreMouseEvents(true, { forward: true })

    // Aucune navigation externe depuis l'overlay.
    win.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    const persist = (): void => {
      if (!win || win.isDestroyed()) return
      const b = win.getBounds()
      this.deps.config.set('overlayBounds', { x: b.x, y: b.y, width: b.width, height: b.height })
    }
    win.on('moved', persist)
    win.on('resized', persist)
    win.on('closed', () => {
      if (this.win === win) this.win = null
    })
    win.once('ready-to-show', () => win.showInactive())

    if (this.deps.isDev && this.deps.rendererUrl) {
      void win.loadURL(`${this.deps.rendererUrl}/overlay.html`)
    } else {
      void win.loadFile(join(this.deps.rendererDir, 'overlay.html'))
    }

    this.win = win
    logger.info('Overlay affiché (League doit être en mode « Sans bordure »)')
  }
}

export function createOverlay(deps: OverlayDeps): Overlay {
  return new Overlay(deps)
}
