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
import { AXIS_MINORITY_SHARE, aggregate, underTarget, type Acc } from './lib/aggregate'
import {
  type BuildAxis,
  type BuildBookFile,
  type BuildItem,
  type BuildRole,
  type ChampionBuild,
  type RoleBuild,
} from '../src/shared/build-types'

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
  const acc: Acc = {
    games: base?.games ?? 0,
    legend: new Map(),
    boots: new Map(base?.boots ?? []),
    starters: new Map(base?.starters ?? []),
  }
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
  for (const [id, n] of extra.starters) acc.starters.set(id, (acc.starters.get(id) ?? 0) + n)
  return acc
}

function toRoleBuild(role: BuildRole, acc: Acc): RoleBuild | null {
  const games = acc.games
  const legend: BuildItem[] = [...acc.legend.entries()]
    .map(([id, s]) => ({
      id,
      pickRate: round(s.count / games, 3),
      avgSlot: round(s.slotSum / s.count, 2),
    }))
    .sort((x, y) => y.pickRate - x.pickRate)
  const core = legend.filter((x) => x.pickRate >= coreMin)
  const situational = legend.filter((x) => x.pickRate >= sitMin && x.pickRate < coreMin).slice(0, 8)
  const boots: BuildItem[] = [...acc.boots.entries()]
    .map(([id, count]) => ({ id, pickRate: round(count / games, 3), avgSlot: 0 }))
    .filter((x) => x.pickRate >= sitMin)
    .sort((x, y) => y.pickRate - x.pickRate)
    .slice(0, 3)
  const starters: BuildItem[] = [...acc.starters.entries()]
    .map(([id, count]) => ({ id, pickRate: round(count / games, 3), avgSlot: 0 }))
    .filter((x) => x.pickRate >= 0.15)
    .sort((x, y) => y.pickRate - x.pickRate)
    .slice(0, 4)
  if (core.length === 0 && boots.length === 0) return null
  return { role, games, boots, core, situational, ...(starters.length ? { starters } : {}) }
}

// Les clés `champ|ROLE#axe` sont des variantes, traitées avec leur couple parent.
const allKeys = new Set([...curMap.keys(), ...prevMap.keys()].filter((k) => !k.includes('#')))
const champs = new Map<string, ChampionBuild>()
let entryCount = 0
let blendedCount = 0
let agnosticCount = 0
let axisVariantCount = 0

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

  // ── Variantes d'axe (champions bimodaux : Shaco AD vs AP) ───────────────
  // On n'émet que si les deux côtés tiennent debout ET que le minoritaire pèse
  // assez — sinon c'est un champion mono-chemin (Kaïsa) et scinder n'a pas de
  // sens.
  const variants: { axis: BuildAxis; acc: Acc }[] = []
  for (const axis of ['physical', 'magic'] as BuildAxis[]) {
    const vk = `${key}#${axis}`
    const v = curMap.get(vk) ?? (prevMap.has(vk) ? prevMap.get(vk) : undefined)
    if (v && v.games >= minGames) variants.push({ axis, acc: v })
  }
  if (variants.length === 2) {
    const total = variants[0].acc.games + variants[1].acc.games
    const minority = Math.min(variants[0].acc.games, variants[1].acc.games) / total
    if (minority >= AXIS_MINORITY_SHARE) {
      for (const v of variants) {
        const vrb = toRoleBuild(role, v.acc)
        if (!vrb) continue
        vrb.axis = v.axis
        cb.roles.push(vrb)
        axisVariantCount += 1
      }
    }
  }

  champs.set(slug, cb)
  entryCount += 1
  qualifiedSlugRoles.add(slug)
}

// ── Repli poolé pour les champions **mono-rôle** trop peu vus ──────────────
// On ne poole PAS un champion joué dans plusieurs rôles réels (builds distincts
// → on ne veut jamais conseiller un build de jungle à un joueur top).
const REAL = 3
const slugsSeen = new Set([...allKeys].map((k) => k.split('|')[0]))
for (const slug of slugsSeen) {
  if (qualifiedSlugRoles.has(slug)) continue

  const rolesGames = new Map<BuildRole, number>()
  for (const map of [curMap, prevMap]) {
    for (const [key, acc] of map) {
      if (key.includes('#')) continue // variante d'axe : déjà comptée dans la combinée
      const [s, roleRaw] = key.split('|')
      if (s !== slug) continue
      rolesGames.set(roleRaw as BuildRole, (rolesGames.get(roleRaw as BuildRole) ?? 0) + acc.games)
    }
  }
  const realRoles = [...rolesGames.entries()].filter(([, g]) => g >= REAL).map(([r]) => r)
  if (realRoles.length !== 1) continue // 0 = bruit, ≥2 = builds distincts → repli moteur

  let pooled: Acc | undefined
  let usedPrev = false
  for (const [map, isPrev] of [
    [curMap, false],
    [prevMap, true],
  ] as const) {
    for (const [key, acc] of map) {
      if (key.includes('#') || key.split('|')[0] !== slug) continue
      pooled = merge(pooled, acc)
      if (isPrev) usedPrev = true
    }
    if (pooled && pooled.games >= minGames) break
  }
  if (!pooled || pooled.games < minGames) continue
  const rb = toRoleBuild(realRoles[0], pooled)
  if (!rb) continue
  rb.roleAgnostic = true
  rb.pooledRoles = realRoles
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
  `${entryCount} entrées (${blendedCount} complétées N-1, ${agnosticCount} tous-rôles) · ${axisVariantCount} variantes d'axe AD/AP`,
  `Couverture ≥ ${TARGET} parties : ${complete}/${curMap.size} couples · ${incomplete.length} réels sous le seuil`,
]
console.log(lines.join('\n'))
if (incomplete.length) {
  console.log(
    '  incomplets : ' +
      incomplete
        .slice(0, 30)
        .map((x) => `${x.key}(${x.games})`)
        .join(', ') +
      (incomplete.length > 30 ? ' …' : ''),
  )
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Squelette de build',
      ...lines.map((l) => `- ${l}`),
      '',
      '```',
      incomplete.map((x) => `${x.key}  ${x.games}`).join('\n'),
      '```',
      '',
    ].join('\n'),
  )
}
console.log(`\n→ resources/builds.json  ·  bench/coverage.json`)
