import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { registerUpdateIpc, type IpcMainLike, type SenderLike } from './update-ipc'
import { IpcChannels } from '../../shared/ipc'
import type { Updater } from '../updater'
import { IDLE_UPDATE_STATE } from '../../shared/update-types'

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
    if (!fn) throw new Error(`aucun handler ${channel}`)
    return fn({}, ...args)
  }
}

class FakeUpdater extends EventEmitter {
  info = vi.fn(() => ({
    currentVersion: '1.0.0',
    supported: true,
    state: { ...IDLE_UPDATE_STATE },
  }))
  check = vi.fn(async () => ({ ...IDLE_UPDATE_STATE, phase: 'checking' as const }))
  download = vi.fn(async () => ({ ...IDLE_UPDATE_STATE }))
  install = vi.fn()
}

function setup() {
  const ipcMain = new FakeIpcMain()
  const updater = new FakeUpdater()
  const sender: SenderLike & { send: ReturnType<typeof vi.fn> } = {
    send: vi.fn(),
    isDestroyed: () => false,
  }
  const dispose = registerUpdateIpc({
    ipcMain,
    updater: updater as unknown as Updater,
    getSender: () => sender,
  })
  return { ipcMain, updater, sender, dispose }
}

describe('registerUpdateIpc', () => {
  it('câble les handlers get-info / check / download / install', async () => {
    const { ipcMain, updater } = setup()
    expect(await ipcMain.invoke(IpcChannels.updateGetInfo)).toMatchObject({ currentVersion: '1.0.0' })

    await ipcMain.invoke(IpcChannels.updateCheck)
    expect(updater.check).toHaveBeenCalledOnce()

    await ipcMain.invoke(IpcChannels.updateDownload)
    expect(updater.download).toHaveBeenCalledOnce()

    await ipcMain.invoke(IpcChannels.updateInstall)
    expect(updater.install).toHaveBeenCalledOnce()
  })

  it('relaie les changements d’état vers le renderer', () => {
    const { updater, sender } = setup()
    updater.emit('state', { ...IDLE_UPDATE_STATE, phase: 'available', version: '2.0.0' })
    expect(sender.send).toHaveBeenCalledWith(
      IpcChannels.updateState,
      expect.objectContaining({ phase: 'available', version: '2.0.0' }),
    )
  })

  it('dispose() retire handlers et écouteur', () => {
    const { ipcMain, updater, sender, dispose } = setup()
    dispose()
    expect(ipcMain.handlers.size).toBe(0)
    updater.emit('state', { ...IDLE_UPDATE_STATE, phase: 'checking' })
    expect(sender.send).not.toHaveBeenCalled()
  })
})
