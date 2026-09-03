/**
 * Overlay in-game (fenêtre transparente toujours au-dessus, façon widget Blitz).
 *
 * Aucune injection : c'est une simple `BrowserWindow` Electron qui affiche le
 * conseil du Coach par-dessus le jeu. Nécessite League en mode **Sans bordure**
 * (le plein écran exclusif passe devant toute fenêtre).
 */

export interface OverlayBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface OverlayState {
  /** L'overlay est affiché. */
  enabled: boolean
  /** Dernière position/taille connue (`null` = position par défaut). */
  bounds: OverlayBounds | null
}

export const OVERLAY_DEFAULT_SIZE = { width: 340, height: 260 }

export const IDLE_OVERLAY_STATE: OverlayState = { enabled: false, bounds: null }
