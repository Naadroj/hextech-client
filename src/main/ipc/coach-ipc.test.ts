import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { registerCoachIpc, type IpcMainLike, type SenderLike } from './coach-ipc'
import { IpcChannels } from '../../shared/ipc'
import { IDLE_ADVICE, type CoachAdvice } from '../../shared/coach-types'
import type { Coach } from '../engine/coach'

class FakeIpcMain implements IpcMainLike {
  handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener)
  }
  removeHandler(channel: string): void {
    this.handlers.delete(channel)
  }
  invoke(channel: string): unknown {
    return this.handlers.get(channel)?.({})
  }
}

class FakeCoach extends EventEmitter {
  advice: CoachAdvice = IDLE_ADVICE
}

const ACTIVE: CoachAdvice = { ...IDLE_ADVICE, status: 'active', computedAt: 42 }

function setup() {
  const ipcMain = new FakeIpcMain()
  const coach = new FakeCoach()
  const sender: SenderLike & { send: ReturnType<typeof vi.fn> } = {
    send: vi.fn(),
    isDestroyed: () => false,
  }
  const dispose = registerCoachIpc({
    ipcMain,
    coach: coach as unknown as Coach,
    getSender: () => sender,
  })
  return { ipcMain, coach, sender, dispose }
}

describe('registerCoachIpc', () => {
  it('expose le dernier conseil via invoke', () => {
    const { ipcMain, coach } = setup()
    expect(ipcMain.invoke(IpcChannels.coachGetAdvice)).toBe(IDLE_ADVICE)
    coach.advice = ACTIVE
    expect(ipcMain.invoke(IpcChannels.coachGetAdvice)).toBe(ACTIVE)
  })

  it('relaie l’événement advice vers le sender', () => {
    const { coach, sender } = setup()
    coach.emit('advice', ACTIVE)
    expect(sender.send).toHaveBeenCalledWith(IpcChannels.coachAdvice, ACTIVE)
  })

  it('dispose() retire handler et abonnement', () => {
    const { ipcMain, coach, sender, dispose } = setup()
    dispose()
    expect(ipcMain.handlers.size).toBe(0)
    coach.emit('advice', ACTIVE)
    expect(sender.send).not.toHaveBeenCalled()
  })
})
