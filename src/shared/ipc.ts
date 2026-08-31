/**
 * Contrat d'API exposée au renderer via `contextBridge` (accessible sur
 * `window.app`). Partagé entre le preload (implémentation) et le renderer
 * (typage). Aucun secret LCU ne transite jamais par cette surface.
 */

export interface WindowControls {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
}

export interface AppApi {
  windowControls: WindowControls
}

/** Noms de canaux IPC (source unique de vérité main <-> preload). */
export const IpcChannels = {
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
