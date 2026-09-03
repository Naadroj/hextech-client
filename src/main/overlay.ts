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
 * Visibilité : la fenêtre reste créée tant que l'overlay est activé, mais n'est
 * **affichée que quand la partie League est au premier plan** (`getForeground
 * ProcessName`). Alt-Tab vers une autre application → la fenêtre se masque.
 *
 * Événement : `state` (`OverlayState`).
 */

/** Nom de process de la fenêtre de jeu (in-game), pas du client. */
const GAME_PROCESS_NAME = 'League of Legends'
/** Cadence de suivi du curseur pendant un déplacement (~60 Hz). */
const DRAG_TICK_MS = 16
/** Filet de sécurité : un drag ne dure jamais plus longtemps que ça. */
const DRAG_MAX_MS = 30_000
/**
 * Cadence du test « le jeu est-il au premier plan ? ». Chaque tick lance un
 * PowerShell : on ne sonde **que pendant une partie** (voir `setGameActive`).
 */
const FOREGROUND_TICK_MS = 1500

export interface OverlayDeps {
  config: ConfigStore
  /** `true` en développement (pas de gate premier-plan : overlay toujours visible). */
  isDev: boolean
  rendererUrl?: string
  rendererDir: string
  preloadPath: string
  /** Injectable pour les tests ; par défaut `getForegroundProcessName` de system.ts. */
  getForegroundProcessName?: () => Promise<string | null>
}

/** Nouvelle position pour un tick de drag — **la taille est fixée**, jamais recalculée. */
export function dragBoundsFor(
  cursor: { x: number; y: number },
  offset: { x: number; y: number },
  size: { width: number; height: number },
): OverlayBounds {
  return {
    x: Math.round(cursor.x - offset.x),
    y: Math.round(cursor.y - offset.y),
    width: Math.round(size.width),
    height: Math.round(size.height),
  }
}

/**
 * L'overlay doit-il être visible ? Il faut **une partie en cours** *et* que la
 * fenêtre de jeu soit au premier plan (Alt-Tab → masqué). On garde la fenêtre
 * visible pendant un déplacement, et en dev pour pouvoir la travailler.
 */
export function overlayShouldShow(o: {
  enabled: boolean
  isDev: boolean
  dragging: boolean
  gameActive: boolean
  gameForeground: boolean
  foregroundUnavailable: boolean
}): boolean {
  if (!o.enabled) return false
  if (o.isDev || o.dragging) return true
  if (!o.gameActive) return false
  return o.gameForeground || o.foregroundUnavailable
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

/** Coin **haut-gauche** de l'écran principal, légèrement décalé. */
function defaultBounds(): OverlayBounds {
  const area = screen.getPrimaryDisplay().workArea
  return {
    width: OVERLAY_DEFAULT_SIZE.width,
    height: OVERLAY_DEFAULT_SIZE.height,
    x: area.x + 24,
    y: area.y + 24,
  }
}

export class Overlay extends EventEmitter {
  private win: BrowserWindow | null = null
  private disposed = false
  private dragTimer: NodeJS.Timeout | null = null
  private dragStopTimer: NodeJS.Timeout | null = null
  private dragOffset = { x: 0, y: 0 }
  private dragSize = { width: OVERLAY_DEFAULT_SIZE.width, height: OVERLAY_DEFAULT_SIZE.height }
  private dragging = false

  private fgTimer: NodeJS.Timeout | null = null
  private gameActive = false
  private gameForeground = false
  private fgFailures = 0

  private readonly getForeground: () => Promise<string | null>

  constructor(private readonly deps: OverlayDeps) {
    super()
    this.getForeground =
      deps.getForegroundProcessName ??
      (() => Promise.resolve(null))
  }

  get state(): OverlayState {
    return {
      enabled: this.deps.config.get('overlayEnabled'),
      bounds: this.deps.config.get('overlayBounds'),
    }
  }

  restore(): void {
    if (this.deps.config.get('overlayEnabled')) this.setEnabled(true)
  }

  setEnabled(enabled: boolean): OverlayState {
    if (this.disposed) return this.state
    this.deps.config.set('overlayEnabled', enabled)
    if (enabled) {
      this.ensureWindow()
      if (this.gameActive) this.startForegroundWatch()
      this.applyVisibility()
    } else {
      this.stopForegroundWatch()
      this.destroyWindow()
    }
    const next = this.state
    this.emit('state', next)
    return next
  }

  /**
   * Partie en cours ou non (câblé sur le poller Live). Hors partie, on **arrête
   * complètement** la sonde de premier plan : elle lance un PowerShell à chaque
   * tick, inutile de la faire tourner en permanence.
   */
  setGameActive(active: boolean): void {
    if (this.gameActive === active) return
    this.gameActive = active
    if (active && this.deps.config.get('overlayEnabled')) this.startForegroundWatch()
    else if (!active) this.stopForegroundWatch()
    this.applyVisibility()
  }

  toggle(): OverlayState {
    return this.setEnabled(!this.deps.config.get('overlayEnabled'))
  }

  setInteractive(interactive: boolean): void {
    if (!this.win || this.win.isDestroyed()) return
    if (interactive) this.win.setIgnoreMouseEvents(false)
    else this.win.setIgnoreMouseEvents(true, { forward: true })
  }

  /**
   * Déplacement suivi depuis le process principal. La **taille est capturée au
   * début et ré-imposée à chaque tick** : sur Windows, `setPosition` en boucle
   * sur une fenêtre `transparent` fait grossir la fenêtre (bug Electron/DPI).
   */
  startDrag(): void {
    if (!this.win || this.win.isDestroyed()) return
    this.endDrag()
    const b = this.win.getBounds()
    const cursor = screen.getCursorScreenPoint()
    this.dragOffset = { x: cursor.x - b.x, y: cursor.y - b.y }
    this.dragSize = { width: b.width, height: b.height }
    this.dragging = true

    this.dragTimer = setInterval(() => {
      if (!this.win || this.win.isDestroyed()) {
        this.endDrag()
        return
      }
      const p = screen.getCursorScreenPoint()
      this.win.setBounds(dragBoundsFor(p, this.dragOffset, this.dragSize))
    }, DRAG_TICK_MS)
    this.dragStopTimer = setTimeout(() => this.endDrag(), DRAG_MAX_MS)
  }

  endDrag(): void {
    const wasDragging = this.dragTimer !== null
    if (this.dragTimer) clearInterval(this.dragTimer)
    if (this.dragStopTimer) clearTimeout(this.dragStopTimer)
    this.dragTimer = null
    this.dragStopTimer = null
    this.dragging = false
    if (wasDragging) this.persistBounds()
  }

  send(channel: string, payload: unknown): void {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload)
  }

  dispose(): void {
    this.disposed = true
    this.endDrag()
    this.stopForegroundWatch()
    this.destroyWindow()
    this.removeAllListeners()
  }

  // ─── Premier plan ────────────────────────────────────────────────────────

  private startForegroundWatch(): void {
    if (this.fgTimer || this.deps.isDev) {
      // En dev : pas de gate, l'overlay est visible dès qu'il est activé.
      if (this.deps.isDev) this.applyVisibility()
      return
    }
    const tick = (): void => {
      void this.getForeground()
        .then((name) => {
          if (name === null) {
            this.fgFailures += 1
          } else {
            this.fgFailures = 0
            this.gameForeground = name === GAME_PROCESS_NAME
          }
          this.applyVisibility()
        })
        .catch(() => {
          this.fgFailures += 1
          this.applyVisibility()
        })
    }
    tick()
    this.fgTimer = setInterval(tick, FOREGROUND_TICK_MS)
  }

  private stopForegroundWatch(): void {
    if (this.fgTimer) clearInterval(this.fgTimer)
    this.fgTimer = null
    this.gameForeground = false
    this.fgFailures = 0
  }

  private applyVisibility(): void {
    if (!this.win || this.win.isDestroyed()) return
    const show = overlayShouldShow({
      enabled: this.deps.config.get('overlayEnabled'),
      isDev: this.deps.isDev,
      dragging: this.dragging,
      gameActive: this.gameActive,
      gameForeground: this.gameForeground,
      // 3 échecs d'affilée → on considère la détection HS et on affiche
      // plutôt que de piéger l'utilisateur avec un overlay invisible.
      foregroundUnavailable: this.fgFailures >= 3,
    })
    if (show && !this.win.isVisible()) this.win.showInactive()
    else if (!show && this.win.isVisible()) this.win.hide()
  }

  // ─── Fenêtre ─────────────────────────────────────────────────────────────

  private persistBounds(): void {
    if (!this.win || this.win.isDestroyed()) return
    const b = this.win.getBounds()
    this.deps.config.set('overlayBounds', { x: b.x, y: b.y, width: b.width, height: b.height })
  }

  private destroyWindow(): void {
    this.endDrag()
    if (this.win && !this.win.isDestroyed()) this.win.destroy()
    this.win = null
  }

  private ensureWindow(): void {
    if (this.win && !this.win.isDestroyed()) {
      this.applyVisibility()
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
      focusable: false,
      webPreferences: {
        preload: this.deps.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    })

    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setIgnoreMouseEvents(true, { forward: true })

    win.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url)
      return { action: 'deny' }
    })

    const persist = (): void => {
      if (!this.dragging) this.persistBounds()
    }
    win.on('moved', persist)
    win.on('resized', persist)
    win.on('closed', () => {
      if (this.win === win) this.win = null
    })
    win.once('ready-to-show', () => this.applyVisibility())

    if (this.deps.isDev && this.deps.rendererUrl) {
      void win.loadURL(`${this.deps.rendererUrl}/overlay.html`)
    } else {
      void win.loadFile(join(this.deps.rendererDir, 'overlay.html'))
    }

    this.win = win
    logger.info('Overlay prêt (visible quand League est au premier plan)')
  }
}

export function createOverlay(deps: OverlayDeps): Overlay {
  return new Overlay(deps)
}
