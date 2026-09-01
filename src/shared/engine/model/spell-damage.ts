import type { AbilityDamage, RatioStat, StatBlock } from '../../staticdata-types'
import { damageMultiplier, effectiveResist, type Penetration } from './defense'

/**
 * Couche modèle — dégâts de sorts **réels** (A2.2), à partir des ratios extraits
 * de Meraki. Remplace le proxy de `damageOutputIndex` quand les données sont là.
 *
 * `rotationDamage` = dégâts d'une rotation Q+W+E+R au rang correspondant au
 * niveau, contre une cible donnée, avec les stats de l'attaquant.
 */

export interface SpellAttacker {
  stats: StatBlock
  /** AD de base (sans items) — pour les ratios « % bonus AD ». */
  baseAttackDamage: number
  /** PV de base au niveau — pour les ratios « % bonus health ». */
  baseHealth: number
  level: number
}

export interface SpellTarget {
  armor: number
  magicResist: number
  maxHealth: number
  /** PV actuels supposés (défaut : 55 % des PV max). */
  currentHealth?: number
  armorPen?: Penetration
  magicPen?: Penetration
}

/** Rang d'un slot en fonction du niveau (ordre de skill générique). */
export function rankAtLevel(slot: AbilityDamage['slot'], level: number): number {
  if (slot === 'R') return level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0
  if (slot === 'P') return 1
  // Q/W/E : une compétence « principale » maxée vers 9, les autres suivent.
  return Math.max(1, Math.min(5, Math.ceil((level - 2) / 2)))
}

const atRank = (arr: number[], rank: number): number => {
  if (arr.length === 0) return 0
  return arr[Math.min(arr.length, Math.max(1, rank)) - 1] ?? arr[arr.length - 1] ?? 0
}

function statValue(stat: RatioStat, atk: SpellAttacker, tgt: SpellTarget): number {
  const s = atk.stats
  const cur = tgt.currentHealth ?? tgt.maxHealth * 0.55
  switch (stat) {
    case 'ap':
      return s.abilityPower
    case 'bonusAD':
      return Math.max(0, s.attackDamage - atk.baseAttackDamage)
    case 'totalAD':
      return s.attackDamage
    case 'baseAD':
      return atk.baseAttackDamage
    case 'bonusHP':
      return Math.max(0, s.health - atk.baseHealth)
    case 'maxHP':
      return s.health
    case 'armor':
      return s.armor
    case 'mr':
      return s.magicResist
    case 'maxMana':
      return s.mana
    case 'targetMaxHP':
      return tgt.maxHealth
    case 'targetCurrentHP':
      return cur
    case 'targetMissingHP':
      return Math.max(0, tgt.maxHealth - cur)
    default:
      return 0
  }
}

export interface DamageTriple {
  physical: number
  magic: number
  true: number
}

/** Dégâts bruts (avant résistances) d'un sort à un rang donné. */
export function abilityRawDamage(
  ab: AbilityDamage,
  rank: number,
  atk: SpellAttacker,
  tgt: SpellTarget,
): number {
  if (rank <= 0) return 0
  let raw = atRank(ab.flat, rank)
  for (const r of ab.ratios) raw += atRank(r.pct, rank) * statValue(r.stat, atk, tgt)
  return Math.max(0, raw)
}

/** Dégâts d'un sort **après résistances** de la cible, ventilés par type. */
export function abilityDamage(
  ab: AbilityDamage,
  rank: number,
  atk: SpellAttacker,
  tgt: SpellTarget,
): DamageTriple {
  const raw = abilityRawDamage(ab, rank, atk, tgt)
  if (raw <= 0) return { physical: 0, magic: 0, true: 0 }

  const effArmor = effectiveResist(tgt.armor, tgt.armorPen)
  const effMr = effectiveResist(tgt.magicResist, tgt.magicPen)
  const physMult = damageMultiplier(effArmor)
  const magMult = damageMultiplier(effMr)

  switch (ab.damageType) {
    case 'physical':
      return { physical: raw * physMult, magic: 0, true: 0 }
    case 'true':
      return { physical: 0, magic: 0, true: raw }
    case 'mixed':
      return { physical: raw * 0.5 * physMult, magic: raw * 0.5 * magMult, true: 0 }
    default:
      return { physical: 0, magic: raw * magMult, true: 0 }
  }
}

/** Dégâts d'une rotation Q+W+E(+R) au niveau `atk.level`, après résistances. */
export function rotationDamage(
  abilities: AbilityDamage[],
  atk: SpellAttacker,
  tgt: SpellTarget,
): DamageTriple {
  const out: DamageTriple = { physical: 0, magic: 0, true: 0 }
  for (const ab of abilities) {
    if (ab.slot === 'P') continue
    const d = abilityDamage(ab, rankAtLevel(ab.slot, atk.level), atk, tgt)
    out.physical += d.physical
    out.magic += d.magic
    out.true += d.true
  }
  return out
}
