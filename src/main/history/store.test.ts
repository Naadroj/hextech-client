import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { appendFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HistoryStore, MAX_GAMES } from './store'
import type { HistoryGameMeta, HistoryStep } from '../../shared/history-types'

const meta = (id: string, startedAt = '2026-09-04T10:00:00.000Z'): HistoryGameMeta => ({
  kind: 'meta',
  id,
  startedAt,
  champion: 'Shaco',
  role: 'JUNGLE',
  patch: '16.17',
})

const step = (t: number, itemId: number): HistoryStep => ({
  t,
  at: '2026-09-04T10:05:00.000Z',
  gold: 1200,
  level: 8,
  completedItems: 1,
  axis: null,
  primary: { itemId, name: `item ${itemId}`, goldTotal: 3000, affordable: false, reason: 'parce que' },
  alternatives: [],
  boots: null,
})

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hx-history-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('HistoryStore', () => {
  it('relit une partie écrite étape par étape', () => {
    const store = new HistoryStore(dir)
    store.open(meta('g1'))
    store.append('g1', step(120, 3142))
    store.append('g1', step(600, 6699))

    const game = store.read('g1')
    expect(game?.meta.champion).toBe('Shaco')
    expect(game?.steps.map((s) => s.primary?.itemId)).toEqual([3142, 6699])
  })

  it('renvoie null pour une partie inconnue', () => {
    expect(new HistoryStore(dir).read('nope')).toBeNull()
  })

  it('ignore une ligne tronquée sans perdre les autres', () => {
    const store = new HistoryStore(dir)
    store.open(meta('g1'))
    store.append('g1', step(120, 3142))
    appendFileSync(join(dir, 'g1.jsonl'), '{"t":300,"prim\n', 'utf8')
    store.append('g1', step(600, 6699))

    expect(store.read('g1')?.steps).toHaveLength(2)
  })

  it('liste les parties, la plus récente en tête, avec le dernier item', () => {
    const store = new HistoryStore(dir)
    store.open(meta('vieille', '2026-09-01T10:00:00.000Z'))
    store.append('vieille', step(100, 3142))
    store.open(meta('recente', '2026-09-04T10:00:00.000Z'))
    store.append('recente', step(100, 3142))
    store.append('recente', step(900, 6699))

    const list = store.list()
    expect(list.map((g) => g.id)).toEqual(['recente', 'vieille'])
    expect(list[0]).toMatchObject({ steps: 2, lastItem: { itemId: 6699 } })
  })

  it('ne conserve que les MAX_GAMES dernières parties', () => {
    const store = new HistoryStore(dir)
    for (let i = 0; i < MAX_GAMES + 5; i += 1) store.open(meta(`g${i}`))
    expect(readdirSync(dir).filter((f) => f.endsWith('.jsonl'))).toHaveLength(MAX_GAMES)
  })

  it('n’explose pas sur un dossier inexistant', () => {
    const store = new HistoryStore(join(dir, 'jamais-créé'))
    expect(store.list()).toEqual([])
    expect(store.read('g1')).toBeNull()
  })
})
