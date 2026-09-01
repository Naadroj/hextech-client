import type { StatBlock } from '../../staticdata-types'

/**
 * Valeur en or approximative par unité de stat (barème « communautaire »
 * courant). Sert uniquement au sous-score d'efficacité — c'est un départage,
 * pas une vérité.
 */
export const GOLD_PER_STAT: Partial<Record<keyof StatBlock, number>> = {
  attackDamage: 35,
  abilityPower: 20,
  health: 2.67,
  armor: 20,
  magicResist: 20,
  healthRegen: 3,
  manaRegen: 3,
  mana: 1.4,
  bonusAttackSpeedPercent: 25,
  critChance: 40,
  abilityHaste: 26.7,
  lethality: 35,
  moveSpeed: 12,
  moveSpeedPercent: 20,
  lifeSteal: 37.5,
  omnivamp: 39,
  healAndShieldPower: 18,
  armorPenetrationPercent: 35,
  magicPenetrationFlat: 15,
  magicPenetrationPercent: 35,
  tenacity: 25,
}

/** Valeur en or brute des stats d'un item (hors passifs/actifs). */
export function statGoldValue(stats: Partial<StatBlock>): number {
  let total = 0
  for (const [key, gold] of Object.entries(GOLD_PER_STAT) as [keyof StatBlock, number][]) {
    total += (stats[key] ?? 0) * gold
  }
  return total
}
