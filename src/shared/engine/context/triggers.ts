import type { LivePlayer } from '../../live-types'
import type { StatBlock, StaticData } from '../../staticdata-types'
import { effectiveHpVsProfile } from '../model'
import { baseDamageWeight } from './threat'
import type { SituationalTriggers, ThreatAssessment } from './types'

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Déclencheurs situationnels : petits signaux booléens que le recommandeur (A4)
 * traduit en priorités d'items (antisoin, QSS, GA, Zhonya…).
 */

/**
 * Champions à sustain/soin marqué que la détection par items ne peut pas voir
 * (soin issu du kit). Volontairement **court** — ce n'est pas une table de
 * classification, juste une liste de cas connus, à revoir 1×/patch.
 */
const SUSTAIN_CHAMPIONS = new Set([
  'Soraka',
  'Yuumi',
  'Nami',
  'Sona',
  'Taric',
  'Milio',
  'Aatrox',
  'Vladimir',
  'DrMundo',
  'Warwick',
  'Sylas',
  'Swain',
  'Fiddlesticks',
  'Renekton',
  'Briar',
  'Ambessa',
])

const CC_ROLES = new Set(['CATCHER', 'VANGUARD', 'WARDEN'])
const AUTO_ROLES = new Set(['MARKSMAN', 'SKIRMISHER'])

export interface TriggerDeps {
  enemies: LivePlayer[]
  selfPlayer: LivePlayer
  /** Stats effectives réelles du joueur (pour estimer sa fragilité). */
  selfStats: StatBlock
  threat: ThreatAssessment
  selfFed: number
  gameTimeSeconds: number
  staticData: StaticData
}

/**
 * Létalité graduée du burst de la menace principale envers le joueur (0..1).
 */
function computeBurstSeverity(threat: ThreatAssessment, selfStats: StatBlock): number {
  const prim = threat.primary
  if (!prim) return 0

  // Une menace qui n'est PAS en avance n'est pas un burst « sévère » : le
  // danger du kit ne compte qu'à la mesure de son avance.
  const aheadFactor = clamp(prim.fed / 1.8, 0, 1)
  const roleTerm = clamp((baseDamageWeight(prim.profile) - 0.4) / 0.6, 0, 1)
  const burstTerm =
    prim.profile.pattern === 'burst' ? 1 : prim.profile.pattern === 'mixed' ? 0.5 : 0.15
  const kitDanger = 0.35 + 0.35 * roleTerm + 0.3 * burstTerm // 0,35 … 1

  const ehp = effectiveHpVsProfile(selfStats, {
    physical: threat.physical,
    magic: threat.magic,
    true: threat.true,
  })
  const fragility = clamp((3000 - ehp) / 1800, 0, 1)

  return clamp(aheadFactor * kitDanger + 0.15 * fragility, 0, 1)
}

export function assessTriggers(deps: TriggerDeps): SituationalTriggers {
  const { enemies, selfPlayer, selfStats, threat, selfFed, gameTimeSeconds, staticData } = deps

  // ─── Soin ennemi ───
  let healPoints = 0
  for (const e of enemies) {
    if (SUSTAIN_CHAMPIONS.has(e.championName)) healPoints += 1
    const items = (e.items ?? [])
      .map((i) => staticData.getItem(i.itemID))
      .filter((x): x is NonNullable<typeof x> => !!x)
    const vamp = items.reduce(
      (a, it) => a + (it.stats.lifeSteal ?? 0) + (it.stats.omnivamp ?? 0),
      0,
    )
    if (vamp >= 15) healPoints += 1
    else if (vamp >= 8) healPoints += 0.5
    if (items.some((it) => (it.stats.healAndShieldPower ?? 0) > 0)) healPoints += 0.5
  }
  const enemyHealing =
    healPoints >= 2.5 ? 'heavy' : healPoints >= 1 ? 'moderate' : 'none'

  // ─── CC dur ───
  const enemyHardCcCount = threat.enemies.filter((e) =>
    e.profile.roles.some((r) => CC_ROLES.has(r.toUpperCase())),
  ).length
  const enemyHardCC = enemyHardCcCount >= 2

  // ─── Burst de la menace principale (gradué) ───
  const primary = threat.primary
  const burstSeverity = computeBurstSeverity(threat, selfStats)
  const enemyBurstPhysical = burstSeverity >= 0.4 && !!primary && primary.profile.physical >= 0.5
  const enemyBurstMagic = burstSeverity >= 0.4 && !!primary && primary.profile.magic >= 0.5

  // ─── Auto-attaquants ───
  const autoCount = threat.enemies.filter((e) =>
    e.profile.roles.some((r) => AUTO_ROLES.has(r.toUpperCase())),
  ).length
  const enemyAutoAttackers = autoCount >= 2 && threat.physical >= 0.45

  // ─── Suis-je focus ? ───
  const deaths = selfPlayer.scores?.deaths ?? 0
  const beingFocused = deaths >= 4 && selfFed < 0.2 && gameTimeSeconds > 600

  return {
    enemyHealing,
    enemyHardCC,
    enemyHardCcCount,
    burstSeverity,
    enemyBurstPhysical,
    enemyBurstMagic,
    enemyAutoAttackers,
    beingFocused,
    aheadHard: selfFed >= 1,
    behindHard: selfFed <= -0.6,
  }
}
