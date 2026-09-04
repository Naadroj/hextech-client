import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannels, type AppApi } from '../shared/ipc'
import type { ConnectionInfo, LcuEvent } from '../shared/lcu-types'
import type { LiveSnapshot, LiveStatus } from '../shared/live-types'
import type { StaticDataSummary } from '../shared/staticdata-types'
import type { CoachAdvice } from '../shared/coach-types'
import type { UpdateState } from '../shared/update-types'
import type { OverlayState } from '../shared/overlay-types'
import type { FeedbackDraft, FeedbackState } from '../shared/feedback-types'

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
    getChampionIcon: (championId: number) =>
      ipcRenderer.invoke(IpcChannels.lcuGetChampionIcon, championId),
    getItemIcon: (itemId: number) => ipcRenderer.invoke(IpcChannels.lcuGetItemIcon, itemId),
    getSplashBackground: () => ipcRenderer.invoke(IpcChannels.lcuGetSplash),
    acceptReadyCheck: () => ipcRenderer.invoke(IpcChannels.lcuAcceptReadyCheck),
    declineReadyCheck: () => ipcRenderer.invoke(IpcChannels.lcuDeclineReadyCheck),
    createLobby: (queueId: number) => ipcRenderer.invoke(IpcChannels.lcuCreateLobby, queueId),
    createPracticeTool: () => ipcRenderer.invoke(IpcChannels.lcuCreatePracticeTool),
    createCustomLobby: () => ipcRenderer.invoke(IpcChannels.lcuCreateCustomLobby),
    leaveLobby: () => ipcRenderer.invoke(IpcChannels.lcuLeaveLobby),
    startMatchmaking: () => ipcRenderer.invoke(IpcChannels.lcuStartMatchmaking),
    stopMatchmaking: () => ipcRenderer.invoke(IpcChannels.lcuStopMatchmaking),
    champHover: (actionId: number, championId: number) =>
      ipcRenderer.invoke(IpcChannels.lcuChampHover, actionId, championId),
    champLock: (actionId: number, championId: number) =>
      ipcRenderer.invoke(IpcChannels.lcuChampLock, actionId, championId),
    setSummonerSpells: (spell1Id: number, spell2Id: number) =>
      ipcRenderer.invoke(IpcChannels.lcuSetSpells, spell1Id, spell2Id),
    setRunePage: (pageId: number) => ipcRenderer.invoke(IpcChannels.lcuSetRunePage, pageId),
    read: (path: string) => ipcRenderer.invoke(IpcChannels.lcuRead, path),
    onConnectionChanged: (cb: (info: ConnectionInfo) => void) =>
      subscribe<ConnectionInfo>(IpcChannels.lcuConnectionChanged, cb),
    onEvent: (cb: (event: LcuEvent) => void) => subscribe<LcuEvent>(IpcChannels.lcuEvent, cb),
  },
  live: {
    getSnapshot: () => ipcRenderer.invoke(IpcChannels.liveGetSnapshot),
    getStatus: () => ipcRenderer.invoke(IpcChannels.liveGetStatus),
    onSnapshot: (cb: (snapshot: LiveSnapshot) => void) =>
      subscribe<LiveSnapshot>(IpcChannels.liveSnapshot, cb),
    onStatusChanged: (cb: (status: LiveStatus) => void) =>
      subscribe<LiveStatus>(IpcChannels.liveStatusChanged, cb),
  },
  staticData: {
    getSummary: () => ipcRenderer.invoke(IpcChannels.staticDataGetSummary),
    refresh: () => ipcRenderer.invoke(IpcChannels.staticDataRefresh),
    onUpdated: (cb: (summary: StaticDataSummary) => void) =>
      subscribe<StaticDataSummary>(IpcChannels.staticDataUpdated, cb),
  },
  coach: {
    getAdvice: () => ipcRenderer.invoke(IpcChannels.coachGetAdvice),
    setAxis: (axis: 'physical' | 'magic' | null) =>
      ipcRenderer.invoke(IpcChannels.coachSetAxis, axis),
    onAdvice: (cb: (advice: CoachAdvice) => void) =>
      subscribe<CoachAdvice>(IpcChannels.coachAdvice, cb),
  },
  updater: {
    getInfo: () => ipcRenderer.invoke(IpcChannels.updateGetInfo),
    check: () => ipcRenderer.invoke(IpcChannels.updateCheck),
    download: () => ipcRenderer.invoke(IpcChannels.updateDownload),
    install: () => ipcRenderer.invoke(IpcChannels.updateInstall),
    onState: (cb: (state: UpdateState) => void) =>
      subscribe<UpdateState>(IpcChannels.updateState, cb),
  },
  overlay: {
    getState: () => ipcRenderer.invoke(IpcChannels.overlayGetState),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke(IpcChannels.overlaySetEnabled, enabled),
    toggle: () => ipcRenderer.invoke(IpcChannels.overlayToggle),
    setCompact: (compact: boolean) => ipcRenderer.invoke(IpcChannels.overlaySetCompact, compact),
    setInteractive: (interactive: boolean) =>
      ipcRenderer.invoke(IpcChannels.overlaySetInteractive, interactive),
    dragStart: () => ipcRenderer.invoke(IpcChannels.overlayDragStart),
    dragEnd: () => ipcRenderer.invoke(IpcChannels.overlayDragEnd),
    onState: (cb: (state: OverlayState) => void) =>
      subscribe<OverlayState>(IpcChannels.overlayState, cb),
  },
  feedback: {
    getState: () => ipcRenderer.invoke(IpcChannels.feedbackGetState),
    send: (draft: FeedbackDraft) => ipcRenderer.invoke(IpcChannels.feedbackSend, draft),
    setEnabled: (enabled: boolean) =>
      ipcRenderer.invoke(IpcChannels.feedbackSetEnabled, enabled),
    onState: (cb: (state: FeedbackState) => void) =>
      subscribe<FeedbackState>(IpcChannels.feedbackState, cb),
  },
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('app', api)
} else {
  // Repli si contextIsolation est désactivé (ne devrait pas arriver).
  ;(globalThis as unknown as { app: AppApi }).app = api
}
