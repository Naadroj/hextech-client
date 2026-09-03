import type { AppApi, OverlayBridge } from '@shared/ipc'

/** Accès typé au pont overlay (`window.app.overlay`). */
function getApp(): AppApi {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app
}

export function getOverlay(): OverlayBridge {
  return getApp().overlay
}

/** Bascule le click-through sans jeter si le preload est absent (tests). */
export function setOverlayInteractive(interactive: boolean): void {
  try {
    void getOverlay().setInteractive(interactive)
  } catch {
    /* hors Electron */
  }
}
