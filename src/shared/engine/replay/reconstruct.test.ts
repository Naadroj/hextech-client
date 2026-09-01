import { describe, it, expect } from 'vitest'
import {
  extractDecisions,
  frameAt,
  itemMultisetAt,
  kdaAt,
  patchOf,
  reconstructState,
} from './reconstruct'
import { assessGame } from '../context'
import { makeStaticData } from '../context/fixtures'
import type { MatchDto, TimelineDto, TimelineEvent } from './types'

const sd = makeStaticData()

const participant = (id: number, champ: string, team: 100 | 200, pos: string): MatchDto['info']['participants'][number] => ({
  participantId: id,
  puuid: `puuid-${id}`,
  summonerName: champ,
  riotIdGameName: champ,
  riotIdTagline: 'EUW',
  championId: id,
  championName: champ,
  teamId: team,
  teamPosition: pos,
  summoner1Id: 4,
  summoner2Id: 14,
  kills: 0,
  deaths: 0,
  assists: 0,
  perks: { styles: [{ description: 'primaryStyle', style: 8100, selections: [{ perk: 8112 }] }] },
})

const MATCH: MatchDto = {
  metadata: { matchId: 'EUW1_TEST' },
  info: {
    gameVersion: '16.17.531.4185',
    gameDuration: 1800,
    queueId: 420,
    mapId: 11,
    participants: [
      participant(1, 'Caitlyn', 100, 'BOTTOM'),
      participant(2, 'Malphite', 100, 'TOP'),
      participant(3, 'Zed', 200, 'MIDDLE'),
      participant(4, 'Syndra', 200, 'MIDDLE'),
    ],
  },
}

const cs = (over: Record<string, number>) => ({
  attackDamage: 90,
  abilityPower: 0,
  armor: 45,
  magicResist: 32,
  healthMax: 1400,
  health: 1400,
  abilityHaste: 0,
  movementSpeed: 330,
  powerMax: 300,
  power: 300,
  ...over,
})

const pf = (id: number, level: number, gold: number, over: Record<string, number> = {}) => ({
  participantId: id,
  currentGold: gold,
  totalGold: gold + 2000,
  level,
  minionsKilled: 20 * level,
  jungleMinionsKilled: 0,
  championStats: cs(over),
})

const ev = (e: TimelineEvent): TimelineEvent => e

const TIMELINE: TimelineDto = {
  metadata: { matchId: 'EUW1_TEST' },
  info: {
    frameInterval: 60000,
    frames: [
      {
        timestamp: 0,
        participantFrames: { 1: pf(1, 1, 500), 2: pf(2, 1, 500), 3: pf(3, 1, 500), 4: pf(4, 1, 500) },
        events: [
          ev({ type: 'ITEM_PURCHASED', timestamp: 1000, participantId: 1, itemId: 1036 }),
          ev({ type: 'ITEM_PURCHASED', timestamp: 2000, participantId: 1, itemId: 1036 }),
        ],
      },
      {
        timestamp: 60000,
        participantFrames: { 1: pf(1, 6, 900, { attackDamage: 120 }), 2: pf(2, 6, 400), 3: pf(3, 7, 1100), 4: pf(4, 6, 800) },
        events: [
          ev({ type: 'CHAMPION_KILL', timestamp: 50000, killerId: 1, victimId: 3, assistingParticipantIds: [2] }),
          ev({ type: 'ITEM_PURCHASED', timestamp: 55000, participantId: 1, itemId: 3134 }),
          ev({ type: 'ITEM_DESTROYED', timestamp: 55000, participantId: 1, itemId: 1036 }),
          ev({ type: 'ITEM_PURCHASED', timestamp: 56000, participantId: 1, itemId: 1038 }),
          ev({ type: 'ITEM_UNDO', timestamp: 56500, participantId: 1, beforeId: 1038, afterId: 0 }),
        ],
      },
      {
        timestamp: 120000,
        participantFrames: { 1: pf(1, 9, 1500, { attackDamage: 150 }), 2: pf(2, 9, 600), 3: pf(3, 10, 900), 4: pf(4, 9, 1200) },
        events: [
          ev({ type: 'CHAMPION_KILL', timestamp: 100000, killerId: 3, victimId: 1 }),
        ],
      },
      {
        timestamp: 600000,
        participantFrames: { 1: pf(1, 13, 300, { attackDamage: 210 }), 2: pf(2, 13, 200), 3: pf(3, 14, 400), 4: pf(4, 13, 500) },
        events: [
          ev({ type: 'ITEM_PURCHASED', timestamp: 610000, participantId: 1, itemId: 3031 }), // Infinity Edge (légendaire)
          ev({ type: 'ITEM_PURCHASED', timestamp: 590000, participantId: 3, itemId: 2003 }), // consommable → ignoré
        ],
      },
    ],
  },
}

describe('patchOf', () => {
  it('garde majeur.mineur', () => {
    expect(patchOf('16.17.531.4185')).toBe('16.17')
    expect(patchOf('14.9.1')).toBe('14.9')
  })
})

describe('itemMultisetAt', () => {
  it('rejoue PURCHASED / DESTROYED / UNDO', () => {
    expect(itemMultisetAt(TIMELINE.info.frames.flatMap((f) => f.events), 1, 3000).sort()).toEqual([
      1036, 1036,
    ])
    // à 60 s : les 2 Long Sword détruits (−1 chacun… ici −1 pour un seul event), Dirk acheté, 1038 annulé
    const at60 = itemMultisetAt(TIMELINE.info.frames.flatMap((f) => f.events), 1, 60000)
    expect(at60).toContain(3134)
    expect(at60).not.toContain(1038)
  })
})

describe('kdaAt', () => {
  it('accumule kills / deaths / assists jusqu’à T', () => {
    const k = kdaAt(TIMELINE.info.frames.flatMap((f) => f.events), 120000)
    expect(k.get(1)).toEqual({ kills: 1, deaths: 1, assists: 0 })
    expect(k.get(2)).toEqual({ kills: 0, deaths: 0, assists: 1 })
    expect(k.get(3)).toEqual({ kills: 1, deaths: 1, assists: 0 })
  })
})

describe('frameAt', () => {
  it('retourne le dernier frame <= atMs', () => {
    expect(frameAt(TIMELINE.info.frames, 130000).timestamp).toBe(120000)
    expect(frameAt(TIMELINE.info.frames, 0).timestamp).toBe(0)
  })
})

describe('reconstructState', () => {
  it('reconstruit un LiveGameData exploitable par assessGame', () => {
    const live = reconstructState(MATCH, TIMELINE, 120000, 1, sd)
    expect(live.allPlayers).toHaveLength(4)
    expect(live.gameData.gameTime).toBe(120)
    expect(live.activePlayer.riotId).toBe('Caitlyn#EUW')
    expect(live.activePlayer.currentGold).toBe(1500)
    expect(live.activePlayer.championStats.attackDamage).toBe(150) // valeur calculée de la timeline
    expect(live.activePlayer.championStats.attackSpeed).toBeGreaterThan(0) // recalculée base+items
    expect(live.activePlayer.championStats.resourceType).toBe('MANA')
    const self = live.allPlayers.find((p) => p.championName === 'Caitlyn')!
    expect(self.scores).toMatchObject({ kills: 1, deaths: 1 })

    const a = assessGame(live, sd)
    expect(a).not.toBeNull()
    expect(a!.self.slug).toBe('Caitlyn')
    expect(a!.threat.enemies.map((e) => e.slug).sort()).toEqual(['Syndra', 'Zed'])
  })
})

describe('extractDecisions', () => {
  it('émet un point de décision par achat de légendaire final, avec l’inventaire d’avant', () => {
    const decisions = extractDecisions(MATCH, TIMELINE, sd, { minSeconds: 300 })
    expect(decisions).toHaveLength(1)
    expect(decisions[0]).toMatchObject({
      participantId: 1,
      championName: 'Caitlyn',
      role: 'BOTTOM',
      atMs: 610000,
      expectedNextItem: 3031,
      patch: '16.17',
    })
    expect(decisions[0].currentItems).toContain(3134)
  })

  it('ignore les achats avant minSeconds et les consommables', () => {
    expect(extractDecisions(MATCH, TIMELINE, sd, { minSeconds: 1200 })).toHaveLength(0)
  })
})
