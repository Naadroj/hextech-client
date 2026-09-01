import { describe, it, expect } from 'vitest'
import { generateCandidates } from './candidates'
import { assessGame } from '../context'
import { makeStaticData, makeLiveGame } from '../context/fixtures'

const sd = makeStaticData()

function assess(over: Parameters<typeof makeLiveGame>[0]) {
  return assessGame(makeLiveGame(over), sd)!
}

describe('generateCandidates', () => {
  it('exclut les items possédés, les consommables et les bottes des légendaires', () => {
    const a = assess({
      selfChampion: 'Caitlyn',
      selfItems: [3031], // Infinity Edge possédé
      allies: [],
      enemies: [{ champion: 'Zed' }],
    })
    const c = generateCandidates(a, sd)
    expect(c.legendaries.some((i) => i.id === 3031)).toBe(false)
    expect(c.legendaries.some((i) => i.isBoots || i.isConsumable)).toBe(false)
    expect(c.legendaries.every((i) => i.goldTotal >= 2000 && i.isFinal)).toBe(true)
  })

  it('needsBoots vrai sans bottes, faux avec', () => {
    expect(
      generateCandidates(assess({ selfChampion: 'Caitlyn', allies: [], enemies: [{ champion: 'Zed' }] }), sd)
        .needsBoots,
    ).toBe(true)
    expect(
      generateCandidates(
        assess({ selfChampion: 'Caitlyn', selfItems: [3111], allies: [], enemies: [{ champion: 'Zed' }] }),
        sd,
      ).needsBoots,
    ).toBe(false)
  })
})
