import { describe, it, expect, vi } from 'vitest'
import type { LcuResponse } from './rest-client'
import {
  getCurrentSummoner,
  getReadyCheck,
  acceptReadyCheck,
  declineReadyCheck,
  getGameflowPhase,
  getCurrentRankedStats,
  getGameQueues,
  getLobby,
  createLobby,
  leaveLobby,
  startMatchmaking,
  stopMatchmaking,
  getMatchmakingSearch,
  getTopMasteryChampionId,
  createPracticeToolLobby,
  createCustomLobby,
  getChampSelectSession,
  getGridChampions,
  getPickableChampionIds,
  getBannableChampionIds,
  hoverChampion,
  lockChampion,
  setSummonerSpells,
  getSummonerSpells,
  getRunePages,
  setCurrentRunePage,
  LcuError,
  type HttpLike,
} from './endpoints'

function ok<T>(data: T, status = 200): LcuResponse<T> {
  return { status, ok: status >= 200 && status < 300, data }
}
function fail(status: number, data: unknown = null): LcuResponse<unknown> {
  return { status, ok: false, data }
}

/** Construit un HttpLike à partir de mocks locaux (castés pour éviter la
 *  friction sur la signature générique). */
function http(
  get: ReturnType<typeof vi.fn> = vi.fn(),
  post: ReturnType<typeof vi.fn> = vi.fn(),
  del: ReturnType<typeof vi.fn> = vi.fn(),
  patch: ReturnType<typeof vi.fn> = vi.fn(),
  put: ReturnType<typeof vi.fn> = vi.fn(),
): HttpLike {
  return { get, post, delete: del, patch, put } as unknown as HttpLike
}

describe('getCurrentSummoner', () => {
  it('retourne les données sur 200', async () => {
    const get = vi.fn(async () => ok({ summonerId: 42, displayName: 'Ashe' }))
    const summoner = await getCurrentSummoner(http(get))
    expect(summoner.summonerId).toBe(42)
    expect(get).toHaveBeenCalledWith('/lol-summoner/v1/current-summoner')
  })

  it('lève LcuError sur un statut non-ok', async () => {
    await expect(getCurrentSummoner(http(vi.fn(async () => fail(401))))).rejects.toBeInstanceOf(
      LcuError,
    )
  })
})

describe('getReadyCheck', () => {
  it('retourne null sur 404', async () => {
    expect(await getReadyCheck(http(vi.fn(async () => fail(404))))).toBeNull()
  })

  it('retourne l’état sur 200', async () => {
    const get = vi.fn(async () => ok({ state: 'InProgress', playerResponse: 'None', timer: 8 }))
    expect((await getReadyCheck(http(get)))?.state).toBe('InProgress')
  })

  it('lève LcuError sur 500', async () => {
    await expect(getReadyCheck(http(vi.fn(async () => fail(500))))).rejects.toBeInstanceOf(LcuError)
  })
})

describe('acceptReadyCheck / declineReadyCheck', () => {
  it('POST accept sur le bon endpoint', async () => {
    const post = vi.fn(async () => ok(null, 204))
    await acceptReadyCheck(http(vi.fn(), post))
    expect(post).toHaveBeenCalledWith('/lol-matchmaking/v1/ready-check/accept', {})
  })

  it('POST decline sur le bon endpoint', async () => {
    const post = vi.fn(async () => ok(null, 204))
    await declineReadyCheck(http(vi.fn(), post))
    expect(post).toHaveBeenCalledWith('/lol-matchmaking/v1/ready-check/decline', {})
  })

  it('tolère un 404 (ready-check déjà expiré)', async () => {
    await expect(acceptReadyCheck(http(vi.fn(), vi.fn(async () => fail(404))))).resolves.toBeUndefined()
  })

  it('lève LcuError sur un vrai échec', async () => {
    await expect(
      acceptReadyCheck(http(vi.fn(), vi.fn(async () => fail(500)))),
    ).rejects.toBeInstanceOf(LcuError)
  })
})

describe('getGameflowPhase', () => {
  it('retourne la phase courante', async () => {
    expect(await getGameflowPhase(http(vi.fn(async () => ok('ChampSelect'))))).toBe('ChampSelect')
  })
})

describe('getCurrentRankedStats', () => {
  it('normalise solo/duo et flex depuis queueMap', async () => {
    const get = vi.fn(async () =>
      ok({
        queueMap: {
          RANKED_SOLO_5x5: { tier: 'PLATINUM', division: 'IV', leaguePoints: 12, wins: 30, losses: 25 },
          RANKED_FLEX_SR: { tier: '', division: 'NA', leaguePoints: 0, wins: 0, losses: 0 },
        },
      }),
    )
    const stats = await getCurrentRankedStats(http(get))
    expect(stats.soloDuo).toEqual({
      queueType: '',
      tier: 'PLATINUM',
      division: 'IV',
      leaguePoints: 12,
      wins: 30,
      losses: 25,
    })
    // tier vide → non classé
    expect(stats.flex).toBeNull()
  })

  it('retourne { null, null } si queueMap est absent', async () => {
    const stats = await getCurrentRankedStats(http(vi.fn(async () => ok({}))))
    expect(stats).toEqual({ soloDuo: null, flex: null })
  })

  it('lève LcuError sur un statut non-ok', async () => {
    await expect(getCurrentRankedStats(http(vi.fn(async () => fail(500))))).rejects.toBeInstanceOf(
      LcuError,
    )
  })
})

describe('getGameQueues', () => {
  it('garde PvP + VersusAi (dispo ou non) et normalise', async () => {
    const get = vi.fn(async () =>
      ok([
        {
          id: 420,
          name: 'Ranked Solo/Duo',
          shortName: 'Ranked',
          description: 'd',
          category: 'PvP',
          gameMode: 'CLASSIC',
          isRanked: true,
          mapId: 11,
          queueAvailability: 'Available',
        },
        { id: 870, name: 'Coop', category: 'VersusAi', gameMode: 'CLASSIC', mapId: 11 },
        { id: 9999, name: 'Old', category: 'PvP', queueAvailability: 'PlatformDisabled' },
        { id: 0, name: 'Custom', category: 'Custom', queueAvailability: 'Available' },
        null,
      ]),
    )
    const queues = await getGameQueues(http(get))
    expect(queues.map((q) => q.id).sort((a, b) => a - b)).toEqual([420, 870, 9999])
    expect(queues.find((q) => q.id === 9999)?.queueAvailability).toBe('PlatformDisabled')
    // queueAvailability manquant -> 'Available' par défaut
    expect(queues.find((q) => q.id === 870)?.queueAvailability).toBe('Available')
  })

  it('retourne [] si la réponse est inattendue', async () => {
    expect(await getGameQueues(http(vi.fn(async () => ok({ nope: true }))))).toEqual([])
    expect(await getGameQueues(http(vi.fn(async () => fail(500))))).toEqual([])
  })
})

describe('createPracticeToolLobby / createCustomLobby', () => {
  it('POSTe un lobby personnalisé PRACTICETOOL', async () => {
    const post = vi.fn(async () => ok({ partyId: 'p' }))
    await createPracticeToolLobby(http(vi.fn(), post))
    expect(post).toHaveBeenCalledWith(
      '/lol-lobby/v2/lobby',
      expect.objectContaining({
        isCustom: true,
        customGameLobby: expect.objectContaining({
          configuration: expect.objectContaining({ gameMode: 'PRACTICETOOL', mapId: 11 }),
        }),
      }),
    )
  })

  it('POSTe un lobby personnalisé CLASSIC', async () => {
    const post = vi.fn(async () => ok({ partyId: 'p' }))
    await createCustomLobby(http(vi.fn(), post))
    expect(post).toHaveBeenCalledWith(
      '/lol-lobby/v2/lobby',
      expect.objectContaining({
        customGameLobby: expect.objectContaining({
          configuration: expect.objectContaining({ gameMode: 'CLASSIC' }),
        }),
      }),
    )
  })

  it('lève LcuError sur échec', async () => {
    await expect(
      createPracticeToolLobby(http(vi.fn(), vi.fn(async () => fail(500)))),
    ).rejects.toBeInstanceOf(LcuError)
  })

  it('quitte le lobby courant + réveille le sous-système avant de créer', async () => {
    const order: string[] = []
    const del = vi.fn(async () => {
      order.push('delete')
      return ok(null, 204)
    })
    const get = vi.fn(async () => {
      order.push('get')
      return ok([])
    })
    const post = vi.fn(async () => {
      order.push('post')
      return ok({ partyId: 'p' })
    })
    await createCustomLobby(http(get, post, del))
    expect(del).toHaveBeenCalledWith('/lol-lobby/v2/lobby')
    expect(get).toHaveBeenCalledWith('/lol-lobby/v2/lobby/custom/available-bots')
    expect(order).toEqual(['delete', 'get', 'post'])
  })

  it('retente une fois après un échec (cycle lobby jetable)', async () => {
    let customPosts = 0
    const post = vi.fn(async (_path: string, body?: unknown) => {
      if (body && typeof body === 'object' && 'queueId' in body) return ok(null) // lobby jetable
      customPosts += 1
      return customPosts === 1 ? fail(500, { message: 'INVALID_LOBBY' }) : ok({ partyId: 'ok' })
    })
    const lobby = await createPracticeToolLobby(http(vi.fn(), post))
    expect(lobby).toMatchObject({ partyId: 'ok' })
    expect(customPosts).toBe(2)
  })
})

describe('lobby & matchmaking', () => {
  it('getLobby renvoie null sur 404, les données sur 200', async () => {
    expect(await getLobby(http(vi.fn(async () => fail(404))))).toBeNull()
    const get = vi.fn(async () => ok({ partyId: 'p1', gameConfig: { queueId: 430 } }))
    expect((await getLobby(http(get)))?.partyId).toBe('p1')
  })

  it('createLobby POSTe { queueId } et renvoie le lobby', async () => {
    const post = vi.fn(async () => ok({ partyId: 'p2', gameConfig: { queueId: 450 } }))
    const lobby = await createLobby(http(vi.fn(), post), 450)
    expect(post).toHaveBeenCalledWith('/lol-lobby/v2/lobby', { queueId: 450 })
    expect(lobby.partyId).toBe('p2')
  })

  it('createLobby lève LcuError sur échec', async () => {
    await expect(
      createLobby(http(vi.fn(), vi.fn(async () => fail(400, { message: 'busy' }))), 450),
    ).rejects.toBeInstanceOf(LcuError)
  })

  it('leaveLobby DELETE, tolère un 404', async () => {
    const del = vi.fn(async () => ok(null, 204))
    await leaveLobby(http(vi.fn(), vi.fn(), del))
    expect(del).toHaveBeenCalledWith('/lol-lobby/v2/lobby')
    await expect(leaveLobby(http(vi.fn(), vi.fn(), vi.fn(async () => fail(404))))).resolves.toBeUndefined()
  })

  it('startMatchmaking POSTe la recherche et propage l’erreur', async () => {
    const post = vi.fn(async () => ok(null, 204))
    await startMatchmaking(http(vi.fn(), post))
    expect(post).toHaveBeenCalledWith('/lol-lobby/v2/lobby/matchmaking/search', {})
    await expect(
      startMatchmaking(http(vi.fn(), vi.fn(async () => fail(400, { message: 'not leader' })))),
    ).rejects.toBeInstanceOf(LcuError)
  })

  it('stopMatchmaking DELETE, tolère un 404', async () => {
    const del = vi.fn(async () => ok(null, 204))
    await stopMatchmaking(http(vi.fn(), vi.fn(), del))
    expect(del).toHaveBeenCalledWith('/lol-lobby/v2/lobby/matchmaking/search')
    await expect(
      stopMatchmaking(http(vi.fn(), vi.fn(), vi.fn(async () => fail(404)))),
    ).resolves.toBeUndefined()
  })

  it('getMatchmakingSearch renvoie null sur 404', async () => {
    expect(await getMatchmakingSearch(http(vi.fn(async () => fail(404))))).toBeNull()
    const get = vi.fn(async () => ok({ searchState: 'Searching', timeInQueue: 12 }))
    expect((await getMatchmakingSearch(http(get)))?.searchState).toBe('Searching')
  })
})

describe('champ-select : lecture', () => {
  it('getChampSelectSession renvoie null sur 404', async () => {
    expect(await getChampSelectSession(http(vi.fn(async () => fail(404))))).toBeNull()
    const get = vi.fn(async () => ok({ localPlayerCellId: 3, actions: [] }))
    expect((await getChampSelectSession(http(get)))?.localPlayerCellId).toBe(3)
  })

  it('getGridChampions normalise et filtre les ids invalides', async () => {
    const get = vi.fn(async () =>
      ok([
        { id: 103, name: 'Ahri', disabled: false, owned: true },
        { id: 0, name: 'None' },
        { name: 'NoId' },
      ]),
    )
    const grid = await getGridChampions(http(get))
    expect(grid).toEqual([{ id: 103, name: 'Ahri', disabled: false, owned: true }])
  })

  it('getPickable/BannableChampionIds tolèrent une réponse vide', async () => {
    expect(await getPickableChampionIds(http(vi.fn(async () => ok([1, 2, 3]))))).toEqual([1, 2, 3])
    expect(await getBannableChampionIds(http(vi.fn(async () => fail(404))))).toEqual([])
  })

  it('getSummonerSpells et getRunePages normalisent', async () => {
    const spells = await getSummonerSpells(
      http(vi.fn(async () => ok([{ id: 4, name: 'Flash', gameModes: ['CLASSIC'] }, { id: 0 }]))),
    )
    expect(spells).toEqual([{ id: 4, name: 'Flash', description: '', gameModes: ['CLASSIC'] }])

    const pages = await getRunePages(
      http(vi.fn(async () => ok([{ id: 7, name: 'Domination', current: true, selectedPerkIds: [1, 2] }]))),
    )
    expect(pages[0]).toMatchObject({ id: 7, name: 'Domination', current: true, selectedPerkIds: [1, 2] })
  })
})

describe('champ-select : actions', () => {
  it('hoverChampion PATCH { championId, completed:false }', async () => {
    const patch = vi.fn(async () => ok(null, 204))
    await hoverChampion(http(vi.fn(), vi.fn(), vi.fn(), patch), 21, 103)
    expect(patch).toHaveBeenCalledWith('/lol-champ-select/v1/session/actions/21', {
      championId: 103,
      completed: false,
    })
  })

  it('lockChampion PATCH { championId, completed:true } et propage l’erreur', async () => {
    const patch = vi.fn(async () => ok(null, 204))
    await lockChampion(http(vi.fn(), vi.fn(), vi.fn(), patch), 21, 103)
    expect(patch).toHaveBeenCalledWith('/lol-champ-select/v1/session/actions/21', {
      championId: 103,
      completed: true,
    })
    await expect(
      lockChampion(http(vi.fn(), vi.fn(), vi.fn(), vi.fn(async () => fail(409))), 21, 103),
    ).rejects.toBeInstanceOf(LcuError)
  })

  it('setSummonerSpells PATCH my-selection', async () => {
    const patch = vi.fn(async () => ok(null, 204))
    await setSummonerSpells(http(vi.fn(), vi.fn(), vi.fn(), patch), 4, 14)
    expect(patch).toHaveBeenCalledWith('/lol-champ-select/v1/session/my-selection', {
      spell1Id: 4,
      spell2Id: 14,
    })
  })

  it('setCurrentRunePage PUT currentpage avec l’id brut', async () => {
    const put = vi.fn(async () => ok(null, 204))
    await setCurrentRunePage(http(vi.fn(), vi.fn(), vi.fn(), vi.fn(), put), 42)
    expect(put).toHaveBeenCalledWith('/lol-perks/v1/currentpage', 42)
  })
})

describe('getTopMasteryChampionId', () => {
  it('retourne le championId avec le plus de points', async () => {
    const get = vi.fn(async () =>
      ok([
        { championId: 1, championPoints: 5000 },
        { championId: 103, championPoints: 91000 },
        { championId: 64, championPoints: 42000 },
      ]),
    )
    expect(await getTopMasteryChampionId(http(get))).toBe(103)
  })

  it('retourne null si vide ou en erreur', async () => {
    expect(await getTopMasteryChampionId(http(vi.fn(async () => ok([]))))).toBeNull()
    expect(await getTopMasteryChampionId(http(vi.fn(async () => fail(500))))).toBeNull()
  })
})

describe('LcuError', () => {
  it('porte endpoint, status et body', () => {
    const err = new LcuError('/x', 503, { e: 1 })
    expect(err.endpoint).toBe('/x')
    expect(err.status).toBe(503)
    expect(err.body).toEqual({ e: 1 })
    expect(err.message).toContain('503')
  })
})
