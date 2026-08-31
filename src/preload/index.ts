import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type AppApi } from '../shared/ipc'

const api: AppApi = {
  windowControls: {
    minimize: () => ipcRenderer.invoke(IpcChannels.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IpcChannels.windowToggleMaximize),
    close: () => ipcRenderer.invoke(IpcChannels.windowClose),
    isMaximized: () => ipcRenderer.invoke(IpcChannels.windowIsMaximized),
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('app', api)
} else {
  // Repli si contextIsolation est désactivé (ne devrait pas arriver).
  ;(globalThis as unknown as { app: AppApi }).app = api
}
