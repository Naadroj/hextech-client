import { IpcChannels } from '../../shared/ipc'
import {
  FEEDBACK_REASONS,
  type FeedbackDraft,
  type FeedbackState,
} from '../../shared/feedback-types'
import type { Feedback } from '../feedback'
import type { IpcMainLike, SenderLike } from './update-ipc'

export interface RegisterFeedbackIpcDeps {
  ipcMain: IpcMainLike
  feedback: Pick<
    Feedback,
    'state' | 'report' | 'setEnabled' | 'list' | 'annotate' | 'discard' | 'push' | 'on' | 'off'
  >
  /** Fenêtres à notifier (principale **et** overlay : les deux affichent l'état). */
  getSenders: () => SenderLike[]
}

const HANDLED = [
  IpcChannels.feedbackGetState,
  IpcChannels.feedbackReport,
  IpcChannels.feedbackSetEnabled,
  IpcChannels.feedbackList,
  IpcChannels.feedbackAnnotate,
  IpcChannels.feedbackDiscard,
  IpcChannels.feedbackPush,
]

const REASON_CODES = new Set<string>(FEEDBACK_REASONS.map((r) => r.code))

/** Le motif est obligatoire : un rapport sans lui ne serait pas exploitable. */
const isDraft = (v: unknown): v is FeedbackDraft => {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    (o['itemId'] === null || typeof o['itemId'] === 'number') &&
    typeof o['itemRank'] === 'number' &&
    typeof o['reasonCode'] === 'string' &&
    REASON_CODES.has(o['reasonCode'])
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
  ipcMain.handle(IpcChannels.feedbackReport, (_e, ...args) => {
    const draft = args[0]
    if (!isDraft(draft)) return false
    return feedback.report({
      itemId: draft.itemId,
      itemRank: draft.itemRank,
      reasonCode: draft.reasonCode,
    })
  })
  ipcMain.handle(IpcChannels.feedbackSetEnabled, (_e, ...args) =>
    feedback.setEnabled(args[0] === true),
  )
  ipcMain.handle(IpcChannels.feedbackList, () => feedback.list())
  ipcMain.handle(IpcChannels.feedbackAnnotate, (_e, ...args) => {
    const [id, comment] = args
    if (typeof id !== 'string' || typeof comment !== 'string') return false
    return feedback.annotate(id, comment)
  })
  ipcMain.handle(IpcChannels.feedbackDiscard, (_e, ...args) =>
    typeof args[0] === 'string' ? feedback.discard(args[0]) : false,
  )
  ipcMain.handle(IpcChannels.feedbackPush, () => feedback.push())

  return () => {
    feedback.off('state', relay)
    for (const ch of HANDLED) ipcMain.removeHandler(ch)
  }
}
