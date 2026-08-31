/**
 * Contrat d'API exposée au renderer via `contextBridge` (accessible sur
 * `window.app`). Partagé entre le preload (implémentation) et le renderer
 * (typage). Aucun secret LCU ne transite jamais par cette surface : le token
 * reste dans le process principal.
 */

import type { ConnectionInfo, LcuEvent, RankedStats } from './lcu-types'

export interface WindowControls {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
}

export interface LcuReadResult<T = unknown> {
  status: number
  ok: boolean
  data: T
}

/**
 * Pont LCU. Les lectures passent par `read()` (GET uniquement, chemins filtrés
 * par une liste blanche côté main). Les mutations ont chacune un canal dédié —
 * le renderer ne peut pas émettre de POST arbitraire.
 */
export interface LcuBridge {
  getConnection: () => Promise<ConnectionInfo>
  getRankedStats: () => Promise<RankedStats>
  /** Icône d'invocateur servie localement par le client, en `data:` URL. */
  getProfileIcon: (iconId: number) => Promise<string | null>
  acceptReadyCheck: () => Promise<void>
  declineReadyCheck: () => Promise<void>
  read: <T = unknown>(path: string) => Promise<LcuReadResult<T>>
  /** Abonnement aux changements d'état de connexion ; retourne un désabonnement. */
  onConnectionChanged: (cb: (info: ConnectionInfo) => void) => () => void
  /** Abonnement aux événements LCU (déjà filtrés par le main). */
  onEvent: (cb: (event: LcuEvent) => void) => () => void
}

export interface AppApi {
  windowControls: WindowControls
  lcu: LcuBridge
}

/** Noms de canaux IPC (source unique de vérité main <-> preload). */
export const IpcChannels = {
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',

  lcuGetConnection: 'lcu:get-connection',
  lcuGetRankedStats: 'lcu:get-ranked-stats',
  lcuGetProfileIcon: 'lcu:get-profile-icon',
  lcuAcceptReadyCheck: 'lcu:accept-ready-check',
  lcuDeclineReadyCheck: 'lcu:decline-ready-check',
  lcuRead: 'lcu:read',
  lcuConnectionChanged: 'lcu:connection-changed',
  lcuEvent: 'lcu:event',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
