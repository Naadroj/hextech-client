// Squelette de build (phase A4.3). Agrège les achats réels des parties hi-elo
// moissonnées (bench/raw/) en, par champion + rôle, la liste des items « cœur »
// avec taux de pick et position d'achat moyenne.
//
// - Repli N-1 : couple trop peu vu sur le patch courant → complété avec le
//   patch précédent (marqué `patchSpan`). Jamais prioritaire.
// - Repli « tous rôles » : champion dont aucun rôle ne qualifie → entrée poolée
//   `roleAgnostic`.
// - Rapport de couverture : couples réels sous TARGET_GAMES (défaut 50).
//
// Usage : npm run builds  [minGames=5] [coreMinPickRate=0.30] [situationalMin=0.12]
// Sortie : resources/builds.json (+ bench/coverage.json)

import { appendFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR, ROOT, loadStaticData, previousPatch, rawMatchIds, readRaw } from './lib/local'
import { aggregate, underTarget, type Acc } from './lib/aggregate'
import { type BuildBookFile, type BuildItem, type BuildRole, type ChampionBuild, type RoleBuild } from '../src/shared/build-types'

const minGames = Number(process.argv[2] ?? 5)
const coreMin = Number(process.argv[3] ?? 0.3)
const sitMin = Number(process.argv[4] ?? 0.12)
const TARGET = Number(process.env.HARVEST_TARGET ?? 50)

const { data: sd, patch } = loadStaticData()
const prevPatch = previousPatch(patch)
const allowed = new Set([patch, ...(prevPatch ? [prevPatch] : [])])
const ids = rawMatchIds()
if (ids.length === 0) {
  console.error(`Aucune partie dans ${RAW_DIR}. Lance d'abord : npm run harvest`)
  process.exit(1)
}

const { byPatch, matchesByPatch } = aggregate(ids, readRaw, sd, allowed)
const curMap = byPatch.get(patch) ?? new Map<string, Acc>()
const prevMap = (prevPatch && byPatch.get(prevPatch)) || new Map<string, Acc>()

const round = (v: number, d: number): number => Number(v.toFixed(d))

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

function toRoleBuild(role: BuildRole, acc: Acc): RoleBuild | null {
  const games = acc.games
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
  if (core.length === 0 && boots.length === 0) return null
  return { role, games, boots, core, situational }
}

const allKeys = new Set([...curMap.keys(), ...prevMap.keys()])
const champs = new Map<string, ChampionBuild>()
let entryCount = 0
let blendedCount = 0
let agnosticCount = 0

// ── Entrées par rôle ──────────────────────────────────────────────────────
const qualifiedSlugRoles = new Set<string>()
for (const key of [...allKeys].sort()) {
  const [slug, roleRaw] = key.split('|')
  const role = roleRaw as BuildRole
  const cur = curMap.get(key)
  let acc = cur
  let patchSpan: string | undefined
  if ((!cur || cur.games < minGames) && prevMap.has(key)) {
    acc = merge(cur, prevMap.get(key))
    patchSpan = `${prevPatch}→${patch}`
  }
  if (!acc || acc.games < minGames) continue
  const rb = toRoleBuild(role, acc)
  if (!rb) continue
  if (patchSpan) {
    rb.patchSpan = patchSpan
    blendedCount += 1
  }
  const cb = champs.get(slug) ?? { slug, roles: [] }
  cb.roles.push(rb)
  champs.set(slug, cb)
  entryCount += 1
  qualifiedSlugRoles.add(slug)
}

// ── Repli « tous rôles » pour les champions sans aucune entrée ─────────────
const slugsSeen = new Set([...allKeys].map((k) => k.split('|')[0]))
for (const slug of slugsSeen) {
  if (qualifiedSlugRoles.has(slug)) continue
  // pool tous rôles, courant puis N-1
  let pooled: Acc | undefined
  let dominant: { role: BuildRole; games: number } | null = null
  let usedPrev = false
  for (const [map, isPrev] of [[curMap, false], [prevMap, true]] as const) {
    for (const [key, acc] of map) {
      const [s, roleRaw] = key.split('|')
      if (s !== slug) continue
      pooled = merge(pooled, acc)
      if (isPrev) usedPrev = true
      if (!dominant || acc.games > dominant.games) dominant = { role: roleRaw as BuildRole, games: acc.games }
    }
    if (pooled && pooled.games >= minGames) break
  }
  if (!pooled || pooled.games < minGames || !dominant) continue
  const rb = toRoleBuild(dominant.role, pooled)
  if (!rb) continue
  rb.roleAgnostic = true
  if (usedPrev) rb.patchSpan = `${prevPatch}→${patch}`
  champs.set(slug, { slug, roles: [rb] })
  entryCount += 1
  agnosticCount += 1
}

const totalMatches = [...matchesByPatch.values()].reduce((a, b) => a + b, 0)
const out: BuildBookFile = {
  patch,
  generatedAt: new Date().toISOString(),
  sampleGames: totalMatches,
  params: { minGames, coreMinPickRate: coreMin, situationalMinPickRate: sitMin },
  builds: [...champs.values()].sort((x, y) => x.slug.localeCompare(y.slug)),
}
writeFileSync(resolve(ROOT, 'resources/builds.json'), JSON.stringify(out, null, 2) + '\n')

// ── Rapport de couverture ────────────────────────────────────────────────
const incomplete = underTarget(byPatch, patch, TARGET, 3)
const complete = [...curMap.values()].filter((a) => a.games >= TARGET).length
const coverage = {
  patch,
  target: TARGET,
  generatedAt: out.generatedAt,
  seenChampRoles: curMap.size,
  atTarget: complete,
  incomplete: incomplete.map((x) => ({ champRole: x.key, games: x.games })),
}
writeFileSync(resolve(ROOT, 'bench/coverage.json'), JSON.stringify(coverage, null, 2) + '\n')

const lines = [
  `Parties : ${JSON.stringify(Object.fromEntries(matchesByPatch))} (courant ${patch}${prevPatch ? `, repli ${prevPatch}` : ''})`,
  `${entryCount} entrées (${blendedCount} complétées N-1, ${agnosticCount} tous-rôles) — ${curMap.size} couples champion+rôle vus`,
  `Couverture ≥ ${TARGET} parties : ${complete}/${curMap.size} couples · ${incomplete.length} réels sous le seuil`,
]
console.log(lines.join('\n'))
if (incomplete.length) {
  console.log('  incomplets : ' + incomplete.slice(0, 30).map((x) => `${x.key}(${x.games})`).join(', ') + (incomplete.length > 30 ? ' …' : ''))
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    ['## Squelette de build', ...lines.map((l) => `- ${l}`), '', '```', incomplete.map((x) => `${x.key}  ${x.games}`).join('\n'), '```', ''].join('\n'),
  )
}
console.log(`\n→ resources/builds.json  ·  bench/coverage.json`)
