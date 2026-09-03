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

/**
 * Taille de l'overlay, en **fraction de l'écran** — elle s'adapte donc à la
 * résolution au lieu d'être figée en pixels. Bornée pour rester lisible en
 * 1080p et ne pas devenir énorme en 4K.
 */
export const OVERLAY_SIZE_RATIO = { width: 0.15, height: 0.22 }
export const OVERLAY_SIZE_BOUNDS = {
  minWidth: 240,
  maxWidth: 420,
  minHeight: 150,
  maxHeight: 340,
}

export const IDLE_OVERLAY_STATE: OverlayState = { enabled: false, bounds: null }
