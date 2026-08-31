import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  registerLcuIpc,
  isReadPathAllowed,
  isEventUriAllowed,
  type IpcMainLike,
  type SenderLike,
} from './lcu-ipc'
import { IpcChannels } from '../../shared/ipc'
import type { LcuConnection } from '../lcu/connection'

class FakeIpcMain implements IpcMainLike {
  handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener)
  }
  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
  invoke(channel: string, ...args: unknown[]): unknown {
    const fn = this.handlers.get(channel)
    if (!fn) throw new Error(`aucun handler pour ${channel}`)
    return fn({}, ...args)
  }
}

function makeRest(over: Record<string, unknown> = {}) {
  return {
    origin: 'https://127.0.0.1:1',
    request: vi.fn(async () => ({ status: 200, ok: true, data: { hello: 'world' } })),
    get: vi.fn(),
    post: vi.fn(async () => ({ status: 204, ok: true, data: null })),
    patch: vi.fn(async () => ({ status: 204, ok: true, data: null })),
    put: vi.fn(async () => ({ status: 204, ok: true, data: null })),
    delete: vi.fn(async () => ({ status: 204, ok: true, data: null })),
    requestRaw: vi.fn(async () => ({
      status: 200,
      ok: true,
      contentType: 'image/jpeg',
      body: Buffer.from([1, 2, 3]),
    })),
    ...over,
  }
}

class FakeConnection extends EventEmitter {
  rest: ReturnType<typeof makeRest> | null = null
  info: { status: string; summoner: unknown } = { status: 'idle', summoner: null }
  get restClient() {
    return this.rest ?? undefined
  }
}

function setup(conn = new FakeConnection()) {
  const ipcMain = new FakeIpcMain()
  const sender: SenderLike & { send: ReturnType<typeof vi.fn> } = {
    send: vi.fn(),
    isDestroyed: () => false,
  }
  const dispose = registerLcuIpc({
    ipcMain,
    connection: conn as unknown as LcuConnection,
    getSender: () => sender,
  })
  return { ipcMain, sender, conn, dispose }
}

describe('isReadPathAllowed', () => {
  it('accepte les préfixes de la liste blanche', () => {
    expect(isReadPathAllowed('/lol-summoner/v1/current-summoner')).toBe(true)
    expect(isReadPathAllowed('/lol-champ-select/v1/session')).toBe(true)
    expect(isReadPathAllowed('/lol-game-data/assets/v1/x.png')).toBe(true)
  })
  it('accepte /lol-game-queues (Phase 5)', () => {
    expect(isReadPathAllowed('/lol-game-queues/v1/queues')).toBe(true)
  })
  it('rejette hors liste blanche, chemins relatifs et non absolus', () => {
    expect(isReadPathAllowed('/lol-login/v1/session')).toBe(false)
    expect(isReadPathAllowed('/lol-summoner/v1/../../secret')).toBe(false)
    expect(isReadPathAllowed('lol-summoner/v1/x')).toBe(false)
    expect(isReadPathAllowed('')).toBe(false)
  })
})

describe('isEventUriAllowed', () => {
  it('filtre sur les modules de jeu attendus', () => {
    expect(isEventUriAllowed('/lol-gameflow/v1/gameflow-phase')).toBe(true)
    expect(isEventUriAllowed('/lol-champ-select/v1/session')).toBe(true)
    expect(isEventUriAllowed('/lol-login/v1/session')).toBe(false)
    expect(isEventUriAllowed('/riotclient/zoom-scale')).toBe(false)
  })
})

describe('registerLcuIpc — handlers', () => {
  let ctx: ReturnType<typeof setup>
  beforeEach(() => {
    ctx = setup()
  })

  it('lcu:get-connection renvoie l’instantané de connexion (sans token)', async () => {
    ctx.conn.info = { status: 'connected', summoner: { summonerId: 5 } }
    const res = await ctx.ipcMain.invoke(IpcChannels.lcuGetConnection)
    expect(res).toEqual({ status: 'connected', summoner: { summonerId: 5 } })
    expect(JSON.stringify(res)).not.toMatch(/token/i)
  })

  it('lcu:read refuse un endpoint hors liste blanche', async () => {
    ctx.conn.rest = makeRest()
    await expect(ctx.ipcMain.invoke(IpcChannels.lcuRead, '/lol-login/v1/session')).rejects.toThrow(
      /non autorisé/,
    )
    expect(ctx.conn.rest.request).not.toHaveBeenCalled()
  })

  it('lcu:read transmet un GET whitelisté au client REST', async () => {
    ctx.conn.rest = makeRest()
    const res = await ctx.ipcMain.invoke(IpcChannels.lcuRead, '/lol-summoner/v1/current-summoner')
    expect(ctx.conn.rest.request).toHaveBeenCalledWith('GET', '/lol-summoner/v1/current-summoner')
    expect(res).toEqual({ status: 200, ok: true, data: { hello: 'world' } })
  })

  it('lcu:read échoue proprement si LCU hors ligne', async () => {
    await expect(
      ctx.ipcMain.invoke(IpcChannels.lcuRead, '/lol-summoner/v1/current-summoner'),
    ).rejects.toThrow(/hors ligne/)
  })

  it('lcu:get-ranked-stats renvoie vide sans client, normalisé avec client', async () => {
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetRankedStats)).toEqual({
      soloDuo: null,
      flex: null,
    })

    ctx.conn.rest = makeRest({
      get: vi.fn(async () => ({
        status: 200,
        ok: true,
        data: {
          queueMap: {
            RANKED_SOLO_5x5: { tier: 'GOLD', division: 'II', leaguePoints: 44, wins: 10, losses: 8 },
          },
        },
      })),
    })
    const res = (await ctx.ipcMain.invoke(IpcChannels.lcuGetRankedStats)) as {
      soloDuo: { tier: string; leaguePoints: number } | null
      flex: unknown
    }
    expect(res.soloDuo).toMatchObject({ tier: 'GOLD', leaguePoints: 44 })
    expect(res.flex).toBeNull()
  })

  it('lcu:get-splash : mastery -> splash servi localement en data URL', async () => {
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetSplash)).toBeNull()

    ctx.conn.rest = makeRest({
      get: vi.fn(async () => ({
        status: 200,
        ok: true,
        data: [{ championId: 103, championPoints: 99999 }],
      })),
      requestRaw: vi.fn(async (_m: string, path: string) => ({
        status: 200,
        ok: true,
        contentType: 'image/jpeg',
        body: Buffer.from(path.includes('/103/103000.jpg') ? [9, 9, 9] : []),
      })),
    })
    const url = await ctx.ipcMain.invoke(IpcChannels.lcuGetSplash)
    expect(url).toBe('data:image/jpeg;base64,' + Buffer.from([9, 9, 9]).toString('base64'))
  })

  it('lcu:get-profile-icon renvoie une data URL, ou null si invalide', async () => {
    ctx.conn.rest = makeRest()
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetProfileIcon, 3)).toBe(
      'data:image/jpeg;base64,' + Buffer.from([1, 2, 3]).toString('base64'),
    )
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetProfileIcon, 'x')).toBeNull()

    ctx.conn.rest = makeRest({
      requestRaw: vi.fn(async () => ({ status: 404, ok: false, contentType: '', body: Buffer.alloc(0) })),
    })
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetProfileIcon, 9)).toBeNull()
  })

  it('lcu:accept-ready-check exige un client et POSTe le bon endpoint', async () => {
    await expect(ctx.ipcMain.invoke(IpcChannels.lcuAcceptReadyCheck)).rejects.toThrow(/hors ligne/)

    ctx.conn.rest = makeRest()
    await ctx.ipcMain.invoke(IpcChannels.lcuAcceptReadyCheck)
    expect(ctx.conn.rest.post).toHaveBeenCalledWith('/lol-matchmaking/v1/ready-check/accept', {})
  })

  it('lcu:create-lobby valide le queueId et POSTe', async () => {
    ctx.conn.rest = makeRest({ post: vi.fn(async () => ({ status: 200, ok: true, data: {} })) })
    await expect(ctx.ipcMain.invoke(IpcChannels.lcuCreateLobby, -1)).rejects.toThrow(/queueId/)
    await expect(ctx.ipcMain.invoke(IpcChannels.lcuCreateLobby, 'x')).rejects.toThrow(/queueId/)

    await ctx.ipcMain.invoke(IpcChannels.lcuCreateLobby, 450)
    expect(ctx.conn.rest.post).toHaveBeenCalledWith('/lol-lobby/v2/lobby', { queueId: 450 })
  })

  it('lcu:create-practice-tool / create-custom-lobby POSTent un lobby personnalisé', async () => {
    await expect(ctx.ipcMain.invoke(IpcChannels.lcuCreatePracticeTool)).rejects.toThrow(/hors ligne/)

    ctx.conn.rest = makeRest({ post: vi.fn(async () => ({ status: 200, ok: true, data: {} })) })
    await ctx.ipcMain.invoke(IpcChannels.lcuCreatePracticeTool)
    expect(ctx.conn.rest.post).toHaveBeenCalledWith(
      '/lol-lobby/v2/lobby',
      expect.objectContaining({ isCustom: true }),
    )

    await ctx.ipcMain.invoke(IpcChannels.lcuCreateCustomLobby)
    expect(ctx.conn.rest.post).toHaveBeenLastCalledWith(
      '/lol-lobby/v2/lobby',
      expect.objectContaining({
        customGameLobby: expect.objectContaining({
          configuration: expect.objectContaining({ gameMode: 'CLASSIC' }),
        }),
      }),
    )
  })

  it('lcu:champ-hover / champ-lock : valident les entiers et PATCHent', async () => {
    await expect(ctx.ipcMain.invoke(IpcChannels.lcuChampHover, 'x', 1)).rejects.toThrow(/entier/)
    await expect(ctx.ipcMain.invoke(IpcChannels.lcuChampLock, 21, 1.5)).rejects.toThrow(/entier/)

    ctx.conn.rest = makeRest()
    await ctx.ipcMain.invoke(IpcChannels.lcuChampHover, 21, 103)
    expect(ctx.conn.rest.patch).toHaveBeenCalledWith('/lol-champ-select/v1/session/actions/21', {
      championId: 103,
      completed: false,
    })
    await ctx.ipcMain.invoke(IpcChannels.lcuChampLock, 21, 103)
    expect(ctx.conn.rest.patch).toHaveBeenLastCalledWith('/lol-champ-select/v1/session/actions/21', {
      championId: 103,
      completed: true,
    })
  })

  it('lcu:set-spells / set-rune-page PATCH/PUT les bons endpoints', async () => {
    ctx.conn.rest = makeRest()
    await ctx.ipcMain.invoke(IpcChannels.lcuSetSpells, 4, 14)
    expect(ctx.conn.rest.patch).toHaveBeenCalledWith('/lol-champ-select/v1/session/my-selection', {
      spell1Id: 4,
      spell2Id: 14,
    })
    await ctx.ipcMain.invoke(IpcChannels.lcuSetRunePage, 42)
    expect(ctx.conn.rest.put).toHaveBeenCalledWith('/lol-perks/v1/currentpage', 42)
  })

  it('lcu:get-champion-icon : data URL ou null', async () => {
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetChampionIcon, 103)).toBeNull()
    ctx.conn.rest = makeRest({
      requestRaw: vi.fn(async () => ({
        status: 200,
        ok: true,
        contentType: 'image/png',
        body: Buffer.from([7, 7]),
      })),
    })
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetChampionIcon, 103)).toBe(
      'data:image/png;base64,' + Buffer.from([7, 7]).toString('base64'),
    )
    expect(await ctx.ipcMain.invoke(IpcChannels.lcuGetChampionIcon, -1)).toBeNull()
  })

  it('lcu:leave-lobby / start / stop matchmaking exigent un client', async () => {
    for (const ch of [
      IpcChannels.lcuLeaveLobby,
      IpcChannels.lcuStartMatchmaking,
      IpcChannels.lcuStopMatchmaking,
    ]) {
      await expect(ctx.ipcMain.invoke(ch)).rejects.toThrow(/hors ligne/)
    }

    ctx.conn.rest = makeRest()
    await ctx.ipcMain.invoke(IpcChannels.lcuStartMatchmaking)
    expect(ctx.conn.rest.post).toHaveBeenCalledWith('/lol-lobby/v2/lobby/matchmaking/search', {})
    await ctx.ipcMain.invoke(IpcChannels.lcuStopMatchmaking)
    expect(ctx.conn.rest.delete).toHaveBeenCalledWith('/lol-lobby/v2/lobby/matchmaking/search')
  })
})

describe('registerLcuIpc — relais d’événements', () => {
  it('pousse les événements dont l’URI est whitelistée, filtre les autres', () => {
    const { conn, sender } = setup()
    conn.emit('lcu-event', { eventType: 'Update', uri: '/lol-gameflow/v1/gameflow-phase', data: 'Lobby' })
    conn.emit('lcu-event', { eventType: 'Update', uri: '/riotclient/region-locale', data: {} })

    expect(sender.send).toHaveBeenCalledTimes(1)
    expect(sender.send).toHaveBeenCalledWith(
      IpcChannels.lcuEvent,
      expect.objectContaining({ uri: '/lol-gameflow/v1/gameflow-phase' }),
    )
  })

  it('diffuse l’état de connexion sur connected / disconnected', () => {
    const { conn, sender } = setup()
    conn.info = { status: 'connected', summoner: { summonerId: 1 } }
    conn.emit('connected')
    conn.info = { status: 'idle', summoner: null }
    conn.emit('disconnected')

    expect(sender.send).toHaveBeenNthCalledWith(1, IpcChannels.lcuConnectionChanged, {
      status: 'connected',
      summoner: { summonerId: 1 },
    })
    expect(sender.send).toHaveBeenNthCalledWith(2, IpcChannels.lcuConnectionChanged, {
      status: 'idle',
      summoner: null,
    })
  })

  it('dispose() retire handlers et écouteurs', () => {
    const { ipcMain, conn, sender, dispose } = setup()
    dispose()
    expect(ipcMain.handlers.size).toBe(0)
    conn.emit('lcu-event', { eventType: 'Update', uri: '/lol-gameflow/v1/gameflow-phase', data: 1 })
    expect(sender.send).not.toHaveBeenCalled()
  })
})
