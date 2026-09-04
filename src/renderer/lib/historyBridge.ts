import type { AppApi, HistoryBridge } from '@shared/ipc'

/** Accès typé au pont Historique (`window.app.history`). */
export function getHistory(): HistoryBridge {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app.history
}
