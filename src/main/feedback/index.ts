import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { logger } from '../logger'
import { FeedbackStore } from './store'
import { insertReports, isConfigured, type Poster } from './supabase'
import type { ConfigStore } from '../config-store'
import type { LiveGameData } from '../../shared/live-types'
import type { CoachAdvice } from '../../shared/coach-types'
import type {
  FeedbackDraft,
  FeedbackReport,
  FeedbackState,
} from '../../shared/feedback-types'

export * from './store'
export * from './supabase'

/**
 * Orchestrateur des signalements : compose le rapport depuis l'état de partie
 * courant, l'écrit dans la file locale, puis tente l'envoi.
 *
 * Le clic en jeu est **synchrone et local** ; le réseau vient après et n'a pas
 * le droit d'échouer bruyamment. Événement : `state` (`FeedbackState`).
 */

/** Anti-spam : un même (champion, item) n'est pas resignalé avant ce délai. */
const DEDUPE_MS = 30_000
/** Cadence de vidage de la file. */
const FLUSH_TICK_MS = 5 * 60_000

export interface FeedbackDeps {
  config: ConfigStore
  store: FeedbackStore
  appVersion: string
  /** Dernier instantané de partie (`null` hors partie). */
  getLive: () => LiveGameData | null
  /** Dernier conseil calculé. */
  getAdvice: () => CoachAdvice
  /** Patch du catalogue statique courant. */
  getPatch: () => string
  now?: () => number
  post?: Poster
}

export class Feedback extends EventEmitter {
  private flushTimer: NodeJS.Timeout | null = null
  private flushing = false
  private lastSentAt: string | null = null
  /** `champion|itemId` → horodatage du dernier signalement. */
  private readonly recent = new Map<string, number>()

  constructor(private readonly deps: FeedbackDeps) {
    super()
  }

  get state(): FeedbackState {
    return {
      enabled: this.deps.config.get('feedbackEnabled'),
      pending: this.deps.store.count(),
      lastSentAt: this.lastSentAt,
    }
  }

  start(): void {
    if (this.flushTimer) return
    void this.flush()
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_TICK_MS)
  }

  dispose(): void {
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.flushTimer = null
    this.removeAllListeners()
  }

  setEnabled(enabled: boolean): FeedbackState {
    this.deps.config.set('feedbackEnabled', enabled)
    const next = this.state
    this.emit('state', next)
    return next
  }

  /** UUID anonyme d'installation, généré au premier besoin. */
  private installId(): string {
    let id = this.deps.config.get('installId')
    if (!id) {
      id = randomUUID()
      this.deps.config.set('installId', id)
    }
    return id
  }

  /**
   * Compose et met en file un signalement. Retourne `false` si l'état de partie
   * ne permet pas d'en faire un (hors partie) ou si c'est un doublon récent.
   */
  report(draft: FeedbackDraft): boolean {
    const now = (this.deps.now ?? Date.now)()
    const live = this.deps.getLive()
    const advice = this.deps.getAdvice()
    if (!live || advice.status !== 'active' || !advice.self) return false

    const key = `${advice.self.slug}|${draft.itemId ?? 'none'}`
    const last = this.recent.get(key)
    if (last !== undefined && now - last < DEDUPE_MS) return false
    this.recent.set(key, now)

    const rec = advice.recommendation
    const picked =
      draft.itemRank === 0 ? rec?.primary : (rec?.alternatives[draft.itemRank - 1] ?? null)

    const report: FeedbackReport = {
      id: randomUUID(),
      createdAt: new Date(now).toISOString(),
      installId: this.installId(),
      appVersion: this.deps.appVersion,
      patch: this.deps.getPatch(),
      buildsPatch: rec?.skeleton?.patchSpan ?? null,
      champion: advice.self.slug,
      role: advice.self.role,
      level: advice.self.level,
      completedItems: rec?.buildPath.filter((s) => s.owned).length ?? 0,
      itemId: draft.itemId,
      itemRank: draft.itemRank,
      reasonCode: draft.reasonCode,
      hadSkeleton: !!rec?.skeleton,
      skeletonGames: rec?.skeleton?.games ?? null,
      snapshot: {
        meta: {
          champion: advice.self.slug,
          role: advice.self.role,
          atSeconds: Math.round(advice.gameTimeSeconds),
          patch: this.deps.getPatch(),
          expectedItemId: draft.itemId,
          expectedItemName: picked?.name ?? null,
          expectedCategory: 'signalé-incohérent',
        },
        live,
      },
    }

    this.deps.store.append(report)
    logger.info(`feedback: signalement enregistré (${report.champion}, item ${report.itemId})`)
    this.emit('state', this.state)
    void this.flush()
    return true
  }

  /** Vide la file vers Supabase. Silencieux en cas d'échec (on réessaiera). */
  async flush(): Promise<void> {
    if (this.flushing) return
    if (!this.deps.config.get('feedbackEnabled') || !isConfigured()) return
    const pending = this.deps.store.readAll()
    if (pending.length === 0) return

    this.flushing = true
    try {
      const sent = await insertReports(pending, this.deps.post)
      if (sent.length > 0) {
        this.deps.store.remove(new Set(sent))
        this.lastSentAt = new Date((this.deps.now ?? Date.now)()).toISOString()
        logger.info(`feedback: ${sent.length} signalement(s) envoyé(s)`)
        this.emit('state', this.state)
      }
    } finally {
      this.flushing = false
    }
  }
}

export function createFeedback(deps: FeedbackDeps): Feedback {
  return new Feedback(deps)
}
