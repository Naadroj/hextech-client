import { describe, it, expect, vi } from 'vitest'
import { registerStaticDataIpc, type IpcMainLike, type SenderLike } from './staticdata-ipc'
import { IpcChannels } from '../../shared/ipc'
import type { StaticDataController } from '../staticdata'
import type { StaticDataSummary } from '../../shared/staticdata-types'

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

const SUMMARY: StaticDataSummary = {
  version: '16.17.1',
  locale: 'en_US',
  source: 'cache',
  fetchedAt: '2026-09-01T00:00:00.000Z',
  merakiVersion: '16.17.1',
  itemCount: 868,
  championCount: 173,
  runeCount: 62,
  summonerSpellCount: 34,
  damageProfileSources: { meraki: 161, ddragon: 2, override: 10 },
  updating: false,
}

function makeController(): StaticDataController & { fireUpdated: () => void } {
  let updatedCb: (() => void) | null = null
  return {
    data: {} as StaticDataController['data'],
    meta: { version: '16.17.1' } as StaticDataController['meta'],
    refreshing: null,
    refresh: vi.fn(async () => true),
    summary: vi.fn(() => SUMMARY),
    onUpdated: (cb: () => void) => {
      updatedCb = cb
      return () => {
        updatedCb = null
      }
    },
    dispose: vi.fn(),
    fireUpdated: () => updatedCb?.(),
  } as unknown as StaticDataController & { fireUpdated: () => void }
}

function setup() {
  const ipcMain = new FakeIpcMain()
  const controller = makeController()
  const sender: SenderLike & { send: ReturnType<typeof vi.fn> } = {
    send: vi.fn(),
    isDestroyed: () => false,
  }
  const dispose = registerStaticDataIpc({ ipcMain, controller, getSender: () => sender })
  return { ipcMain, controller, sender, dispose }
}

describe('registerStaticDataIpc', () => {
  it('expose le résumé via invoke', async () => {
    const { ipcMain } = setup()
    expect(await ipcMain.invoke(IpcChannels.staticDataGetSummary)).toEqual(SUMMARY)
  })

  it('le canal refresh force la vérification de patch', async () => {
    const { ipcMain, controller } = setup()
    expect(await ipcMain.invoke(IpcChannels.staticDataRefresh)).toBe(true)
    expect(controller.refresh).toHaveBeenCalledWith(true)
  })

  it('pousse le résumé sur "updated"', () => {
    const { controller, sender } = setup()
    controller.fireUpdated()
    expect(sender.send).toHaveBeenCalledWith(IpcChannels.staticDataUpdated, SUMMARY)
  })

  it('dispose() retire handlers et abonnement', () => {
    const { ipcMain, controller, sender, dispose } = setup()
    dispose()
    expect(ipcMain.handlers.size).toBe(0)
    controller.fireUpdated()
    expect(sender.send).not.toHaveBeenCalled()
  })
})
