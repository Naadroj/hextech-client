import { IpcChannels } from '../../shared/ipc'
import type { CoachAdvice } from '../../shared/coach-types'
import type { Coach } from '../engine/coach'

/**
 * Surface IPC du Coach. **Lecture seule** : un `invoke` (dernier conseil) + un
 * canal poussé (`coach:advice`).
 */

export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>,
  ): void
  removeHandler(channel: string): void
}

export interface SenderLike {
  send(channel: string, payload: unknown): void
  isDestroyed(): boolean
}

export interface RegisterCoachIpcDeps {
  ipcMain: IpcMainLike
  coach: Coach
  getSender: () => SenderLike | null
}

export function registerCoachIpc(deps: RegisterCoachIpcDeps): () => void {
  const { ipcMain, coach } = deps

  const onAdvice = (advice: CoachAdvice): void => {
    const sender = deps.getSender()
    if (sender && !sender.isDestroyed()) sender.send(IpcChannels.coachAdvice, advice)
  }
  coach.on('advice', onAdvice)

  ipcMain.handle(IpcChannels.coachGetAdvice, () => coach.advice)

  return () => {
    coach.off('advice', onAdvice)
    ipcMain.removeHandler(IpcChannels.coachGetAdvice)
  }
}
