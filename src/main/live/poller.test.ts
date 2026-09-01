import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LiveClientPoller, isLiveGameData } from './poller'
import type { LiveGameData, LiveSnapshot } from '../../shared/live-types'
import type { LiveHttpClient, LiveResponse } from './rest-client'

const VALID_DATA = {
  activePlayer: { summonerName: 'me', currentGold: 500, level: 3 },
  allPlayers: [],
  events: { Events: [] },
  gameData: {
    gameMode: 'CLASSIC',
    gameTime: 60,
    mapName: 'Map11',
    mapNumber: 11,
    mapTerrain: 'Default',
  },
} as unknown as LiveGameData

type Step = 'ok' | 'bad' | 'throw'

function makeClient(script: Step[]) {
  let i = 0
  const get = vi.fn(async (_path: string): Promise<LiveResponse> => {
    const step = script[Math.min(i, script.length - 1)] ?? 'throw'
    i += 1
    if (step === 'throw') throw new Error('ECONNREFUSED 127.0.0.1:2999')
    if (step === 'bad') return { status: 404, ok: false, data: '<html>not ready</html>' }
    return { status: 200, ok: true, data: VALID_DATA }
  })
  const client = { origin: 'https://127.0.0.1:2999', get } as unknown as LiveHttpClient & {
    get: typeof get
  }
  return client
}

interface Recorder {
  statuses: string[]
  starts: number
  ends: number
  snapshots: LiveSnapshot[]
  errors: unknown[]
}

function record(poller: LiveClientPoller): Recorder {
  const r: Recorder = { statuses: [], starts: 0, ends: 0, snapshots: [], errors: [] }
  poller.on('status', (s: string) => r.statuses.push(s))
  poller.on('game-start', () => (r.starts += 1))
  poller.on('game-end', () => (r.ends += 1))
  poller.on('snapshot', (s: LiveSnapshot) => r.snapshots.push(s))
  poller.on('poll-error', (e: unknown) => r.errors.push(e))
  return r
}

const OPTS = { idleIntervalMs: 100, activeIntervalMs: 50, endThreshold: 3 } as const

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('isLiveGameData', () => {
  it('accepte une réponse plausible et rejette le reste', () => {
    expect(isLiveGameData(VALID_DATA)).toBe(true)
    expect(isLiveGameData('<html>')).toBe(false)
    expect(isLiveGameData(null)).toBe(false)
    expect(isLiveGameData({ allPlayers: [] })).toBe(false)
  })
})

describe('LiveClientPoller', () => {
  it('passe idle → active au premier succès et émet game-start + snapshot', async () => {
    const client = makeClient(['ok'])
    const poller = new LiveClientPoller({ client, ...OPTS, now: () => 1234 })
    const r = record(poller)

    poller.start()
    await vi.advanceTimersByTimeAsync(1)

    expect(poller.currentStatus).toBe('active')
    expect(r.statuses).toEqual(['active'])
    expect(r.starts).toBe(1)
    expect(r.snapshots).toHaveLength(1)
    expect(r.snapshots[0]).toEqual({ receivedAt: 1234, data: VALID_DATA })
    expect(poller.snapshot).toEqual({ receivedAt: 1234, data: VALID_DATA })

    poller.stop()
  })

  it('émet un snapshot par tick à la cadence active', async () => {
    const poller = new LiveClientPoller({ client: makeClient(['ok']), ...OPTS })
    const r = record(poller)

    poller.start()
    await vi.advanceTimersByTimeAsync(1)
    expect(r.snapshots).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(50)
    expect(r.snapshots).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(50)
    expect(r.snapshots).toHaveLength(3)
    expect(r.starts).toBe(1) // game-start une seule fois

    poller.stop()
  })

  it('reste idle sur une réponse non-OK et n’émet pas game-start', async () => {
    const poller = new LiveClientPoller({ client: makeClient(['bad']), ...OPTS })
    const r = record(poller)

    poller.start()
    await vi.advanceTimersByTimeAsync(1)
    await vi.advanceTimersByTimeAsync(200)

    expect(poller.currentStatus).toBe('idle')
    expect(r.starts).toBe(0)
    expect(r.snapshots).toHaveLength(0)

    poller.stop()
  })

  it('termine la partie après endThreshold échecs consécutifs', async () => {
    const client = makeClient(['ok', 'throw', 'throw', 'throw'])
    const poller = new LiveClientPoller({ client, ...OPTS })
    const r = record(poller)

    poller.start()
    await vi.advanceTimersByTimeAsync(1)
    expect(poller.currentStatus).toBe('active')

    await vi.advanceTimersByTimeAsync(50) // échec 1
    expect(poller.currentStatus).toBe('active')
    await vi.advanceTimersByTimeAsync(50) // échec 2
    expect(poller.currentStatus).toBe('active')
    await vi.advanceTimersByTimeAsync(50) // échec 3 → fin

    expect(poller.currentStatus).toBe('idle')
    expect(r.ends).toBe(1)
    expect(r.statuses).toEqual(['active', 'idle'])
    expect(r.errors.length).toBeGreaterThanOrEqual(3)
    expect(poller.snapshot).toBeNull()

    poller.stop()
  })

  it('un échec isolé ne termine pas la partie (compteur remis à zéro par un succès)', async () => {
    const client = makeClient(['ok', 'throw', 'ok', 'throw', 'ok', 'throw'])
    const poller = new LiveClientPoller({ client, ...OPTS })
    const r = record(poller)

    poller.start()
    await vi.advanceTimersByTimeAsync(1)
    await vi.advanceTimersByTimeAsync(300)

    expect(poller.currentStatus).toBe('active')
    expect(r.ends).toBe(0)

    poller.stop()
  })

  it('émet poll-error sans planter et ne devient pas active si tout échoue', async () => {
    const poller = new LiveClientPoller({ client: makeClient(['throw']), ...OPTS })
    const r = record(poller)

    poller.start()
    await vi.advanceTimersByTimeAsync(1)
    await vi.advanceTimersByTimeAsync(100)

    expect(poller.currentStatus).toBe('idle')
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.starts).toBe(0)

    poller.stop()
  })

  it('stop() arrête toute sonde ultérieure', async () => {
    const client = makeClient(['ok'])
    const poller = new LiveClientPoller({ client, ...OPTS })
    record(poller)

    poller.start()
    await vi.advanceTimersByTimeAsync(1)
    const callsAtStop = client.get.mock.calls.length
    poller.stop()

    await vi.advanceTimersByTimeAsync(1000)
    expect(client.get.mock.calls.length).toBe(callsAtStop)
    expect(poller.currentStatus).toBe('idle')
  })

  it('start() est idempotent (pas de double boucle)', async () => {
    const client = makeClient(['ok'])
    const poller = new LiveClientPoller({ client, ...OPTS })
    record(poller)

    poller.start()
    poller.start()
    await vi.advanceTimersByTimeAsync(1)

    expect(client.get.mock.calls.length).toBe(1)

    poller.stop()
  })
})
