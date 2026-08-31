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
  /** Icône carrée d'un champion (data: URL), servie localement. */
  getChampionIcon: (championId: number) => Promise<string | null>
  /** Splash art (data: URL) du champion le plus maîtrisé, pour le fond. */
  getSplashBackground: () => Promise<string | null>
  acceptReadyCheck: () => Promise<void>
  declineReadyCheck: () => Promise<void>
  createLobby: (queueId: number) => Promise<void>
  createPracticeTool: () => Promise<void>
  createCustomLobby: () => Promise<void>
  leaveLobby: () => Promise<void>
  startMatchmaking: () => Promise<void>
  stopMatchmaking: () => Promise<void>
  champHover: (actionId: number, championId: number) => Promise<void>
  champLock: (actionId: number, championId: number) => Promise<void>
  setSummonerSpells: (spell1Id: number, spell2Id: number) => Promise<void>
  setRunePage: (pageId: number) => Promise<void>
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
  lcuGetChampionIcon: 'lcu:get-champion-icon',
  lcuGetSplash: 'lcu:get-splash',
  lcuAcceptReadyCheck: 'lcu:accept-ready-check',
  lcuDeclineReadyCheck: 'lcu:decline-ready-check',
  lcuCreateLobby: 'lcu:create-lobby',
  lcuCreatePracticeTool: 'lcu:create-practice-tool',
  lcuCreateCustomLobby: 'lcu:create-custom-lobby',
  lcuLeaveLobby: 'lcu:leave-lobby',
  lcuStartMatchmaking: 'lcu:start-matchmaking',
  lcuStopMatchmaking: 'lcu:stop-matchmaking',
  lcuChampHover: 'lcu:champ-hover',
  lcuChampLock: 'lcu:champ-lock',
  lcuSetSpells: 'lcu:set-spells',
  lcuSetRunePage: 'lcu:set-rune-page',
  lcuRead: 'lcu:read',
  lcuConnectionChanged: 'lcu:connection-changed',
  lcuEvent: 'lcu:event',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
