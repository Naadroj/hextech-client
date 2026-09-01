// Fige une décision d'une partie moissonnée en scénario golden (phase A4.2).
//
// Usage :
//   npm run freeze-scenario -- --match EUW1_1234 --pid 3 --at 1080 \
//       [--name syndra-vs-zed-fed] [--category stasis]
//
// Écrit test/fixtures/pro-scenarios/{name}.json = { meta, live }.

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SCENARIOS_DIR, loadStaticData, readRaw } from './lib/local'
import {
  extractDecisions,
  reconstructState,
  type MatchDto,
  type TimelineDto,
} from '../src/shared/engine/replay'
import { itemCategory } from '../src/shared/engine/recommend'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const matchId = arg('match')
const pid = Number(arg('pid'))
const atSeconds = Number(arg('at'))
if (!matchId || !pid || !atSeconds) {
  console.error('Requis : --match <id> --pid <1-10> --at <secondes>')
  process.exit(1)
}

const { data: sd, patch } = loadStaticData()
const match = readRaw<MatchDto>(matchId, 'match')
const timeline = readRaw<TimelineDto>(matchId, 'timeline')
const atMs = atSeconds * 1000

const part = match.info.participants.find((p) => p.participantId === pid)
if (!part) {
  console.error(`participant ${pid} introuvable`)
  process.exit(1)
}

// Vérité terrain = prochain achat de légendaire de ce joueur après --at.
const next = extractDecisions(match, timeline, sd, { minSeconds: 0 })
  .filter((d) => d.participantId === pid && d.atMs >= atMs)
  .sort((a, b) => a.atMs - b.atMs)[0]
const expectedItemId = next?.expectedNextItem ?? 0
const expectedItem = expectedItemId ? sd.getItem(expectedItemId) : undefined
const expectedCategory =
  arg('category') ?? (expectedItem ? itemCategory(expectedItem) : 'other')

const live = reconstructState(match, timeline, atMs, pid, sd)

const name =
  arg('name') ??
  `${part.championName.toLowerCase()}-${part.teamPosition.toLowerCase()}-${matchId}-${atSeconds}`
mkdirSync(SCENARIOS_DIR, { recursive: true })
const out = resolve(SCENARIOS_DIR, `${name}.json`)
writeFileSync(
  out,
  JSON.stringify(
    {
      meta: {
        matchId,
        participantId: pid,
        champion: part.championName,
        role: part.teamPosition,
        atSeconds,
        patch,
        expectedItemId,
        expectedItemName: expectedItem?.name ?? null,
        expectedCategory,
      },
      live,
    },
    null,
    2,
  ),
)
console.log(`→ ${out}`)
console.log(
  `  ${part.championName} ${part.teamPosition} @ ${atSeconds}s → attendu : ${expectedItem?.name ?? '?'} [${expectedCategory}]`,
)
