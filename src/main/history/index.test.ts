import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HistoryRecorder } from './index'
import { HistoryStore } from './store'
import type { CoachAdvice } from '../../shared/coach-types'
import { IDLE_ADVICE } from '../../shared/coach-types'

function advice(over: {
  slug?: string
  role?: string
  itemId?: number | null
  axis?: 'physical' | 'magic' | null
  t?: number
} = {}): CoachAdvice {
  const { slug = 'Shaco', role = 'JUNGLE', itemId = 3142, axis = null, t = 600 } = over
  return {
    ...IDLE_ADVICE,
    status: 'active',
    gameTimeSeconds: t,
    self: { slug, role, level: 9, currentGold: 1200, profilePrimary: 'physical', fed: 0, isManaConstrained: false },
    threat: { physical: 0.6, magic: 0.4, true: 0, burst: 0.3, primarySlug: 'Lee Sin', primaryFed: 0 },
    axisOverride: axis,
    axisSwitchAvailable: true,
    recommendation: {
      primary: itemId
        ? { itemId, name: `item ${itemId}`, kind: 'legendary', goldTotal: 3000, affordableNow: false, goldShort: 1800, score: 1, breakdown: { offense: 0, defense: 0, utility: 0, costEfficiency: 0, tempo: 0 }, reasons: ['parce que'] }
        : null,
      alternatives: [],
      boots: null,
      buildPath: [{ itemId: 3078, name: 'Trinité', owned: true, slot: 1 }],
      skeleton: null,
      context: { representativeTargetSlug: 'Lee Sin', threatSummary: '', weightProfile: 'assassin' },
    },
  } as CoachAdvice
}

let dir: string
let store: HistoryStore
let rec: HistoryRecorder
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hx-hrec-'))
  store = new HistoryStore(dir)
  rec = new HistoryRecorder({ store, getPatch: () => '16.17' })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('HistoryRecorder', () => {
  it('n’enregistre rien hors partie', () => {
    rec.record(IDLE_ADVICE)
    expect(store.list()).toEqual([])
  })

  it('ouvre une partie au premier conseil actif', () => {
    rec.record(advice())
    const list = store.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ champion: 'Shaco', role: 'JUNGLE', patch: '16.17', steps: 1 })
  })

  it('ignore les battements de cœur : une étape par changement réel', () => {
    rec.record(advice())
    rec.record(advice({ t: 620 })) // même reco → rien de neuf à raconter
    rec.record(advice({ itemId: 6699, t: 700 }))
    expect(store.list()[0].steps).toBe(2)
  })

  it('un changement d’axe compte comme une nouvelle proposition', () => {
    rec.record(advice())
    rec.record(advice({ axis: 'magic' }))
    const game = store.read(rec.currentGameId!)
    expect(game?.steps.map((s) => s.axis)).toEqual([null, 'magic'])
  })

  it('le retour à idle clôt la partie ; la suivante a son propre fichier', () => {
    rec.record(advice())
    rec.record(IDLE_ADVICE)
    expect(rec.currentGameId).toBeNull()
    rec.record(advice({ slug: 'Nasus', role: 'TOP' }))
    expect(store.list().map((g) => g.champion)).toEqual(['Nasus', 'Shaco'])
  })

  it('un changement de champion sans passer par idle ouvre aussi une partie', () => {
    rec.record(advice())
    rec.record(advice({ slug: 'Nasus', role: 'TOP' }))
    expect(store.list()).toHaveLength(2)
  })

  it('expose les étapes de la partie en cours pour les signalements', () => {
    rec.record(advice())
    rec.record(advice({ itemId: 6699 }))
    const steps = rec.currentSteps()
    expect(steps.map((s) => s.primary?.itemId)).toEqual([3142, 6699])
    expect(steps[0]).toMatchObject({ t: 600, gold: 1200, level: 9, completedItems: 1 })
  })

  it('ne renvoie aucune étape hors partie', () => {
    rec.record(advice())
    rec.record(IDLE_ADVICE)
    expect(rec.currentSteps()).toEqual([])
  })
})
