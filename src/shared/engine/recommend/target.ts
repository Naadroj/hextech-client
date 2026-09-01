import { damageMultiplier } from '../model'
import type { GameAssessment } from '../context'

/**
 * « Cible représentative » des calculs offensifs : l'ennemi que le joueur veut
 * réellement tuer — le carry le plus fragile en priorité, sinon le moins de PV
 * effectifs.
 */

export interface RepresentativeTarget {
  armor: number
  magicResist: number
  slug: string | null
}

const CARRY_ROLES = new Set(['MARKSMAN', 'MAGE', 'ASSASSIN', 'BURST', 'ARTILLERY'])

export function representativeTarget(a: GameAssessment): RepresentativeTarget {
  const enemies = a.threat.enemies
  if (enemies.length === 0) return { armor: 30, magicResist: 30, slug: null }

  const carries = enemies.filter(
    (e) =>
      e.role === 'BOT' ||
      e.role === 'MID' ||
      e.profile.roles.some((r) => CARRY_ROLES.has(r.toUpperCase())),
  )
  const pool = carries.length > 0 ? carries : enemies

  // PV effectifs mixtes (moyenne armure/RM) — le plus bas = le plus tuable.
  const ehp = (armor: number, mr: number, hp: number): number =>
    hp / ((damageMultiplier(armor) + damageMultiplier(mr)) / 2)

  const pick = pool
    .slice()
    .sort(
      (x, y) =>
        ehp(x.effectiveStats.armor, x.effectiveStats.magicResist, x.effectiveStats.health) -
        ehp(y.effectiveStats.armor, y.effectiveStats.magicResist, y.effectiveStats.health),
    )[0]

  // Mélange : la cible tuable (65 %) + la moyenne de l'équipe ennemie (35 %),
  // pour que la pénétration soit créditée face à une frontline blindée même si
  // le carry visé, lui, n'a pas d'armure.
  const avg = (sel: (e: (typeof enemies)[number]) => number): number =>
    enemies.reduce((s, e) => s + sel(e), 0) / enemies.length
  return {
    armor: 0.65 * pick.effectiveStats.armor + 0.35 * avg((e) => e.effectiveStats.armor),
    magicResist:
      0.65 * pick.effectiveStats.magicResist + 0.35 * avg((e) => e.effectiveStats.magicResist),
    slug: pick.slug,
  }
}
