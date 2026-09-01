/**
 * Types de la mise à jour automatique (electron-updater + GitHub Releases).
 * Partagés main <-> renderer.
 */

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'unsupported'

export interface UpdateState {
  phase: UpdatePhase
  /** Version cible (`available` / `downloading` / `downloaded`) ou installée (`not-available`). */
  version: string | null
  /** Progression du téléchargement en % (0–100), pertinent en `downloading`. */
  percent: number
  /** Notes de version (`available`) — texte brut, peut être `null`. */
  notes: string | null
  /** Message d'erreur (`error`) ou raison d'indisponibilité (`unsupported`). */
  message: string | null
}

export interface UpdaterInfo {
  /** Version actuellement installée. */
  currentVersion: string
  /** `false` en développement / hors application packagée : la MàJ auto est inerte. */
  supported: boolean
  state: UpdateState
}

export const IDLE_UPDATE_STATE: UpdateState = {
  phase: 'idle',
  version: null,
  percent: 0,
  notes: null,
  message: null,
}
