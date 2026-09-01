// Benchmark du moteur Coach contre les décisions d'achat réelles moissonnées
// (phase A4.2). Ne modifie rien — imprime un rapport et écrit bench/report.json.
//
// Usage : npm run bench:coach

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR, ROOT, loadBuildBook, loadStaticData, rawMatchIds, readRaw } from './lib/local'
import {
  extractDecisions,
  patchOf,
  reconstructState,
  type MatchDto,
  type TimelineDto,
} from '../src/shared/engine/replay'
import { assessGame } from '../src/shared/engine/context'
import { recommend, itemIntent, type Intent } from '../src/shared/engine/recommend'

const DEFENSIVE = new Set<Intent>(['tank', 'antiheal', 'qss', 'stasis'])
const OFFENSIVE = new Set<Intent>(['ap-damage', 'ad-carry', 'ad-onhit', 'ad-bruiser'])

type Miss =
  | 'hit'
  | 'too-defensive'
  | 'too-greedy'
  | 'wrong-offense-axis'
  | 'wrong-defense-axis'
  | 'other'

function classify(hit: boolean, engine: Intent | null, pro: Intent | null): Miss {
  if (hit) return 'hit'
  if (!engine || !pro) return 'other'
  const eDef = DEFENSIVE.has(engine)
  const pDef = DEFENSIVE.has(pro)
  if (eDef && OFFENSIVE.has(pro)) return 'too-defensive'
  if (OFFENSIVE.has(engine) && pDef) return 'too-greedy'
  if (!eDef && !pDef) return 'wrong-offense-axis'
  if (eDef && pDef) return 'wrong-defense-axis'
  return 'other'
}

const { data: sd, patch } = loadStaticData()
// A/B : BENCH_NO_BUILDS=1 pour mesurer le moteur sans le squelette de build (A4.3).
const book = process.env.BENCH_NO_BUILDS ? undefined : loadBuildBook()
const ids = rawMatchIds()
if (ids.length === 0) {
  console.error(`Aucune partie dans ${RAW_DIR}. Lance d'abord : npm run harvest`)
  process.exit(1)
}
console.log(
  `${ids.length} matchs · patch ${patch} · squelette de build : ${
    book ? `${book.entryCount} couples champion+rôle` : 'désactivé'
  }\n`,
)

interface Row {
  matchId: string
  role: string
  champion: string
  minute: number
  expected: number
  top1: boolean
  top3: boolean
  catInTop3: boolean
  miss: Miss
  engineBucket: string
  proBucket: string
}

const rows: Row[] = []
let skipped = 0

for (const id of ids) {
  let match: MatchDto
  let timeline: TimelineDto
  try {
    match = readRaw<MatchDto>(id, 'match')
    timeline = readRaw<TimelineDto>(id, 'timeline')
  } catch {
    continue
  }
  // `bench/raw/` peut contenir des parties du patch précédent (repli N-1 pour
  // `npm run builds`) : on ne benche que le patch du snapshot.
  if (patchOf(match.info.gameVersion) !== patch) continue

  for (const dec of extractDecisions(match, timeline, sd, { minSeconds: 360 })) {
    // état JUSTE AVANT l'achat (sinon l'item acheté compte comme « possédé »)
    const live = reconstructState(match, timeline, dec.stateAtMs, dec.participantId, sd)
    const a = assessGame(live, sd)
    if (!a) {
      skipped++
      continue
    }
    const rec = recommend(a, sd, book)
    const picks = [rec.primary, ...rec.alternatives].filter((x): x is NonNullable<typeof x> => !!x)
    const expItem = sd.getItem(dec.expectedNextItem)
    const expBucket = expItem ? itemIntent(expItem) : null
    const primItem = rec.primary ? sd.getItem(rec.primary.itemId) : null
    const primBucket = primItem ? itemIntent(primItem) : null
    const catInTop3 = picks.some((p) => {
      const it = sd.getItem(p.itemId)
      return it ? itemIntent(it) === expBucket : false
    })
    rows.push({
      matchId: id,
      role: dec.role,
      champion: dec.championName,
      minute: Math.round(dec.atMs / 60000),
      expected: dec.expectedNextItem,
      top1: rec.primary?.itemId === dec.expectedNextItem,
      top3: picks.some((p) => p.itemId === dec.expectedNextItem),
      catInTop3,
      miss: classify(catInTop3, primBucket, expBucket),
      engineBucket: primBucket ?? '?',
      proBucket: expBucket ?? '?',
    })
  }
}

if (rows.length === 0) {
  console.error('Aucune décision extraite. (patch des parties ≠ patch du snapshot ?)')
  process.exit(1)
}

const pct = (n: number, d: number): string => (d === 0 ? '—' : `${((100 * n) / d).toFixed(1)} %`)
const agg = (sub: Row[]) => ({
  n: sub.length,
  top1: pct(sub.filter((r) => r.top1).length, sub.length),
  top3: pct(sub.filter((r) => r.top3).length, sub.length),
  bucket: pct(sub.filter((r) => r.catInTop3).length, sub.length),
})

console.log(`Décisions évaluées : ${rows.length}  (ignorées : ${skipped})\n`)
console.log('GLOBAL           ', JSON.stringify(agg(rows)))

console.log('\nPar rôle :')
for (const role of ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']) {
  const sub = rows.filter((r) => r.role === role)
  if (sub.length) console.log(`  ${role.padEnd(9)}`, JSON.stringify(agg(sub)))
}

console.log('\nPar phase :')
for (const [label, lo, hi] of [
  ['06–14 min', 6, 14],
  ['14–22 min', 14, 22],
  ['22+ min', 22, 999],
] as const) {
  const sub = rows.filter((r) => r.minute >= lo && r.minute < hi)
  if (sub.length) console.log(`  ${label.padEnd(9)}`, JSON.stringify(agg(sub)))
}

console.log('\nChampions les moins bien servis (≥ 4 décisions) :')
const byChamp = new Map<string, Row[]>()
for (const r of rows) byChamp.set(r.champion, [...(byChamp.get(r.champion) ?? []), r])
;[...byChamp.entries()]
  .filter(([, v]) => v.length >= 4)
  .map(([k, v]) => ({ champ: k, ...agg(v), catRate: v.filter((r) => r.catInTop3).length / v.length }))
  .sort((a, b) => a.catRate - b.catRate)
  .slice(0, 12)
  .forEach((r) => console.log(`  ${r.champ.padEnd(14)} n=${String(r.n).padEnd(3)} top3 ${r.top3.padEnd(7)} bucket ${r.bucket}`))

console.log('\nDirection des ratés (part des décisions) :')
for (const m of ['too-defensive', 'too-greedy', 'wrong-offense-axis', 'wrong-defense-axis', 'other'] as const) {
  console.log(`  ${m.padEnd(20)}`, pct(rows.filter((r) => r.miss === m).length, rows.length))
}
console.log('\nConfusions les plus fréquentes  (bucket primaire moteur → bucket pro) :')
{
  const pairs = new Map<string, number>()
  for (const r of rows) {
    if (r.catInTop3) continue
    const key = `${r.engineBucket} → ${r.proBucket}`
    pairs.set(key, (pairs.get(key) ?? 0) + 1)
  }
  ;[...pairs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([k, n]) => console.log(`  ${k.padEnd(34)} ${pct(n, rows.length)}`))
}

console.log('\nDirection par rôle (too-defensive / too-greedy) :')
for (const role of ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']) {
  const sub = rows.filter((r) => r.role === role)
  if (!sub.length) continue
  const d = sub.filter((r) => r.miss === 'too-defensive').length
  const g = sub.filter((r) => r.miss === 'too-greedy').length
  console.log(`  ${role.padEnd(9)} def ${pct(d, sub.length).padEnd(7)} greedy ${pct(g, sub.length)}`)
}

const out = resolve(ROOT, 'bench/report.json')
writeFileSync(out, JSON.stringify({ patch, generatedAt: new Date().toISOString(), global: agg(rows), rows }, null, 2))
console.log(`\n→ ${out}`)
