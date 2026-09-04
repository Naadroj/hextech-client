import { describe, it, expect } from 'vitest'
import { indexBuildBook, type BuildBookFile, type RoleBuild } from './build-types'

const rb = (over: Partial<RoleBuild>): RoleBuild => ({
  role: 'JUNGLE',
  games: 40,
  boots: [],
  core: [{ id: 1, pickRate: 0.9, avgSlot: 1 }],
  situational: [],
  ...over,
})

const FILE: BuildBookFile = {
  patch: '16.17',
  generatedAt: '',
  sampleGames: 100,
  params: { minGames: 5, coreMinPickRate: 0.3, situationalMinPickRate: 0.12 },
  builds: [
    {
      // Bimodal : combinée + deux variantes.
      slug: 'Shaco',
      roles: [
        rb({ core: [{ id: 100, pickRate: 0.5, avgSlot: 1 }] }),
        rb({ axis: 'physical', core: [{ id: 3142, pickRate: 0.95, avgSlot: 1 }] }),
        rb({ axis: 'magic', core: [{ id: 2503, pickRate: 0.92, avgSlot: 1 }] }),
      ],
    },
    // Mono-chemin : uniquement la combinée.
    { slug: 'Kaisa', roles: [rb({ role: 'BOT', core: [{ id: 6672, pickRate: 0.96, avgSlot: 1 }] })] },
  ],
}

describe('variantes d’axe du squelette', () => {
  const book = indexBuildBook(FILE)

  it('hasAxisVariants ne vaut que pour les champions bimodaux', () => {
    expect(book.hasAxisVariants('Shaco', 'JUNGLE')).toBe(true)
    expect(book.hasAxisVariants('Kaisa', 'BOTTOM')).toBe(false)
    expect(book.hasAxisVariants('Inconnu', 'MID')).toBe(false)
  })

  it('sans axe demandé → entrée combinée', () => {
    expect(book.getBuild('Shaco', 'JUNGLE')?.core[0].id).toBe(100)
    expect(book.getBuild('Shaco', 'JUNGLE')?.axis).toBeUndefined()
  })

  it('avec un axe → la variante correspondante', () => {
    expect(book.getBuild('Shaco', 'JUNGLE', 'physical')?.core[0].id).toBe(3142)
    expect(book.getBuild('Shaco', 'JUNGLE', 'magic')?.core[0].id).toBe(2503)
  })

  it('axe demandé mais sans variante → repli sur la combinée', () => {
    expect(book.getBuild('Kaisa', 'BOTTOM', 'magic')?.core[0].id).toBe(6672)
  })

  it('les variantes ne comptent pas comme des couples couverts', () => {
    // 2 entrées combinées (Shaco JUNGLE, Kaisa BOT), pas 4.
    expect(book.entryCount).toBe(2)
  })
})
