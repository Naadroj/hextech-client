import type { LcuResponse } from './rest-client'
import type {
  CurrentSummoner,
  GameflowPhase,
  GameQueue,
  Lobby,
  MatchmakingSearch,
  RankedEntry,
  RankedStats,
  ReadyCheck,
} from '../../shared/lcu-types'

export type {
  CurrentSummoner,
  GameflowPhase,
  GameQueue,
  Lobby,
  LobbyMember,
  MatchmakingSearch,
  MatchmakingSearchState,
  RankedEntry,
  RankedStats,
  ReadyCheck,
  ReadyCheckStateName,
} from '../../shared/lcu-types'

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
  delete<T = unknown>(path: string): Promise<LcuResponse<T>>
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

export async function getCurrentSummoner(http: HttpLike): Promise<CurrentSummoner> {
  const res = await http.get<CurrentSummoner>('/lol-summoner/v1/current-summoner')
  if (!res.ok) throw new LcuError('/lol-summoner/v1/current-summoner', res.status, res.data)
  return res.data
}

// ─── /lol-matchmaking : ready-check ──────────────────────────────────────────

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

export async function getGameflowPhase(http: HttpLike): Promise<GameflowPhase> {
  const res = await http.get<GameflowPhase>('/lol-gameflow/v1/gameflow-phase')
  if (!res.ok) throw new LcuError('/lol-gameflow/v1/gameflow-phase', res.status, res.data)
  return res.data
}

// ─── /lol-ranked ────────────────────────────────────────────────────────────

interface RawRankedStats {
  queueMap?: Record<string, Partial<RankedEntry> | undefined>
}

function normalizeRankedEntry(raw: Partial<RankedEntry> | undefined): RankedEntry | null {
  if (!raw || !raw.tier) return null
  return {
    queueType: raw.queueType ?? '',
    tier: raw.tier,
    division: raw.division ?? '',
    leaguePoints: raw.leaguePoints ?? 0,
    wins: raw.wins ?? 0,
    losses: raw.losses ?? 0,
  }
}

/** Classement solo/duo + flex du joueur connecté. */
export async function getCurrentRankedStats(http: HttpLike): Promise<RankedStats> {
  const res = await http.get<RawRankedStats>('/lol-ranked/v1/current-ranked-stats')
  if (!res.ok) throw new LcuError('/lol-ranked/v1/current-ranked-stats', res.status, res.data)
  const queues = res.data.queueMap ?? {}
  return {
    soloDuo: normalizeRankedEntry(queues['RANKED_SOLO_5x5']),
    flex: normalizeRankedEntry(queues['RANKED_FLEX_SR']),
  }
}

// ─── /lol-game-queues ───────────────────────────────────────────────────────

type RawQueue = Partial<GameQueue> & { queueAvailability?: string }

/** Files de jeu PvP disponibles, normalisées pour le sélecteur de mode. */
export async function getGameQueues(http: HttpLike): Promise<GameQueue[]> {
  const res = await http.get<RawQueue[]>('/lol-game-queues/v1/queues')
  if (!res.ok || !Array.isArray(res.data)) return []
  return res.data
    .filter(
      (q): q is RawQueue =>
        !!q &&
        typeof q.id === 'number' &&
        q.category === 'PvP' &&
        q.queueAvailability === 'Available',
    )
    .map((q) => ({
      id: q.id as number,
      name: q.name ?? q.shortName ?? `File ${q.id}`,
      shortName: q.shortName ?? '',
      description: q.description ?? '',
      category: q.category ?? '',
      gameMode: q.gameMode ?? '',
      isRanked: Boolean(q.isRanked),
      mapId: q.mapId ?? 0,
    }))
}

// ─── /lol-lobby ─────────────────────────────────────────────────────────────

/** Lobby courant, ou `null` si le joueur n'est dans aucun lobby (HTTP 404). */
export async function getLobby(http: HttpLike): Promise<Lobby | null> {
  const res = await http.get<Lobby>('/lol-lobby/v2/lobby')
  if (res.status === 404) return null
  if (!res.ok) throw new LcuError('/lol-lobby/v2/lobby', res.status, res.data)
  return res.data
}

export async function createLobby(http: HttpLike, queueId: number): Promise<Lobby> {
  const res = await http.post<Lobby>('/lol-lobby/v2/lobby', { queueId })
  if (!res.ok) throw new LcuError('/lol-lobby/v2/lobby', res.status, res.data)
  return res.data
}

export async function leaveLobby(http: HttpLike): Promise<void> {
  const res = await http.delete('/lol-lobby/v2/lobby')
  if (!res.ok && res.status !== 404) {
    throw new LcuError('DELETE /lol-lobby/v2/lobby', res.status, res.data)
  }
}

export async function startMatchmaking(http: HttpLike): Promise<void> {
  const res = await http.post('/lol-lobby/v2/lobby/matchmaking/search', {})
  if (!res.ok) {
    throw new LcuError('/lol-lobby/v2/lobby/matchmaking/search', res.status, res.data)
  }
}

export async function stopMatchmaking(http: HttpLike): Promise<void> {
  const res = await http.delete('/lol-lobby/v2/lobby/matchmaking/search')
  if (!res.ok && res.status !== 404) {
    throw new LcuError('DELETE /lol-lobby/v2/lobby/matchmaking/search', res.status, res.data)
  }
}

// ─── /lol-matchmaking ───────────────────────────────────────────────────────

/** État de la recherche de partie, ou `null` hors file (HTTP 404). */
export async function getMatchmakingSearch(http: HttpLike): Promise<MatchmakingSearch | null> {
  const res = await http.get<MatchmakingSearch>('/lol-matchmaking/v1/search')
  if (res.status === 404) return null
  if (!res.ok) throw new LcuError('/lol-matchmaking/v1/search', res.status, res.data)
  return res.data
}

// ─── /lol-champion-mastery ──────────────────────────────────────────────────

interface MasteryEntry {
  championId?: number
  championPoints?: number
}

/** championId du champion le plus maîtrisé, ou `null`. */
export async function getTopMasteryChampionId(http: HttpLike): Promise<number | null> {
  const res = await http.get<MasteryEntry[]>(
    '/lol-champion-mastery/v1/local-player/champion-mastery',
  )
  if (!res.ok || !Array.isArray(res.data) || res.data.length === 0) return null
  let best: MasteryEntry | undefined
  for (const entry of res.data) {
    if (typeof entry?.championId !== 'number') continue
    if (!best || (entry.championPoints ?? 0) > (best.championPoints ?? 0)) best = entry
  }
  return best?.championId ?? null
}
