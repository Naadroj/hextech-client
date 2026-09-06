import type { NormalizedItem, StaticData } from '../../staticdata-types'
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

/**
 * Part de la valeur-or d'un item partant en stats de dégâts de l'axe opposé.
 *
 * Au-delà, l'item est écarté du slot principal même si son `itemIntent` le dit
 * neutre. Le Cimeterre mercuriel est classé `qss` — à juste titre, on l'achète
 * pour le nettoyage de CC — mais ses 55 AD sont de l'or mort sur un champion AP,
 * et le proposer à une Annie a été signalé le 6 septembre 2026.
 */
const OFF_AXIS_DEAD_GOLD = 0.25

/**
 * `true` si l'item est de l'axe opposé — par son intention, **ou** parce qu'il
 * y laisse trop d'or malgré une intention neutre.
 */
export function isOffCommittedAxisItem(
  item: NormalizedItem,
  committed: 'physical' | 'magic' | undefined,
): boolean {
  if (!committed) return false
  if (isOffCommittedAxis(itemIntent(item), committed)) return true

  const total = statGoldValue(item.stats)
  if (total <= 0) return false
  const s = item.stats
  const offAxis =
    committed === 'magic'
      ? statGoldValue({
          attackDamage: s.attackDamage,
          lethality: s.lethality,
          critChance: s.critChance,
        })
      : statGoldValue({ abilityPower: s.abilityPower })
  return offAxis / total >= OFF_AXIS_DEAD_GOLD
}
