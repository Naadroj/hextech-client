/**
 * Sous-ensemble des DTO **Riot Match-V5** (`/lol/match/v5/matches/{id}` +
 * `/timeline`) nécessaire pour reconstruire un état de partie à un instant T et
 * en extraire les décisions d'achat réelles (phase A4.2, corpus de validation).
 *
 * Réf. : https://developer.riotgames.com/apis#match-v5
 */

// ─── Match ─────────────────────────────────────────────────────────────────

export interface MatchParticipantDto {
  participantId: number
  puuid: string
  summonerName?: string
  riotIdGameName?: string
  riotIdTagline?: string
  championId: number
  championName: string
  teamId: 100 | 200
  teamPosition: string
  summoner1Id: number
  summoner2Id: number
  kills: number
  deaths: number
  assists: number
  perks?: {
    styles?: {
      description: string
      style: number
      selections?: { perk: number }[]
    }[]
  }
}

export interface MatchDto {
  metadata: { matchId: string }
  info: {
    gameVersion: string
    gameDuration: number
    queueId: number
    mapId: number
    participants: MatchParticipantDto[]
  }
}

// ─── Timeline ──────────────────────────────────────────────────────────────

export interface TimelineChampionStats {
  abilityHaste?: number
  abilityPower?: number
  armor?: number
  armorPen?: number
  armorPenPercent?: number
  attackDamage?: number
  attackSpeed?: number
  bonusArmorPenPercent?: number
  bonusMagicPenPercent?: number
  health?: number
  healthMax?: number
  healthRegen?: number
  lifesteal?: number
  magicPen?: number
  magicPenPercent?: number
  magicResist?: number
  movementSpeed?: number
  omnivamp?: number
  power?: number
  powerMax?: number
  powerRegen?: number
  spellVamp?: number
}

export interface TimelineParticipantFrame {
  participantId: number
  currentGold: number
  totalGold: number
  level: number
  minionsKilled: number
  jungleMinionsKilled: number
  championStats?: TimelineChampionStats
}

export type TimelineEvent =
  | { type: 'ITEM_PURCHASED'; timestamp: number; participantId: number; itemId: number }
  | { type: 'ITEM_SOLD'; timestamp: number; participantId: number; itemId: number }
  | { type: 'ITEM_DESTROYED'; timestamp: number; participantId: number; itemId: number }
  | {
      type: 'ITEM_UNDO'
      timestamp: number
      participantId: number
      beforeId?: number
      afterId?: number
    }
  | {
      type: 'CHAMPION_KILL'
      timestamp: number
      killerId: number
      victimId: number
      assistingParticipantIds?: number[]
    }
  | { type: string; timestamp: number; [k: string]: unknown }

export interface TimelineFrame {
  timestamp: number
  participantFrames: Record<string, TimelineParticipantFrame>
  events: TimelineEvent[]
}

export interface TimelineDto {
  metadata: { matchId: string }
  info: {
    frameInterval: number
    frames: TimelineFrame[]
  }
}

// ─── Sorties ───────────────────────────────────────────────────────────────

/** Un point de décision : le joueur `participantId` achète `expectedNextItem` à `atMs`. */
export interface Decision {
  matchId: string
  patch: string
  participantId: number
  championName: string
  role: string
  /** Instant de l'achat (ms). */
  atMs: number
  /**
   * Instant à passer à `reconstructState` pour obtenir l'état **juste avant**
   * l'achat (`atMs - 1`) — sinon l'item acheté est déjà « possédé ».
   */
  stateAtMs: number
  /** Inventaire (ids, avec doublons) juste avant l'achat. */
  currentItems: number[]
  expectedNextItem: number
}
