import type { NormalizedItem } from '../../staticdata-types'

/**
 * Catégories **fonctionnelles** d'un item. Un item peut en servir plusieurs
 * (Vestige mortel = pénétration d'armure ET antisoin). Sert :
 *  - au benchmark A4.2 (« accord de catégorie » : intersection non vide entre
 *    l'item acheté par le pro et l'item conseillé) ;
 *  - potentiellement au moteur (diversification).
 */

export type ItemCategory =
  | 'boots'
  | 'antiheal'
  | 'qss'
  | 'stasis'
  | 'lifeline'
  | 'armor-pen'
  | 'magic-pen'
  | 'armor'
  | 'magic-resist'
  | 'health'
  | 'crit'
  | 'attack-speed'
  | 'on-hit'
  | 'ability-power'
  | 'attack-damage'
  | 'ability-haste'
  | 'mana'
  | 'other'

/** Items à effet « bouée » (bouclier de survie) non détectables autrement. */
const LIFELINE_IDS = new Set([3156, 3155, 3053, 3814, 2504])

/** Toutes les catégories qui s'appliquent à un item (au moins `['other']`). */
export function itemCategories(item: NormalizedItem): ItemCategory[] {
  if (item.isBoots) return ['boots']

  const s = item.stats
  const d = item.description
  const out = new Set<ItemCategory>()

  if (/grievous wounds/i.test(d)) out.add('antiheal')
  if (/quicksilver|removes all crowd control/i.test(d)) out.add('qss')
  if (/\bstasis\b/i.test(d)) out.add('stasis')
  if (LIFELINE_IDS.has(item.id) || /lifeline/i.test(d)) out.add('lifeline')
  if (/on-?hit/i.test(d)) out.add('on-hit')

  if ((s.armorPenetrationPercent ?? 0) > 0 || (s.lethality ?? 0) > 0) out.add('armor-pen')
  if ((s.magicPenetrationPercent ?? 0) > 0 || (s.magicPenetrationFlat ?? 0) > 0) out.add('magic-pen')
  if ((s.armor ?? 0) > 0) out.add('armor')
  if ((s.magicResist ?? 0) > 0) out.add('magic-resist')
  if ((s.health ?? 0) >= 300) out.add('health')
  if ((s.critChance ?? 0) > 0) out.add('crit')
  if ((s.bonusAttackSpeedPercent ?? 0) >= 20) out.add('attack-speed')
  if ((s.abilityPower ?? 0) > 0) out.add('ability-power')
  if ((s.attackDamage ?? 0) > 0) out.add('attack-damage')
  if ((s.abilityHaste ?? 0) >= 15) out.add('ability-haste')
  if ((s.mana ?? 0) >= 250) out.add('mana')

  return out.size > 0 ? [...out] : ['other']
}

/** Catégorie « dominante » (première de la liste ordonnée). Rétro-compat. */
export function itemCategory(item: NormalizedItem): ItemCategory {
  return itemCategories(item)[0]
}

/** `true` si les deux items partagent au moins une catégorie fonctionnelle. */
export function categoriesOverlap(a: NormalizedItem, b: NormalizedItem): boolean {
  const bc = new Set(itemCategories(b))
  return itemCategories(a).some((c) => bc.has(c))
}

/**
 * Rôle de build **unique** d'un item (pour la métrique d'accord du benchmark) :
 * plus discriminant qu'une intersection de catégories, tout en tolérant les
 * substituts (Lord Dominik's ≈ Collector = `lethality` ; Kraken ≈ BotRK =
 * `on-hit`). Ordre = priorité.
 */
export type ItemBucket =
  | 'boots'
  | 'antiheal'
  | 'qss'
  | 'stasis'
  | 'lethality'
  | 'magic-pen'
  | 'mr'
  | 'armor'
  | 'crit'
  | 'on-hit'
  | 'ap-bruiser'
  | 'ap-burst'
  | 'ad-bruiser'
  | 'ad'
  | 'mana'
  | 'health-tank'
  | 'haste'
  | 'other'

/**
 * « Intention » d'itémisation — regroupement grossier des buckets pour la
 * métrique d'accord du benchmark : Bâton du néant ≈ Rabadon (`ap-damage`),
 * Collector ≈ Éclipse (`ad-lethality`)…
 */
export type Intent =
  | 'ap-damage'
  | 'ad-carry'
  | 'ad-onhit'
  | 'ad-bruiser'
  | 'tank'
  | 'antiheal'
  | 'qss'
  | 'stasis'
  | 'haste'
  | 'mana'
  | 'boots'
  | 'other'

const BUCKET_TO_INTENT: Record<ItemBucket, Intent> = {
  'magic-pen': 'ap-damage',
  'ap-burst': 'ap-damage',
  'ap-bruiser': 'ap-damage',
  // crit-carry & létalité assassin = même *intention* de build (dégâts AD core) :
  // IE ≈ Collector ≈ Lord Dominik's pour l'accord.
  crit: 'ad-carry',
  lethality: 'ad-carry',
  'on-hit': 'ad-onhit',
  'ad-bruiser': 'ad-bruiser',
  ad: 'ad-bruiser',
  armor: 'tank',
  mr: 'tank',
  'health-tank': 'tank',
  antiheal: 'antiheal',
  qss: 'qss',
  stasis: 'stasis',
  haste: 'haste',
  mana: 'mana',
  boots: 'boots',
  other: 'other',
}

export function itemIntent(item: NormalizedItem): Intent {
  return BUCKET_TO_INTENT[itemBucket(item)]
}

export function itemBucket(item: NormalizedItem): ItemBucket {
  const s = item.stats
  const d = item.description
  if (item.isBoots) return 'boots'
  if (/grievous wounds/i.test(d)) return 'antiheal'
  if (/quicksilver|removes all crowd control/i.test(d)) return 'qss'
  if (/\bstasis\b/i.test(d)) return 'stasis'

  const ad = s.attackDamage ?? 0
  const ap = s.abilityPower ?? 0
  const hp = s.health ?? 0

  if ((s.armorPenetrationPercent ?? 0) > 0 || (s.lethality ?? 0) > 0) return 'lethality'
  if ((s.magicPenetrationPercent ?? 0) > 0 || (s.magicPenetrationFlat ?? 0) > 0) return 'magic-pen'
  if ((s.magicResist ?? 0) > 0 && ad === 0 && ap < 40) return 'mr'
  if ((s.armor ?? 0) > 0 && ad === 0 && ap < 40) return 'armor'
  if ((s.critChance ?? 0) > 0) return 'crit'
  if ((s.bonusAttackSpeedPercent ?? 0) >= 20 || /on-?hit/i.test(d)) return 'on-hit'
  if (ap > 0 && hp >= 250) return 'ap-bruiser'
  if (ap > 0) return 'ap-burst'
  if (ad > 0 && hp >= 250) return 'ad-bruiser'
  if (ad > 0) return 'ad'
  if ((s.mana ?? 0) >= 250) return 'mana'
  if (hp >= 300) return 'health-tank'
  if ((s.abilityHaste ?? 0) >= 15) return 'haste'
  return 'other'
}
