import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { logger } from '../logger'
import { FeedbackStore } from './store'
import { insertReports, isConfigured, type Poster } from './supabase'
import type { ConfigStore } from '../config-store'
import type { LiveGameData } from '../../shared/live-types'
import type { CoachAdvice } from '../../shared/coach-types'
import type { HistoryStep } from '../../shared/history-types'
import type {
  FeedbackDraft,
  FeedbackPushResult,
  FeedbackReport,
  FeedbackState,
} from '../../shared/feedback-types'
import { FEEDBACK_COMMENT_MAX } from '../../shared/feedback-types'

export * from './store'
export * from './supabase'

/**
 * Orchestrateur des signalements : compose le rapport depuis l'état de partie
 * courant et l'écrit dans la file locale. **Rien ne part tout seul** — l'envoi
 * en base est déclenché explicitement depuis l'onglet Signalements, ce qui
 * laisse le temps d'ajouter des précisions à froid, après la partie.
 *
 * Le clic en jeu est donc purement local et ne peut pas échouer.
 * Événement : `state` (`FeedbackState`).
 */

/** Anti-spam : un même (champion, item) n'est pas resignalé avant ce délai. */
const DEDUPE_MS = 30_000

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
  /** Fil des propositions de la partie en cours (optionnel). */
  getHistory?: () => HistoryStep[]
  now?: () => number
  post?: Poster
}

export class Feedback extends EventEmitter {
  private pushing = false
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
      configured: isConfigured(),
    }
  }

  dispose(): void {
    this.removeAllListeners()
  }

  /** Rapports en attente, du plus récent au plus ancien. */
  list(): FeedbackReport[] {
    return this.deps.store.readAll().reverse()
  }

  /** Ajoute ou remplace les précisions d'un rapport en attente. */
  annotate(id: string, comment: string): boolean {
    const trimmed = comment.trim().slice(0, FEEDBACK_COMMENT_MAX)
    const ok = this.deps.store.patch(id, { comment: trimmed || null })
    if (ok) this.emit('state', this.state)
    return ok
  }

  /** Jette un rapport sans l'envoyer. */
  discard(id: string): boolean {
    const before = this.deps.store.count()
    this.deps.store.remove(new Set([id]))
    const ok = this.deps.store.count() < before
    if (ok) this.emit('state', this.state)
    return ok
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

    const history = this.deps.getHistory?.() ?? []
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
      comment: null,
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
        ...(history.length > 0 ? { history } : {}),
      },
    }

    this.deps.store.append(report)
    logger.info(`feedback: signalement enregistré (${report.champion}, item ${report.itemId})`)
    this.emit('state', this.state)
    return true
  }

  /**
   * Envoie la file vers Supabase. **Déclenché à la main** depuis l'app. Ce qui
   * n'est pas parti reste en file : on ne perd jamais un rapport.
   */
  async push(): Promise<FeedbackPushResult> {
    const pending = this.deps.store.readAll()
    const idle = (error: FeedbackPushResult['error']): FeedbackPushResult => ({
      sent: 0,
      remaining: pending.length,
      error,
    })
    if (pending.length === 0) return { sent: 0, remaining: 0, error: null }
    if (this.pushing) return idle('network')
    if (!this.deps.config.get('feedbackEnabled')) return idle('disabled')
    if (!isConfigured()) return idle('not-configured')

    this.pushing = true
    try {
      const sent = await insertReports(pending, this.deps.post)
      if (sent.length > 0) {
        this.deps.store.remove(new Set(sent))
        this.lastSentAt = new Date((this.deps.now ?? Date.now)()).toISOString()
        logger.info(`feedback: ${sent.length} signalement(s) envoyé(s)`)
      }
      const remaining = this.deps.store.count()
      this.emit('state', this.state)
      return { sent: sent.length, remaining, error: remaining > 0 ? 'network' : null }
    } finally {
      this.pushing = false
    }
  }
}

export function createFeedback(deps: FeedbackDeps): Feedback {
  return new Feedback(deps)
}
