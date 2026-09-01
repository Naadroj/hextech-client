import type {
  DdragonChampionStats,
  NormalizedChampion,
  NormalizedItem,
  RuneInfo,
  StatBlock,
  SummonerSpellInfo,
} from './types'
import { fetchJson, type FetchJsonOptions } from './fetcher'

/**
 * Accès et normalisation de Data Dragon (CDN Riot officiel, sans clé, versionné
 * par patch).
 *
 * Locale figée à `en_US` : les libellés de stats dans la description HTML
 * (« Ability Haste », « Lethality »…) doivent rester stables pour le parseur,
 * et le moteur matche des chaînes anglaises. Les noms d'affichage FR sont
 * récupérés **en plus** (`fetchLocalizedItemNames`) et n'alimentent que l'UI.
 */

export const DDRAGON_LOCALE = 'en_US'
/** Locale d'affichage : noms d'items localisés (jamais utilisée par le moteur). */
export const DDRAGON_DISPLAY_LOCALE = 'fr_FR'
const CDN = 'https://ddragon.leagueoflegends.com'

export const ddragonUrls = {
  versions: `${CDN}/api/versions.json`,
  items: (v: string) => `${CDN}/cdn/${v}/data/${DDRAGON_LOCALE}/item.json`,
  itemsLocalized: (v: string) => `${CDN}/cdn/${v}/data/${DDRAGON_DISPLAY_LOCALE}/item.json`,
  champions: (v: string) => `${CDN}/cdn/${v}/data/${DDRAGON_LOCALE}/champion.json`,
  runes: (v: string) => `${CDN}/cdn/${v}/data/${DDRAGON_LOCALE}/runesReforged.json`,
  summoners: (v: string) => `${CDN}/cdn/${v}/data/${DDRAGON_LOCALE}/summoner.json`,
}

// ─── Formes brutes ─────────────────────────────────────────────────────────

interface RawItem {
  name: string
  description?: string
  plaintext?: string
  into?: string[]
  from?: string[]
  gold?: { base: number; total: number; sell: number; purchasable: boolean }
  tags?: string[]
  maps?: Record<string, boolean>
  stats?: Record<string, number>
  depth?: number
  inStore?: boolean
  requiredChampion?: string
}

interface RawItemFile {
  data: Record<string, RawItem>
}

interface RawChampion {
  key: string
  id: string
  name: string
  tags?: string[]
  partype?: string
  info?: { attack: number; defense: number; magic: number; difficulty: number }
  stats: DdragonChampionStats
}

interface RawChampionFile {
  data: Record<string, RawChampion>
}

interface RawRuneTree {
  id: number
  key: string
  name: string
  slots: { runes: { id: number; key: string; name: string; shortDesc: string }[] }[]
}

interface RawSummoner {
  id: string
  name: string
  description: string
  key: string
  modes: string[]
}

interface RawSummonerFile {
  data: Record<string, RawSummoner>
}

// ─── Récupération ──────────────────────────────────────────────────────────

/** Retourne la dernière version de patch publiée (`versions.json[0]`). */
export async function fetchLatestVersion(options?: FetchJsonOptions): Promise<string> {
  const versions = await fetchJson<string[]>(ddragonUrls.versions, options)
  if (!Array.isArray(versions) || typeof versions[0] !== 'string') {
    throw new Error('versions.json inattendu')
  }
  return versions[0]
}

export async function fetchRawItems(v: string, options?: FetchJsonOptions): Promise<RawItemFile> {
  return fetchJson<RawItemFile>(ddragonUrls.items(v), options)
}

/**
 * Noms d'items localisés (`fr_FR`), `id → nom`. Purement pour l'affichage.
 * Toute défaillance réseau ⇒ `Map` vide (repli sur le nom anglais).
 */
export async function fetchLocalizedItemNames(
  v: string,
  options?: FetchJsonOptions,
): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  try {
    const file = await fetchJson<RawItemFile>(ddragonUrls.itemsLocalized(v), options)
    for (const [idStr, raw] of Object.entries(file.data ?? {})) {
      const id = Number.parseInt(idStr, 10)
      if (Number.isFinite(id) && raw?.name) out.set(id, raw.name)
    }
  } catch {
    /* repli anglais */
  }
  return out
}
export async function fetchRawChampions(
  v: string,
  options?: FetchJsonOptions,
): Promise<RawChampionFile> {
  return fetchJson<RawChampionFile>(ddragonUrls.champions(v), options)
}
export async function fetchRawRunes(v: string, options?: FetchJsonOptions): Promise<RawRuneTree[]> {
  return fetchJson<RawRuneTree[]>(ddragonUrls.runes(v), options)
}
export async function fetchRawSummoners(
  v: string,
  options?: FetchJsonOptions,
): Promise<RawSummonerFile> {
  return fetchJson<RawSummonerFile>(ddragonUrls.summoners(v), options)
}

// ─── Normalisation : items ─────────────────────────────────────────────────

const toIntList = (a: string[] | undefined): number[] =>
  (a ?? []).map((x) => Number.parseInt(x, 10)).filter((n) => Number.isFinite(n))

/**
 * Table de correspondance libellé (bloc `<stats>` de la description) → clé de
 * `StatBlock`. `pct` indique que la valeur est un pourcentage (stocké en
 * nombre entier : « 30% » → 30).
 */
const STAT_LABELS: { re: RegExp; key: keyof StatBlock; pct?: boolean }[] = [
  { re: /^attack damage$/i, key: 'attackDamage' },
  { re: /^ability power$/i, key: 'abilityPower' },
  { re: /^health$/i, key: 'health' },
  { re: /^armou?r$/i, key: 'armor' },
  { re: /^magic resist(ance)?$/i, key: 'magicResist' },
  { re: /^attack speed$/i, key: 'bonusAttackSpeedPercent', pct: true },
  { re: /^ability haste$/i, key: 'abilityHaste' },
  { re: /^mana$/i, key: 'mana' },
  { re: /^(base )?mana regen$/i, key: 'manaRegen', pct: true },
  { re: /^(base )?health regen$/i, key: 'healthRegen', pct: true },
  { re: /^(critical strike chance|crit chance)$/i, key: 'critChance', pct: true },
  { re: /^lethality$/i, key: 'lethality' },
  { re: /^armou?r penetration$/i, key: 'armorPenetrationPercent', pct: true },
  { re: /^life ?steal$/i, key: 'lifeSteal', pct: true },
  { re: /^omnivamp$/i, key: 'omnivamp', pct: true },
  { re: /^heal and shield power$/i, key: 'healAndShieldPower', pct: true },
  { re: /^tenacity$/i, key: 'tenacity', pct: true },
  { re: /^attack range$/i, key: 'attackRange' },
]

/**
 * Extrait les stats du bloc `<stats>…</stats>` de la description Data Dragon.
 * C'est la source faisant autorité pour les stats « modernes » (accélération
 * de compétence, létalité, pénétration…) absentes du bloc `stats` legacy.
 */
export function parseItemDescriptionStats(description: string): Partial<StatBlock> {
  const out: Partial<StatBlock> = {}
  const block = /<stats>([\s\S]*?)<\/stats>/i.exec(description)?.[1]
  if (!block) return out

  for (const frag of block.split(/<br\s*\/?>/i)) {
    const m = /<attention>\s*\+?\s*([\d.]+)\s*(%?)\s*<\/attention>\s*([\s\S]+)/i.exec(frag)
    if (!m) continue
    const value = Number.parseFloat(m[1])
    const isPct = m[2] === '%'
    const label = m[3].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (!Number.isFinite(value)) continue

    // « Move Speed » : flat ou %, selon la présence du signe %.
    if (/^move ?speed$/i.test(label)) {
      if (isPct) out.moveSpeedPercent = (out.moveSpeedPercent ?? 0) + value
      else out.moveSpeed = (out.moveSpeed ?? 0) + value
      continue
    }
    if (/^magic penetration$/i.test(label)) {
      if (isPct) out.magicPenetrationPercent = (out.magicPenetrationPercent ?? 0) + value
      else out.magicPenetrationFlat = (out.magicPenetrationFlat ?? 0) + value
      continue
    }
    const entry = STAT_LABELS.find((s) => s.re.test(label))
    if (!entry) continue
    out[entry.key] = (out[entry.key] ?? 0) + value
  }
  return out
}

/** Repli : bloc `stats` legacy de Data Dragon (jeu de stats restreint). */
function legacyStats(stats: Record<string, number> | undefined): Partial<StatBlock> {
  const s = stats ?? {}
  const out: Partial<StatBlock> = {}
  const put = (k: keyof StatBlock, v: number | undefined, mul = 1): void => {
    if (typeof v === 'number' && v !== 0) out[k] = (out[k] ?? 0) + v * mul
  }
  put('health', s['FlatHPPoolMod'])
  put('mana', s['FlatMPPoolMod'])
  put('armor', s['FlatArmorMod'])
  put('magicResist', s['FlatSpellBlockMod'])
  put('attackDamage', s['FlatPhysicalDamageMod'])
  put('abilityPower', s['FlatMagicDamageMod'])
  put('moveSpeed', s['FlatMovementSpeedMod'])
  put('moveSpeedPercent', s['PercentMovementSpeedMod'], 100)
  put('bonusAttackSpeedPercent', s['PercentAttackSpeedMod'], 100)
  put('critChance', s['FlatCritChanceMod'], 100)
  put('lifeSteal', s['PercentLifeStealMod'], 100)
  put('healthRegen', s['FlatHPRegenMod'])
  return out
}

/** Fusionne les stats de description (prioritaires) avec le repli legacy. */
export function mergeItemStats(description: string, legacy: Record<string, number> | undefined) {
  const fromDesc = parseItemDescriptionStats(description)
  const fromLegacy = legacyStats(legacy)
  return { ...fromLegacy, ...fromDesc }
}

export function normalizeItems(
  file: RawItemFile,
  localizedNames?: Map<number, string>,
): NormalizedItem[] {
  const out: NormalizedItem[] = []
  for (const [idStr, raw] of Object.entries(file.data ?? {})) {
    const id = Number.parseInt(idStr, 10)
    if (!Number.isFinite(id)) continue
    const tags = raw.tags ?? []
    const description = raw.description ?? ''
    const into = toIntList(raw.into)
    const localized = localizedNames?.get(id)
    out.push({
      id,
      name: raw.name ?? `Item ${id}`,
      ...(localized && localized !== raw.name ? { nameLocalized: localized } : {}),
      description,
      plaintext: raw.plaintext ?? '',
      tags,
      goldBase: raw.gold?.base ?? 0,
      goldTotal: raw.gold?.total ?? 0,
      goldSell: raw.gold?.sell ?? 0,
      purchasable: raw.gold?.purchasable ?? false,
      onSummonersRift: raw.maps?.['11'] === true,
      depth: raw.depth ?? 1,
      from: toIntList(raw.from),
      into,
      isFinal: into.length === 0,
      isBoots: tags.includes('Boots'),
      isConsumable: tags.includes('Consumable'),
      isTrinket: tags.includes('Trinket'),
      stats: mergeItemStats(description, raw.stats),
      hasActive: tags.includes('Active') || /<active>/i.test(description),
    })
  }
  return out
}

// ─── Normalisation : champions ─────────────────────────────────────────────

export function normalizeChampions(file: RawChampionFile): NormalizedChampion[] {
  const out: NormalizedChampion[] = []
  for (const raw of Object.values(file.data ?? {})) {
    const id = Number.parseInt(raw.key, 10)
    if (!Number.isFinite(id)) continue
    out.push({
      id,
      slug: raw.id,
      name: raw.name,
      tags: raw.tags ?? [],
      resource: raw.partype ?? 'None',
      info: raw.info ?? { attack: 0, defense: 0, magic: 0, difficulty: 0 },
      base: raw.stats,
    })
  }
  return out
}

// `growthFactor` / `statsAtLevel` (interpolation de stats par niveau) sont dans
// la couche modèle partagée ; ré-exportés ici pour compat des imports A1.
export { growthFactor, statsAtLevel } from '../../shared/engine/model/champion-stats'

// ─── Normalisation : runes & sorts ─────────────────────────────────────────

export function normalizeRunes(trees: RawRuneTree[]): RuneInfo[] {
  const out: RuneInfo[] = []
  for (const tree of trees ?? []) {
    tree.slots?.forEach((slot, slotIndex) => {
      for (const rune of slot.runes ?? []) {
        out.push({
          id: rune.id,
          key: rune.key,
          name: rune.name,
          tree: tree.key,
          keystone: slotIndex === 0,
          shortDesc: rune.shortDesc ?? '',
        })
      }
    })
  }
  return out
}

export function normalizeSummoners(file: RawSummonerFile): SummonerSpellInfo[] {
  const out: SummonerSpellInfo[] = []
  for (const raw of Object.values(file.data ?? {})) {
    const id = Number.parseInt(raw.key, 10)
    if (!Number.isFinite(id)) continue
    out.push({
      id,
      key: raw.id,
      name: raw.name,
      description: raw.description ?? '',
      modes: raw.modes ?? [],
    })
  }
  return out
}
