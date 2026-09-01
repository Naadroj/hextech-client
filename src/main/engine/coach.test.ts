import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { Coach } from './coach'
import type { LiveSnapshot } from '../../shared/live-types'
import { makeStaticData, makeLiveGame } from '../../shared/engine/context/fixtures'

class FakePoller extends EventEmitter {
  currentStatus: 'idle' | 'active' = 'active'
  snapshot: LiveSnapshot | null = null
}

const snap = (over: Parameters<typeof makeLiveGame>[0], receivedAt = 1000): LiveSnapshot => ({
  receivedAt,
  data: makeLiveGame(over),
})

const SCENE: Parameters<typeof makeLiveGame>[0] = {
  selfChampion: 'Caitlyn',
  selfPosition: 'BOTTOM',
  selfLevel: 12,
  selfGold: 2000,
  championStats: { attackDamage: 150, attackSpeed: 1, critChance: 0.2, maxHealth: 1500, armor: 45 },
  allies: [{ champion: 'Malphite', pos: 'TOP' }],
  enemies: [
    { champion: 'Zed', pos: 'MIDDLE', level: 15, items: [3031, 3072], k: 12, d: 1 },
    { champion: 'Syndra', pos: 'MIDDLE', level: 12 },
    { champion: 'Soraka', pos: 'UTILITY', level: 11 },
  ],
}

function setup(nowRef: { t: number }) {
  const poller = new FakePoller()
  const sd = makeStaticData()
  const coach = new Coach({
    poller,
    getStaticData: () => sd,
    heartbeatMs: 5000,
    now: () => nowRef.t,
  })
  const advices: unknown[] = []
  coach.on('advice', (a) => advices.push(a))
  return { poller, coach, advices, sd }
}

describe('Coach', () => {
  it('émet un conseil actif au premier instantané', () => {
    const now = { t: 1000 }
    const { poller, advices } = setup(now)
    poller.emit('snapshot', snap(SCENE))

    expect(advices).toHaveLength(1)
    const a = advices[0] as {
      status: string
      self: { slug: string }
      threat: { primarySlug: string }
      recommendation: { primary: { name: string } }
    }
    expect(a.status).toBe('active')
    expect(a.self.slug).toBe('Caitlyn')
    expect(a.threat.primarySlug).toBe('Zed')
    expect(a.recommendation.primary.name).toBeTruthy()
  })

  it('ne re-notifie pas quand rien d’utile ne change (avant le heartbeat)', () => {
    const now = { t: 1000 }
    const { poller, advices } = setup(now)
    poller.emit('snapshot', snap(SCENE))
    now.t = 2000
    poller.emit('snapshot', snap(SCENE, 2000))
    expect(advices).toHaveLength(1)
  })

  it('re-notifie après le heartbeat, ou sur changement de niveau', () => {
    const now = { t: 1000 }
    const { poller, advices } = setup(now)
    poller.emit('snapshot', snap(SCENE))

    now.t = 7000 // > heartbeat
    poller.emit('snapshot', snap(SCENE, 7000))
    expect(advices).toHaveLength(2)

    now.t = 7500
    poller.emit('snapshot', snap({ ...SCENE, selfLevel: 13 }, 7500))
    expect(advices).toHaveLength(3)
  })

  it('signale un catalogue périmé quand des champions sont inconnus', () => {
    const now = { t: 1000 }
    const { poller, advices } = setup(now)
    poller.emit(
      'snapshot',
      snap({
        selfChampion: 'ChampInexistant',
        allies: [],
        enemies: [{ champion: 'Zed' }, { champion: 'Inconnu1' }, { champion: 'Inconnu2' }],
      }),
    )
    const a = advices[0] as { status: string; dataWarning: string | null }
    expect(a.status).toBe('active')
    expect(a.dataWarning).toBe('stale')
  })

  it('émet un conseil "idle" quand la partie se termine', () => {
    const now = { t: 1000 }
    const { poller, advices } = setup(now)
    poller.emit('snapshot', snap(SCENE))
    poller.emit('status', 'idle')
    const last = advices.at(-1) as { status: string }
    expect(last.status).toBe('idle')
  })

  it('ne plante pas et ne notifie pas si le catalogue est indisponible', () => {
    const poller = new FakePoller()
    const coach = new Coach({ poller, getStaticData: () => null })
    const spy = vi.fn()
    coach.on('advice', spy)
    poller.emit('snapshot', snap(SCENE))
    expect(spy).not.toHaveBeenCalled()
  })

  it('dispose() coupe les abonnements', () => {
    const now = { t: 1000 }
    const { poller, coach, advices } = setup(now)
    coach.dispose()
    poller.emit('snapshot', snap(SCENE))
    expect(advices).toHaveLength(0)
  })

  it('substitue le nom d’affichage localisé sur les items conseillés', () => {
    const base = makeStaticData()
    const sd = {
      ...base,
      getItem: (id: number) => {
        const it = base.getItem(id)
        return it ? { ...it, nameLocalized: `FR:${it.name}` } : it
      },
    }
    const poller = new FakePoller()
    const coach = new Coach({ poller, getStaticData: () => sd, now: () => 1000 })
    const advices: unknown[] = []
    coach.on('advice', (a) => advices.push(a))
    poller.emit('snapshot', snap(SCENE))

    const rec = (advices[0] as { recommendation: { primary: { name: string }; alternatives: { name: string }[] } }).recommendation
    expect(rec.primary.name.startsWith('FR:')).toBe(true)
    for (const alt of rec.alternatives) expect(alt.name.startsWith('FR:')).toBe(true)
  })
})
