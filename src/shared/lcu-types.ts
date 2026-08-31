/**
 * DTOs LCU partagés entre le process principal et le renderer.
 * Aucune logique ici — seulement des formes de données.
 */

// ─── WebSocket ──────────────────────────────────────────────────────────────

export type LcuEventType = 'Create' | 'Update' | 'Delete'

export interface LcuEvent<T = unknown> {
  eventType: LcuEventType
  uri: string
  data: T
}

// ─── /lol-summoner ─────────────────────────────────────────────────────────

export interface CurrentSummoner {
  summonerId: number
  accountId: number
  puuid: string
  displayName: string
  gameName: string
  tagLine: string
  internalName: string
  profileIconId: number
  summonerLevel: number
  percentCompleteForNextLevel: number
  xpSinceLastLevel: number
  xpUntilNextLevel: number
}

// ─── /lol-matchmaking : ready-check ────────────────────────────────────────

export type ReadyCheckStateName =
  | 'Invalid'
  | 'InProgress'
  | 'EveryoneReady'
  | 'StrangerNotReady'
  | 'PartyNotReady'

export interface ReadyCheck {
  state: ReadyCheckStateName
  playerResponse: 'None' | 'Accepted' | 'Declined'
  timer: number
}

// ─── /lol-gameflow ────────────────────────────────────────────────────────

export type GameflowPhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'CheckedIntoTournament'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'FailedToLaunch'
  | 'InProgress'
  | 'Reconnect'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'EndOfGame'
  | 'TerminatedInError'

// ─── /lol-lobby & /lol-matchmaking ────────────────────────────────────────

export interface LobbyMember {
  summonerId: number
  summonerName: string
  puuid: string
  isLeader: boolean
  isBot: boolean
}

export interface Lobby {
  partyId: string
  canStartActivity: boolean
  gameConfig: {
    queueId: number
    mapId: number
    gameMode: string
    maxLobbySize: number
    isCustom: boolean
    showPositionSelector: boolean
  }
  members: LobbyMember[]
  localMember: LobbyMember | null
}

export type MatchmakingSearchState =
  | 'Invalid'
  | 'Searching'
  | 'Found'
  | 'Error'
  | 'AbandonedLowPriority'
  | 'ServiceShutdown'
  | 'ServiceError'

export interface MatchmakingSearch {
  searchState: MatchmakingSearchState
  timeInQueue: number
  estimatedQueueTime: number
  isCurrentlyInQueue: boolean
  readyCheck?: ReadyCheck
  errors?: { id: number; errorType: string; message: string; penaltyTimeRemaining: number }[]
}

export interface GameQueue {
  id: number
  name: string
  shortName: string
  description: string
  category: string
  gameMode: string
  isRanked: boolean
  mapId: number
  /** 'Available' | 'PlatformDisabled' | 'DoesntMeetRequirements' | … */
  queueAvailability: string
}

// ─── /lol-champ-select ────────────────────────────────────────────────────

export type ChampSelectActionType = 'ban' | 'pick' | 'ten_bans_reveal'

export interface ChampSelectAction {
  id: number
  actorCellId: number
  championId: number
  completed: boolean
  isAllyAction: boolean
  isInProgress: boolean
  pickTurn: number
  type: ChampSelectActionType
}

export interface ChampSelectCell {
  cellId: number
  championId: number
  championPickIntent: number
  summonerId: number
  puuid: string
  assignedPosition: string
  spell1Id: number
  spell2Id: number
  selectedSkinId: number
  nameVisibilityType: string
}

export interface ChampSelectBans {
  myTeamBans: number[]
  theirTeamBans: number[]
  numBans: number
}

export interface ChampSelectTimer {
  adjustedTimeLeftInPhase: number
  totalTimeInPhase: number
  phase: string
  isInfinite: boolean
}

export interface ChampSelectSession {
  actions: ChampSelectAction[][]
  myTeam: ChampSelectCell[]
  theirTeam: ChampSelectCell[]
  bans: ChampSelectBans
  timer: ChampSelectTimer
  localPlayerCellId: number
  isCustomGame: boolean
  benchEnabled: boolean
  benchChampions: { championId: number }[]
}

export interface GridChampion {
  id: number
  name: string
  disabled: boolean
  owned: boolean
}

export interface SummonerSpell {
  id: number
  name: string
  description: string
  gameModes: string[]
}

export interface RunePage {
  id: number
  name: string
  isEditable: boolean
  isDeletable: boolean
  isActive: boolean
  current: boolean
  primaryStyleId: number
  subStyleId: number
  selectedPerkIds: number[]
}

// ─── /lol-ranked ──────────────────────────────────────────────────────────

export interface RankedEntry {
  queueType: string
  tier: string
  division: string
  leaguePoints: number
  wins: number
  losses: number
}

export interface RankedStats {
  soloDuo: RankedEntry | null
  flex: RankedEntry | null
}

// ─── État de connexion exposé au renderer ─────────────────────────────────

export type ConnectionStatus = 'idle' | 'connecting' | 'connected'

export interface ConnectionInfo {
  status: ConnectionStatus
  summoner: CurrentSummoner | null
}
