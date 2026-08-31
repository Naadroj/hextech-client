import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, type AppApi } from '../shared/ipc'
import type { ConnectionInfo, LcuEvent } from '../shared/lcu-types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: AppApi = {
  windowControls: {
    minimize: () => ipcRenderer.invoke(IpcChannels.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IpcChannels.windowToggleMaximize),
    close: () => ipcRenderer.invoke(IpcChannels.windowClose),
    isMaximized: () => ipcRenderer.invoke(IpcChannels.windowIsMaximized),
  },
  lcu: {
    getConnection: () => ipcRenderer.invoke(IpcChannels.lcuGetConnection),
    getRankedStats: () => ipcRenderer.invoke(IpcChannels.lcuGetRankedStats),
    getProfileIcon: (iconId: number) =>
      ipcRenderer.invoke(IpcChannels.lcuGetProfileIcon, iconId),
    getSplashBackground: () => ipcRenderer.invoke(IpcChannels.lcuGetSplash),
    acceptReadyCheck: () => ipcRenderer.invoke(IpcChannels.lcuAcceptReadyCheck),
    declineReadyCheck: () => ipcRenderer.invoke(IpcChannels.lcuDeclineReadyCheck),
    createLobby: (queueId: number) => ipcRenderer.invoke(IpcChannels.lcuCreateLobby, queueId),
    createPracticeTool: () => ipcRenderer.invoke(IpcChannels.lcuCreatePracticeTool),
    createCustomLobby: () => ipcRenderer.invoke(IpcChannels.lcuCreateCustomLobby),
    leaveLobby: () => ipcRenderer.invoke(IpcChannels.lcuLeaveLobby),
    startMatchmaking: () => ipcRenderer.invoke(IpcChannels.lcuStartMatchmaking),
    stopMatchmaking: () => ipcRenderer.invoke(IpcChannels.lcuStopMatchmaking),
    read: (path: string) => ipcRenderer.invoke(IpcChannels.lcuRead, path),
    onConnectionChanged: (cb: (info: ConnectionInfo) => void) =>
      subscribe<ConnectionInfo>(IpcChannels.lcuConnectionChanged, cb),
    onEvent: (cb: (event: LcuEvent) => void) => subscribe<LcuEvent>(IpcChannels.lcuEvent, cb),
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('app', api)
} else {
  // Repli si contextIsolation est désactivé (ne devrait pas arriver).
  ;(globalThis as unknown as { app: AppApi }).app = api
}
