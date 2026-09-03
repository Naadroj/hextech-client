import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { registerOverlayIpc } from './overlay-ipc'
import type { IpcMainLike, SenderLike } from './update-ipc'
import { IpcChannels } from '../../shared/ipc'
import type { OverlayState } from '../../shared/overlay-types'

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

class FakeOverlay extends EventEmitter {
  private enabled = false
  setInteractive = vi.fn()
  get state(): OverlayState {
    return { enabled: this.enabled, bounds: null }
  }
  setEnabled = vi.fn((v: boolean): OverlayState => {
    this.enabled = v
    this.emit('state', this.state)
    return this.state
  })
  toggle = vi.fn((): OverlayState => this.setEnabled(!this.enabled))
}

function setup() {
  const ipcMain = new FakeIpcMain()
  const overlay = new FakeOverlay()
  const sent: { channel: string; payload: unknown }[] = []
  const sender: SenderLike = {
    send: (channel, payload) => sent.push({ channel, payload }),
    isDestroyed: () => false,
  }
  const dispose = registerOverlayIpc({
    ipcMain,
    overlay: overlay as unknown as Parameters<typeof registerOverlayIpc>[0]['overlay'],
    getSender: () => sender,
  })
  return { ipcMain, overlay, sent, dispose }
}

describe('registerOverlayIpc', () => {
  it('expose l’état courant', () => {
    const { ipcMain } = setup()
    expect(ipcMain.invoke(IpcChannels.overlayGetState)).toEqual({ enabled: false, bounds: null })
  })

  it('setEnabled active/désactive et relaie l’état au renderer', () => {
    const { ipcMain, overlay, sent } = setup()
    const next = ipcMain.invoke(IpcChannels.overlaySetEnabled, true)
    expect(overlay.setEnabled).toHaveBeenCalledWith(true)
    expect(next).toEqual({ enabled: true, bounds: null })
    expect(sent).toEqual([{ channel: IpcChannels.overlayState, payload: { enabled: true, bounds: null } }])
  })

  it('toggle inverse l’état', () => {
    const { ipcMain } = setup()
    expect(ipcMain.invoke(IpcChannels.overlayToggle)).toEqual({ enabled: true, bounds: null })
    expect(ipcMain.invoke(IpcChannels.overlayToggle)).toEqual({ enabled: false, bounds: null })
  })

  it('setInteractive transmet un booléen strict', () => {
    const { ipcMain, overlay } = setup()
    ipcMain.invoke(IpcChannels.overlaySetInteractive, true)
    ipcMain.invoke(IpcChannels.overlaySetInteractive, 'oui')
    expect(overlay.setInteractive).toHaveBeenNthCalledWith(1, true)
    expect(overlay.setInteractive).toHaveBeenNthCalledWith(2, false)
  })

  it('dispose retire les handlers et coupe le relais', () => {
    const { ipcMain, overlay, sent, dispose } = setup()
    dispose()
    expect(ipcMain.handlers.size).toBe(0)
    overlay.emit('state', { enabled: true, bounds: null })
    expect(sent).toHaveLength(0)
  })
})
