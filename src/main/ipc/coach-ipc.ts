import { IpcChannels } from '../../shared/ipc'
import type { BuildAxis } from '../../shared/build-types'
import type { CoachAdvice } from '../../shared/coach-types'
import type { Coach } from '../engine/coach'

/**
 * Surface IPC du Coach : deux `invoke` (dernier conseil, forçage de l'axe) + un
 * canal poussé (`coach:advice`). Aucune de ces actions ne sort de la machine.
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
  ipcMain.handle(IpcChannels.coachSetAxis, (_e, ...args) => {
    const axis = args[0]
    // Le renderer est de confiance mais on garde la surface IPC stricte.
    const valid: BuildAxis | null =
      axis === 'physical' || axis === 'magic' ? axis : null
    return coach.setAxisOverride(valid)
  })

  return () => {
    coach.off('advice', onAdvice)
    ipcMain.removeHandler(IpcChannels.coachGetAdvice)
    ipcMain.removeHandler(IpcChannels.coachSetAxis)
  }
}
