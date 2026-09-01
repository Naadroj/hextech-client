import { IpcChannels } from '../../shared/ipc'
import type { StaticDataController } from '../staticdata'

/**
 * Surface IPC du pipeline de données statiques. **Lecture seule** : seul un
 * résumé (`StaticDataSummary`) franchit la frontière, plus un canal `refresh`
 * (vérification de patch) qui ne prend aucun paramètre.
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

export interface RegisterStaticDataIpcDeps {
  ipcMain: IpcMainLike
  controller: StaticDataController
  getSender: () => SenderLike | null
}

const HANDLED_CHANNELS: string[] = [
  IpcChannels.staticDataGetSummary,
  IpcChannels.staticDataRefresh,
]

export function registerStaticDataIpc(deps: RegisterStaticDataIpcDeps): () => void {
  const { ipcMain, controller } = deps

  const push = (channel: string, payload: unknown): void => {
    const sender = deps.getSender()
    if (sender && !sender.isDestroyed()) sender.send(channel, payload)
  }

  const onUpdated = (): void => push(IpcChannels.staticDataUpdated, controller.summary())
  const unsubscribe = controller.onUpdated(onUpdated)

  ipcMain.handle(IpcChannels.staticDataGetSummary, () => controller.summary())
  ipcMain.handle(IpcChannels.staticDataRefresh, () => controller.refresh(true))

  return () => {
    unsubscribe()
    for (const channel of HANDLED_CHANNELS) ipcMain.removeHandler(channel)
  }
}
