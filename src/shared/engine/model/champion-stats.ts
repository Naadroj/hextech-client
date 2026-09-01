import type { DdragonChampionStats, StatBlock } from '../../staticdata-types'
import { EMPTY_STATS } from './stats'

/**
 * Interpolation des stats de base d'un champion par niveau (courbe de
 * croissance non linéaire de League). Pur.
 */

/** `g(1) = 0`, `g(18) = 17`. */
export function growthFactor(level: number): number {
  const n = Math.max(1, Math.min(18, Math.floor(level)))
  return (n - 1) * (0.7025 + 0.0175 * (n - 1))
}

/** Stats de base d'un champion interpolées au niveau `level` (1..18). */
export function statsAtLevel(base: DdragonChampionStats, level: number): StatBlock {
  const g = growthFactor(level)
  return {
    ...EMPTY_STATS,
    health: base.hp + base.hpperlevel * g,
    healthRegen: base.hpregen + base.hpregenperlevel * g,
    mana: base.mp + base.mpperlevel * g,
    manaRegen: base.mpregen + base.mpregenperlevel * g,
    armor: base.armor + base.armorperlevel * g,
    magicResist: base.spellblock + base.spellblockperlevel * g,
    attackDamage: base.attackdamage + base.attackdamageperlevel * g,
    attackSpeed: base.attackspeed * (1 + (base.attackspeedperlevel / 100) * g),
    attackRange: base.attackrange,
    moveSpeed: base.movespeed,
    critChance: base.crit + base.critperlevel * g,
  }
}
