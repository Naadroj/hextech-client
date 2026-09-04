import { randomUUID } from 'node:crypto'
import type { CoachAdvice } from '../../shared/coach-types'
import type { HistoryStep } from '../../shared/history-types'
import { HistoryStore } from './store'

export * from './store'

/**
 * Enregistre les propositions du coach, une partie à la fois.
 *
 * Une « partie » commence au premier conseil actif et se termine au retour à
 * `idle` — ou dès que le champion/rôle change, ce qui veut dire qu'on est
 * passé à la partie suivante sans repasser par `idle` (app relancée en cours
 * de game, par exemple).
 *
 * On n'écrit que sur **changement réel** de proposition : le coach pousse aussi
 * des battements de cœur, qui n'ont rien à raconter.
 */

/** Étapes jointes à un signalement (les plus récentes). */
export const HISTORY_IN_REPORT = 30

function signature(advice: CoachAdvice): string {
  const r = advice.recommendation
  if (!r) return ''
  return [
    r.primary?.itemId ?? '-',
    r.alternatives.map((a) => a.itemId).join('.'),
    r.boots?.itemId ?? '-',
    advice.axisOverride ?? 'auto',
  ].join('|')
}

export interface HistoryRecorderDeps {
  store: HistoryStore
  getPatch: () => string
}

export class HistoryRecorder {
  private gameId: string | null = null
  private gameKey: string | null = null
  private lastSignature = ''

  constructor(private readonly deps: HistoryRecorderDeps) {}

  get currentGameId(): string | null {
    return this.gameId
  }

  /** À brancher sur l'événement `advice` du coach. */
  record(advice: CoachAdvice): void {
    if (advice.status !== 'active' || !advice.self) {
      this.close()
      return
    }

    const key = `${advice.self.slug}|${advice.self.role}`
    if (this.gameKey !== key) {
      this.close()
      this.gameId = randomUUID()
      this.gameKey = key
      this.deps.store.open({
        kind: 'meta',
        id: this.gameId,
        startedAt: new Date().toISOString(),
        champion: advice.self.slug,
        role: advice.self.role,
        patch: this.deps.getPatch(),
      })
    }

    const sig = signature(advice)
    if (!sig || sig === this.lastSignature) return
    this.lastSignature = sig

    const rec = advice.recommendation
    const p = rec?.primary ?? null
    const step: HistoryStep = {
      t: Math.round(advice.gameTimeSeconds),
      at: new Date().toISOString(),
      gold: advice.self.currentGold,
      level: advice.self.level,
      completedItems: rec?.buildPath.filter((s) => s.owned).length ?? 0,
      axis: advice.axisOverride,
      primary: p
        ? {
            itemId: p.itemId,
            name: p.name,
            goldTotal: p.goldTotal,
            affordable: p.affordableNow,
            reason: p.reasons[0] ?? null,
          }
        : null,
      alternatives: (rec?.alternatives ?? []).map((a) => ({ itemId: a.itemId, name: a.name })),
      boots: rec?.boots ? { itemId: rec.boots.itemId, name: rec.boots.name } : null,
    }
    this.deps.store.append(this.gameId!, step)
  }

  /** Étapes de la partie en cours, pour joindre à un signalement. */
  currentSteps(limit = HISTORY_IN_REPORT): HistoryStep[] {
    if (!this.gameId) return []
    const game = this.deps.store.read(this.gameId)
    return game ? game.steps.slice(-limit) : []
  }

  private close(): void {
    this.gameId = null
    this.gameKey = null
    this.lastSignature = ''
  }
}

export function createHistoryRecorder(deps: HistoryRecorderDeps): HistoryRecorder {
  return new HistoryRecorder(deps)
}
