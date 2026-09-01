import type { LivePlayer } from '../../live-types'
import type { DamageProfile, StaticData } from '../../staticdata-types'
import { EMPTY_STATS, effectiveStats } from '../model'
import { playerKey } from './live-adapter'
import type {
  AllyAssessment,
  DamageMixShares,
  EnemyThreat,
  FedAssessment,
  InferredRole,
  ThreatAssessment,
} from './types'

/**
 * Vecteur de menace ennemi et composition alliée.
 */

/** Profil neutre si un champion n'a aucun profil (ne devrait pas arriver). */
export const FALLBACK_PROFILE: DamageProfile = {
  championId: 0,
  slug: 'unknown',
  physical: 0.5,
  magic: 0.45,
  true: 0.05,
  attackType: 'UNKNOWN',
  primary: 'mixed',
  pattern: 'mixed',
  roles: [],
  source: 'ddragon',
}

/** Poids « combien ce rôle menace-t-il » (0 = inoffensif, 1 = carry). */
const ROLE_DAMAGE_WEIGHT: Record<string, number> = {
  MARKSMAN: 1,
  MAGE: 1,
  ASSASSIN: 1,
  BURST: 1,
  ARTILLERY: 1,
  BATTLEMAGE: 0.95,
  SKIRMISHER: 0.85,
  DIVER: 0.85,
  JUGGERNAUT: 0.8,
  SPECIALIST: 0.7,
  VANGUARD: 0.45,
  TANK: 0.4,
  WARDEN: 0.4,
  CATCHER: 0.4,
  ENCHANTER: 0.3,
}

const FRONTLINE_ROLES = new Set(['TANK', 'VANGUARD', 'WARDEN', 'JUGGERNAUT'])

export function baseDamageWeight(profile: DamageProfile | undefined): number {
  const roles = profile?.roles ?? []
  if (roles.length === 0) return 0.7
  const vals = roles.map((r) => ROLE_DAMAGE_WEIGHT[r.toUpperCase()] ?? 0.7)
  const max = Math.max(...vals)
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  // Adouci : un bruiser-mage (MAGE + TANK) ne pèse pas autant qu'un vrai carry.
  return 0.6 * max + 0.4 * avg
}

function patternBurstShare(p: DamageProfile): number {
  return p.pattern === 'burst' ? 1 : p.pattern === 'mixed' ? 0.5 : 0
}

function mixOf(
  rows: { weight: number; profile: DamageProfile }[],
  totalWeight: number,
): DamageMixShares {
  const w = totalWeight || 1
  return {
    physical: rows.reduce((a, r) => a + r.weight * r.profile.physical, 0) / w,
    magic: rows.reduce((a, r) => a + r.weight * r.profile.magic, 0) / w,
    true: rows.reduce((a, r) => a + r.weight * r.profile.true, 0) / w,
  }
}

export interface ThreatDeps {
  enemies: LivePlayer[]
  fed: Map<string, FedAssessment>
  roles: Map<string, InferredRole>
  staticData: StaticData
}

export function assessThreat(deps: ThreatDeps): ThreatAssessment {
  const { enemies, fed, roles, staticData } = deps

  const rows: EnemyThreat[] = enemies.map((p) => {
    const key = playerKey(p)
    const profile = staticData.getDamageProfile(p.championName) ?? FALLBACK_PROFILE
    const fedScore = fed.get(key)?.score ?? 0
    const weight = baseDamageWeight(profile) * (1 + clamp(fedScore, -0.6, 2) * 0.35)
    const base = staticData.getChampionStatsAtLevel(p.championName, p.level) ?? EMPTY_STATS
    const items = (p.items ?? [])
      .map((i) => staticData.getItem(i.itemID))
      .filter((x): x is NonNullable<typeof x> => !!x)
    return {
      key,
      championId: profile.championId,
      slug: p.championName,
      role: roles.get(key) ?? 'UNKNOWN',
      level: p.level,
      weight,
      fed: fedScore,
      profile,
      effectiveStats: effectiveStats(base, items),
      items: items.map((i) => i.id),
    }
  })

  const totalWeight = rows.reduce((a, r) => a + r.weight, 0)
  const mix = mixOf(rows, totalWeight)
  const burst =
    rows.reduce((a, r) => a + r.weight * patternBurstShare(r.profile), 0) / (totalWeight || 1)
  const primary = rows.slice().sort((a, b) => b.weight - a.weight)[0] ?? null

  return {
    ...mix,
    burst,
    sustained: 1 - burst,
    enemies: rows,
    totalScore: totalWeight,
    primary,
  }
}

// ─── Composition alliée ───────────────────────────────────────────────────

export function assessAllies(
  allies: LivePlayer[],
  selfProfile: DamageProfile,
  staticData: StaticData,
): AllyAssessment {
  const rows = [
    { weight: baseDamageWeight(selfProfile), profile: selfProfile },
    ...allies.map((p) => {
      const profile = staticData.getDamageProfile(p.championName) ?? FALLBACK_PROFILE
      return { weight: baseDamageWeight(profile), profile }
    }),
  ]
  const total = rows.reduce((a, r) => a + r.weight, 0)
  const hasFrontline = allies.some((p) =>
    (staticData.getDamageProfile(p.championName)?.roles ?? []).some((x) =>
      FRONTLINE_ROLES.has(x.toUpperCase()),
    ),
  )
  return { ...mixOf(rows, total), hasFrontline }
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
