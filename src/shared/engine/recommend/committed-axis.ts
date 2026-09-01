import type { StaticData } from '../../staticdata-types'
import type { GameAssessment } from '../context'
import { statGoldValue } from './gold-values'
import { itemIntent } from './categories'

/**
 * Axe de dégâts **déjà engagé** par l'inventaire courant (légendaires **et
 * composants**), pour les champions flex (Shaco, Kayle, Kaïsa…). Une fois qu'un
 * joueur a mis assez d'or d'un côté (AD ou AP), on arrête de lui conseiller
 * l'autre axe.
 *
 * Somme la valeur-or des stats des items dont l'`itemIntent` est offensif, par
 * côté ; retourne le côté dominant s'il pèse ≥ `DOMINANCE` du total offensif et
 * que le total dépasse `MIN_GOLD` (≈ un gros composant).
 */

const MIN_GOLD = 650
const DOMINANCE = 0.7

const AD_INTENTS = new Set(['ad-carry', 'ad-onhit', 'ad-bruiser'])

export function inferCommittedAxis(
  a: GameAssessment,
  sd: StaticData,
): 'physical' | 'magic' | undefined {
  let ad = 0
  let ap = 0
  for (const id of a.self.items) {
    const it = sd.getItem(id)
    if (!it || it.isBoots || it.isConsumable || it.isTrinket) continue
    const intent = itemIntent(it)
    const g = statGoldValue(it.stats)
    if (g <= 0) continue
    if (intent === 'ap-damage') ap += g
    else if (AD_INTENTS.has(intent)) ad += g
  }
  const total = ad + ap
  if (total < MIN_GOLD) return undefined
  if (ad >= total * DOMINANCE) return 'physical'
  if (ap >= total * DOMINANCE) return 'magic'
  return undefined
}

/** `true` si l'`itemIntent` de l'item est sur l'axe **opposé** à l'axe engagé. */
export function isOffCommittedAxis(
  intent: ReturnType<typeof itemIntent>,
  committed: 'physical' | 'magic' | undefined,
): boolean {
  if (!committed) return false
  if (committed === 'physical') return intent === 'ap-damage'
  return AD_INTENTS.has(intent)
}
