import type {
  AbilityDamage,
  ChampionSpellDamage,
  DamageType,
  NormalizedChampion,
  RatioStat,
} from './types'

/**
 * Extraction des **ratios de dégâts de sorts** depuis Meraki `champions.json`
 * (`abilities.{P,Q,W,E,R}[].effects[].leveling[].modifiers[]`).
 *
 * On ne garde qu'**un effet de dégâts principal par slot**, et seulement les
 * unités de ratio non ambiguës (`% AP`, `% bonus AD`, `% max HP`,
 * `% target max HP`…). Les cas complexes (ratios composés, DoT par tick) sont
 * ignorés — le moteur retombe alors sur le proxy pour ce sort.
 *
 * Réf. schéma : https://github.com/meraki-analytics/lolstaticdata
 */

interface RawModifier {
  values?: number[]
  units?: string[]
}
interface RawLeveling {
  attribute?: string
  modifiers?: RawModifier[]
}
interface RawAbility {
  damageType?: string | null
  effects?: { leveling?: RawLeveling[] }[]
}
export type MerakiAbilitiesFile = Record<
  string,
  { id?: number; key?: string; abilities?: Record<string, RawAbility[]> }
>

const SLOTS = ['P', 'Q', 'W', 'E', 'R'] as const
type Slot = (typeof SLOTS)[number]

const ATTR_DAMAGE = /(?:magic|physical|true|mixed|total)\s+damage$/i
const ATTR_REJECT =
  /reduced|minimum|minion|monster|non-?champion|reduction|per tick|increased|enhanced|stored|bonus attack damage/i

function attrScore(attr: string): number {
  const a = attr.toLowerCase()
  if (a.startsWith('total ')) return 3
  if (/^(magic|physical|true|mixed) damage$/.test(a)) return 2
  if (a.startsWith('maximum ')) return 1
  return 0 // "bonus X damage"
}

function damageTypeOf(attr: string, abilityType?: string | null): DamageType | 'mixed' {
  // Le champ `damageType` du sort est plus fiable que le libellé du leveling
  // (ex. Syndra W a un leveling « Total Mixed Damage » mais est 100 % magique).
  switch (abilityType) {
    case 'PHYSICAL_DAMAGE':
      return 'physical'
    case 'MAGIC_DAMAGE':
      return 'magic'
    case 'TRUE_DAMAGE':
      return 'true'
    case 'MIXED_DAMAGE':
      return 'mixed'
    default:
      break
  }
  if (/physical/i.test(attr)) return 'physical'
  if (/true/i.test(attr)) return 'true'
  if (/mixed/i.test(attr)) return 'mixed'
  return 'magic'
}

const UNIT_MAP: [RegExp, RatioStat][] = [
  [/^ap$/, 'ap'],
  [/^bonus ad$/, 'bonusAD'],
  [/^(total )?ad$/, 'totalAD'],
  [/^base ad$/, 'baseAD'],
  [/^bonus (health|hp)$/, 'bonusHP'],
  [/target.?s? (maximum |max )?(health|hp)$/, 'targetMaxHP'],
  [/target.?s? current (health|hp)$/, 'targetCurrentHP'],
  [/target.?s? missing (health|hp)$/, 'targetMissingHP'],
  [/^(maximum |max )?(health|hp)$/, 'maxHP'],
  [/^(bonus |total )?armor$/, 'armor'],
  [/^(bonus |total )?magic resist(ance)?$/, 'mr'],
  [/^(maximum |max |bonus )?mana$/, 'maxMana'],
]

/** Unité brute Meraki → `RatioStat` (ou `null` si non gérée). */
export function unitToRatioStat(unit: string): RatioStat | null {
  const s = unit
    .trim()
    .toLowerCase()
    .replace(/^\+?\s*/, '')
    .replace(/^%\s*/, '')
    .replace(/\bof (the|his|her|its|a) /g, '')
    .replace(/\bof /g, '')
  if (!s || /second|unit|stack|mark|soul|per |×|[[\]]|chunk|:/.test(s)) return null
  for (const [re, stat] of UNIT_MAP) if (re.test(s)) return stat
  return null
}

/** Réduit une liste de `values` (1, 3 ou 5) à un tableau par rang. */
const perRank = (values: number[] | undefined): number[] =>
  Array.isArray(values) && values.length > 0 ? values.slice(0, 5) : []

function parseLeveling(lv: RawLeveling): { flat: number[]; ratios: AbilityDamage['ratios'] } {
  let flat: number[] = []
  const ratios: AbilityDamage['ratios'] = []
  for (const m of lv.modifiers ?? []) {
    const vals = perRank(m.values)
    if (vals.length === 0) continue
    const units = m.units ?? []
    const firstUnit = units.find((u) => u && u.trim() !== '') ?? ''
    if (firstUnit === '') {
      flat = flat.length === 0 ? vals : flat.map((v, i) => v + (vals[i] ?? vals[vals.length - 1] ?? 0))
      continue
    }
    const stat = unitToRatioStat(firstUnit)
    if (!stat) continue
    const pct = vals.map((v) => v / 100)
    const existing = ratios.find((r) => r.stat === stat)
    if (existing) existing.pct = existing.pct.map((v, i) => v + (pct[i] ?? pct[pct.length - 1] ?? 0))
    else ratios.push({ stat, pct })
  }
  return { flat, ratios }
}

function bestAbilityForSlot(slot: Slot, raw: RawAbility[]): AbilityDamage | null {
  let best: { score: number; peak: number; ab: AbilityDamage } | null = null
  for (const entry of raw ?? []) {
    for (const eff of entry.effects ?? []) {
      for (const lv of eff.leveling ?? []) {
        const attr = lv.attribute ?? ''
        if (!ATTR_DAMAGE.test(attr) || ATTR_REJECT.test(attr)) continue
        const { flat, ratios } = parseLeveling(lv)
        if (flat.length === 0 && ratios.length === 0) continue
        const ab: AbilityDamage = {
          slot,
          damageType: damageTypeOf(attr, entry.damageType),
          flat,
          ratios,
        }
        const score = attrScore(attr)
        const peak = (flat[flat.length - 1] ?? 0) + ratios.reduce((s, r) => s + (r.pct.at(-1) ?? 0) * 100, 0)
        if (!best || score > best.score || (score === best.score && peak > best.peak)) {
          best = { score, peak, ab }
        }
      }
    }
  }
  return best?.ab ?? null
}

/**
 * Construit la table de dégâts de sorts pour les champions Data Dragon présents
 * dans Meraki. Un champion sans aucun sort parsable n'apparaît pas.
 */
export function deriveSpellDamage(
  champions: NormalizedChampion[],
  merakiFile: MerakiAbilitiesFile | null,
): ChampionSpellDamage[] {
  if (!merakiFile) return []
  type Entry = MerakiAbilitiesFile[string]
  const byId = new Map<number, Entry>()
  const byKey = new Map<string, Entry>()
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [key, mc] of Object.entries(merakiFile)) {
    if (typeof mc?.id === 'number') byId.set(mc.id, mc)
    byKey.set(norm(mc?.key ?? key), mc)
  }

  const out: ChampionSpellDamage[] = []
  for (const champ of champions) {
    const mc = byId.get(champ.id) ?? byKey.get(norm(champ.slug))
    if (!mc?.abilities) continue
    const abilities: AbilityDamage[] = []
    for (const slot of SLOTS) {
      const parsed = bestAbilityForSlot(slot, mc.abilities[slot] ?? [])
      if (parsed) abilities.push(parsed)
    }
    if (abilities.length > 0) out.push({ championId: champ.id, slug: champ.slug, abilities })
  }
  return out
}
