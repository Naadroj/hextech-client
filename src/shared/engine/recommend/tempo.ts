import type { NormalizedItem, StatBlock } from '../../staticdata-types'
import type { GameAssessment } from '../context'
import { GOLD_PER_STAT, statGoldValue } from './gold-values'

/**
 * Modèle de **tempo / coût d'opportunité** : un item défensif retarde la
 * courbe de dégâts du champion. La pénalité dépend de la fraction de son or qui
 * tombe *quand même* sur l'axe de dégâts, du moment de la partie, du nombre
 * d'items finis et de l'avance/retard.
 *
 * Biais d'avance : **neutre** — la défense ne passe devant que si la sévérité
 * de menace ET le coût de tempo sont tous deux favorables.
 */

const MAGIC_AXIS: (keyof StatBlock)[] = [
  'abilityPower',
  'magicPenetrationFlat',
  'magicPenetrationPercent',
  'abilityHaste',
]
const MARKSMAN_AXIS: (keyof StatBlock)[] = [
  'attackDamage',
  'critChance',
  'bonusAttackSpeedPercent',
  'armorPenetrationPercent',
  'lethality',
  'lifeSteal',
]
const BRUISER_AXIS: (keyof StatBlock)[] = [
  'attackDamage',
  'abilityHaste',
  'armorPenetrationPercent',
  'lethality',
  'bonusAttackSpeedPercent',
]

/** Rôles pour qui le powerspike passe aussi par la tankiness (PV = sur-axe). */
const TANKY_DAMAGE = new Set([
  'JUGGERNAUT',
  'DIVER',
  'FIGHTER',
  'BATTLEMAGE',
  'SKIRMISHER',
  'TANK',
  'VANGUARD',
])

/** Stats qui font avancer le powerspike de dégâts du champion. */
export function damageAxisKeys(a: GameAssessment): (keyof StatBlock)[] {
  const roles = a.self.profile.roles.map((r) => r.toUpperCase())
  const prim = a.self.profile.primary

  let base: (keyof StatBlock)[]
  // Axe déjà engagé par les achats : il prime sur le profil du champion (cas
  // flex — Shaco AD après un 1er item AD ne « voit » plus l'AP comme sur-axe).
  if (a.self.committedAxis === 'magic') base = MAGIC_AXIS
  else if (a.self.committedAxis === 'physical') {
    base = roles.includes('MARKSMAN') ? MARKSMAN_AXIS : BRUISER_AXIS
  } else if (prim === 'magic' || (roles.includes('MAGE') && prim !== 'physical')) base = MAGIC_AXIS
  else if (roles.includes('MARKSMAN')) base = MARKSMAN_AXIS
  else if (prim === 'physical') base = BRUISER_AXIS
  else base = [...new Set([...MAGIC_AXIS, ...MARKSMAN_AXIS])]

  // Bruiser / battlemage / tank-damage : Trinity Force, Riftmaker, Sundered Sky…
  // font partie de leur cœur de build (contre `ad-lethality → ad-bruiser` et
  // `ap-damage → tank` au benchmark).
  if (roles.some((r) => TANKY_DAMAGE.has(r)) && !roles.includes('MARKSMAN')) {
    return [...base, 'health']
  }
  return base
}

/** Fraction (0..1) de l'or « stats » de l'item qui tombe sur l'axe de dégâts. */
export function onAxisGoldFraction(item: NormalizedItem, axis: (keyof StatBlock)[]): number {
  const total = statGoldValue(item.stats)
  if (total <= 0) return 0
  let onAxis = 0
  for (const k of axis) onAxis += (item.stats[k] ?? 0) * (GOLD_PER_STAT[k] ?? 0)
  return Math.min(1, onAxis / total)
}

export function tempoWeight(a: GameAssessment): number {
  const t = a.gameTimeSeconds
  const phaseFactor = t < 900 ? 1 : t < 1500 ? 0.75 : 0.5
  const n = a.self.completedItemCount
  const itemFactor = n <= 1 ? 1 : n === 2 ? 0.85 : n === 3 ? 0.65 : 0.45
  const leadFactor = a.self.fed >= 0.7 ? 1.1 : a.self.fed <= -0.6 ? 0.6 : 1
  return 0.18 * phaseFactor * itemFactor * leadFactor
}

/** Pénalité de tempo (≥ 0) — coût d'opportunité d'un détour hors axe de dégâts. */
export function tempoPenalty(
  item: NormalizedItem,
  a: GameAssessment,
  axis: (keyof StatBlock)[],
): number {
  const offAxis = 1 - onAxisGoldFraction(item, axis)
  if (offAxis <= 0) return 0
  return offAxis * (item.goldTotal / 1000) * tempoWeight(a)
}
