import type { LcuResponse } from './rest-client'

/**
 * Wrappers typés autour des endpoints LCU utilisés par l'application.
 * Chaque fonction prend un client minimal `HttpLike` (testable sans réseau).
 *
 * ⚠️ Les actions (`accept`, `decline`, …) ne doivent être appelées qu'en
 * réponse à un clic explicite de l'utilisateur.
 */

export interface HttpLike {
  get<T = unknown>(path: string): Promise<LcuResponse<T>>
  post<T = unknown>(path: string, body?: unknown): Promise<LcuResponse<T>>
}

export class LcuError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`LCU ${endpoint} → HTTP ${status}`)
    this.name = 'LcuError'
  }
}

// ─── /lol-summoner ───────────────────────────────────────────────────────────

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

export async function getCurrentSummoner(http: HttpLike): Promise<CurrentSummoner> {
  const res = await http.get<CurrentSummoner>('/lol-summoner/v1/current-summoner')
  if (!res.ok) throw new LcuError('/lol-summoner/v1/current-summoner', res.status, res.data)
  return res.data
}

// ─── /lol-matchmaking : ready-check ──────────────────────────────────────────

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

/** Retourne `null` quand aucun ready-check n'est en cours (HTTP 404). */
export async function getReadyCheck(http: HttpLike): Promise<ReadyCheck | null> {
  const res = await http.get<ReadyCheck>('/lol-matchmaking/v1/ready-check')
  if (res.status === 404) return null
  if (!res.ok) throw new LcuError('/lol-matchmaking/v1/ready-check', res.status, res.data)
  return res.data
}

export async function acceptReadyCheck(http: HttpLike): Promise<void> {
  const res = await http.post('/lol-matchmaking/v1/ready-check/accept', {})
  // 204 attendu ; 404 = le ready-check a déjà expiré → non bloquant.
  if (!res.ok && res.status !== 404) {
    throw new LcuError('/lol-matchmaking/v1/ready-check/accept', res.status, res.data)
  }
}

export async function declineReadyCheck(http: HttpLike): Promise<void> {
  const res = await http.post('/lol-matchmaking/v1/ready-check/decline', {})
  if (!res.ok && res.status !== 404) {
    throw new LcuError('/lol-matchmaking/v1/ready-check/decline', res.status, res.data)
  }
}

// ─── /lol-gameflow ──────────────────────────────────────────────────────────

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

export async function getGameflowPhase(http: HttpLike): Promise<GameflowPhase> {
  const res = await http.get<GameflowPhase>('/lol-gameflow/v1/gameflow-phase')
  if (!res.ok) throw new LcuError('/lol-gameflow/v1/gameflow-phase', res.status, res.data)
  return res.data
}
