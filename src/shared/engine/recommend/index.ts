import type { StaticData } from '../../staticdata-types'
import type { BuildBook } from '../../build-types'
import type { GameAssessment } from '../context'
import { generateCandidates } from './candidates'
import { representativeTarget } from './target'
import { contextWeights } from './weights'
import { scoreItem } from './score'
import { inferCommittedAxis } from './committed-axis'
import { reasonsFor, reasonsForBoots, reasonsForComponent } from './explain'
import type { ItemRecommendation, Recommendation } from './types'

export * from './types'
export * from './categories'
export * from './gold-values'
export * from './candidates'
export * from './target'
export * from './weights'
export * from './tempo'
export * from './score'
export * from './build-prior'
export * from './committed-axis'
export * from './explain'

const pct = (v: number): string => `${Math.round(v * 100)} %`

/**
 * Recommandation du prochain achat à partir d'une évaluation de partie (A3) et
 * du catalogue statique. Pure et déterministe.
 */
/** Seuil de sévérité à partir duquel on envisage une reco de composant défensif. */
const COMPONENT_SEVERITY_GATE = 0.55

export function recommend(a0: GameAssessment, sd: StaticData, book?: BuildBook): Recommendation {
  // Axe déjà engagé par l'inventaire (AD/AP) → on l'attache à une copie de
  // l'évaluation, sans muter l'objet du caller.
  const committedAxis = inferCommittedAxis(a0, sd)
  const a: GameAssessment = committedAxis
    ? { ...a0, self: { ...a0.self, committedAxis } }
    : a0

  const target = representativeTarget(a)
  const weights = contextWeights(a)
  const { legendaries, boots, components, needsBoots } = generateCandidates(a, sd)

  const scored = legendaries
    .map((item) => {
      const s = scoreItem(item, a, target, weights, sd, 'legendary', book)
      s.reasons = reasonsFor(s, item, a, weights, target, book)
      return s
    })
    .sort((x, y) => y.score - x.score)

  let primary: ItemRecommendation | null = scored[0] ?? null
  let alternatives = scored.slice(1, 3)

  // Mode composant : menace vive + le meilleur item complet paie un lourd tempo
  // ⇒ un composant défensif bon marché peut être le meilleur achat *maintenant*.
  if (a.triggers.burstSeverity >= COMPONENT_SEVERITY_GATE && components.length > 0 && primary) {
    const bestComp = components
      .map((item) => scoreItem(item, a, target, weights, sd, 'component', book))
      .sort((x, y) => y.score - x.score)[0]
    if (bestComp && bestComp.score > primary.score) {
      const continueToward = primary
      bestComp.reasons = reasonsForComponent(bestComp, sd.getItem(bestComp.itemId)!, a, continueToward.name)
      alternatives = [continueToward, ...scored.slice(1, 2)]
      primary = bestComp
    }
  }

  let bootPick: Recommendation['boots'] = null
  if (needsBoots && boots.length > 0) {
    bootPick =
      boots
        .map((item) => scoreItem(item, a, target, weights, sd, 'boots', book))
        .sort((x, y) => y.score - x.score)[0] ?? null
    if (bootPick) bootPick.reasons = reasonsForBoots(bootPick, a)
  }

  // Chemin de build hi-elo complet (au-delà du prochain item) + méta squelette.
  const rb = book?.getBuild(a.self.slug, a.self.role)
  const ownedIds = new Set(a.self.items)
  const buildPath = (rb?.core ?? [])
    .slice()
    .sort((x, y) => x.avgSlot - y.avgSlot)
    .map((c) => ({
      itemId: c.id,
      name: sd.getItem(c.id)?.name ?? String(c.id),
      owned: ownedIds.has(c.id),
      slot: c.avgSlot,
    }))
  const skeleton: Recommendation['skeleton'] = rb
    ? {
        games: rb.games,
        roleAgnostic: !!rb.roleAgnostic,
        patchSpan: rb.patchSpan ?? null,
        starters: (rb.starters ?? []).map((s) => ({
          itemId: s.id,
          name: sd.getItem(s.id)?.name ?? String(s.id),
          pickRate: s.pickRate,
        })),
      }
    : null

  return {
    primary,
    alternatives,
    boots: bootPick,
    buildPath,
    skeleton,
    context: {
      representativeTargetSlug: target.slug,
      threatSummary: `${pct(a.threat.physical)} phys / ${pct(a.threat.magic)} mag / ${pct(
        a.threat.true,
      )} vrai · burst ${pct(a.threat.burst)}`,
      weightProfile: weights.label,
    },
  }
}
