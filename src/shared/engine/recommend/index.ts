import type { StaticData } from '../../staticdata-types'
import type { BuildBook } from '../../build-types'
import type { GameAssessment } from '../context'
import { generateCandidates } from './candidates'
import { representativeTarget } from './target'
import { contextWeights } from './weights'
import { scoreItem } from './score'
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
export * from './explain'

const pct = (v: number): string => `${Math.round(v * 100)} %`

/**
 * Recommandation du prochain achat à partir d'une évaluation de partie (A3) et
 * du catalogue statique. Pure et déterministe.
 */
/** Seuil de sévérité à partir duquel on envisage une reco de composant défensif. */
const COMPONENT_SEVERITY_GATE = 0.55

export function recommend(a: GameAssessment, sd: StaticData, book?: BuildBook): Recommendation {
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

  return {
    primary,
    alternatives,
    boots: bootPick,
    context: {
      representativeTargetSlug: target.slug,
      threatSummary: `${pct(a.threat.physical)} phys / ${pct(a.threat.magic)} mag / ${pct(
        a.threat.true,
      )} vrai · burst ${pct(a.threat.burst)}`,
      weightProfile: weights.label,
    },
  }
}
