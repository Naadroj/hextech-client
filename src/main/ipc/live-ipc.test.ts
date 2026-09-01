import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { registerLiveIpc, type IpcMainLike, type SenderLike } from './live-ipc'
import { IpcChannels } from '../../shared/ipc'
import type { LiveClientPoller } from '../live/poller'
import type { LiveSnapshot } from '../../shared/live-types'

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

class FakePoller extends EventEmitter {
  snapshot: LiveSnapshot | null = null
  currentStatus: 'idle' | 'active' = 'idle'
}

const SNAP: LiveSnapshot = {
  receivedAt: 111,
  data: {
    activePlayer: { summonerName: 'me', currentGold: 42, level: 1 },
    allPlayers: [],
    events: { Events: [] },
    gameData: { gameMode: 'CLASSIC', gameTime: 0, mapName: 'x', mapNumber: 11, mapTerrain: 'y' },
  } as unknown as LiveSnapshot['data'],
}

function setup() {
  const ipcMain = new FakeIpcMain()
  const poller = new FakePoller()
  const sender: SenderLike & { send: ReturnType<typeof vi.fn> } = {
    send: vi.fn(),
    isDestroyed: () => false,
  }
  const dispose = registerLiveIpc({
    ipcMain,
    poller: poller as unknown as LiveClientPoller,
    getSender: () => sender,
  })
  return { ipcMain, poller, sender, dispose }
}

describe('registerLiveIpc', () => {
  it('expose le snapshot et le statut courants via invoke', async () => {
    const { ipcMain, poller } = setup()
    expect(await ipcMain.invoke(IpcChannels.liveGetSnapshot)).toBeNull()
    expect(await ipcMain.invoke(IpcChannels.liveGetStatus)).toBe('idle')

    poller.snapshot = SNAP
    poller.currentStatus = 'active'
    expect(await ipcMain.invoke(IpcChannels.liveGetSnapshot)).toEqual(SNAP)
    expect(await ipcMain.invoke(IpcChannels.liveGetStatus)).toBe('active')
  })

  it('relaie les événements snapshot et status vers le sender', () => {
    const { poller, sender } = setup()

    poller.emit('status', 'active')
    poller.emit('snapshot', SNAP)

    expect(sender.send).toHaveBeenCalledWith(IpcChannels.liveStatusChanged, 'active')
    expect(sender.send).toHaveBeenCalledWith(IpcChannels.liveSnapshot, SNAP)
  })

  it('ne pousse rien si le sender est détruit', () => {
    const ipcMain = new FakeIpcMain()
    const poller = new FakePoller()
    const send = vi.fn()
    registerLiveIpc({
      ipcMain,
      poller: poller as unknown as LiveClientPoller,
      getSender: () => ({ send, isDestroyed: () => true }),
    })

    poller.emit('snapshot', SNAP)
    expect(send).not.toHaveBeenCalled()
  })

  it('dispose() retire les handlers et les abonnements', () => {
    const { ipcMain, poller, sender, dispose } = setup()
    dispose()

    expect(ipcMain.handlers.has(IpcChannels.liveGetSnapshot)).toBe(false)
    expect(ipcMain.handlers.has(IpcChannels.liveGetStatus)).toBe(false)

    poller.emit('snapshot', SNAP)
    expect(sender.send).not.toHaveBeenCalled()
    expect(poller.listenerCount('snapshot')).toBe(0)
    expect(poller.listenerCount('status')).toBe(0)
  })
})
