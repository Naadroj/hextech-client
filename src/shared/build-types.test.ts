import { describe, it, expect } from 'vitest'
import {
  EMPTY_BUILD_BOOK,
  indexBuildBook,
  normalizeBuildRole,
  type BuildBookFile,
} from './build-types'

const FILE: BuildBookFile = {
  patch: '16.17',
  generatedAt: '2026-09-01T00:00:00.000Z',
  sampleGames: 116,
  params: { minGames: 6, coreMinPickRate: 0.3, situationalMinPickRate: 0.12 },
  builds: [
    {
      slug: 'Nasus',
      roles: [
        {
          role: 'TOP',
          games: 8,
          boots: [{ id: 3158, pickRate: 0.5, avgSlot: 0 }],
          core: [
            { id: 3110, pickRate: 0.75, avgSlot: 1.33 },
            { id: 3078, pickRate: 0.63, avgSlot: 1.6 },
          ],
          situational: [{ id: 3065, pickRate: 0.25, avgSlot: 2.8 }],
        },
      ],
    },
  ],
}

describe('normalizeBuildRole', () => {
  it('mappe les positions Riot et InferredRole vers BuildRole', () => {
    expect(normalizeBuildRole('MIDDLE')).toBe('MID')
    expect(normalizeBuildRole('MID')).toBe('MID')
    expect(normalizeBuildRole('BOTTOM')).toBe('BOT')
    expect(normalizeBuildRole('UTILITY')).toBe('SUPPORT')
    expect(normalizeBuildRole('SUPPORT')).toBe('SUPPORT')
    expect(normalizeBuildRole('top')).toBe('TOP')
  })
  it('renvoie null pour l’inconnu', () => {
    expect(normalizeBuildRole('')).toBeNull()
    expect(normalizeBuildRole('AFK')).toBeNull()
    expect(normalizeBuildRole(undefined)).toBeNull()
  })
})

describe('indexBuildBook', () => {
  const book = indexBuildBook(FILE)

  it('expose les métadonnées et le nombre de couples', () => {
    expect(book.patch).toBe('16.17')
    expect(book.entryCount).toBe(1)
  })

  it('résout par slug (insensible casse/ponctuation) + rôle normalisé', () => {
    expect(book.getBuild('Nasus', 'TOP')?.games).toBe(8)
    expect(book.getBuild('nasus', 'MIDDLE')).toBeUndefined()
    expect(book.getBuild('  NASUS ', 'top')?.core[0].id).toBe(3110)
  })

  it('renvoie undefined pour un champion / rôle absent', () => {
    expect(book.getBuild('Garen', 'TOP')).toBeUndefined()
    expect(book.getBuild('Nasus', 'JUNGLE')).toBeUndefined()
  })
})

describe('repli poolé (roleAgnostic + pooledRoles)', () => {
  const book = indexBuildBook({
    ...FILE,
    builds: [
      {
        slug: 'Ivern',
        roles: [
          {
            role: 'JUNGLE',
            games: 9,
            roleAgnostic: true,
            pooledRoles: ['JUNGLE'],
            boots: [],
            core: [{ id: 6620, pickRate: 0.7, avgSlot: 1.2 }],
            situational: [],
          },
        ],
      },
    ],
  })

  it('sert l’entrée poolée pour un rôle de pooledRoles', () => {
    expect(book.getBuild('Ivern', 'JUNGLE')?.core[0].id).toBe(6620)
  })

  it('NE sert PAS un rôle absent de pooledRoles (pas de build jungle pour un top)', () => {
    expect(book.getBuild('Ivern', 'TOP')).toBeUndefined()
    expect(book.getBuild('Ivern', 'SUPPORT')).toBeUndefined()
  })

  it('une entrée par rôle normale ne fait pas de repli inter-rôles', () => {
    expect(indexBuildBook(FILE).getBuild('Nasus', 'MID')).toBeUndefined()
  })

  it('pooledRoles absent (ancien format) → repli tolérant', () => {
    const legacy = indexBuildBook({
      ...FILE,
      builds: [{ slug: 'Ivern', roles: [{ role: 'JUNGLE', games: 9, roleAgnostic: true, boots: [], core: [{ id: 6620, pickRate: 0.7, avgSlot: 1 }], situational: [] }] }],
    })
    expect(legacy.getBuild('Ivern', 'TOP')?.core[0].id).toBe(6620)
  })
})

describe('EMPTY_BUILD_BOOK', () => {
  it('ne résout jamais rien', () => {
    expect(EMPTY_BUILD_BOOK.getBuild('Nasus', 'TOP')).toBeUndefined()
    expect(EMPTY_BUILD_BOOK.entryCount).toBe(0)
  })
})
