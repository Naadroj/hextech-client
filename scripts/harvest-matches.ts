// Moisson de parties Challenger soloqueue (RANKED_SOLO 420) du patch courant,
// pour le corpus de validation du moteur Coach (phase A4.2).
//
// Usage :
//   RIOT_API_KEY=RGAPI-xxxx npm run harvest -- [nbJoueurs] [matchsParJoueur]
//   RIOT_PLATFORM=euw1 RIOT_REGION=europe  (défauts)
//
// Écrit bench/raw/{matchId}.match.json + .timeline.json (gitignored).

import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { riot } from './lib/riot'
import { RAW_DIR, loadStaticData, patchOfVersion, previousPatch } from './lib/local'
import type { MatchDto, TimelineDto } from '../src/shared/engine/replay/types'

const NB_PLAYERS = Number(process.argv[2] ?? 30)
const PER_PLAYER = Number(process.argv[3] ?? 6)
const { patch } = loadStaticData()
// On garde aussi le patch précédent : `npm run builds` s'en sert pour compléter
// les champions trop peu vus sur le patch courant (repli N-1).
const prevPatch = previousPatch(patch)
const allowedPatches = new Set([patch, ...(prevPatch ? [prevPatch] : [])])

mkdirSync(RAW_DIR, { recursive: true })
console.log(
  `Patchs gardés : ${[...allowedPatches].join(', ')} · ${NB_PLAYERS} joueurs × ${PER_PLAYER} parties`,
)

interface LeagueList {
  entries: { summonerId: string; puuid?: string }[]
}

const league = await riot<LeagueList>(
  '/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5',
  'platform',
)
const top = league.entries.slice(0, NB_PLAYERS)

const puuids: string[] = []
for (const e of top) {
  if (e.puuid) {
    puuids.push(e.puuid)
    continue
  }
  try {
    const s = await riot<{ puuid: string }>(
      `/lol/summoner/v4/summoners/${encodeURIComponent(e.summonerId)}`,
      'platform',
    )
    puuids.push(s.puuid)
  } catch (err) {
    console.warn('  summoner KO', String(err))
  }
}

const matchIds = new Set<string>()
for (const puuid of puuids) {
  try {
    const ids = await riot<string[]>(
      `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&type=ranked&count=${PER_PLAYER}`,
    )
    for (const id of ids) matchIds.add(id)
  } catch (err) {
    console.warn('  match ids KO', String(err))
  }
}
console.log(`${matchIds.size} matchs uniques à examiner`)

let kept = 0
let skippedPatch = 0
let cached = 0
for (const id of matchIds) {
  const matchPath = resolve(RAW_DIR, `${id}.match.json`)
  if (existsSync(matchPath)) {
    cached++
    continue
  }
  try {
    const match = await riot<MatchDto>(`/lol/match/v5/matches/${id}`)
    if (
      match.info.queueId !== 420 ||
      match.info.mapId !== 11 ||
      !allowedPatches.has(patchOfVersion(match.info.gameVersion))
    ) {
      skippedPatch++
      continue
    }
    const timeline = await riot<TimelineDto>(`/lol/match/v5/matches/${id}/timeline`)
    writeFileSync(matchPath, JSON.stringify(match))
    writeFileSync(resolve(RAW_DIR, `${id}.timeline.json`), JSON.stringify(timeline))
    kept++
    if (kept % 10 === 0) console.log(`  ${kept} gardés…`)
  } catch (err) {
    console.warn(`  ${id} KO`, String(err))
  }
}

console.log(
  `\nTerminé : ${kept} nouveaux, ${cached} déjà en cache, ${skippedPatch} hors patch/queue. → ${RAW_DIR}`,
)
console.log('Puis : npm run bench:coach')
