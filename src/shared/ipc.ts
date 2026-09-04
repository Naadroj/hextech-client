/**
 * Contrat d'API exposée au renderer via `contextBridge` (accessible sur
 * `window.app`). Partagé entre le preload (implémentation) et le renderer
 * (typage). Aucun secret LCU ne transite jamais par cette surface : le token
 * reste dans le process principal.
 */

import type { ConnectionInfo, LcuEvent, RankedStats } from './lcu-types'
import type { LiveSnapshot, LiveStatus } from './live-types'
import type { StaticDataSummary } from './staticdata-types'
import type { CoachAdvice } from './coach-types'
import type { BuildAxis } from './build-types'
import type { HistoryGame, HistoryGameSummary } from './history-types'
import type { UpdateState, UpdaterInfo } from './update-types'
import type { OverlayState } from './overlay-types'
import type {
  FeedbackDraft,
  FeedbackPushResult,
  FeedbackReport,
  FeedbackState,
} from './feedback-types'

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
  /** Icône carrée d'un item (data: URL), servie localement. */
  getItemIcon: (itemId: number) => Promise<string | null>
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

/**
 * Pont Live Client Data (serveur local du client de jeu, actif en partie
 * seulement). **Lecture seule** : aucune mutation, aucun secret — la surface se
 * limite à l'instantané courant, le statut, et deux abonnements poussés.
 */
export interface LiveBridge {
  /** Dernier instantané connu de la partie (`null` hors partie). */
  getSnapshot: () => Promise<LiveSnapshot | null>
  /** Statut courant du poller (`idle` hors partie, `active` en partie). */
  getStatus: () => Promise<LiveStatus>
  /** Abonnement aux instantanés (~1/s en partie) ; retourne un désabonnement. */
  onSnapshot: (cb: (snapshot: LiveSnapshot) => void) => () => void
  /** Abonnement aux transitions de statut `idle` ↔ `active`. */
  onStatusChanged: (cb: (status: LiveStatus) => void) => () => void
}

/**
 * Pont données statiques (Data Dragon / Meraki). **Lecture seule.** Ne remonte
 * qu'un résumé (`StaticDataSummary`) ; le catalogue complet reste côté main.
 */
export interface StaticDataBridge {
  getSummary: () => Promise<StaticDataSummary>
  /** Force une vérification de patch. Retourne `true` si le snapshot a changé. */
  refresh: () => Promise<boolean>
  /** Abonnement aux changements de snapshot (patch rafraîchi). */
  onUpdated: (cb: (summary: StaticDataSummary) => void) => () => void
}

/**
 * Pont Coach : le moteur de recommandation d'items (A2→A4) tourne dans le
 * process principal ; ce pont ne transporte que le conseil résultant.
 */
/**
 * Historique local des propositions. **Lecture seule** : rien ne s'écrit depuis
 * le renderer, et rien ne sort de la machine.
 */
export interface HistoryBridge {
  list: () => Promise<HistoryGameSummary[]>
  get: (id: string) => Promise<HistoryGame | null>
}

export interface CoachBridge {
  getAdvice: () => Promise<CoachAdvice>
  /** Force l'axe de degats (`null` = auto). Renvoie le conseil recalcule. */
  setAxis: (axis: BuildAxis | null) => Promise<CoachAdvice>
  onAdvice: (cb: (advice: CoachAdvice) => void) => () => void
}

/**
 * Pont de mise à jour automatique (electron-updater + GitHub Releases).
 * Toutes les actions sont explicites : rien ne se télécharge ni ne s'installe
 * sans clic. Inerte hors application packagée.
 */
export interface UpdaterBridge {
  getInfo: () => Promise<UpdaterInfo>
  /** Vérifie la disponibilité d'une nouvelle version. */
  check: () => Promise<UpdateState>
  /** Télécharge la mise à jour disponible. */
  download: () => Promise<UpdateState>
  /** Quitte et installe la mise à jour téléchargée. */
  install: () => Promise<void>
  /** Abonnement aux transitions d'état ; retourne un désabonnement. */
  onState: (cb: (state: UpdateState) => void) => () => void
}

/**
 * Pont overlay in-game. `setInteractive` pilote le click-through : l'overlay
 * laisse passer les clics vers le jeu, sauf quand le curseur survole la carte.
 */
export interface OverlayBridge {
  getState: () => Promise<OverlayState>
  setEnabled: (enabled: boolean) => Promise<OverlayState>
  toggle: () => Promise<OverlayState>
  /** Bascule mode réduit / détaillé (redimensionne la fenêtre en conséquence). */
  setCompact: (compact: boolean) => Promise<OverlayState>
  /** Appelé par la fenêtre overlay elle-même au survol / à la sortie de la carte. */
  setInteractive: (interactive: boolean) => Promise<void>
  /** Début de déplacement : le main suit le curseur jusqu'à `dragEnd`. */
  dragStart: () => Promise<void>
  dragEnd: () => Promise<void>
  onState: (cb: (state: OverlayState) => void) => () => void
}

/**
 * Pont de signalement : « l'item proposé n'est pas cohérent ». Le rapport est
 * composé côté main (il a besoin de l'état de partie complet) ; le renderer
 * n'envoie que l'item visé et une catégorie optionnelle.
 */
export interface FeedbackBridge {
  getState: () => Promise<FeedbackState>
  /** Met en file un signalement. `false` si hors partie ou doublon récent. */
  report: (draft: FeedbackDraft) => Promise<boolean>
  setEnabled: (enabled: boolean) => Promise<FeedbackState>
  /** Rapports en attente, du plus récent au plus ancien. */
  list: () => Promise<FeedbackReport[]>
  /** Ajoute des précisions à un rapport en attente. */
  annotate: (id: string, comment: string) => Promise<boolean>
  discard: (id: string) => Promise<boolean>
  /** Envoi manuel vers la base — le seul moment où quelque chose sort. */
  push: () => Promise<FeedbackPushResult>
  onState: (cb: (state: FeedbackState) => void) => () => void
}

export interface AppApi {
  windowControls: WindowControls
  lcu: LcuBridge
  live: LiveBridge
  staticData: StaticDataBridge
  coach: CoachBridge
  history: HistoryBridge
  updater: UpdaterBridge
  overlay: OverlayBridge
  feedback: FeedbackBridge
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
  lcuGetItemIcon: 'lcu:get-item-icon',
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

  liveGetSnapshot: 'live:get-snapshot',
  liveGetStatus: 'live:get-status',
  liveSnapshot: 'live:snapshot',
  liveStatusChanged: 'live:status-changed',

  staticDataGetSummary: 'staticdata:get-summary',
  staticDataRefresh: 'staticdata:refresh',
  staticDataUpdated: 'staticdata:updated',

  coachGetAdvice: 'coach:get-advice',
  coachAdvice: 'coach:advice',
  coachSetAxis: 'coach:set-axis',

  historyList: 'history:list',
  historyGet: 'history:get',

  updateGetInfo: 'update:get-info',
  updateCheck: 'update:check',
  updateDownload: 'update:download',
  updateInstall: 'update:install',
  updateState: 'update:state',

  overlayGetState: 'overlay:get-state',
  overlaySetEnabled: 'overlay:set-enabled',
  overlayToggle: 'overlay:toggle',
  overlaySetCompact: 'overlay:set-compact',
  overlaySetInteractive: 'overlay:set-interactive',
  overlayDragStart: 'overlay:drag-start',
  overlayDragEnd: 'overlay:drag-end',
  overlayState: 'overlay:state',

  feedbackGetState: 'feedback:get-state',
  feedbackReport: 'feedback:report',
  feedbackSetEnabled: 'feedback:set-enabled',
  feedbackList: 'feedback:list',
  feedbackAnnotate: 'feedback:annotate',
  feedbackDiscard: 'feedback:discard',
  feedbackPush: 'feedback:push',
  feedbackState: 'feedback:state',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
