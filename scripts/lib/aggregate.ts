import { patchOf, type MatchDto, type TimelineDto, type TimelineEvent } from '../../src/shared/engine/replay'
import { normalizeBuildRole, type BuildRole } from '../../src/shared/build-types'
import type { StaticData } from '../../src/shared/staticdata-types'

/**
 * Parsing / agrégation **partagée** entre `build-skeletons.ts` (génère
 * `builds.json`) et `topup-matches.ts` (moisson ciblée pour la couverture).
 */

export interface Acc {
  games: number
  legend: Map<number, { count: number; slotSum: number }>
  boots: Map<number, number>
}

export interface AggregateResult {
  /** patch → (`champion|ROLE` → Acc). */
  byPatch: Map<string, Map<string, Acc>>
  /** `champion|ROLE` → puuids vus jouer ce couple (toutes patchs). Sert au top-up ciblé. */
  puuidsByKey: Map<string, Set<string>>
  /** patch → nombre de matchs distincts retenus. */
  matchesByPatch: Map<string, number>
}

export function isLegendary(sd: StaticData, id: number): boolean {
  const it = sd.getItem(id)
  return (
    !!it &&
    id < 200000 &&
    it.isFinal &&
    !it.isBoots &&
    !it.isConsumable &&
    !it.isTrinket &&
    it.goldTotal >= 2000
  )
}
export function isFinalBoots(sd: StaticData, id: number): boolean {
  const it = sd.getItem(id)
  return !!it && it.isFinal && it.isBoots && !it.isConsumable
}

export interface ParsedParticipant {
  puuid: string
  slug: string
  role: BuildRole
  legendaryOrder: number[]
  bootsId: number | null
}

/** Extrait, par participant à `teamPosition` connue, l'ordre des légendaires + 1res bottes. */
export function parseParticipants(
  match: MatchDto,
  timeline: TimelineDto,
  sd: StaticData,
): ParsedParticipant[] {
  const events: TimelineEvent[] = timeline.info.frames.flatMap((f) => f.events ?? [])
  const buysByPid = new Map<number, number[]>()
  for (const e of events) {
    if (e.type !== 'ITEM_PURCHASED') continue
    const pe = e as { participantId: number; itemId: number }
    const arr = buysByPid.get(pe.participantId) ?? []
    arr.push(pe.itemId)
    buysByPid.set(pe.participantId, arr)
  }

  const out: ParsedParticipant[] = []
  for (const p of match.info.participants) {
    const role = normalizeBuildRole(p.teamPosition)
    if (!role) continue
    const legendaryOrder: number[] = []
    let bootsId: number | null = null
    for (const itemId of buysByPid.get(p.participantId) ?? []) {
      if (isLegendary(sd, itemId) && !legendaryOrder.includes(itemId)) legendaryOrder.push(itemId)
      else if (bootsId === null && isFinalBoots(sd, itemId)) bootsId = itemId
    }
    if (legendaryOrder.length === 0 && bootsId === null) continue
    out.push({ puuid: p.puuid, slug: p.championName, role, legendaryOrder, bootsId })
  }
  return out
}

export function aggregate(
  matchIds: string[],
  readRaw: <T>(id: string, kind: 'match' | 'timeline') => T,
  sd: StaticData,
  allowedPatches: Set<string>,
): AggregateResult {
  const byPatch = new Map<string, Map<string, Acc>>()
  const puuidsByKey = new Map<string, Set<string>>()
  const matchesByPatch = new Map<string, number>()

  const accFor = (p: string, key: string): Acc => {
    let m = byPatch.get(p)
    if (!m) byPatch.set(p, (m = new Map()))
    let v = m.get(key)
    if (!v) m.set(key, (v = { games: 0, legend: new Map(), boots: new Map() }))
    return v
  }

  for (const id of matchIds) {
    let match: MatchDto
    let timeline: TimelineDto
    try {
      match = readRaw<MatchDto>(id, 'match')
      timeline = readRaw<TimelineDto>(id, 'timeline')
    } catch {
      continue
    }
    const mp = patchOf(match.info.gameVersion)
    if (!allowedPatches.has(mp)) continue
    if ((match.info.mapId ?? 11) !== 11) continue
    matchesByPatch.set(mp, (matchesByPatch.get(mp) ?? 0) + 1)

    for (const pp of parseParticipants(match, timeline, sd)) {
      const key = `${pp.slug}|${pp.role}`
      const acc = accFor(mp, key)
      acc.games += 1
      pp.legendaryOrder.forEach((itemId, i) => {
        const cur = acc.legend.get(itemId) ?? { count: 0, slotSum: 0 }
        cur.count += 1
        cur.slotSum += i + 1
        acc.legend.set(itemId, cur)
      })
      if (pp.bootsId !== null) acc.boots.set(pp.bootsId, (acc.boots.get(pp.bootsId) ?? 0) + 1)
      if (pp.puuid) {
        let set = puuidsByKey.get(key)
        if (!set) puuidsByKey.set(key, (set = new Set()))
        set.add(pp.puuid)
      }
    }
  }
  return { byPatch, puuidsByKey, matchesByPatch }
}

/**
 * Couples `champion|ROLE` **réels mais incomplets** du patch courant :
 * `floor <= games < target` (croissant). En dessous de `floor` = bruit off-méta
 * (un troll en Soraka top) qu'on ne chasse pas.
 */
export function underTarget(
  byPatch: Map<string, Map<string, Acc>>,
  currentPatch: string,
  target: number,
  floor = 3,
): { key: string; games: number }[] {
  const cur = byPatch.get(currentPatch) ?? new Map<string, Acc>()
  const out: { key: string; games: number }[] = []
  for (const [key, acc] of cur) {
    if (acc.games >= floor && acc.games < target) out.push({ key, games: acc.games })
  }
  return out.sort((a, b) => a.games - b.games)
}
