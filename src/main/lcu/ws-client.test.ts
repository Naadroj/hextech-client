import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, type WebSocket as WsSocket } from 'ws'
import { parseWampEvent, LcuWebSocket } from './ws-client'

describe('parseWampEvent', () => {
  it('extrait un événement [8, "OnJsonApiEvent", payload]', () => {
    const raw = JSON.stringify([
      8,
      'OnJsonApiEvent',
      { eventType: 'Update', uri: '/lol-matchmaking/v1/ready-check', data: { state: 'InProgress' } },
    ])
    expect(parseWampEvent(raw)).toEqual({
      eventType: 'Update',
      uri: '/lol-matchmaking/v1/ready-check',
      data: { state: 'InProgress' },
    })
  })

  it('ignore les trames vides ou non-événement', () => {
    expect(parseWampEvent('')).toBeNull()
    expect(parseWampEvent('not json')).toBeNull()
    expect(parseWampEvent(JSON.stringify([5, 'OnJsonApiEvent']))).toBeNull()
    expect(parseWampEvent(JSON.stringify([8, 'OtherEvent', {}]))).toBeNull()
    expect(parseWampEvent(JSON.stringify([8, 'OnJsonApiEvent', { uri: '/x' }]))).toBeNull()
  })
})

describe('LcuWebSocket', () => {
  let wss: WebSocketServer
  let url: string
  const sockets = new Set<WsSocket>()

  beforeEach(async () => {
    wss = new WebSocketServer({ port: 0, host: '127.0.0.1' })
    await new Promise<void>((r) => wss.once('listening', r))
    wss.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
    url = `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`
  })

  afterEach(async () => {
    for (const s of sockets) s.terminate()
    sockets.clear()
    await new Promise<void>((r) => wss.close(() => r()))
  })

  it('envoie la souscription [5, "OnJsonApiEvent"] à l’ouverture', async () => {
    const received = new Promise<string>((resolve) => {
      wss.once('connection', (socket) => socket.once('message', (m) => resolve(m.toString())))
    })
    const client = new LcuWebSocket({ url, authHeader: 'Basic x', autoReconnect: false })
    client.connect()
    expect(JSON.parse(await received)).toEqual([5, 'OnJsonApiEvent'])
    client.disconnect()
  })

  it('émet "event" et "event:<uri>" pour une trame reçue', async () => {
    const client = new LcuWebSocket({ url, authHeader: 'Basic x', autoReconnect: false })
    const generic = vi.fn()
    const targeted = vi.fn()
    client.on('event', generic)
    client.on('event:/lol-gameflow/v1/gameflow-phase', targeted)

    wss.once('connection', (socket) => {
      socket.once('message', () => {
        socket.send(
          JSON.stringify([
            8,
            'OnJsonApiEvent',
            { eventType: 'Update', uri: '/lol-gameflow/v1/gameflow-phase', data: 'ChampSelect' },
          ]),
        )
      })
    })

    client.connect()
    await vi.waitFor(() => {
      expect(generic).toHaveBeenCalledWith(
        expect.objectContaining({ uri: '/lol-gameflow/v1/gameflow-phase', data: 'ChampSelect' }),
      )
      expect(targeted).toHaveBeenCalledOnce()
    })
    client.disconnect()
  })

  it('se reconnecte après une fermeture non sollicitée', async () => {
    let connections = 0
    wss.on('connection', (socket) => {
      connections += 1
      if (connections === 1) setTimeout(() => socket.close(), 10)
    })
    const client = new LcuWebSocket({
      url,
      authHeader: 'Basic x',
      reconnectDelayMs: 15,
      autoReconnect: true,
    })
    client.connect()
    await vi.waitFor(() => expect(connections).toBeGreaterThanOrEqual(2), { timeout: 1000 })
    client.disconnect()
  })

  it('ne se reconnecte pas après disconnect()', async () => {
    let connections = 0
    wss.on('connection', () => {
      connections += 1
    })
    const client = new LcuWebSocket({ url, authHeader: 'Basic x', reconnectDelayMs: 10 })
    client.connect()
    await vi.waitFor(() => expect(connections).toBe(1))
    client.disconnect()
    await new Promise((r) => setTimeout(r, 60))
    expect(connections).toBe(1)
  })
})
