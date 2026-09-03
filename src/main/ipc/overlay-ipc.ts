import { IpcChannels } from '../../shared/ipc'
import type { OverlayState } from '../../shared/overlay-types'
import type { Overlay } from '../overlay'
import type { IpcMainLike, SenderLike } from './update-ipc'

export interface RegisterOverlayIpcDeps {
  ipcMain: IpcMainLike
  overlay: Pick<Overlay, 'state' | 'setEnabled' | 'toggle' | 'setInteractive' | 'on' | 'off'>
  /** Fenêtre principale (reçoit les changements d'état pour l'UI Réglages). */
  getSender: () => SenderLike | null
}

const HANDLED = [
  IpcChannels.overlayGetState,
  IpcChannels.overlaySetEnabled,
  IpcChannels.overlayToggle,
  IpcChannels.overlaySetInteractive,
]

/** Branche les handlers overlay + le relais d'état vers le renderer. `dispose()`. */
export function registerOverlayIpc(deps: RegisterOverlayIpcDeps): () => void {
  const { ipcMain, overlay } = deps

  const relay = (state: OverlayState): void => {
    const sender = deps.getSender()
    if (sender && !sender.isDestroyed()) sender.send(IpcChannels.overlayState, state)
  }
  overlay.on('state', relay)

  ipcMain.handle(IpcChannels.overlayGetState, () => overlay.state)
  ipcMain.handle(IpcChannels.overlaySetEnabled, (_e, ...args) =>
    overlay.setEnabled(args[0] === true),
  )
  ipcMain.handle(IpcChannels.overlayToggle, () => overlay.toggle())
  ipcMain.handle(IpcChannels.overlaySetInteractive, (_e, ...args) => {
    overlay.setInteractive(args[0] === true)
  })

  return () => {
    overlay.off('state', relay)
    for (const ch of HANDLED) ipcMain.removeHandler(ch)
  }
}
