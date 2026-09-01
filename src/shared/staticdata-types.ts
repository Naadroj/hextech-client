/**
 * Types du domaine « données statiques » (Data Dragon + Meraki), **partagés**
 * entre le process principal (pipeline A1), le moteur (A2+) et le renderer (A5).
 *
 * Aucune logique ici — seulement des formes de données. Le calcul vit dans
 * `src/main/staticdata/*` (extraction) et `src/shared/engine/*` (modèle).
 *
 * Convention : les stats en pourcentage sont stockées en **nombre entier**
 * (« 30 % » → `30`). Le modèle divise par 100 là où c'est nécessaire.
 */

// ─── Stats ─────────────────────────────────────────────────────────────────

/**
 * Ensemble de stats normalisé, unités « jeu ». Valeurs absolues au niveau
 * considéré (pas des « par niveau »). Les stats absentes valent 0.
 */
export interface StatBlock {
  health: number
  healthRegen: number
  mana: number
  manaRegen: number
  armor: number
  magicResist: number
  attackDamage: number
  /** Vitesse d'attaque effective (attaques/seconde). */
  attackSpeed: number
  /** Bonus de vitesse d'attaque en % (items ; hors base). */
  bonusAttackSpeedPercent: number
  attackRange: number
  moveSpeed: number
  /** Bonus de déplacement en % (items). */
  moveSpeedPercent: number
  critChance: number
  abilityPower: number
  abilityHaste: number
  lethality: number
  armorPenetrationPercent: number
  magicPenetrationFlat: number
  magicPenetrationPercent: number
  lifeSteal: number
  omnivamp: number
  healAndShieldPower: number
  tenacity: number
}

// ─── Champions ─────────────────────────────────────────────────────────────

/** Bloc `stats` brut de Data Dragon (`champion.json`). */
export interface DdragonChampionStats {
  hp: number
  hpperlevel: number
  mp: number
  mpperlevel: number
  movespeed: number
  armor: number
  armorperlevel: number
  spellblock: number
  spellblockperlevel: number
  attackrange: number
  hpregen: number
  hpregenperlevel: number
  mpregen: number
  mpregenperlevel: number
  crit: number
  critperlevel: number
  attackdamage: number
  attackdamageperlevel: number
  /** % de vitesse d'attaque gagné par niveau (ex. 2.5 = +2.5 %/niv). */
  attackspeedperlevel: number
  attackspeed: number
}

export interface NormalizedChampion {
  /** Identifiant numérique (`key` de Data Dragon), ex. 266. */
  id: number
  /** Identifiant texte de Data Dragon, ex. `Aatrox`. */
  slug: string
  name: string
  tags: string[]
  /** `Mana`, `Energy`, `Blood Well`, `None`… */
  resource: string
  info: { attack: number; defense: number; magic: number; difficulty: number }
  base: DdragonChampionStats
}

export type DamageType = 'physical' | 'magic' | 'true'
export type AttackType = 'MELEE' | 'RANGED' | 'UNKNOWN'
export type DamagePattern = 'burst' | 'sustained' | 'mixed'
export type DamageProfileSource = 'meraki' | 'ddragon' | 'override'

/**
 * Profil de dégâts d'un champion : parts normalisées physique / magique / vrai
 * (somme ≈ 1), type d'attaque, et motif burst/sustained. Sert au moteur (A3) à
 * estimer le vecteur de menace ennemi et l'axe de résistance à prioriser.
 */
export interface DamageProfile {
  championId: number
  slug: string
  physical: number
  magic: number
  true: number
  attackType: AttackType
  /** Axe dominant si ≥ 0,6, sinon `mixed`. */
  primary: DamageType | 'mixed'
  pattern: DamagePattern
  roles: string[]
  source: DamageProfileSource
}

// ─── Ratios de sorts (A2.2) ───────────────────────────────────────────────

/** Stat sur laquelle porte un ratio de sort. */
export type RatioStat =
  | 'ap'
  | 'bonusAD'
  | 'totalAD'
  | 'baseAD'
  | 'bonusHP'
  | 'maxHP'
  | 'armor'
  | 'mr'
  | 'targetMaxHP'
  | 'targetCurrentHP'
  | 'targetMissingHP'
  | 'maxMana'

/** Dégâts d'un sort (un slot P/Q/W/E/R), par rang. */
export interface AbilityDamage {
  slot: 'P' | 'Q' | 'W' | 'E' | 'R'
  damageType: DamageType | 'mixed'
  /** Dégâts plats par rang (index 0 = rang 1 ; longueur 1..5). */
  flat: number[]
  /** Ratios : `pct` (fraction, 0.6 = 60 %) par rang, sur `stat`. */
  ratios: { stat: RatioStat; pct: number[] }[]
}

/** Dégâts de sorts d'un champion (slots dont l'effet principal a pu être parsé). */
export interface ChampionSpellDamage {
  championId: number
  slug: string
  abilities: AbilityDamage[]
}

/** Entrée de `overrides.json` (corrections manuelles du profil de dégâts). */
export interface DamageProfileOverride {
  physical: number
  magic: number
  true: number
  pattern?: DamagePattern
  /** Raison de la correction (documentation ; non utilisé au runtime). */
  note?: string
}

// ─── Items ─────────────────────────────────────────────────────────────────

export interface NormalizedItem {
  id: number
  /** Nom canonique **en anglais** — sert aux appariements du moteur, ne pas localiser. */
  name: string
  /** Nom d'affichage localisé (fr_FR), si disponible. Affichage seulement. */
  nameLocalized?: string
  /** Description HTML brute de Data Dragon (source des stats « modernes »). */
  description: string
  plaintext: string
  tags: string[]
  goldBase: number
  goldTotal: number
  goldSell: number
  purchasable: boolean
  /** Achetable sur la Faille de l'invocateur (map 11). */
  onSummonersRift: boolean
  /** Profondeur dans l'arbre de craft (composants = 1, légendaires ≥ 3). */
  depth: number
  /** IDs des composants directs. */
  from: number[]
  /** IDs des items qui se construisent à partir de celui-ci. */
  into: number[]
  /** `true` si l'item ne se construit en rien (item « final »). */
  isFinal: boolean
  isBoots: boolean
  isConsumable: boolean
  isTrinket: boolean
  /** Stats agrégées, extraites du bloc `<stats>` de la description + repli legacy. */
  stats: Partial<StatBlock>
  /** `true` s'il possède un actif utilisable (Zhonya, GA…). */
  hasActive: boolean
}

// ─── Runes & sorts ─────────────────────────────────────────────────────────

export interface RuneInfo {
  id: number
  key: string
  name: string
  /** Clé de l'arbre : `Domination`, `Precision`, `Sorcery`, `Resolve`, `Inspiration`. */
  tree: string
  /** `true` si c'est une pierre de fondation (keystone). */
  keystone: boolean
  shortDesc: string
}

export interface SummonerSpellInfo {
  id: number
  key: string
  name: string
  description: string
  /** Modes où le sort est disponible (ex. `CLASSIC`). */
  modes: string[]
}

// ─── Snapshot ──────────────────────────────────────────────────────────────

export interface SnapshotMeta {
  /** Version de patch Data Dragon, ex. `16.17.1`. */
  version: string
  locale: string
  /** ISO 8601. */
  fetchedAt: string
  /** Version Meraki effectivement utilisée (peut être en retard d'un patch). */
  merakiVersion: string | null
  /** `bundled` (embarqué) ou `cache` (rafraîchi dans userData). */
  origin: 'bundled' | 'cache'
}

/** Contenu complet d'un snapshot de données statiques pour un patch. */
export interface StaticSnapshot {
  meta: SnapshotMeta
  items: NormalizedItem[]
  champions: NormalizedChampion[]
  damageProfiles: DamageProfile[]
  /** Ratios de sorts (A2.2) — optionnel : un vieux snapshot sans ce champ reste valide. */
  spellDamage?: ChampionSpellDamage[]
  runes: RuneInfo[]
  summonerSpells: SummonerSpellInfo[]
}

// ─── Accès indexé ─────────────────────────────────────────────────────────

/**
 * Accès en lecture, indexé, à un snapshot de données statiques. Implémenté par
 * `indexSnapshot()` (`src/shared/static-index.ts`) ; le process principal
 * l'enveloppe dans un contrôleur (`createStaticData`) qui gère cache et
 * rafraîchissement.
 */
export interface StaticData {
  readonly version: string
  readonly locale: string
  getItem(id: number): NormalizedItem | undefined
  getAllItems(): NormalizedItem[]
  /** Items achetables sur la Faille, hors consommables et bibelots. */
  getPurchasableItems(): NormalizedItem[]
  getChampion(ref: number | string): NormalizedChampion | undefined
  /** Stats de base interpolées au niveau donné (1..18). */
  getChampionStatsAtLevel(ref: number | string, level: number): StatBlock | undefined
  getDamageProfile(ref: number | string): DamageProfile | undefined
  /** Dégâts de sorts (ratios) du champion, si disponibles. */
  getSpellDamage(ref: number | string): ChampionSpellDamage | undefined
  getRuneById(id: number): RuneInfo | undefined
  getSummonerSpellById(id: number): SummonerSpellInfo | undefined
}

// ─── Résumé exposé au renderer ─────────────────────────────────────────────

/**
 * Résumé de l'état du pipeline de données statiques. Aucune donnée lourde ne
 * transite : le catalogue complet reste dans le process principal.
 */
export interface StaticDataSummary {
  version: string
  locale: string
  /** `bundled` (embarqué) ou `cache` (rafraîchi dans userData). */
  source: 'bundled' | 'cache'
  /** ISO 8601. */
  fetchedAt: string
  /** Version Meraki effectivement utilisée (`null` si repli Data Dragon). */
  merakiVersion: string | null
  itemCount: number
  championCount: number
  runeCount: number
  summonerSpellCount: number
  /** Répartition des sources de profil de dégâts. */
  damageProfileSources: { meraki: number; ddragon: number; override: number }
  /** `true` tant qu'un rafraîchissement réseau est en cours. */
  updating: boolean
}
