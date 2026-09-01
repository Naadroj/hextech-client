import type {
  LiveActivePlayer,
  LiveChampionStats,
  LiveGameData,
  LivePlayer,
} from '../../live-types'
import type { DamageProfile, NormalizedChampion, NormalizedItem, StaticSnapshot } from '../../staticdata-types'
import type { StaticData } from '../../staticdata-types'
import { indexSnapshot } from '../../static-index'

/**
 * Fixtures partagées des tests de la couche contexte (A3). Pas un fichier
 * `*.test.ts` : importé par les tests, jamais exécuté seul.
 */

function champ(
  id: number,
  slug: string,
  over: Partial<NormalizedChampion['base']> = {},
  tags: string[] = [],
): NormalizedChampion {
  return {
    id,
    slug,
    name: slug,
    tags,
    resource: 'Mana',
    info: { attack: 5, defense: 5, magic: 5, difficulty: 5 },
    base: {
      hp: 600, hpperlevel: 100, mp: 400, mpperlevel: 40, movespeed: 340,
      armor: 28, armorperlevel: 4.2, spellblock: 30, spellblockperlevel: 1.3,
      attackrange: 175, hpregen: 6, hpregenperlevel: 0.6, mpregen: 8, mpregenperlevel: 0.7,
      crit: 0, critperlevel: 0, attackdamage: 58, attackdamageperlevel: 3,
      attackspeedperlevel: 2.2, attackspeed: 0.65, ...over,
    },
  }
}

function profile(
  championId: number,
  slug: string,
  physical: number,
  magic: number,
  trueDmg: number,
  pattern: DamageProfile['pattern'],
  roles: string[],
  attackType: DamageProfile['attackType'] = 'RANGED',
): DamageProfile {
  const primary =
    physical >= 0.6 ? 'physical' : magic >= 0.6 ? 'magic' : trueDmg >= 0.6 ? 'true' : 'mixed'
  return {
    championId, slug, physical, magic, true: trueDmg, attackType,
    primary, pattern, roles, source: 'meraki',
  }
}

function item(id: number, name: string, stats: NormalizedItem['stats'], over: Partial<NormalizedItem> = {}): NormalizedItem {
  return {
    id, name, description: '', plaintext: '', tags: [],
    goldBase: 0, goldTotal: 3000, goldSell: 2100, purchasable: true, onSummonersRift: true,
    depth: 3, from: [], into: [], isFinal: true, isBoots: false, isConsumable: false, isTrinket: false,
    stats, hasActive: false, ...over,
  }
}

const CHAMPIONS: NormalizedChampion[] = [
  champ(134, 'Syndra', { attackrange: 550, attackdamage: 54 }, ['Mage']),
  champ(51, 'Caitlyn', { attackrange: 650, attackdamage: 62, attackspeed: 0.681 }, ['Marksman']),
  champ(238, 'Zed', { attackrange: 125, attackdamage: 63 }, ['Assassin']),
  champ(54, 'Malphite', { attackrange: 125, armor: 37, armorperlevel: 5.2, hp: 645, hpperlevel: 110 }, ['Tank']),
  champ(16, 'Soraka', { attackrange: 550 }, ['Support']),
  champ(64, 'LeeSin', { attackrange: 125, attackdamage: 66 }, ['Fighter']),
  champ(266, 'Aatrox', { attackrange: 175, hp: 650, hpperlevel: 114, attackdamage: 60, attackdamageperlevel: 0 }, ['Fighter']),
]

const PROFILES: DamageProfile[] = [
  profile(134, 'Syndra', 0.02, 0.93, 0.05, 'burst', ['MAGE', 'BURST']),
  profile(51, 'Caitlyn', 0.92, 0.03, 0.05, 'sustained', ['MARKSMAN']),
  profile(238, 'Zed', 0.9, 0.05, 0.05, 'burst', ['ASSASSIN'], 'MELEE'),
  profile(54, 'Malphite', 0.2, 0.75, 0.05, 'mixed', ['TANK', 'VANGUARD'], 'MELEE'),
  profile(16, 'Soraka', 0.05, 0.9, 0.05, 'sustained', ['ENCHANTER'], 'RANGED'),
  profile(64, 'LeeSin', 0.85, 0.1, 0.05, 'sustained', ['SKIRMISHER', 'DIVER'], 'MELEE'),
  profile(266, 'Aatrox', 0.78, 0.17, 0.05, 'sustained', ['JUGGERNAUT', 'FIGHTER'], 'MELEE'),
]

const ITEMS: NormalizedItem[] = [
  item(3006, "Berserker's Greaves", { moveSpeed: 45, bonusAttackSpeedPercent: 35 }, { goldTotal: 1100, depth: 2, isBoots: true, isFinal: false }),
  item(3047, 'Plated Steelcaps', { moveSpeed: 45, armor: 25 }, { goldTotal: 1200, depth: 2, isBoots: true, isFinal: false }),
  item(3111, "Mercury's Treads", { moveSpeed: 45, magicResist: 20, tenacity: 30 }, { goldTotal: 1200, depth: 2, isBoots: true, isFinal: false }),
  item(3031, 'Infinity Edge', { attackDamage: 70, critChance: 20 }, { goldTotal: 3450 }),
  item(3072, 'Bloodthirster', { attackDamage: 55, lifeSteal: 15 }, { goldTotal: 3400 }),
  item(3036, "Lord Dominik's Regards", { attackDamage: 35, critChance: 20, armorPenetrationPercent: 35 }, { goldTotal: 3100 }),
  item(3089, "Rabadon's Deathcap", { abilityPower: 130 }, { goldTotal: 3600 }),
  item(3135, 'Void Staff', { abilityPower: 95, magicPenetrationPercent: 40 }, { goldTotal: 3000 }),
  item(3068, 'Sunfire Aegis', { health: 450, armor: 50, abilityHaste: 15 }, { goldTotal: 2900 }),
  item(3065, 'Spirit Visage', { health: 450, magicResist: 55, abilityHaste: 10, healAndShieldPower: 30 }, { goldTotal: 2900 }),
  item(3157, "Zhonya's Hourglass", { abilityPower: 105, armor: 50 }, { goldTotal: 3250, hasActive: true, description: '<active>Time Stop</active> Enter Stasis for 2.5 seconds.' }),
  item(3139, 'Mercurial Scimitar', { attackDamage: 40, magicResist: 40, lifeSteal: 8 }, { goldTotal: 3200, hasActive: true, description: '<active>Quicksilver</active> Removes all crowd control.' }),
  item(3165, 'Morellonomicon', { abilityPower: 90, health: 350 }, { goldTotal: 2850, description: 'Dealing ability damage applies <b>Grievous Wounds</b>.' }),
  item(3143, "Randuin's Omen", { health: 400, armor: 60 }, { goldTotal: 3000, hasActive: true, description: 'Reduces incoming critical strike damage and enemy attack speed.' }),
  // Composants défensifs (non-finaux, bon marché) — pour le mode reco de composant.
  item(2420, "Seeker's Armguard", { armor: 25, abilityPower: 40 }, { goldTotal: 1600, depth: 2, isFinal: false, description: '<passive>Stasis</passive> Once per life, become invulnerable but unable to act.' }),
  item(3155, 'Hexdrinker', { magicResist: 25, attackDamage: 25 }, { goldTotal: 1300, depth: 2, isFinal: false, description: '<passive>Lifeline</passive> Gain a magic shield when low.' }),
  item(4632, 'Verdant Barrier', { magicResist: 25, abilityPower: 40 }, { goldTotal: 1600, depth: 2, isFinal: false }),
  item(1057, 'Negatron Cloak', { magicResist: 45 }, { goldTotal: 850, depth: 2, isFinal: false }),
  item(2003, 'Health Potion', {}, { goldTotal: 50, depth: 1, isConsumable: true }),
]

const SNAPSHOT: StaticSnapshot = {
  meta: { version: '16.99.9', locale: 'en_US', fetchedAt: '2026-09-01T00:00:00.000Z', merakiVersion: '16.99.9', origin: 'cache' },
  items: ITEMS,
  champions: CHAMPIONS,
  damageProfiles: PROFILES,
  runes: [{ id: 8112, key: 'Electrocute', name: 'Electrocute', tree: 'Domination', keystone: true, shortDesc: '' }],
  summonerSpells: [{ id: 4, key: 'SummonerFlash', name: 'Flash', description: '', modes: ['CLASSIC'] }],
}

export function makeStaticData(): StaticData {
  return indexSnapshot(SNAPSHOT)
}

// ─── Live game builder ────────────────────────────────────────────────────

const DEFAULT_CS: LiveChampionStats = {
  abilityHaste: 0, abilityPower: 0, armor: 30, armorPenetrationFlat: 0, armorPenetrationPercent: 0,
  attackDamage: 60, attackRange: 175, attackSpeed: 0.7, bonusArmorPenetrationPercent: 0,
  bonusMagicPenetrationPercent: 0, critChance: 0, critDamage: 175, currentHealth: 1000,
  healShieldPower: 0, healthRegenRate: 5, lifeSteal: 0, magicLethality: 0, magicPenetrationFlat: 0,
  magicPenetrationPercent: 0, magicResist: 30, maxHealth: 1000, moveSpeed: 340, omnivamp: 0,
  physicalLethality: 0, physicalVamp: 0, resourceMax: 400, resourceRegenRate: 8,
  resourceType: 'MANA', resourceValue: 400, spellVamp: 0, tenacity: 0,
}

const spell = (name: string) => ({ displayName: name, rawDescription: '', rawDisplayName: `Summoner${name}` })

export interface PlayerSpec {
  champion: string
  team?: 'ORDER' | 'CHAOS'
  level?: number
  items?: number[]
  kills?: number
  deaths?: number
  assists?: number
  cs?: number
  position?: string
  spells?: [string, string]
  /** Alias courts pratiques pour les scénarios. */
  k?: number
  d?: number
  a?: number
  pos?: string
}

export function livePlayer(spec: PlayerSpec): LivePlayer {
  const kills = spec.kills ?? spec.k ?? 3
  const deaths = spec.deaths ?? spec.d ?? 3
  const assists = spec.assists ?? spec.a ?? 5
  const position = spec.position ?? spec.pos ?? ''
  return {
    championName: spec.champion,
    rawChampionName: `game_character_displayname_${spec.champion}`,
    skinID: 0,
    isBot: false,
    isDead: false,
    respawnTimer: 0,
    items: (spec.items ?? []).map((id, slot) => ({
      canUse: false, consumable: false, count: 1, displayName: `Item ${id}`,
      itemID: id, price: 0, rawDescription: '', rawDisplayName: '', slot,
    })),
    level: spec.level ?? 11,
    position,
    scores: {
      kills,
      deaths,
      assists,
      creepScore: spec.cs ?? 120,
      wardScore: 10,
    },
    summonerName: spec.champion,
    riotId: `${spec.champion}#EUW`,
    riotIdGameName: spec.champion,
    riotIdTagLine: 'EUW',
    summonerSpells: {
      summonerSpellOne: spell(spec.spells?.[0] ?? 'Flash'),
      summonerSpellTwo: spell(spec.spells?.[1] ?? 'Ignite'),
    },
    runes: {
      keystone: { displayName: 'Electrocute', id: 8112, rawDescription: '', rawDisplayName: '' },
      primaryRuneTree: { displayName: 'Domination', id: 8100, rawDescription: '', rawDisplayName: '' },
      secondaryRuneTree: { displayName: 'Sorcery', id: 8200, rawDescription: '', rawDisplayName: '' },
    },
    team: spec.team ?? 'ORDER',
  }
}

export interface LiveGameSpec {
  selfChampion: string
  allies: PlayerSpec[]
  enemies: PlayerSpec[]
  gameTime?: number
  selfLevel?: number
  selfGold?: number
  selfItems?: number[]
  championStats?: Partial<LiveChampionStats>
  selfScores?: { kills?: number; deaths?: number; assists?: number; cs?: number }
  selfPosition?: string
  selfSpells?: [string, string]
}

export function makeLiveGame(spec: LiveGameSpec): LiveGameData {
  const self = livePlayer({
    champion: spec.selfChampion,
    team: 'ORDER',
    level: spec.selfLevel ?? 11,
    items: spec.selfItems ?? [],
    position: spec.selfPosition ?? '',
    spells: spec.selfSpells,
    kills: spec.selfScores?.kills,
    deaths: spec.selfScores?.deaths,
    assists: spec.selfScores?.assists,
    cs: spec.selfScores?.cs,
  })
  const allPlayers: LivePlayer[] = [
    self,
    ...spec.allies.map((a) => livePlayer({ ...a, team: 'ORDER' })),
    ...spec.enemies.map((e) => livePlayer({ ...e, team: 'CHAOS' })),
  ]
  const activePlayer: LiveActivePlayer = {
    abilities: {
      Passive: { displayName: 'P', id: 'p', rawDescription: '', rawDisplayName: '' },
      Q: { displayName: 'Q', id: 'q', rawDescription: '', rawDisplayName: '' },
      W: { displayName: 'W', id: 'w', rawDescription: '', rawDisplayName: '' },
      E: { displayName: 'E', id: 'e', rawDescription: '', rawDisplayName: '' },
      R: { displayName: 'R', id: 'r', rawDescription: '', rawDisplayName: '' },
    },
    championStats: { ...DEFAULT_CS, ...spec.championStats },
    currentGold: spec.selfGold ?? 500,
    fullRunes: {
      keystone: { displayName: 'Electrocute', id: 8112, rawDescription: '', rawDisplayName: '' },
      primaryRuneTree: { displayName: 'Domination', id: 8100, rawDescription: '', rawDisplayName: '' },
      secondaryRuneTree: { displayName: 'Sorcery', id: 8200, rawDescription: '', rawDisplayName: '' },
      generalRunes: [],
      statRunes: [],
    },
    level: spec.selfLevel ?? 11,
    summonerName: spec.selfChampion,
    riotId: `${spec.selfChampion}#EUW`,
    riotIdGameName: spec.selfChampion,
    riotIdTagLine: 'EUW',
  }
  return {
    activePlayer,
    allPlayers,
    events: { Events: [] },
    gameData: {
      gameMode: 'CLASSIC',
      gameTime: spec.gameTime ?? 900,
      mapName: 'Map11',
      mapNumber: 11,
      mapTerrain: 'Default',
    },
  }
}
