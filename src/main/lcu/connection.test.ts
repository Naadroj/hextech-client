import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { LcuConnection, type LcuConnectionDeps } from './connection'
import type { LcuCredentials } from './credentials'
import type { LcuRestClient } from './rest-client'

const CREDS: LcuCredentials = {
  port: 52001,
  token: 'super-secret',
  protocol: 'https',
  source: 'lockfile',
}

class FakeWatcher extends EventEmitter {
  start = vi.fn()
  stop = vi.fn()
}

class FakeWs extends EventEmitter {
  connect = vi.fn()
  disconnect = vi.fn()
}

function restClientOk(summoner: unknown): LcuRestClient {
  return {
    origin: 'https://127.0.0.1:52001',
    request: vi.fn(),
    get: vi.fn(async () => ({ status: 200, ok: true, data: summoner })),
    post: vi.fn(async () => ({ status: 204, ok: true, data: null })),
    delete: vi.fn(),
  } as unknown as LcuRestClient
}

function restClientFail(): LcuRestClient {
  return {
    origin: '',
    request: vi.fn(),
    get: vi.fn(async () => ({ status: 503, ok: false, data: null })),
    post: vi.fn(),
    delete: vi.fn(),
  } as unknown as LcuRestClient
}

function setup(overrides: Partial<LcuConnectionDeps> = {}) {
  const watcher = new FakeWatcher()
  const ws = new FakeWs()
  const deps: LcuConnectionDeps = {
    watcher,
    getCredentials: vi.fn(async () => CREDS),
    createRestClient: vi.fn(() => restClientOk({ summonerId: 7, displayName: 'Lux' })),
    createWebSocket: vi.fn(() => ws),
    retryDelayMs: 5,
    maxAttempts: 5,
    ...overrides,
  }
  const conn = new LcuConnection(deps)
  return { conn, deps, watcher, ws }
}

describe('LcuConnection', () => {
  it('se connecte quand le watcher signale "started" et émet un payload sans token', async () => {
    const { conn, watcher, ws } = setup()
    const connected = vi.fn()
    conn.on('connected', connected)

    conn.start()
    watcher.emit('started')

    await vi.waitFor(() => expect(connected).toHaveBeenCalledOnce())
    const payload = connected.mock.calls[0][0]
    expect(payload.summoner).toEqual({ summonerId: 7, displayName: 'Lux' })
    expect(payload.credentials).toEqual({ port: 52001, protocol: 'https', source: 'lockfile' })
    expect(JSON.stringify(payload)).not.toContain('super-secret')
    expect(conn.state).toBe('connected')
    expect(ws.connect).toHaveBeenCalledOnce()
  })

  it('relaie les événements WebSocket via "lcu-event"', async () => {
    const { conn, watcher, ws } = setup()
    const onEvent = vi.fn()
    conn.on('lcu-event', onEvent)
    conn.start()
    watcher.emit('started')
    await vi.waitFor(() => expect(ws.connect).toHaveBeenCalled())

    ws.emit('event', { eventType: 'Update', uri: '/lol-gameflow/v1/gameflow-phase', data: 'Lobby' })
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ uri: '/lol-gameflow/v1/gameflow-phase' }),
    )
  })

  it('réessaie tant que getCredentials renvoie null', async () => {
    const getCredentials = vi
      .fn(async (): Promise<LcuCredentials | null> => null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(CREDS)
    const { conn, watcher } = setup({ getCredentials })
    const connected = vi.fn()
    conn.on('connected', connected)

    conn.start()
    watcher.emit('started')

    await vi.waitFor(() => expect(connected).toHaveBeenCalledOnce(), { timeout: 1000 })
    expect(getCredentials.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('réessaie si la sonde REST échoue puis réussit', async () => {
    const createRestClient = vi
      .fn()
      .mockReturnValueOnce(restClientFail())
      .mockReturnValue(restClientOk({ summonerId: 1 }))
    const { conn, watcher } = setup({ createRestClient })
    const connected = vi.fn()
    conn.on('connected', connected)

    conn.start()
    watcher.emit('started')

    await vi.waitFor(() => expect(connected).toHaveBeenCalledOnce(), { timeout: 1000 })
    expect(createRestClient.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('émet "disconnected" et coupe le WebSocket sur "stopped"', async () => {
    const { conn, watcher, ws } = setup()
    const disconnected = vi.fn()
    conn.on('connected', () => {})
    conn.on('disconnected', disconnected)

    conn.start()
    watcher.emit('started')
    await vi.waitFor(() => expect(conn.state).toBe('connected'))

    watcher.emit('stopped')
    expect(disconnected).toHaveBeenCalledOnce()
    expect(ws.disconnect).toHaveBeenCalledOnce()
    expect(conn.state).toBe('idle')
    expect(conn.restClient).toBeUndefined()
  })

  it('abandonne après maxAttempts et émet "error"', async () => {
    const { conn, watcher } = setup({
      getCredentials: vi.fn(async () => null),
      retryDelayMs: 2,
      maxAttempts: 3,
    })
    const onError = vi.fn()
    conn.on('error', onError)

    conn.start()
    watcher.emit('started')

    await vi.waitFor(() => expect(onError).toHaveBeenCalled(), { timeout: 1000 })
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error)
    expect(conn.state).toBe('idle')
  })

  it('stop() arrête le watcher et démonte tout', async () => {
    const { conn, watcher, ws } = setup()
    conn.on('connected', () => {})
    conn.start()
    watcher.emit('started')
    await vi.waitFor(() => expect(conn.state).toBe('connected'))

    conn.stop()
    expect(watcher.stop).toHaveBeenCalledOnce()
    expect(ws.disconnect).toHaveBeenCalled()
    expect(conn.state).toBe('idle')
  })
})
