import type {
  AttackType,
  DamagePattern,
  DamageProfile,
  DamageProfileOverride,
  DamageType,
  NormalizedChampion,
} from './types'
import { fetchJson, type FetchJsonOptions } from './fetcher'
import overridesJson from './overrides.json' with { type: 'json' }

/**
 * Dérivation du **profil de dégâts** par champion.
 *
 * Chaîne de résolution : `overrides.json` (corrections manuelles) →
 * Meraki Analytics (`adaptiveType` + `damageType` par sort) → repli Data Dragon
 * (tags + `info`). Aucune clé requise ; Meraki peut être en retard d'un patch
 * (quelques champions récents absents → repli Data Dragon).
 */

const MERAKI_CDN = 'https://cdn.merakianalytics.com/riot/lol/resources'
export const merakiUrl = (locale = 'en-US') =>
  `${MERAKI_CDN}/latest/${locale}/champions.json`

const OVERRIDES = overridesJson as Record<string, DamageProfileOverride>

// ─── Forme brute (sous-ensemble utilisé) ──────────────────────────────────

interface MerakiAbility {
  name?: string
  damageType?: string | null
}

export interface MerakiChampion {
  id: number
  key?: string
  name?: string
  adaptiveType?: string
  attackType?: string
  roles?: string[]
  abilities?: Record<string, MerakiAbility[]>
}

export type MerakiChampionsFile = Record<string, MerakiChampion>

export async function fetchMerakiChampions(
  options?: FetchJsonOptions & { locale?: string },
): Promise<MerakiChampionsFile> {
  return fetchJson<MerakiChampionsFile>(merakiUrl(options?.locale), options)
}

// ─── Utilitaires ──────────────────────────────────────────────────────────

const normKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const BURST_ROLES = new Set(['BURST', 'ASSASSIN', 'ARTILLERY'])
const SUSTAINED_ROLES = new Set([
  'MARKSMAN',
  'JUGGERNAUT',
  'SKIRMISHER',
  'BATTLEMAGE',
  'WARDEN',
  'SPECIALIST',
])

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function finish(
  championId: number,
  slug: string,
  parts: [number, number, number],
  attackType: AttackType,
  roles: string[],
  source: DamageProfile['source'],
  patternHint?: DamagePattern,
): DamageProfile {
  const sum = parts[0] + parts[1] + parts[2] || 1
  const physical = round3(parts[0] / sum)
  const magic = round3(parts[1] / sum)
  const trueDmg = round3(1 - physical - magic)
  const upper = roles.map((r) => r.toUpperCase())

  let pattern: DamagePattern = patternHint ?? 'mixed'
  if (!patternHint) {
    if (upper.some((r) => BURST_ROLES.has(r))) pattern = 'burst'
    else if (upper.some((r) => SUSTAINED_ROLES.has(r))) pattern = 'sustained'
  }

  const entries: [DamageType, number][] = [
    ['physical', physical],
    ['magic', magic],
    ['true', trueDmg],
  ]
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  const primary: DamageProfile['primary'] = top[1] >= 0.6 ? top[0] : 'mixed'

  return {
    championId,
    slug,
    physical,
    magic,
    true: trueDmg,
    attackType,
    primary,
    pattern,
    roles: upper,
    source,
  }
}

function deriveFromMeraki(mc: MerakiChampion, champ: NormalizedChampion): DamageProfile {
  const axis: DamageType = mc.adaptiveType === 'MAGIC_DAMAGE' ? 'magic' : 'physical'
  const attackType: AttackType =
    mc.attackType === 'MELEE' ? 'MELEE' : mc.attackType === 'RANGED' ? 'RANGED' : 'UNKNOWN'
  const roles = mc.roles ?? champ.tags

  let p = 0
  let m = 0
  let t = 0
  for (const arr of Object.values(mc.abilities ?? {})) {
    for (const ab of arr ?? []) {
      switch (ab.damageType) {
        case 'PHYSICAL_DAMAGE':
          p += 1
          break
        case 'MAGIC_DAMAGE':
          m += 1
          break
        case 'TRUE_DAMAGE':
          t += 1
          break
        case 'MIXED_DAMAGE':
          p += 0.5
          m += 0.5
          break
        default:
          break
      }
    }
  }

  const signal = p + m + t
  if (signal < 1) {
    const pure: [number, number, number] =
      axis === 'magic' ? [0.2, 0.75, 0.05] : [0.72, 0.23, 0.05]
    return finish(champ.id, champ.slug, pure, attackType, roles, 'meraki')
  }

  // `adaptiveType` comme biais, pondéré par la quantité de signal.
  const w = Math.max(1, signal * 0.5)
  let pp = p + (axis === 'physical' ? w : 0)
  let mm = m + (axis === 'magic' ? w : 0)
  const tt = t

  // Tireur à distance à dominante physique : l'essentiel du dégât vient des
  // attaques de base, sous-représentées par le comptage de sorts.
  const upper = roles.map((r) => r.toUpperCase())
  if (upper.includes('MARKSMAN') && attackType === 'RANGED' && axis === 'physical') pp += 2
  if (upper.includes('MARKSMAN') && attackType === 'RANGED' && axis === 'magic') mm += 1

  return finish(champ.id, champ.slug, [pp, mm, tt], attackType, roles, 'meraki')
}

function deriveFromDdragon(champ: NormalizedChampion): DamageProfile {
  const tags = champ.tags
  const attackType: AttackType = champ.base.attackrange >= 285 ? 'RANGED' : 'MELEE'
  const a = Math.max(0, champ.info.attack)
  const mg = Math.max(0, champ.info.magic)
  const infoBlend: [number, number, number] =
    a + mg > 0 ? [(a / (a + mg)) * 0.95, (mg / (a + mg)) * 0.95, 0.05] : [0.5, 0.45, 0.05]

  let parts: [number, number, number]
  let pattern: DamagePattern | undefined
  if (tags.includes('Marksman')) {
    parts = [0.8, 0.15, 0.05]
    pattern = 'sustained'
  } else if (tags.includes('Mage')) {
    parts = [0.15, 0.8, 0.05]
  } else if (tags.includes('Assassin')) {
    parts = infoBlend
    pattern = 'burst'
  } else if (tags.includes('Fighter')) {
    parts = [0.7, 0.25, 0.05]
    pattern = 'sustained'
  } else if (tags.includes('Tank')) {
    parts = [0.45, 0.5, 0.05]
  } else if (tags.includes('Support')) {
    parts = [0.25, 0.7, 0.05]
  } else {
    parts = infoBlend
  }
  return finish(champ.id, champ.slug, parts, attackType, tags, 'ddragon', pattern)
}

function applyOverride(champ: NormalizedChampion): DamageProfile | null {
  const ov = OVERRIDES[champ.slug]
  if (!ov) return null
  return finish(
    champ.id,
    champ.slug,
    [ov.physical, ov.magic, ov.true],
    champ.base.attackrange >= 285 ? 'RANGED' : 'MELEE',
    champ.tags,
    'override',
    ov.pattern,
  )
}

/**
 * Construit la table de profils de dégâts pour tous les champions Data Dragon.
 * `merakiFile` optionnel : si absent ou incomplet, repli Data Dragon.
 */
export function deriveDamageProfiles(
  champions: NormalizedChampion[],
  merakiFile: MerakiChampionsFile | null,
): DamageProfile[] {
  const byId = new Map<number, MerakiChampion>()
  const byKey = new Map<string, MerakiChampion>()
  for (const [key, mc] of Object.entries(merakiFile ?? {})) {
    if (typeof mc?.id === 'number') byId.set(mc.id, mc)
    byKey.set(normKey(mc?.key ?? key), mc)
  }

  return champions.map((champ) => {
    const override = applyOverride(champ)
    if (override) return override
    const mc = byId.get(champ.id) ?? byKey.get(normKey(champ.slug))
    return mc ? deriveFromMeraki(mc, champ) : deriveFromDdragon(champ)
  })
}

/** Nombre de champions couverts par `overrides.json` (diagnostic). */
export const overrideCount = Object.keys(OVERRIDES).length
