import type {
  LiveActivePlayer,
  LiveChampionStats,
  LiveGameData,
  LivePlayer,
} from '../../live-types'
import type { StaticData } from '../../staticdata-types'
import { effectiveStats } from '../model'
import type {
  Decision,
  MatchDto,
  MatchParticipantDto,
  TimelineChampionStats,
  TimelineDto,
  TimelineEvent,
  TimelineFrame,
} from './types'

/**
 * Reconstruction d'un `LiveGameData` à partir d'un match + timeline Riot
 * Match-V5, et extraction des décisions d'achat réelles. **Pur**.
 */

/** `"16.17.531.4185"` → `"16.17"`. */
export function patchOf(gameVersion: string): string {
  const parts = (gameVersion ?? '').split('.')
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : gameVersion
}

const allEvents = (timeline: TimelineDto): TimelineEvent[] =>
  timeline.info.frames.flatMap((f) => f.events ?? [])

/** Dernier frame dont `timestamp <= atMs` (ou le premier si `atMs` est avant). */
export function frameAt(frames: TimelineFrame[], atMs: number): TimelineFrame {
  let pick = frames[0]
  for (const f of frames) {
    if (f.timestamp <= atMs) pick = f
    else break
  }
  return pick
}

/** Inventaire (ids avec doublons) du participant `pid` à l'instant `atMs`. */
export function itemMultisetAt(
  events: TimelineEvent[],
  pid: number,
  atMs: number,
): number[] {
  const counts = new Map<number, number>()
  const inc = (id: number, by: number): void => {
    if (!id) return
    counts.set(id, Math.max(0, (counts.get(id) ?? 0) + by))
  }
  const relevant = events
    .filter((e) => (e as { participantId?: number }).participantId === pid && e.timestamp <= atMs)
    .sort((a, b) => a.timestamp - b.timestamp)

  for (const e of relevant) {
    switch (e.type) {
      case 'ITEM_PURCHASED':
        inc((e as { itemId: number }).itemId, +1)
        break
      case 'ITEM_SOLD':
      case 'ITEM_DESTROYED':
        inc((e as { itemId: number }).itemId, -1)
        break
      case 'ITEM_UNDO': {
        const u = e as { beforeId?: number; afterId?: number }
        if (u.beforeId) inc(u.beforeId, -1)
        if (u.afterId) inc(u.afterId, +1)
        break
      }
      default:
        break
    }
  }

  const out: number[] = []
  for (const [id, n] of counts) for (let i = 0; i < n; i++) out.push(id)
  return out
}

export interface KDA {
  kills: number
  deaths: number
  assists: number
}

/** KDA accumulé de chaque participant jusqu'à `atMs`. */
export function kdaAt(events: TimelineEvent[], atMs: number): Map<number, KDA> {
  const map = new Map<number, KDA>()
  const get = (pid: number): KDA => {
    let v = map.get(pid)
    if (!v) {
      v = { kills: 0, deaths: 0, assists: 0 }
      map.set(pid, v)
    }
    return v
  }
  for (const e of events) {
    if (e.type !== 'CHAMPION_KILL' || e.timestamp > atMs) continue
    const k = e as {
      killerId: number
      victimId: number
      assistingParticipantIds?: number[]
    }
    if (k.killerId) get(k.killerId).kills += 1
    if (k.victimId) get(k.victimId).deaths += 1
    for (const a of k.assistingParticipantIds ?? []) get(a).assists += 1
  }
  return map
}

const fracToPct = (v: number | undefined): number =>
  typeof v === 'number' && v > 0 ? Math.max(0, Math.min(100, v <= 1 ? v * 100 : v)) : 0

const EMPTY_LIVE_CS: LiveChampionStats = {
  abilityHaste: 0,
  abilityPower: 0,
  armor: 0,
  armorPenetrationFlat: 0,
  armorPenetrationPercent: 0,
  attackDamage: 0,
  attackRange: 0,
  attackSpeed: 0,
  bonusArmorPenetrationPercent: 0,
  bonusMagicPenetrationPercent: 0,
  critChance: 0,
  critDamage: 175,
  currentHealth: 0,
  healShieldPower: 0,
  healthRegenRate: 0,
  lifeSteal: 0,
  magicLethality: 0,
  magicPenetrationFlat: 0,
  magicPenetrationPercent: 0,
  magicResist: 0,
  maxHealth: 0,
  moveSpeed: 0,
  omnivamp: 0,
  physicalLethality: 0,
  physicalVamp: 0,
  resourceMax: 0,
  resourceRegenRate: 0,
  resourceType: 'MANA',
  resourceValue: 0,
  spellVamp: 0,
  tenacity: 0,
}

/**
 * Convertit `championStats` de timeline → `LiveChampionStats`. La vitesse
 * d'attaque et la chance de critique de la timeline sont peu fiables (format
 * variable) : on les **recalcule** depuis les stats de base + items.
 */
export function timelineChampionStatsToLive(
  ts: TimelineChampionStats,
  championName: string,
  level: number,
  itemIds: number[],
  staticData: StaticData,
): LiveChampionStats {
  const base = staticData.getChampionStatsAtLevel(championName, level)
  const items = itemIds
    .map((id) => staticData.getItem(id))
    .filter((x): x is NonNullable<typeof x> => !!x)
  const eff = base ? effectiveStats(base, items) : null
  const resourceType = (staticData.getChampion(championName)?.resource ?? 'None').toUpperCase()

  return {
    ...EMPTY_LIVE_CS,
    abilityHaste: ts.abilityHaste ?? 0,
    abilityPower: ts.abilityPower ?? 0,
    armor: ts.armor ?? eff?.armor ?? 0,
    armorPenetrationFlat: ts.armorPen ?? 0,
    armorPenetrationPercent: fracToPct(ts.armorPenPercent),
    physicalLethality: ts.armorPen ?? 0,
    attackDamage: ts.attackDamage ?? eff?.attackDamage ?? 0,
    attackRange: eff?.attackRange ?? 0,
    attackSpeed: eff?.attackSpeed ?? (ts.attackSpeed ?? 0),
    critChance: eff ? eff.critChance : 0,
    currentHealth: ts.health ?? ts.healthMax ?? 0,
    maxHealth: ts.healthMax ?? eff?.health ?? 0,
    healthRegenRate: ts.healthRegen ?? 0,
    lifeSteal: fracToPct(ts.lifesteal),
    magicPenetrationFlat: ts.magicPen ?? 0,
    magicPenetrationPercent: fracToPct(ts.magicPenPercent),
    magicResist: ts.magicResist ?? eff?.magicResist ?? 0,
    moveSpeed: ts.movementSpeed ?? eff?.moveSpeed ?? 0,
    omnivamp: fracToPct(ts.omnivamp),
    resourceMax: ts.powerMax ?? 0,
    resourceValue: ts.power ?? 0,
    resourceRegenRate: ts.powerRegen ?? 0,
    resourceType,
  }
}

const riotId = (p: MatchParticipantDto): string =>
  p.riotIdGameName && p.riotIdTagline
    ? `${p.riotIdGameName}#${p.riotIdTagline}`
    : (p.summonerName ?? `P${p.participantId}`)

const spell = (name: string) => ({
  displayName: name,
  rawDescription: '',
  rawDisplayName: `Summoner${name}`,
})

/**
 * Reconstruit un `LiveGameData` du point de vue du participant `coachPid` à
 * l'instant `atMs`.
 */
export function reconstructState(
  match: MatchDto,
  timeline: TimelineDto,
  atMs: number,
  coachPid: number,
  staticData: StaticData,
): LiveGameData {
  const events = allEvents(timeline)
  const frame = frameAt(timeline.info.frames, atMs)
  const kda = kdaAt(events, atMs)
  const byPid = new Map(match.info.participants.map((p) => [p.participantId, p]))

  const buildPlayer = (p: MatchParticipantDto): LivePlayer => {
    const pf = frame.participantFrames[String(p.participantId)]
    const items = itemMultisetAt(events, p.participantId, atMs)
    const k = kda.get(p.participantId) ?? { kills: 0, deaths: 0, assists: 0 }
    const spells = [p.summoner1Id, p.summoner2Id].map(
      (id) => staticData.getSummonerSpellById(id)?.name ?? 'Flash',
    )
    const keystoneId = p.perks?.styles?.[0]?.selections?.[0]?.perk ?? 0
    const keystone = staticData.getRuneById(keystoneId)
    return {
      championName: p.championName,
      rawChampionName: `game_character_displayname_${p.championName}`,
      skinID: 0,
      isBot: false,
      isDead: false,
      respawnTimer: 0,
      items: items.map((id, slot) => ({
        canUse: false,
        consumable: false,
        count: 1,
        displayName: staticData.getItem(id)?.name ?? '',
        itemID: id,
        price: 0,
        rawDescription: '',
        rawDisplayName: '',
        slot,
      })),
      level: pf?.level ?? 1,
      position: p.teamPosition ?? '',
      scores: {
        kills: k.kills,
        deaths: k.deaths,
        assists: k.assists,
        creepScore: (pf?.minionsKilled ?? 0) + (pf?.jungleMinionsKilled ?? 0),
        wardScore: 0,
      },
      summonerName: p.summonerName ?? p.riotIdGameName ?? `P${p.participantId}`,
      riotId: riotId(p),
      riotIdGameName: p.riotIdGameName,
      riotIdTagLine: p.riotIdTagline,
      summonerSpells: {
        summonerSpellOne: spell(spells[0]),
        summonerSpellTwo: spell(spells[1]),
      },
      runes: {
        keystone: {
          displayName: keystone?.name ?? '',
          id: keystoneId,
          rawDescription: '',
          rawDisplayName: '',
        },
        primaryRuneTree: { displayName: '', id: 0, rawDescription: '', rawDisplayName: '' },
        secondaryRuneTree: { displayName: '', id: 0, rawDescription: '', rawDisplayName: '' },
      },
      team: p.teamId === 100 ? 'ORDER' : 'CHAOS',
    }
  }

  const allPlayers = match.info.participants.map(buildPlayer)
  const self = byPid.get(coachPid)!
  const selfItems = itemMultisetAt(events, coachPid, atMs)
  const selfFrame = frame.participantFrames[String(coachPid)]
  const cs = timelineChampionStatsToLive(
    selfFrame?.championStats ?? {},
    self.championName,
    selfFrame?.level ?? 1,
    selfItems,
    staticData,
  )

  const activePlayer: LiveActivePlayer = {
    abilities: {
      Passive: { displayName: '', id: '', rawDescription: '', rawDisplayName: '' },
      Q: { displayName: '', id: '', rawDescription: '', rawDisplayName: '' },
      W: { displayName: '', id: '', rawDescription: '', rawDisplayName: '' },
      E: { displayName: '', id: '', rawDescription: '', rawDisplayName: '' },
      R: { displayName: '', id: '', rawDescription: '', rawDisplayName: '' },
    },
    championStats: cs,
    currentGold: selfFrame?.currentGold ?? 0,
    fullRunes: {
      keystone: { displayName: '', id: 0, rawDescription: '', rawDisplayName: '' },
      primaryRuneTree: { displayName: '', id: 0, rawDescription: '', rawDisplayName: '' },
      secondaryRuneTree: { displayName: '', id: 0, rawDescription: '', rawDisplayName: '' },
      generalRunes: [],
      statRunes: [],
    },
    level: selfFrame?.level ?? 1,
    summonerName: self.summonerName ?? '',
    riotId: riotId(self),
    riotIdGameName: self.riotIdGameName,
    riotIdTagLine: self.riotIdTagline,
  }

  return {
    activePlayer,
    allPlayers,
    events: { Events: [] },
    gameData: {
      gameMode: 'CLASSIC',
      gameTime: atMs / 1000,
      mapName: 'Map11',
      mapNumber: match.info.mapId ?? 11,
      mapTerrain: 'Default',
    },
  }
}

export interface ExtractOptions {
  /** Ignore les décisions avant ce temps (bruit de départ / 1er back). Défaut : 300 s. */
  minSeconds?: number
  /** Or minimal d'un « légendaire final » candidat. Défaut : 2000. */
  minGold?: number
}

/**
 * Extrait chaque achat de **légendaire final** (par joueur, dans l'ordre) comme
 * point de décision, avec l'inventaire juste avant.
 */
export function extractDecisions(
  match: MatchDto,
  timeline: TimelineDto,
  staticData: StaticData,
  options: ExtractOptions = {},
): Decision[] {
  const minMs = (options.minSeconds ?? 300) * 1000
  const minGold = options.minGold ?? 2000
  const events = allEvents(timeline)
  const patch = patchOf(match.info.gameVersion)
  const byPid = new Map(match.info.participants.map((p) => [p.participantId, p]))

  const isLegendary = (id: number): boolean => {
    const it = staticData.getItem(id)
    return (
      !!it &&
      id < 200000 &&
      it.isFinal &&
      !it.isBoots &&
      !it.isConsumable &&
      !it.isTrinket &&
      it.goldTotal >= minGold
    )
  }

  const purchases = events
    .filter((e) => e.type === 'ITEM_PURCHASED')
    .map((e) => e as { timestamp: number; participantId: number; itemId: number })
    .sort((a, b) => a.timestamp - b.timestamp)

  const out: Decision[] = []
  for (const p of purchases) {
    if (p.timestamp < minMs || !isLegendary(p.itemId)) continue
    const part = byPid.get(p.participantId)
    if (!part) continue
    out.push({
      matchId: match.metadata.matchId,
      patch,
      participantId: p.participantId,
      championName: part.championName,
      role: part.teamPosition ?? '',
      atMs: p.timestamp,
      stateAtMs: p.timestamp - 1,
      currentItems: itemMultisetAt(events, p.participantId, p.timestamp - 1),
      expectedNextItem: p.itemId,
    })
  }
  return out
}
