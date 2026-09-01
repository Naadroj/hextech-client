import { IpcChannels } from '../../shared/ipc'
import type { LiveSnapshot, LiveStatus } from '../../shared/live-types'
import type { LiveClientPoller } from '../live/poller'

/**
 * Surface IPC du pont Live Client Data.
 *
 * **Lecture seule** : la Live Client Data API n'expose ni mutation ni secret, la
 * surface se limite donc à deux `invoke` (instantané courant, statut) et deux
 * canaux poussés (`live:snapshot`, `live:status-changed`). Aucune liste blanche
 * de chemins n'est nécessaire — le poller n'interroge qu'un endpoint fixe.
 */

/** Sous-ensemble d'`Electron.IpcMain` suffisant ici (injectable pour les tests). */
export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>,
  ): void
  removeHandler(channel: string): void
}

/** Sous-ensemble d'`Electron.WebContents`. */
export interface SenderLike {
  send(channel: string, payload: unknown): void
  isDestroyed(): boolean
}

export interface RegisterLiveIpcDeps {
  ipcMain: IpcMainLike
  poller: LiveClientPoller
  /** Cible des événements poussés (WebContents de la fenêtre principale). */
  getSender: () => SenderLike | null
}

const HANDLED_CHANNELS: string[] = [IpcChannels.liveGetSnapshot, IpcChannels.liveGetStatus]

/** Branche les handlers et le relais d'événements. Retourne un `dispose()`. */
export function registerLiveIpc(deps: RegisterLiveIpcDeps): () => void {
  const { ipcMain, poller } = deps

  const push = (channel: string, payload: unknown): void => {
    const sender = deps.getSender()
    if (sender && !sender.isDestroyed()) sender.send(channel, payload)
  }

  const onSnapshot = (snapshot: LiveSnapshot): void => push(IpcChannels.liveSnapshot, snapshot)
  const onStatus = (status: LiveStatus): void => push(IpcChannels.liveStatusChanged, status)

  poller.on('snapshot', onSnapshot)
  poller.on('status', onStatus)

  ipcMain.handle(IpcChannels.liveGetSnapshot, () => poller.snapshot)
  ipcMain.handle(IpcChannels.liveGetStatus, () => poller.currentStatus)

  return () => {
    poller.off('snapshot', onSnapshot)
    poller.off('status', onStatus)
    for (const channel of HANDLED_CHANNELS) ipcMain.removeHandler(channel)
  }
}
