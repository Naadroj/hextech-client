import { describe, it, expect } from 'vitest'
import type { GameQueue } from '@shared/lcu-types'
import { groupQueues } from './gameModes'

function q(partial: Partial<GameQueue>): GameQueue {
  return {
    id: 0,
    name: 'X',
    shortName: '',
    description: '',
    category: 'PvP',
    gameMode: 'CLASSIC',
    isRanked: false,
    mapId: 11,
    queueAvailability: 'Available',
    ...partial,
  }
}

describe('groupQueues', () => {
  it('range les files dans les bonnes catégories', () => {
    const cats = groupQueues([
      q({ id: 420, isRanked: true }),
      q({ id: 430 }),
      q({ id: 450, mapId: 12, gameMode: 'ARAM' }),
      q({ id: 900, gameMode: 'URF', mapId: 11 }),
      q({ id: 1700, gameMode: 'CHERRY', mapId: 30 }),
      q({ id: 870, category: 'VersusAi' }),
    ])
    const byId = Object.fromEntries(cats.map((c) => [c.id, c]))
    expect(byId.rift.items.map((i) => i.queueId)).toEqual([420, 430])
    expect(byId.aram.items[0].queueId).toBe(450)
    expect(byId.rotating.items[0].queueId).toBe(900)
    expect(byId.arena.items[0].queueId).toBe(1700)
    expect(byId.coop.items[0].queueId).toBe(870)
  })

  it('trie par priorité curée (Classé Solo/Duo avant Draft)', () => {
    const cats = groupQueues([q({ id: 400 }), q({ id: 420, isRanked: true })])
    expect(cats[0].items.map((i) => i.queueId)).toEqual([420, 400])
    expect(cats[0].items[0].isRanked).toBe(true)
  })

  it('marque les files indisponibles avec une raison', () => {
    const cats = groupQueues([q({ id: 430, queueAvailability: 'PlatformDisabled' })])
    const item = cats[0].items[0]
    expect(item.available).toBe(false)
    expect(item.unavailableReason).toMatch(/indisponible/i)
  })

  it('ajoute toujours la catégorie Personnalisée (Practice Tool + Custom)', () => {
    const cats = groupQueues([])
    const custom = cats.find((c) => c.id === 'custom')
    expect(custom?.items.map((i) => i.kind)).toEqual(['practice', 'custom'])
  })

  it('omet les catégories vides (sauf Personnalisée)', () => {
    const cats = groupQueues([q({ id: 450, mapId: 12, gameMode: 'ARAM' })])
    expect(cats.map((c) => c.id)).toEqual(['aram', 'custom'])
  })
})
