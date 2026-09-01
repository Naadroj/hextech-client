// Squelette de build (phase A4.3). Agrège les achats réels des parties
// Challenger moissonnées (bench/raw/) en, par champion + rôle, la liste des
// items « cœur » avec taux de pick et position d'achat moyenne.
//
// Repli N-1 : un couple champion+rôle trop peu vu sur le patch courant est
// complété avec les parties du patch précédent (marqué `patchSpan`).
//
// Usage : npm run builds  [minGames=6] [coreMinPickRate=0.30] [situationalMin=0.12]
// Sortie : resources/builds.json  (committé — repli offline du client)

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR, ROOT, loadStaticData, previousPatch, rawMatchIds, readRaw } from './lib/local'
import { patchOf, type MatchDto, type TimelineDto, type TimelineEvent } from '../src/shared/engine/replay'
import { normalizeBuildRole, type BuildBookFile, type BuildItem, type ChampionBuild, type RoleBuild } from '../src/shared/build-types'

const minGames = Number(process.argv[2] ?? 6)
const coreMin = Number(process.argv[3] ?? 0.3)
const sitMin = Number(process.argv[4] ?? 0.12)

const { data: sd, patch } = loadStaticData()
const prevPatch = previousPatch(patch)
const ids = rawMatchIds()
if (ids.length === 0) {
  console.error(`Aucune partie dans ${RAW_DIR}. Lance d'abord : npm run harvest`)
  process.exit(1)
}

const isLegendary = (id: number): boolean => {
  const it = sd.getItem(id)
  return !!it && id < 200000 && it.isFinal && !it.isBoots && !it.isConsumable && !it.isTrinket && it.goldTotal >= 2000
}
const isBoots = (id: number): boolean => {
  const it = sd.getItem(id)
  return !!it && it.isFinal && it.isBoots && !it.isConsumable
}

interface Acc {
  games: number
  legend: Map<number, { count: number; slotSum: number }>
  boots: Map<number, number>
}
/** patch → (`champion|ROLE` → Acc). */
const byPatch = new Map<string, Map<string, Acc>>()
const accFor = (p: string, key: string): Acc => {
  let m = byPatch.get(p)
  if (!m) {
    m = new Map()
    byPatch.set(p, m)
  }
  let v = m.get(key)
  if (!v) {
    v = { games: 0, legend: new Map(), boots: new Map() }
    m.set(key, v)
  }
  return v
}

const matchesByPatch = new Map<string, number>()

for (const id of ids) {
  let match: MatchDto
  let timeline: TimelineDto
  try {
    match = readRaw<MatchDto>(id, 'match')
    timeline = readRaw<TimelineDto>(id, 'timeline')
  } catch {
    continue
  }
  const mp = patchOf(match.info.gameVersion)
  if (mp !== patch && mp !== prevPatch) continue
  if ((match.info.mapId ?? 11) !== 11) continue
  matchesByPatch.set(mp, (matchesByPatch.get(mp) ?? 0) + 1)

  const events: TimelineEvent[] = timeline.info.frames.flatMap((f) => f.events ?? [])
  const buysByPid = new Map<number, number[]>()
  for (const e of events) {
    if (e.type !== 'ITEM_PURCHASED') continue
    const pe = e as { participantId: number; itemId: number }
    const arr = buysByPid.get(pe.participantId) ?? []
    arr.push(pe.itemId)
    buysByPid.set(pe.participantId, arr)
  }

  for (const p of match.info.participants) {
    const role = normalizeBuildRole(p.teamPosition)
    if (!role) continue
    const legendaryOrder: number[] = []
    let bootsId: number | null = null
    for (const itemId of buysByPid.get(p.participantId) ?? []) {
      if (isLegendary(itemId) && !legendaryOrder.includes(itemId)) legendaryOrder.push(itemId)
      else if (bootsId === null && isBoots(itemId)) bootsId = itemId
    }
    if (legendaryOrder.length === 0 && bootsId === null) continue

    const a = accFor(mp, `${p.championName}|${role}`)
    a.games += 1
    legendaryOrder.forEach((itemId, i) => {
      const cur = a.legend.get(itemId) ?? { count: 0, slotSum: 0 }
      cur.count += 1
      cur.slotSum += i + 1
      a.legend.set(itemId, cur)
    })
    if (bootsId !== null) a.boots.set(bootsId, (a.boots.get(bootsId) ?? 0) + 1)
  }
}

/** Fusionne `extra` dans une copie de `base` (ids déjà filtrés au catalogue courant). */
function merge(base: Acc | undefined, extra: Acc | undefined): Acc {
  const acc: Acc = { games: base?.games ?? 0, legend: new Map(), boots: new Map(base?.boots ?? []) }
  for (const [id, s] of base?.legend ?? []) acc.legend.set(id, { ...s })
  if (!extra) return acc
  acc.games += extra.games
  for (const [id, s] of extra.legend) {
    const cur = acc.legend.get(id) ?? { count: 0, slotSum: 0 }
    cur.count += s.count
    cur.slotSum += s.slotSum
    acc.legend.set(id, cur)
  }
  for (const [id, n] of extra.boots) acc.boots.set(id, (acc.boots.get(id) ?? 0) + n)
  return acc
}

const round = (v: number, d: number): number => Number(v.toFixed(d))
const curMap = byPatch.get(patch) ?? new Map<string, Acc>()
const prevMap = (prevPatch && byPatch.get(prevPatch)) || new Map<string, Acc>()
const allKeys = new Set([...curMap.keys(), ...prevMap.keys()])

const champs = new Map<string, ChampionBuild>()
let entryCount = 0
let blendedCount = 0

for (const key of [...allKeys].sort()) {
  const cur = curMap.get(key)
  let acc = cur
  let patchSpan: string | undefined
  if ((!cur || cur.games < minGames) && prevPatch && prevMap.has(key)) {
    acc = merge(cur, prevMap.get(key))
    patchSpan = `${prevPatch}→${patch}`
  }
  if (!acc || acc.games < minGames) continue
  const games = acc.games

  const [slug, roleRaw] = key.split('|')
  const legend: BuildItem[] = [...acc.legend.entries()]
    .map(([id, s]) => ({ id, pickRate: round(s.count / games, 3), avgSlot: round(s.slotSum / s.count, 2) }))
    .sort((x, y) => y.pickRate - x.pickRate)
  const core = legend.filter((x) => x.pickRate >= coreMin)
  const situational = legend.filter((x) => x.pickRate >= sitMin && x.pickRate < coreMin).slice(0, 8)
  const boots: BuildItem[] = [...acc.boots.entries()]
    .map(([id, count]) => ({ id, pickRate: round(count / games, 3), avgSlot: 0 }))
    .filter((x) => x.pickRate >= sitMin)
    .sort((x, y) => y.pickRate - x.pickRate)
    .slice(0, 3)
  if (core.length === 0 && boots.length === 0) continue

  const rb: RoleBuild = { role: roleRaw as RoleBuild['role'], games, boots, core, situational }
  if (patchSpan) {
    rb.patchSpan = patchSpan
    blendedCount += 1
  }
  const cb = champs.get(slug) ?? { slug, roles: [] }
  cb.roles.push(rb)
  champs.set(slug, cb)
  entryCount += 1
}

const totalMatches = [...matchesByPatch.values()].reduce((a, b) => a + b, 0)
const out: BuildBookFile = {
  patch,
  generatedAt: new Date().toISOString(),
  sampleGames: totalMatches,
  params: { minGames, coreMinPickRate: coreMin, situationalMinPickRate: sitMin },
  builds: [...champs.values()].sort((x, y) => x.slug.localeCompare(y.slug)),
}

const dest = resolve(ROOT, 'resources/builds.json')
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')

console.log(
  `Parties : ${JSON.stringify(Object.fromEntries(matchesByPatch))} (courant ${patch}` +
    `${prevPatch ? `, repli ${prevPatch}` : ''})`,
)
console.log(
  `${entryCount} couples champion+rôle retenus (≥ ${minGames} parties, dont ${blendedCount} complétés N-1) sur ${allKeys.size} vus`,
)
const byRole = new Map<string, number>()
for (const cb of out.builds) for (const rb of cb.roles) byRole.set(rb.role, (byRole.get(rb.role) ?? 0) + 1)
console.log('  par rôle :', JSON.stringify(Object.fromEntries([...byRole.entries()].sort())))

const nameOf = (id: number): string => sd.getItem(id)?.name ?? String(id)
for (const slug of ['Nasus', 'Kaisa', 'Jinx', 'Ahri']) {
  const cb = out.builds.find((c) => c.slug.toLowerCase() === slug.toLowerCase())
  if (!cb) continue
  for (const rb of cb.roles) {
    const core = rb.core.map((c) => `${nameOf(c.id)} (${Math.round(c.pickRate * 100)}% · s${c.avgSlot})`).join(', ')
    console.log(`  ${cb.slug} ${rb.role} [${rb.games}${rb.patchSpan ? ' ' + rb.patchSpan : ''}] : ${core || '—'}`)
  }
}

console.log(`\n→ ${dest}`)
