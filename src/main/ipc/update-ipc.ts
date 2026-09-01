import { IpcChannels } from '../../shared/ipc'
import type { UpdateState } from '../../shared/update-types'
import type { Updater } from '../updater'

/** Sous-ensemble d'`Electron.IpcMain` (injectable pour les tests). */
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

export interface RegisterUpdateIpcDeps {
  ipcMain: IpcMainLike
  updater: Pick<Updater, 'info' | 'check' | 'download' | 'install' | 'on' | 'off'>
  getSender: () => SenderLike | null
}

const HANDLED = [
  IpcChannels.updateGetInfo,
  IpcChannels.updateCheck,
  IpcChannels.updateDownload,
  IpcChannels.updateInstall,
]

/** Branche les handlers MàJ + le relais d'état vers le renderer. `dispose()`. */
export function registerUpdateIpc(deps: RegisterUpdateIpcDeps): () => void {
  const { ipcMain, updater } = deps

  const relay = (state: UpdateState): void => {
    const sender = deps.getSender()
    if (sender && !sender.isDestroyed()) sender.send(IpcChannels.updateState, state)
  }
  updater.on('state', relay)

  ipcMain.handle(IpcChannels.updateGetInfo, () => updater.info())
  ipcMain.handle(IpcChannels.updateCheck, () => updater.check())
  ipcMain.handle(IpcChannels.updateDownload, () => updater.download())
  ipcMain.handle(IpcChannels.updateInstall, () => {
    updater.install()
  })

  return () => {
    updater.off('state', relay)
    for (const ch of HANDLED) ipcMain.removeHandler(ch)
  }
}
