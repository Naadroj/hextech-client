import type { AbilityDamage, DamageProfile, StatBlock } from '../../staticdata-types'
import { damageMultiplier, effectiveResist } from './defense'
import { rotationDamage, type SpellAttacker } from './spell-damage'

/**
 * Couche modèle — offense effective (A2 / A2.2). Fonctions pures.
 *
 * `damageOutputIndex` estime le débit de dégâts pour la **comparaison marginale**
 * en A4 (build avec l'item X vs sans). Quand les **ratios de sorts** réels sont
 * fournis (A2.2, via Meraki), la composante « sorts » est calculée pour de vrai ;
 * sinon on retombe sur un proxy.
 */

/** Multiplicateur de dégâts moyen des attaques de base compte tenu du crit. */
export const BASE_CRIT_MULTIPLIER = 1.75

export function critFactor(critChancePercent: number, critMultiplier = BASE_CRIT_MULTIPLIER): number {
  const c = Math.min(100, Math.max(0, critChancePercent)) / 100
  return 1 + c * (critMultiplier - 1)
}

/** Cible minimale pour les calculs offensifs : ses résistances. */
export interface TargetResists {
  armor: number
  magicResist: number
}

function physicalPen(stats: StatBlock) {
  return { percent: stats.armorPenetrationPercent, flat: stats.lethality }
}
function magicPen(stats: StatBlock) {
  return { percent: stats.magicPenetrationPercent, flat: stats.magicPenetrationFlat }
}

/**
 * DPS d'attaques de base contre une cible : `AD × facteur crit × AS`, atténué
 * par l'armure effective de la cible (après pénétration de l'attaquant).
 */
export function autoAttackDps(
  stats: StatBlock,
  target: Pick<TargetResists, 'armor'>,
  opts: { critMultiplier?: number } = {},
): number {
  const effArmor = effectiveResist(target.armor, physicalPen(stats))
  const perHit = stats.attackDamage * critFactor(stats.critChance, opts.critMultiplier)
  return perHit * stats.attackSpeed * damageMultiplier(effArmor)
}

/**
 * Proxy heuristique du **débit de dégâts** d'un champion (stats `stats`, profil
 * `profile`) contre une cible aux résistances `target`. Sans unité — seul
 * l'ordre relatif compte.
 *
 * Propriétés garanties (monotonie), toutes choses égales par ailleurs :
 *  - ↑ AP  ⇒ ↑ index pour un profil à dominante magique ;
 *  - ↑ AD / crit / vitesse d'attaque ⇒ ↑ index pour un profil physique ;
 *  - ↑ pénétration d'armure/létalité ⇒ ↑ index contre une cible blindée ;
 *  - ↑ pénétration magique ⇒ ↑ index contre une cible avec de la RM ;
 *  - ↑ accélération de compétence ⇒ ↑ index.
 */
export interface DamageOutputOpts {
  critMultiplier?: number
  /** Ratios de sorts réels (A2.2). Si fournis (non vides), remplacent le proxy. */
  abilities?: AbilityDamage[]
  level?: number
  baseAttackDamage?: number
  baseHealth?: number
}

export function damageOutputIndex(
  stats: StatBlock,
  profile: Pick<DamageProfile, 'physical' | 'magic' | 'true' | 'pattern'>,
  target: TargetResists,
  opts: DamageOutputOpts = {},
): number {
  const total = profile.physical + profile.magic + profile.true || 1
  const pPhys = profile.physical / total
  const pMag = profile.magic / total
  const pTrue = profile.true / total

  const effArmor = effectiveResist(target.armor, physicalPen(stats))
  const effMr = effectiveResist(target.magicResist, magicPen(stats))
  const physMult = damageMultiplier(effArmor)
  const magMult = damageMultiplier(effMr)
  const hasteFactor = 1 + stats.abilityHaste / 100

  // Composante attaques de base (physique par convention).
  const autoComp =
    stats.attackDamage *
    critFactor(stats.critChance, opts.critMultiplier) *
    stats.attackSpeed *
    physMult

  let spellComp: number
  if (opts.abilities && opts.abilities.length > 0) {
    // Sorts réels : dégâts d'une rotation contre la cible, échelonnés pour être
    // du même ordre de grandeur que `autoComp` (comparaison marginale).
    const attacker: SpellAttacker = {
      stats,
      baseAttackDamage: opts.baseAttackDamage ?? stats.attackDamage * 0.5,
      baseHealth: opts.baseHealth ?? stats.health * 0.6,
      level: opts.level ?? 11,
    }
    const rot = rotationDamage(opts.abilities, attacker, {
      armor: target.armor,
      magicResist: target.magicResist,
      maxHealth: 2000,
      armorPen: physicalPen(stats),
      magicPen: magicPen(stats),
    })
    spellComp = ((rot.physical + rot.magic + rot.true) / 4) * hasteFactor
  } else {
    // Proxy : pondéré par les parts du profil.
    spellComp =
      (pPhys * (stats.attackDamage * 0.6) * physMult +
        pMag * (stats.abilityPower * 0.9) * magMult +
        pTrue * (stats.attackDamage * 0.3 + stats.abilityPower * 0.3)) *
      hasteFactor
  }

  // Mélange auto / sorts selon le motif de dégâts.
  const autoWeight =
    profile.pattern === 'sustained' ? 0.6 : profile.pattern === 'burst' ? 0.15 : 0.4

  return autoWeight * autoComp + (1 - autoWeight) * spellComp
}
