import { describe, it, expect } from 'vitest'
import { indexBuildBook, type BuildBookFile } from '../../build-types'
import {
  BUILD_MIN_GAMES,
  BUILD_MIN_ORDER_FACTOR,
  BUILD_W_CORE,
  BUILD_W_SITUATIONAL,
  buildPrior,
} from './build-prior'
import type { GameAssessment } from '../context'
import type { NormalizedItem } from '../../staticdata-types'

const file: BuildBookFile = {
  patch: '16.17',
  generatedAt: '',
  sampleGames: 100,
  params: { minGames: 6, coreMinPickRate: 0.3, situationalMinPickRate: 0.12 },
  builds: [
    {
      slug: 'Nasus',
      roles: [
        {
          role: 'TOP',
          games: 10,
          boots: [{ id: 3158, pickRate: 0.6, avgSlot: 0 }],
          core: [
            { id: 3110, pickRate: 0.8, avgSlot: 1.2 }, // Cœur gelé, tôt
            { id: 3065, pickRate: 0.5, avgSlot: 3.5 }, // Visage, tard
          ],
          situational: [{ id: 3193, pickRate: 0.2, avgSlot: 4 }],
        },
      ],
    },
    {
      slug: 'Thin',
      roles: [
        {
          role: 'TOP',
          games: 3, // sous le seuil de confiance
          boots: [],
          core: [{ id: 3110, pickRate: 1, avgSlot: 1 }],
          situational: [],
        },
      ],
    },
  ],
}
const book = indexBuildBook(file)

const item = (id: number): NormalizedItem => ({ id }) as NormalizedItem
const assess = (slug: string, completedItemCount: number): GameAssessment =>
  ({ self: { slug, role: 'TOP', completedItemCount } }) as GameAssessment

describe('buildPrior', () => {
  it('renvoie 0 sans livre de builds', () => {
    expect(buildPrior(item(3110), assess('Nasus', 0), undefined, 'legendary').value).toBe(0)
  })

  it('renvoie 0 pour un champion hors squelette', () => {
    expect(buildPrior(item(3110), assess('Garen', 0), book, 'legendary').value).toBe(0)
  })

  it('renvoie 0 sous le seuil de confiance (games < BUILD_MIN_GAMES)', () => {
    expect(file.builds[1].roles[0].games).toBeLessThan(BUILD_MIN_GAMES)
    expect(buildPrior(item(3110), assess('Thin', 0), book, 'legendary').value).toBe(0)
  })

  it('bonus core maximal quand avgSlot colle au prochain légendaire', () => {
    // 0 légendaire fini → nextSlot = 1 ≈ avgSlot 1.2 → facteur d'ordre ~1
    const p = buildPrior(item(3110), assess('Nasus', 0), book, 'legendary')
    expect(p.kind).toBe('core')
    expect(p.value).toBeGreaterThan(BUILD_W_CORE * 0.8 * 0.9)
    expect(p.value).toBeLessThanOrEqual(BUILD_W_CORE * 0.8)
  })

  it('bonus core amorti quand on est loin de la position habituelle, mais jamais nul', () => {
    // item habituellement 4e (avgSlot 3.5), acheté alors qu'on n'a rien fini
    const p = buildPrior(item(3065), assess('Nasus', 0), book, 'legendary')
    expect(p.value).toBeGreaterThanOrEqual(BUILD_W_CORE * 0.5 * BUILD_MIN_ORDER_FACTOR - 1e-9)
    expect(p.value).toBeLessThan(BUILD_W_CORE * 0.5) // amorti
    // et il remonte quand on approche du bon slot
    const later = buildPrior(item(3065), assess('Nasus', 3), book, 'legendary')
    expect(later.value).toBeGreaterThan(p.value)
  })

  it('item situationnel : bonus plat proportionnel au pickRate', () => {
    const p = buildPrior(item(3193), assess('Nasus', 2), book, 'legendary')
    expect(p.kind).toBe('situational')
    expect(p.value).toBeCloseTo(BUILD_W_SITUATIONAL * 0.2, 5)
  })

  it('bottes : ne matchent que sur kind="boots"', () => {
    expect(buildPrior(item(3158), assess('Nasus', 0), book, 'legendary').value).toBe(0)
    const p = buildPrior(item(3158), assess('Nasus', 0), book, 'boots')
    expect(p.kind).toBe('boots')
    expect(p.value).toBeGreaterThan(0)
  })
})
