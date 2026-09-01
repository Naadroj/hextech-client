import type { AppApi, UpdaterBridge } from '@shared/ipc'

/** Accès typé au pont de mise à jour (`window.app.updater`). */
function getApp(): AppApi {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app
}

export function getUpdater(): UpdaterBridge {
  return getApp().updater
}
