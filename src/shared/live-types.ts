/**
 * DTOs de la **Live Client Data API** — serveur HTTP local du client de jeu
 * (`https://127.0.0.1:2999/liveclientdata/*`), actif uniquement pendant un
 * match. Sans authentification. Distinct du LCU.
 *
 * Partagés entre le process principal (implémentation) et le renderer (typage).
 * Aucune logique ici — seulement des formes de données.
 *
 * Réf. : https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api
 * Les schémas varient légèrement selon les patchs (ex. `summonerName` →
 * `riotId`) : les champs instables sont marqués optionnels.
 */

// ─── activePlayer ──────────────────────────────────────────────────────────

export interface LiveAbilityLevel {
  abilityLevel?: number
  displayName: string
  id: string
  rawDescription: string
  rawDisplayName: string
}

export interface LiveActivePlayerAbilities {
  Passive: LiveAbilityLevel
  Q: LiveAbilityLevel
  W: LiveAbilityLevel
  E: LiveAbilityLevel
  R: LiveAbilityLevel
}

/** Stats calculées du joueur actif (le seul pour qui l'API les expose). */
export interface LiveChampionStats {
  abilityHaste: number
  abilityPower: number
  armor: number
  armorPenetrationFlat: number
  armorPenetrationPercent: number
  attackDamage: number
  attackRange: number
  attackSpeed: number
  bonusArmorPenetrationPercent: number
  bonusMagicPenetrationPercent: number
  critChance: number
  critDamage: number
  currentHealth: number
  healShieldPower: number
  healthRegenRate: number
  lifeSteal: number
  magicLethality: number
  magicPenetrationFlat: number
  magicPenetrationPercent: number
  magicResist: number
  maxHealth: number
  moveSpeed: number
  omnivamp: number
  physicalLethality: number
  physicalVamp: number
  resourceMax: number
  resourceRegenRate: number
  resourceType: string
  resourceValue: number
  spellVamp: number
  tenacity: number
}

export interface LiveRune {
  displayName: string
  id: number
  rawDescription: string
  rawDisplayName: string
}

export interface LiveFullRunes {
  keystone: LiveRune
  primaryRuneTree: LiveRune
  secondaryRuneTree: LiveRune
  generalRunes: LiveRune[]
  statRunes: { id: number; rawDescription: string }[]
}

export interface LiveActivePlayer {
  abilities: LiveActivePlayerAbilities
  championStats: LiveChampionStats
  currentGold: number
  fullRunes: LiveFullRunes
  level: number
  summonerName: string
  /** Patchs récents : Riot ID complet « Nom#TAG ». */
  riotId?: string
  riotIdGameName?: string
  riotIdTagLine?: string
  teamRelativeColors?: boolean
}

// ─── allPlayers ────────────────────────────────────────────────────────────

export interface LiveItem {
  canUse: boolean
  consumable: boolean
  count: number
  displayName: string
  itemID: number
  price: number
  rawDescription: string
  rawDisplayName: string
  slot: number
}

export interface LiveScores {
  assists: number
  creepScore: number
  deaths: number
  kills: number
  wardScore: number
}

export interface LiveRunesShort {
  keystone: LiveRune
  primaryRuneTree: LiveRune
  secondaryRuneTree: LiveRune
}

export interface LiveSummonerSpell {
  displayName: string
  rawDescription: string
  rawDisplayName: string
}

export type LiveTeamId = 'ORDER' | 'CHAOS' | (string & {})

export interface LivePlayer {
  championName: string
  rawChampionName: string
  rawSkinName?: string
  skinID: number
  isBot: boolean
  isDead: boolean
  respawnTimer: number
  items: LiveItem[]
  level: number
  position: string
  scores: LiveScores
  summonerName: string
  riotId?: string
  riotIdGameName?: string
  riotIdTagLine?: string
  summonerSpells: {
    summonerSpellOne: LiveSummonerSpell
    summonerSpellTwo: LiveSummonerSpell
  }
  runes: LiveRunesShort
  team: LiveTeamId
}

// ─── events / gameData ─────────────────────────────────────────────────────

export interface LiveEvent {
  EventID: number
  EventName: string
  EventTime: number
  /** Champs variables selon `EventName` (KillerName, VictimName, DragonType…). */
  [key: string]: unknown
}

export interface LiveEventData {
  Events: LiveEvent[]
}

export interface LiveGameStats {
  gameMode: string
  gameTime: number
  mapName: string
  mapNumber: number
  mapTerrain: string
}

export interface LiveGameData {
  activePlayer: LiveActivePlayer
  allPlayers: LivePlayer[]
  events: LiveEventData
  gameData: LiveGameStats
}

// ─── État exposé au renderer ───────────────────────────────────────────────

export type LiveStatus = 'idle' | 'active'

export interface LiveSnapshot {
  /** Horodatage local (ms) de la capture. */
  receivedAt: number
  data: LiveGameData
}
