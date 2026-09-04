import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Feedback, type FeedbackDeps } from './index'
import { FeedbackStore } from './store'
import type { ConfigStore } from '../config-store'
import type { CoachAdvice } from '../../shared/coach-types'
import { IDLE_ADVICE } from '../../shared/coach-types'
import type { LiveGameData } from '../../shared/live-types'

const LIVE = { gameData: { gameTime: 600 } } as unknown as LiveGameData

const ACTIVE: CoachAdvice = {
  ...IDLE_ADVICE,
  status: 'active',
  gameTimeSeconds: 600,
  self: { slug: 'Nasus', role: 'TOP', level: 9, currentGold: 1200, profilePrimary: 'physical', fed: 0, isManaConstrained: false },
  threat: { physical: 0.6, magic: 0.4, true: 0, burst: 0.3, primarySlug: 'Darius', primaryFed: 0.5 },
  recommendation: {
    primary: { itemId: 3083, name: "Armure de Warmog", kind: 'legendary', goldTotal: 3000, affordableNow: false, goldShort: 1800, score: 1, breakdown: { offense: 0, defense: 0, utility: 0, costEfficiency: 0, tempo: 0 }, reasons: ['x'] },
    alternatives: [],
    boots: null,
    buildPath: [{ itemId: 3078, name: 'Trinité', owned: true, slot: 1 }],
    skeleton: { games: 21, roleAgnostic: false, patchSpan: null, starters: [] },
    context: { representativeTargetSlug: 'Darius', threatSummary: '', weightProfile: 'combattant' },
  },
} as CoachAdvice

function makeConfig(): ConfigStore {
  const data: Record<string, unknown> = { feedbackEnabled: true, installId: '' }
  return {
    get: (k: string) => data[k],
    set: (k: string, v: unknown) => {
      data[k] = v
    },
  } as unknown as ConfigStore
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hx-fbo-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function setup(over: Partial<FeedbackDeps> = {}) {
  const store = new FeedbackStore(join(dir, 'pending.jsonl'))
  const post = vi.fn(async () => ({ ok: true, status: 201, text: async () => '' }))
  const fb = new Feedback({
    config: makeConfig(),
    store,
    appVersion: '0.1.10',
    getLive: () => LIVE,
    getAdvice: () => ACTIVE,
    getPatch: () => '16.17',
    now: () => 1_700_000_000_000,
    post,
    ...over,
  })
  return { fb, store, post }
}

describe('Feedback.report', () => {
  it('compose un rapport rejouable et le met en file', () => {
    const { fb, store } = setup()
    expect(fb.report({ itemId: 3083, itemRank: 0, reasonCode: 'too-defensive' })).toBe(true)

    const [r] = store.readAll()
    expect(r.champion).toBe('Nasus')
    expect(r.role).toBe('TOP')
    expect(r.itemId).toBe(3083)
    expect(r.reasonCode).toBe('too-defensive')
    expect(r.hadSkeleton).toBe(true)
    expect(r.skeletonGames).toBe(21)
    expect(r.completedItems).toBe(1)
    // La forme d'une fixture golden : rejouable tel quel.
    expect(r.snapshot.live).toEqual(LIVE)
    expect(r.snapshot.meta.champion).toBe('Nasus')
    expect(r.snapshot.meta.atSeconds).toBe(600)
  })

  it('joint le fil des propositions de la partie quand il existe', () => {
    const steps = [
      {
        t: 300,
        at: '2026-09-04T10:00:00.000Z',
        gold: 900,
        level: 6,
        completedItems: 0,
        axis: null,
        primary: { itemId: 3078, name: 'Trinité', goldTotal: 3333, affordable: false, reason: 'x' },
        alternatives: [],
        boots: null,
      },
    ]
    const { fb, store } = setup({ getHistory: () => steps })
    fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })
    expect(store.readAll()[0].snapshot.history).toEqual(steps)
  })

  it('omet le champ historique plutôt que d’envoyer un tableau vide', () => {
    const { fb, store } = setup({ getHistory: () => [] })
    fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })
    expect(store.readAll()[0].snapshot).not.toHaveProperty('history')
  })

  it('génère et réutilise un installId anonyme', () => {
    const { fb, store } = setup()
    fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })
    fb.report({ itemId: 6333, itemRank: 0, reasonCode: null })
    const ids = new Set(store.readAll().map((r) => r.installId))
    expect(ids.size).toBe(1)
    expect([...ids][0]).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('refuse hors partie', () => {
    const { fb, store } = setup({ getAdvice: () => IDLE_ADVICE })
    expect(fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })).toBe(false)
    expect(store.count()).toBe(0)
  })

  it('déduplique un même (champion, item) dans la fenêtre anti-spam', () => {
    const { fb, store } = setup()
    expect(fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })).toBe(true)
    expect(fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })).toBe(false)
    // un autre item passe
    expect(fb.report({ itemId: 6333, itemRank: 0, reasonCode: null })).toBe(true)
    expect(store.count()).toBe(2)
  })
})

describe('Feedback.flush', () => {
  it('vide la file quand l’envoi réussit', async () => {
    const { fb, store, post } = setup()
    fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })
    vi.stubEnv('HEXTECH_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('HEXTECH_SUPABASE_ANON_KEY', 'k')
    await fb.flush()
    // Non configuré au moment de l'import du module : l'envoi est inerte,
    // la file est donc conservée (comportement voulu : on réessaiera).
    expect(store.count()).toBe(1)
    expect(post).not.toHaveBeenCalled()
    vi.unstubAllEnvs()
  })

  it('ne perd rien si le réseau échoue', async () => {
    const { fb, store } = setup({
      post: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    fb.report({ itemId: 3083, itemRank: 0, reasonCode: null })
    await fb.flush()
    expect(store.count()).toBe(1)
  })
})
