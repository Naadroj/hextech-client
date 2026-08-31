import { describe, it, expect, vi } from 'vitest'
import type { LcuResponse } from './rest-client'
import {
  getCurrentSummoner,
  getReadyCheck,
  acceptReadyCheck,
  declineReadyCheck,
  getGameflowPhase,
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
function http(get: ReturnType<typeof vi.fn>, post: ReturnType<typeof vi.fn> = vi.fn()): HttpLike {
  return { get, post } as unknown as HttpLike
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

describe('LcuError', () => {
  it('porte endpoint, status et body', () => {
    const err = new LcuError('/x', 503, { e: 1 })
    expect(err.endpoint).toBe('/x')
    expect(err.status).toBe(503)
    expect(err.body).toEqual({ e: 1 })
    expect(err.message).toContain('503')
  })
})
