import type { AppApi, LiveBridge } from '@shared/ipc'

/**
 * Accès typé au pont Live Client Data exposé par le preload (`window.app.live`).
 * Lève une erreur explicite si le preload n'est pas chargé (utile en test /
 * hors Electron).
 */
function getApp(): AppApi {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app
}

export function getLive(): LiveBridge {
  return getApp().live
}
