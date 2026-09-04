import type { AppApi, FeedbackBridge } from '@shared/ipc'

/** Accès typé au pont de signalement (`window.app.feedback`). */
function getApp(): AppApi {
  const app = (globalThis as { app?: AppApi }).app
  if (!app) throw new Error('window.app indisponible — preload non chargé')
  return app
}

export function getFeedback(): FeedbackBridge {
  return getApp().feedback
}
