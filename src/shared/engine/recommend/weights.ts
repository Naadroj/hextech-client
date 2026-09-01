import type { GameAssessment } from '../context'

/**
 * Pondération contextuelle des quatre sous-scores. Base = profil du joueur,
 * puis modulations selon l'état de partie (retard, focus, burst adverse…).
 */

export interface Weights {
  offense: number
  defense: number
  utility: number
  costEfficiency: number
  /** `carry` | `combattant` | `tank` | `utilitaire`. */
  label: string
}

const CARRY = new Set(['MARKSMAN', 'ASSASSIN', 'BURST', 'ARTILLERY', 'BATTLEMAGE'])
const TANKY = new Set(['TANK', 'VANGUARD', 'WARDEN'])

/**
 * Ordre de résolution : enchanteur → tank/vanguard → carry (dont mage solo) →
 * mage-support → combattant. `MAGE` seul ne suffit pas à faire un « carry » si
 * le champion est aussi tank ou support.
 */
function baseWeights(roles: string[]): Weights {
  const r = roles.map((x) => x.toUpperCase())
  const has = (x: string): boolean => r.includes(x)

  if (has('ENCHANTER'))
    return { offense: 0.1, defense: 0.22, utility: 0.58, costEfficiency: 0.1, label: 'utilitaire' }
  if (r.some((x) => TANKY.has(x)))
    return { offense: 0.12, defense: 0.53, utility: 0.25, costEfficiency: 0.1, label: 'tank' }
  if (r.some((x) => CARRY.has(x)))
    return { offense: 0.55, defense: 0.2, utility: 0.15, costEfficiency: 0.1, label: 'carry' }
  if (has('MAGE'))
    return has('SUPPORT') || has('CATCHER')
      ? { offense: 0.18, defense: 0.24, utility: 0.48, costEfficiency: 0.1, label: 'utilitaire' }
      : { offense: 0.55, defense: 0.2, utility: 0.15, costEfficiency: 0.1, label: 'carry' }
  return { offense: 0.4, defense: 0.35, utility: 0.15, costEfficiency: 0.1, label: 'combattant' }
}

export function contextWeights(a: GameAssessment): Weights {
  const base = baseWeights(a.self.profile.roles)
  const t = a.triggers

  let off = base.offense
  let def = base.defense
  let util = base.utility
  let ce = base.costEfficiency

  if (t.behindHard) {
    ce += 0.08
    def += 0.05
    off -= 0.13
  }
  if (t.aheadHard) {
    off += 0.1
    def -= 0.1
  }
  if (t.beingFocused) {
    def += 0.16
    off -= 0.16
  }
  if (a.threat.burst > 0.55 && base.label === 'carry') {
    def += 0.1
    off -= 0.1
  }
  // Situations « build-defining » : on remonte fortement le poids d'utilité.
  if (t.enemyHealing === 'heavy') util += 0.14
  else if (t.enemyHealing === 'moderate') util += 0.07
  if (t.enemyHardCC) util += 0.2
  util += 0.16 * t.burstSeverity

  off = Math.max(0.03, off)
  def = Math.max(0.03, def)
  util = Math.max(0.03, util)
  ce = Math.max(0.03, ce)
  const sum = off + def + util + ce

  return {
    offense: off / sum,
    defense: def / sum,
    utility: util / sum,
    costEfficiency: ce / sum,
    label: base.label,
  }
}
