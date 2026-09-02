// Moisson **large** de parties soloqueue (RANKED_SOLO 420) hi-elo, patch courant
// (+ N-1 pour le repli). Premier passage ; `npm run topup` complète ensuite les
// couples champion+rôle rares.
//
// Usage :
//   RIOT_API_KEY=RGAPI-xxxx npm run harvest -- [nbJoueurs] [matchsParJoueur]
//   RIOT_PLATFORM=euw1 RIOT_REGION=europe            (défauts)
//   HARVEST_TIERS=challenger,grandmaster,master      (défaut : les 3)
//
// Écrit bench/raw/{matchId}.match.json + .timeline.json (gitignored, mis en
// cache par patch dans la CI → le corpus grossit à chaque run).

import { mkdirSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { riot } from './lib/riot'
import { RAW_DIR, loadStaticData, patchOfVersion, previousPatch } from './lib/local'
import type { MatchDto, TimelineDto } from '../src/shared/engine/replay/types'

const NB_PLAYERS = Number(process.argv[2] ?? 60)
const PER_PLAYER = Number(process.argv[3] ?? 12)
const TIERS = (process.env.HARVEST_TIERS ?? 'challenger,grandmaster,master')
  .split(',')
  .map((t) => t.trim().toLowerCase())
  .filter(Boolean)

const { patch } = loadStaticData()
const prevPatch = previousPatch(patch)
const allowedPatches = new Set([patch, ...(prevPatch ? [prevPatch] : [])])

mkdirSync(RAW_DIR, { recursive: true })
console.log(
  `Patchs gardés : ${[...allowedPatches].join(', ')} · tiers ${TIERS.join('+')} · ${NB_PLAYERS} joueurs/tier × ${PER_PLAYER} parties`,
)

interface LeagueList {
  entries: { summonerId: string; puuid?: string }[]
}
const LEAGUE_PATH: Record<string, string> = {
  challenger: '/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5',
  grandmaster: '/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5',
  master: '/lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5',
}

const puuids = new Set<string>()
for (const tier of TIERS) {
  const path = LEAGUE_PATH[tier]
  if (!path) {
    console.warn(`  tier inconnu ignoré : ${tier}`)
    continue
  }
  try {
    const league = await riot<LeagueList>(path, 'platform')
    const top = [...league.entries]
      .sort((a, b) => ((b as { leaguePoints?: number }).leaguePoints ?? 0) - ((a as { leaguePoints?: number }).leaguePoints ?? 0))
      .slice(0, NB_PLAYERS)
    for (const e of top) {
      if (e.puuid) {
        puuids.add(e.puuid)
        continue
      }
      try {
        const s = await riot<{ puuid: string }>(
          `/lol/summoner/v4/summoners/${encodeURIComponent(e.summonerId)}`,
          'platform',
        )
        puuids.add(s.puuid)
      } catch (err) {
        console.warn('  summoner KO', String(err))
      }
    }
  } catch (err) {
    console.warn(`  ligue ${tier} KO`, String(err))
  }
}
console.log(`${puuids.size} joueurs uniques`)

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
let skipped = 0
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
      skipped++
      continue
    }
    const timeline = await riot<TimelineDto>(`/lol/match/v5/matches/${id}/timeline`)
    writeFileSync(matchPath, JSON.stringify(match))
    writeFileSync(resolve(RAW_DIR, `${id}.timeline.json`), JSON.stringify(timeline))
    kept++
    if (kept % 25 === 0) console.log(`  ${kept} gardés…`)
  } catch (err) {
    console.warn(`  ${id} KO`, String(err))
  }
}

console.log(
  `\nTerminé : ${kept} nouveaux, ${cached} déjà en cache, ${skipped} hors patch/queue. → ${RAW_DIR}`,
)
console.log('Puis : npm run topup  (ciblé) puis npm run builds')
