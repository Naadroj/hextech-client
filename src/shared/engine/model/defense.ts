import type { StatBlock } from '../../staticdata-types'

/**
 * Couche modèle — défense effective (A2). Fonctions pures.
 */

/**
 * Multiplicateur de dégâts subis pour une résistance donnée (armure ou RM).
 * `resist = 0` → 1 ; `100` → 0,5 ; les valeurs négatives amplifient les dégâts
 * selon la formule du jeu (`2 - 100/(100 - resist)`).
 */
export function damageMultiplier(resist: number): number {
  return resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist)
}

export interface Penetration {
  /** Réduction plate d'armure/RM appliquée en premier (ex. Cleaver). */
  flatReduction?: number
  /** % de réduction + % de pénétration, cumulés, appliqués ensuite. */
  percent?: number
  /** Pénétration plate (létalité / pénétration magique) appliquée en dernier. */
  flat?: number
}

/**
 * Résistance effective après pénétration, dans l'ordre du jeu :
 * réduction plate → % → pénétration plate. Peut devenir négative.
 */
export function effectiveResist(base: number, pen: Penetration = {}): number {
  let r = base - (pen.flatReduction ?? 0)
  r = r * (1 - (pen.percent ?? 0) / 100)
  r = r - (pen.flat ?? 0)
  return r
}

export interface EffectiveHp {
  /** PV bruts. */
  flat: number
  /** PV effectifs contre des dégâts purement physiques. */
  vsPhysical: number
  /** PV effectifs contre des dégâts purement magiques. */
  vsMagic: number
}

/** PV effectifs d'un bloc de stats, sans pénétration adverse. */
export function effectiveHp(stats: Pick<StatBlock, 'health' | 'armor' | 'magicResist'>): EffectiveHp {
  return {
    flat: stats.health,
    vsPhysical: stats.health / damageMultiplier(stats.armor),
    vsMagic: stats.health / damageMultiplier(stats.magicResist),
  }
}

export interface DamageMix {
  physical: number
  magic: number
  true: number
}

/**
 * PV effectifs contre un **profil de dégâts** (parts phys/mag/vrai), en tenant
 * compte de la pénétration de l'attaquant. Plus la valeur est haute, plus la
 * cible encaisse ce profil. Sert au moteur (A3) à pondérer « de quoi ai-je le
 * plus besoin : armure, RM ou PV ? ».
 */
export function effectiveHpVsProfile(
  stats: Pick<StatBlock, 'health' | 'armor' | 'magicResist'>,
  mix: DamageMix,
  pen: { armor?: Penetration; magic?: Penetration } = {},
): number {
  const total = mix.physical + mix.magic + mix.true || 1
  const p = mix.physical / total
  const m = mix.magic / total
  const t = mix.true / total
  const effArmor = effectiveResist(stats.armor, pen.armor)
  const effMr = effectiveResist(stats.magicResist, pen.magic)
  const takenMultiplier = p * damageMultiplier(effArmor) + m * damageMultiplier(effMr) + t * 1
  return takenMultiplier > 0 ? stats.health / takenMultiplier : Infinity
}
