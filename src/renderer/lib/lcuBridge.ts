import type { AppApi, LcuBridge } from '@shared/ipc'

/**
 * Accès typé au pont exposé par le preload (`window.app`). Lève une erreur
 * explicite si le preload n'est pas chargé (utile en test / hors Electron).
 */
function getApp(): AppApi {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app
}

export function getLcu(): LcuBridge {
  return getApp().lcu
}
