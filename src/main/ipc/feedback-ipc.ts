import { IpcChannels } from '../../shared/ipc'
import type { FeedbackDraft, FeedbackState } from '../../shared/feedback-types'
import type { Feedback } from '../feedback'
import type { IpcMainLike, SenderLike } from './update-ipc'

export interface RegisterFeedbackIpcDeps {
  ipcMain: IpcMainLike
  feedback: Pick<Feedback, 'state' | 'report' | 'setEnabled' | 'flush' | 'on' | 'off'>
  /** Fenêtres à notifier (principale **et** overlay : les deux affichent l'état). */
  getSenders: () => SenderLike[]
}

const HANDLED = [
  IpcChannels.feedbackGetState,
  IpcChannels.feedbackSend,
  IpcChannels.feedbackSetEnabled,
]

const isDraft = (v: unknown): v is FeedbackDraft => {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    (o['itemId'] === null || typeof o['itemId'] === 'number') &&
    typeof o['itemRank'] === 'number'
  )
}

/** Branche les handlers de signalement + le relais d'état. `dispose()`. */
export function registerFeedbackIpc(deps: RegisterFeedbackIpcDeps): () => void {
  const { ipcMain, feedback } = deps

  const relay = (state: FeedbackState): void => {
    for (const s of deps.getSenders()) {
      if (!s.isDestroyed()) s.send(IpcChannels.feedbackState, state)
    }
  }
  feedback.on('state', relay)

  ipcMain.handle(IpcChannels.feedbackGetState, () => feedback.state)
  ipcMain.handle(IpcChannels.feedbackSend, (_e, ...args) => {
    const draft = args[0]
    if (!isDraft(draft)) return false
    return feedback.report({
      itemId: draft.itemId,
      itemRank: draft.itemRank,
      reasonCode: draft.reasonCode ?? null,
    })
  })
  ipcMain.handle(IpcChannels.feedbackSetEnabled, (_e, ...args) =>
    feedback.setEnabled(args[0] === true),
  )

  return () => {
    feedback.off('state', relay)
    for (const ch of HANDLED) ipcMain.removeHandler(ch)
  }
}
