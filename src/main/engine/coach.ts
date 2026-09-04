import { EventEmitter } from 'node:events'
import type { LiveSnapshot } from '../../shared/live-types'
import type { StaticData } from '../../shared/staticdata-types'
import type { BuildAxis, BuildBook } from '../../shared/build-types'
import type { CoachAdvice } from '../../shared/coach-types'
import { IDLE_ADVICE } from '../../shared/coach-types'
import { assessGame } from '../../shared/engine/context'
import { recommend, type ItemRecommendation, type Recommendation } from '../../shared/engine/recommend'

/**
 * Substitue le nom d'affichage localisé (`nameLocalized`) sur chaque item
 * conseillé. Le moteur a déjà tourné avec le nom anglais (appariements de
 * bottes, etc.) — on ne touche qu'au libellé remonté à l'UI.
 */
function localizeNames(rec: Recommendation, sd: StaticData): Recommendation {
  const loc = (itemId: number, fallback: string): string => sd.getItem(itemId)?.nameLocalized ?? fallback
  const fix = <T extends ItemRecommendation>(r: T): T => ({ ...r, name: loc(r.itemId, r.name) })
  return {
    ...rec,
    primary: rec.primary ? fix(rec.primary) : null,
    alternatives: rec.alternatives.map(fix),
    boots: rec.boots ? fix(rec.boots) : null,
    buildPath: rec.buildPath.map((s) => ({ ...s, name: loc(s.itemId, s.name) })),
    skeleton: rec.skeleton
      ? { ...rec.skeleton, starters: rec.skeleton.starters.map((s) => ({ ...s, name: loc(s.itemId, s.name) })) }
      : null,
  }
}

/**
 * Orchestrateur du moteur de coaching : à chaque instantané du poller Live,
 * recalcule évaluation (A3) + recommandation (A4) et émet un `advice` — mais
 * seulement quand quelque chose d'utile a changé (items conseillés, palier
 * d'or franchi, changement de niveau), sinon au plus une fois toutes les
 * `heartbeatMs`.
 *
 * Événement : `advice` (`CoachAdvice`).
 */

export interface CoachDeps {
  /** Émetteur du poller Live (événements `snapshot` / `status`). */
  poller: EventEmitter & { currentStatus: 'idle' | 'active'; snapshot: LiveSnapshot | null }
  /** Accès au catalogue courant (peut changer sur rafraîchissement de patch). */
  getStaticData: () => StaticData | null
  /** Squelette de build hi-elo (A4.3) — optionnel : absent = moteur pré-A4.3. */
  getBuildBook?: () => BuildBook | null
  /** Intervalle minimal entre deux pushes « rien n'a changé » (défaut : 5000). */
  heartbeatMs?: number
  now?: () => number
}

function recommendedIds(advice: CoachAdvice): string {
  const r = advice.recommendation
  if (!r) return ''
  return [
    r.primary?.itemId,
    ...r.alternatives.map((x) => x.itemId),
    r.boots?.itemId,
    r.primary?.affordableNow ? 'y' : 'n',
  ].join(',')
}

export class Coach extends EventEmitter {
  private last: CoachAdvice = IDLE_ADVICE
  /** Axe force par l'utilisateur, remis a zero a chaque nouvelle partie. */
  private axisOverride: BuildAxis | null = null
  private lastPushAt = 0
  private disposed = false
  private readonly onSnapshot: (s: LiveSnapshot) => void
  private readonly onStatus: (status: 'idle' | 'active') => void

  constructor(private readonly deps: CoachDeps) {
    super()
    this.onSnapshot = (s) => this.handleSnapshot(s)
    this.onStatus = (status) => {
      // Nouvelle partie (ou fin) : l'axe force ne doit jamais fuiter d'une
      // partie a l'autre — on peut jouer AD Shaco puis AP Shaco.
      this.axisOverride = null
      if (status === 'idle') this.emitAdvice(IDLE_ADVICE, true)
    }
    deps.poller.on('snapshot', this.onSnapshot)
    deps.poller.on('status', this.onStatus)
  }

  get advice(): CoachAdvice {
    return this.last
  }

  /** Force l'axe de degats (`null` = auto). Recalcule immediatement. */
  setAxisOverride(axis: BuildAxis | null): CoachAdvice {
    this.axisOverride = axis
    const snap = this.deps.poller.snapshot
    if (snap) this.handleSnapshot(snap, true)
    return this.last
  }

  dispose(): void {
    this.disposed = true
    this.deps.poller.off('snapshot', this.onSnapshot)
    this.deps.poller.off('status', this.onStatus)
    this.removeAllListeners()
  }

  private handleSnapshot(snap: LiveSnapshot, force = false): void {
    if (this.disposed) return
    const sd = this.deps.getStaticData()
    if (!sd) return

    const assessment = assessGame(snap.data, sd)
    const now = (this.deps.now ?? Date.now)()
    if (!assessment) {
      this.emitAdvice({ ...IDLE_ADVICE, computedAt: now }, false)
      return
    }

    const book = this.deps.getBuildBook?.() ?? undefined
    const rec = localizeNames(
      recommend(assessment, sd, book, this.axisOverride),
      sd,
    )

    // Catalogue périmé : champions inconnus (championId 0 = profil de repli).
    const unknownEnemies = assessment.threat.enemies.filter((e) => e.championId === 0).length
    const dataWarning: CoachAdvice['dataWarning'] =
      assessment.self.championId === 0 || unknownEnemies >= 2 ? 'stale' : null

    const advice: CoachAdvice = {
      status: 'active',
      dataWarning,
      computedAt: now,
      gameTimeSeconds: assessment.gameTimeSeconds,
      self: {
        slug: assessment.self.slug,
        role: assessment.self.role,
        level: assessment.self.level,
        currentGold: assessment.self.currentGold,
        profilePrimary: assessment.self.profile.primary,
        fed: assessment.self.fed,
        isManaConstrained: assessment.self.isManaConstrained,
      },
      threat: {
        physical: assessment.threat.physical,
        magic: assessment.threat.magic,
        true: assessment.threat.true,
        burst: assessment.threat.burst,
        primarySlug: assessment.threat.primary?.slug ?? null,
        primaryFed: assessment.threat.primary?.fed ?? 0,
      },
      recommendation: rec,
      axisOverride: this.axisOverride,
      axisSwitchAvailable:
        book?.hasAxisVariants(assessment.self.slug, assessment.self.role) ?? false,
    }

    const changed =
      this.last.status !== 'active' ||
      recommendedIds(advice) !== recommendedIds(this.last) ||
      (advice.self && this.last.self && advice.self.level !== this.last.self.level)
    const heartbeat = now - this.lastPushAt >= (this.deps.heartbeatMs ?? 5000)

    if (changed || heartbeat || force) this.emitAdvice(advice, false)
    else this.last = advice // garde l'état à jour sans notifier
  }

  private emitAdvice(advice: CoachAdvice, force: boolean): void {
    this.last = advice
    this.lastPushAt = (this.deps.now ?? Date.now)()
    if (force || !this.disposed) this.emit('advice', advice)
  }
}

export function createCoach(deps: CoachDeps): Coach {
  return new Coach(deps)
}
