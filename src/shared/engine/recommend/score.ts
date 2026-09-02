import type { NormalizedItem, StaticData } from '../../staticdata-types'
import type { BuildBook } from '../../build-types'
import {
  addItemStats,
  damageOutputIndex,
  effectiveHpVsProfile,
  type Penetration,
} from '../model'
import type { GameAssessment } from '../context'
import { statGoldValue } from './gold-values'
import { buildPrior } from './build-prior'
import { damageAxisKeys, onAxisGoldFraction, tempoPenalty } from './tempo'
import type { RepresentativeTarget } from './target'
import type { Weights } from './weights'
import type { ItemKind, ItemRecommendation } from './types'

/**
 * Score d'un item candidat par comparaison marginale (« avec » vs « sans »)
 * contre l'état de partie.
 */

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

const RX_GRIEVOUS = /grievous wounds/i
const RX_QSS = /quicksilver|removes all crowd control/i
const RX_STASIS = /\bstasis\b/i
/** Items qui punissent les attaques de base (Randuin, Cœur gelé, Épines, Gargouille). */
const AA_PUNISH_IDS = new Set([3143, 3110, 3075, 3193])

function penetrationOf(a: GameAssessment): { armor?: Penetration; magic?: Penetration } {
  const p = a.threat.primary
  if (!p) return {}
  return {
    armor: {
      percent: p.effectiveStats.armorPenetrationPercent,
      flat: p.effectiveStats.lethality,
    },
    magic: {
      percent: p.effectiveStats.magicPenetrationPercent,
      flat: p.effectiveStats.magicPenetrationFlat,
    },
  }
}

/** Items « bouée de sauvetage » défensifs non détectés par `hasActive` (revive/lifeline). */
const DEFENSIVE_SAVE_IDS = new Set([3026, 3157, 3156, 3155, 3053, 3814])

/** Bonus situationnel d'un item (0 .. ~1,6). */
export function utilityScore(item: NormalizedItem, a: GameAssessment): number {
  const t = a.triggers
  let u = 0

  if (t.enemyHealing !== 'none' && RX_GRIEVOUS.test(item.description)) {
    u += t.enemyHealing === 'heavy' ? 1.1 : 0.35
  }
  if (t.enemyHardCC && RX_QSS.test(item.description)) u += 1.1
  // Objet « bouée » (stase / lifeline) : bonus **gradué** par la sévérité du burst.
  const isSaveItem =
    (item.hasActive && RX_STASIS.test(item.description)) ||
    DEFENSIVE_SAVE_IDS.has(item.id) ||
    RX_STASIS.test(item.description)
  if (isSaveItem && (t.burstSeverity > 0.45 || t.beingFocused)) {
    u += 0.25 + 0.6 * Math.max(t.burstSeverity, t.beingFocused ? 0.45 : 0)
  }
  if (a.self.isManaConstrained && ((item.stats.mana ?? 0) >= 200 || /mana/i.test(item.plaintext))) {
    u += 0.4
  }

  // Adéquation d'axe de résistance, croissante avec la part de menace et le burst.
  const burstMul = a.threat.burst > 0.55 ? 1.5 : 1
  if (a.threat.physical >= 0.5 && (item.stats.armor ?? 0) > 0) {
    u += (0.15 + 0.7 * Math.max(0, (a.threat.physical - 0.5) / 0.5)) * burstMul
  }
  if (a.threat.magic >= 0.5 && (item.stats.magicResist ?? 0) > 0) {
    u += (0.15 + 0.7 * Math.max(0, (a.threat.magic - 0.5) / 0.5)) * burstMul
  }

  if (t.enemyAutoAttackers && AA_PUNISH_IDS.has(item.id)) u += 0.45

  return Math.min(1.6, u)
}

export function scoreItem(
  item: NormalizedItem,
  a: GameAssessment,
  target: RepresentativeTarget,
  weights: Weights,
  sd: StaticData,
  kind: ItemKind = 'legendary',
  book?: BuildBook,
): ItemRecommendation {
  const before = a.self.stats
  const after = addItemStats(before, item)
  const pen = penetrationOf(a)

  const axis = damageAxisKeys(a)
  const dmgOpts = {
    abilities: sd.getSpellDamage(a.self.slug)?.abilities,
    level: a.self.level,
    baseAttackDamage: a.self.baseAttackDamage,
    baseHealth: a.self.baseHealth,
  }
  const offBefore = damageOutputIndex(before, a.self.profile, target, dmgOpts)
  const offAfter = damageOutputIndex(after, a.self.profile, target, dmgOpts)
  const rawOffense = offBefore > 0 ? (offAfter - offBefore) / offBefore : 0
  // Amortissement léger des gains marginaux extrêmes (empilement crit/AS), sans
  // écraser l'offense des carries (la pénétration passe justement par là).
  const KNEE = 0.7
  const damped =
    rawOffense <= KNEE ? Math.max(0, rawOffense) : KNEE + 0.7 * (rawOffense - KNEE)

  // « Continue ta courbe de carry » : quand rien ne menace et que le build n'est
  // pas fini, on relance les items sur l'axe de dégâts (contre-poids à la
  // sur-défensive du moteur constatée au benchmark).
  const roles = a.self.profile.roles.map((r) => r.toUpperCase())
  const isCarry = roles.some((r) =>
    ['MARKSMAN', 'ASSASSIN', 'BURST', 'ARTILLERY', 'MAGE', 'BATTLEMAGE'].includes(r),
  )
  const onAxis = onAxisGoldFraction(item, axis)
  const nothingPressing =
    a.triggers.burstSeverity < 0.5 &&
    !a.triggers.enemyHardCC &&
    a.triggers.enemyHealing !== 'heavy' &&
    !a.triggers.beingFocused &&
    !a.triggers.behindHard
  const coreBuild =
    isCarry && nothingPressing && a.self.completedItemCount < 5 && onAxis >= 0.45
      ? 0.2 * onAxis
      : 0
  const offense = damped + coreBuild

  const mix = { physical: a.threat.physical, magic: a.threat.magic, true: a.threat.true }
  const ehpBefore = effectiveHpVsProfile(before, mix, pen)
  const ehpAfter = effectiveHpVsProfile(after, mix, pen)
  const defense =
    Number.isFinite(ehpBefore) && ehpBefore > 0 ? (ehpAfter - ehpBefore) / ehpBefore : 0

  const utility = utilityScore(item, a)

  const eff = statGoldValue(item.stats) / Math.max(1, item.goldTotal)
  const costEfficiency = clamp((eff - 0.75) / 0.5, -0.5, 1)

  const tempo = -tempoPenalty(item, a, axis)

  // Prior de build (A4.3) : bonus si l'item est dans le squelette hi-elo du
  // champion + rôle. Additif — l'heuristique ci-dessus peut toujours dominer.
  const prior = buildPrior(item, a, book, kind).value

  // Pénalité de timing « stat-stick de PV » : un item qui ne pèse au score que
  // par des PV bruts (aucune résistance, aucun actif, offense et utilité quasi
  // nulles — Warmog, Heartsteel) est un très mauvais 1er/2e achat. Sans entrée
  // de squelette, le moteur défautait sinon dessus pour les juggernauts.
  const rawHpStick =
    (item.stats.health ?? 0) >= 400 &&
    (item.stats.armor ?? 0) === 0 &&
    (item.stats.magicResist ?? 0) === 0 &&
    !item.hasActive &&
    offense < 0.12 &&
    utility <= 0.05
  const EARLY_STICK_PENALTY = [0.9, 0.5, 0.15]
  const timing =
    rawHpStick && prior === 0 && a.self.completedItemCount < EARLY_STICK_PENALTY.length
      ? -EARLY_STICK_PENALTY[a.self.completedItemCount]
      : 0

  const score =
    weights.offense * offense +
    weights.defense * defense +
    weights.utility * utility +
    weights.costEfficiency * costEfficiency +
    tempo +
    prior +
    timing

  return {
    itemId: item.id,
    name: item.name,
    kind,
    goldTotal: item.goldTotal,
    affordableNow: a.self.currentGold >= item.goldTotal,
    goldShort: Math.max(0, item.goldTotal - a.self.currentGold),
    score,
    breakdown: { offense, defense, utility, costEfficiency, tempo, buildPrior: prior, timing },
    reasons: [],
  }
}
