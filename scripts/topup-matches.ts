// Moisson **ciblée** : complète les couples champion+rôle réels qui n'ont pas
// encore HARVEST_TARGET parties sur le patch courant. Utilise les puuids déjà
// vus jouer ces couples (aucun endpoint « par champion » n'existe) → tire leur
// historique profond.
//
// Usage :  npm run topup            (après npm run harvest)
//   HARVEST_TARGET=50  TOPUP_BUDGET=3000  TOPUP_ITERS=4

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { riot } from './lib/riot'
import { RAW_DIR, loadStaticData, previousPatch, rawMatchIds, readRaw } from './lib/local'
import { aggregate, underTarget } from './lib/aggregate'
import { patchOf, type MatchDto, type TimelineDto } from '../src/shared/engine/replay'

const TARGET = Number(process.env.HARVEST_TARGET ?? 50)
let budget = Number(process.env.TOPUP_BUDGET ?? 3000)
const ITERS = Number(process.env.TOPUP_ITERS ?? 4)
const FLOOR = 5 // = BUILD_MIN_GAMES : on ne chasse qu'un pick « réel »
const PUUIDS_PER_KEY = 40
const IDS_PER_PUUID = 100

const { data: sd, patch } = loadStaticData()
const prevPatch = previousPatch(patch)
const allowed = new Set([patch, ...(prevPatch ? [prevPatch] : [])])

mkdirSync(RAW_DIR, { recursive: true })

const have = new Set(rawMatchIds())
if (have.size === 0) {
  console.error("Aucune partie dans bench/raw/. Lance d'abord : npm run harvest")
  process.exit(1)
}
console.log(`Top-up ciblé · cible ${TARGET} parties/couple · budget ${budget} · départ ${have.size} matchs`)

async function download(id: string): Promise<boolean> {
  const matchPath = resolve(RAW_DIR, `${id}.match.json`)
  if (existsSync(matchPath)) return false
  try {
    const match = await riot<MatchDto>(`/lol/match/v5/matches/${id}`)
    if (match.info.queueId !== 420 || match.info.mapId !== 11 || !allowed.has(patchOf(match.info.gameVersion))) {
      return false
    }
    const timeline = await riot<TimelineDto>(`/lol/match/v5/matches/${id}/timeline`)
    writeFileSync(matchPath, JSON.stringify(match))
    writeFileSync(resolve(RAW_DIR, `${id}.timeline.json`), JSON.stringify(timeline))
    have.add(id)
    return true
  } catch (err) {
    console.warn(`  ${id} KO`, String(err))
    return false
  }
}

for (let iter = 1; iter <= ITERS && budget > 0; iter++) {
  const { byPatch, puuidsByKey } = aggregate([...have], readRaw, sd, allowed)
  const gaps = underTarget(byPatch, patch, TARGET, FLOOR)
  if (gaps.length === 0) {
    console.log(`Itération ${iter} : tous les couples réels ≥ ${TARGET}. Fini.`)
    break
  }
  console.log(`\nItération ${iter} : ${gaps.length} couples sous ${TARGET} (budget ${budget})`)

  // 1) collecte d'ids candidats depuis les joueurs connus des couples en manque
  const candidates = new Set<string>()
  for (const { key } of gaps) {
    const puuids = [...(puuidsByKey.get(key) ?? [])].slice(0, PUUIDS_PER_KEY)
    for (const puuid of puuids) {
      try {
        const list = await riot<string[]>(
          `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&type=ranked&count=${IDS_PER_PUUID}`,
        )
        for (const id of list) if (!have.has(id)) candidates.add(id)
      } catch (err) {
        console.warn('  ids KO', String(err))
      }
    }
    if (candidates.size > budget * 1.5) break
  }
  console.log(`  ${candidates.size} ids candidats`)

  // 2) téléchargement dans la limite du budget
  let got = 0
  for (const id of candidates) {
    if (budget <= 0) break
    budget--
    if (await download(id)) got++
    if (got % 25 === 0 && got) console.log(`  +${got} matchs…`)
  }
  console.log(`  itération ${iter} : +${got} matchs (total ${have.size})`)
  if (got === 0) {
    console.log('  aucun nouveau match — arrêt.')
    break
  }
}

const { byPatch } = aggregate([...have], readRaw, sd, allowed)
const remaining = underTarget(byPatch, patch, TARGET, FLOOR)
console.log(`\nTerminé : ${have.size} matchs. ${remaining.length} couples réels encore sous ${TARGET}.`)
if (remaining.length) {
  console.log('  ' + remaining.slice(0, 40).map((x) => `${x.key}(${x.games})`).join(', ') + (remaining.length > 40 ? ' …' : ''))
}
console.log('Puis : npm run builds')
