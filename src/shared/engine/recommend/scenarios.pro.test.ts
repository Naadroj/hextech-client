import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexSnapshot } from '../../static-index'
import { assessGame } from '../context'
import { recommend } from './index'
import { itemBucket } from './categories'
import type { LiveGameData } from '../../live-types'

/**
 * Golden-file « pro » (phase A4.2) : scénarios reconstruits depuis de **vraies
 * parties** (Challenger soloqueue) via `npm run harvest` + `npm run
 * freeze-scenario`. Assertion **catégorielle** : l'item réellement acheté et
 * l'item conseillé appartiennent-ils à la même famille fonctionnelle ?
 *
 * Tant que `test/fixtures/pro-scenarios/` est vide, ce fichier ne fait rien.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const DIR = resolve(HERE, '../../../../test/fixtures/pro-scenarios')
const SNAPSHOT = resolve(HERE, '../../../../resources/staticdata/snapshot.json')

interface ProScenario {
  meta: {
    matchId: string
    champion: string
    role: string
    atSeconds: number
    patch: string
    expectedItemId: number
    expectedItemName: string | null
    expectedCategory: string
  }
  live: LiveGameData
}

function listScenarios(): string[] {
  try {
    return readdirSync(DIR).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
}

const files = listScenarios()

describe('scénarios golden « pro » (A4.2)', () => {
  if (files.length === 0) {
    it('aucun scénario figé — voir BENCH.md (npm run harvest / freeze-scenario)', () => {
      expect(files).toEqual([])
    })
    return
  }

  const sd = indexSnapshot(JSON.parse(readFileSync(SNAPSHOT, 'utf8')))

  it.each(files)('%s', (file) => {
    const fx = JSON.parse(readFileSync(resolve(DIR, file), 'utf8')) as ProScenario
    const a = assessGame(fx.live, sd)
    expect(a, `${file}: joueur actif introuvable`).not.toBeNull()

    const rec = recommend(a!, sd)
    const picks = [rec.primary, ...rec.alternatives].filter(
      (x): x is NonNullable<typeof x> => !!x,
    )
    const expItem = sd.getItem(fx.meta.expectedItemId)
    const expBucket = expItem ? itemBucket(expItem) : fx.meta.expectedCategory
    const match = picks.some((p) => {
      const it = sd.getItem(p.itemId)
      return it ? itemBucket(it) === expBucket : false
    })

    const top3 = picks.map((p) => sd.getItem(p.itemId)?.name ?? p.itemId).join(', ')
    expect(
      match,
      `${fx.meta.champion} ${fx.meta.role} @ ${fx.meta.atSeconds}s : acheté « ${fx.meta.expectedItemName} » [${expBucket}], top-3 = ${top3}`,
    ).toBe(true)
  })
})
