import type { AppApi, CoachBridge } from '@shared/ipc'

/** Accès typé au pont Coach (`window.app.coach`). */
function getApp(): AppApi {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app
}

export function getCoach(): CoachBridge {
  return getApp().coach
}
