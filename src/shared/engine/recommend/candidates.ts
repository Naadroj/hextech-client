import type { NormalizedItem, StaticData } from '../../staticdata-types'
import type { GameAssessment } from '../context'

/**
 * Génération de l'espace de candidats : items légendaires « finaux » achetables
 * sur la Faille + bottes de tier 2, hors items déjà possédés.
 */

/** Au-dessus de cet id : upgrades Ornn / enchantements de bottes, non achetables directement. */
const MAX_BUYABLE_ID = 200000

export interface Candidates {
  legendaries: NormalizedItem[]
  boots: NormalizedItem[]
  /** Composants défensifs bon marché (Seeker's Armguard, Hexdrinker, QSS…). */
  components: NormalizedItem[]
  /** `true` si le joueur ne porte pas encore de bottes. */
  needsBoots: boolean
}

const RX_SAVE = /\bstasis\b|quicksilver|removes all crowd control/i

export function generateCandidates(a: GameAssessment, sd: StaticData): Candidates {
  const owned = new Set(a.self.items)
  const all = sd.getAllItems()

  const legendaries = all.filter(
    (i) =>
      i.id < MAX_BUYABLE_ID &&
      i.onSummonersRift &&
      i.purchasable &&
      i.isFinal &&
      !i.isBoots &&
      !i.isConsumable &&
      !i.isTrinket &&
      i.goldTotal >= 2000 &&
      !owned.has(i.id),
  )

  const boots = all.filter(
    (i) =>
      i.id < MAX_BUYABLE_ID &&
      i.isBoots &&
      i.depth >= 2 &&
      i.purchasable &&
      i.goldTotal >= 900 &&
      !owned.has(i.id),
  )

  const components = all.filter(
    (i) =>
      i.id < MAX_BUYABLE_ID &&
      i.onSummonersRift &&
      i.purchasable &&
      !i.isFinal &&
      !i.isBoots &&
      !i.isConsumable &&
      !i.isTrinket &&
      i.goldTotal >= 700 &&
      i.goldTotal <= 1700 &&
      ((i.stats.armor ?? 0) > 0 ||
        (i.stats.magicResist ?? 0) > 0 ||
        (i.stats.health ?? 0) >= 150 ||
        RX_SAVE.test(i.description)) &&
      !owned.has(i.id),
  )

  const needsBoots = !a.self.items.some((id) => sd.getItem(id)?.isBoots)

  return { legendaries, boots, components, needsBoots }
}
