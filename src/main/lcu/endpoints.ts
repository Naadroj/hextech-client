import type { LcuResponse } from './rest-client'
import type {
  ChampSelectSession,
  CurrentSummoner,
  GameflowPhase,
  GameQueue,
  GridChampion,
  Lobby,
  MatchmakingSearch,
  RankedEntry,
  RankedStats,
  ReadyCheck,
  RunePage,
  SummonerSpell,
} from '../../shared/lcu-types'

export type {
  ChampSelectAction,
  ChampSelectCell,
  ChampSelectSession,
  CurrentSummoner,
  GameflowPhase,
  GameQueue,
  GridChampion,
  Lobby,
  LobbyMember,
  MatchmakingSearch,
  MatchmakingSearchState,
  RankedEntry,
  RankedStats,
  ReadyCheck,
  ReadyCheckStateName,
  RunePage,
  SummonerSpell,
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
  patch<T = unknown>(path: string, body?: unknown): Promise<LcuResponse<T>>
  put<T = unknown>(path: string, body?: unknown): Promise<LcuResponse<T>>
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

type RawQueue = Partial<GameQueue>

const SELECTABLE_CATEGORIES = new Set(['PvP', 'VersusAi'])

/**
 * Files de jeu jouables (PvP + Coop vs IA), normalisées pour le sélecteur de
 * mode. Les files indisponibles sont conservées (avec `queueAvailability`)
 * pour être affichées grisées.
 */
export async function getGameQueues(http: HttpLike): Promise<GameQueue[]> {
  const res = await http.get<RawQueue[]>('/lol-game-queues/v1/queues')
  if (!res.ok || !Array.isArray(res.data)) return []
  return res.data
    .filter(
      (q): q is RawQueue =>
        !!q && typeof q.id === 'number' && SELECTABLE_CATEGORIES.has(q.category ?? ''),
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
      queueAvailability: q.queueAvailability ?? 'Available',
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

function customLobbyBody(gameMode: 'PRACTICETOOL' | 'CLASSIC', lobbyName: string) {
  return {
    isCustom: true,
    customGameLobby: {
      lobbyName,
      lobbyPassword: '',
      configuration: {
        gameMode,
        gameMutator: '',
        gameServerRegion: '',
        mapId: 11,
        mutators: { id: 1 },
        spectatorPolicy: 'AllAllowed',
        teamSize: 5,
      },
    },
  }
}

/** Crée un lobby « Outil d'entraînement » (Practice Tool). */
export async function createPracticeToolLobby(http: HttpLike): Promise<Lobby> {
  const res = await http.post<Lobby>(
    '/lol-lobby/v2/lobby',
    customLobbyBody('PRACTICETOOL', "Outil d'entraînement"),
  )
  if (!res.ok) throw new LcuError('/lol-lobby/v2/lobby (practice)', res.status, res.data)
  return res.data
}

/** Crée un lobby de partie personnalisée (Faille de l'invocateur). */
export async function createCustomLobby(http: HttpLike): Promise<Lobby> {
  const res = await http.post<Lobby>(
    '/lol-lobby/v2/lobby',
    customLobbyBody('CLASSIC', 'Partie personnalisée'),
  )
  if (!res.ok) throw new LcuError('/lol-lobby/v2/lobby (custom)', res.status, res.data)
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

// ─── /lol-champ-select ─────────────────────────────────────────────────────

/** Session de sélection des champions, ou `null` hors phase (HTTP 404). */
export async function getChampSelectSession(http: HttpLike): Promise<ChampSelectSession | null> {
  const res = await http.get<ChampSelectSession>('/lol-champ-select/v1/session')
  if (res.status === 404) return null
  if (!res.ok) throw new LcuError('/lol-champ-select/v1/session', res.status, res.data)
  return res.data
}

async function championIdList(http: HttpLike, path: string): Promise<number[]> {
  const res = await http.get<number[]>(path)
  return res.ok && Array.isArray(res.data) ? res.data : []
}

export function getPickableChampionIds(http: HttpLike): Promise<number[]> {
  return championIdList(http, '/lol-champ-select/v1/pickable-champion-ids')
}

export function getBannableChampionIds(http: HttpLike): Promise<number[]> {
  return championIdList(http, '/lol-champ-select/v1/bannable-champion-ids')
}

interface RawGridChampion extends Partial<GridChampion> {
  selectionStatus?: { banned?: boolean; pickedByOtherOrBanned?: boolean }
}

/** Champions de la grille de sélection (nom, disponibilité). */
export async function getGridChampions(http: HttpLike): Promise<GridChampion[]> {
  const res = await http.get<RawGridChampion[]>('/lol-champ-select/v1/all-grid-champions')
  if (!res.ok || !Array.isArray(res.data)) return []
  return res.data
    .filter((c): c is RawGridChampion => typeof c?.id === 'number' && c.id > 0)
    .map((c) => ({
      id: c.id as number,
      name: c.name ?? `Champion ${c.id}`,
      disabled: Boolean(c.disabled),
      owned: Boolean(c.owned),
    }))
}

/** Survole un champion (aperçu, non verrouillé). */
export async function hoverChampion(
  http: HttpLike,
  actionId: number,
  championId: number,
): Promise<void> {
  const res = await http.patch(`/lol-champ-select/v1/session/actions/${actionId}`, {
    championId,
    completed: false,
  })
  if (!res.ok) {
    throw new LcuError(`/lol-champ-select/v1/session/actions/${actionId}`, res.status, res.data)
  }
}

/** Verrouille le champion survolé (pick ou ban définitif). */
export async function lockChampion(
  http: HttpLike,
  actionId: number,
  championId: number,
): Promise<void> {
  const res = await http.patch(`/lol-champ-select/v1/session/actions/${actionId}`, {
    championId,
    completed: true,
  })
  if (!res.ok) {
    throw new LcuError(
      `/lol-champ-select/v1/session/actions/${actionId} (lock)`,
      res.status,
      res.data,
    )
  }
}

/** Change les deux sorts d'invocateur du joueur local. */
export async function setSummonerSpells(
  http: HttpLike,
  spell1Id: number,
  spell2Id: number,
): Promise<void> {
  const res = await http.patch('/lol-champ-select/v1/session/my-selection', { spell1Id, spell2Id })
  if (!res.ok) {
    throw new LcuError('/lol-champ-select/v1/session/my-selection', res.status, res.data)
  }
}

// ─── /lol-game-data & /lol-perks (données pour champ select) ────────────────

interface RawSpell extends Partial<SummonerSpell> {
  gameModes?: string[]
}

export async function getSummonerSpells(http: HttpLike): Promise<SummonerSpell[]> {
  const res = await http.get<RawSpell[]>('/lol-game-data/v1/summoner-spells.json')
  if (!res.ok || !Array.isArray(res.data)) return []
  return res.data
    .filter((s): s is RawSpell => typeof s?.id === 'number' && s.id > 0)
    .map((s) => ({
      id: s.id as number,
      name: s.name ?? `Sort ${s.id}`,
      description: s.description ?? '',
      gameModes: Array.isArray(s.gameModes) ? s.gameModes : [],
    }))
}

export async function getRunePages(http: HttpLike): Promise<RunePage[]> {
  const res = await http.get<Partial<RunePage>[]>('/lol-perks/v1/pages')
  if (!res.ok || !Array.isArray(res.data)) return []
  return res.data
    .filter((p): p is Partial<RunePage> => typeof p?.id === 'number')
    .map((p) => ({
      id: p.id as number,
      name: p.name ?? 'Page',
      isEditable: Boolean(p.isEditable),
      isDeletable: Boolean(p.isDeletable),
      isActive: Boolean(p.isActive),
      current: Boolean(p.current),
      primaryStyleId: p.primaryStyleId ?? 0,
      subStyleId: p.subStyleId ?? 0,
      selectedPerkIds: Array.isArray(p.selectedPerkIds) ? p.selectedPerkIds : [],
    }))
}

/** Active une page de runes existante (par identifiant). */
export async function setCurrentRunePage(http: HttpLike, pageId: number): Promise<void> {
  const res = await http.put('/lol-perks/v1/currentpage', pageId)
  if (!res.ok) throw new LcuError('/lol-perks/v1/currentpage', res.status, res.data)
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
