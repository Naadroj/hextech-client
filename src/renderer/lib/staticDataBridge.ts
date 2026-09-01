import type { AppApi, StaticDataBridge } from '@shared/ipc'

/**
 * Accès typé au pont données statiques (`window.app.staticData`). Lève si le
 * preload n'est pas chargé (test / hors Electron).
 */
function getApp(): AppApi {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app
}

export function getStaticData(): StaticDataBridge {
  return getApp().staticData
}
