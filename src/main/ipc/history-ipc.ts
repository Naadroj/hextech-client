import { IpcChannels } from '../../shared/ipc'
import type { HistoryStore } from '../history'

/**
 * Surface IPC de l'historique : deux `invoke` en lecture seule. Aucune écriture
 * depuis le renderer — l'enregistrement est piloté par les conseils du coach.
 */

export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>,
  ): void
  removeHandler(channel: string): void
}

export function registerHistoryIpc(deps: { ipcMain: IpcMainLike; store: HistoryStore }): () => void {
  const { ipcMain, store } = deps

  ipcMain.handle(IpcChannels.historyList, () => store.list())
  ipcMain.handle(IpcChannels.historyGet, (_e, ...args) => {
    const id = args[0]
    return typeof id === 'string' ? store.read(id) : null
  })

  return () => {
    ipcMain.removeHandler(IpcChannels.historyList)
    ipcMain.removeHandler(IpcChannels.historyGet)
  }
}
