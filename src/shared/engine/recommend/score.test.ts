import { describe, it, expect } from 'vitest'
import { scoreItem, utilityScore } from './score'
import { representativeTarget } from './target'
import { contextWeights } from './weights'
import { assessGame } from '../context'
import { makeStaticData, makeLiveGame } from '../context/fixtures'

const sd = makeStaticData()
const item = (id: number) => sd.getItem(id)!
const assess = (o: Parameters<typeof makeLiveGame>[0]) => assessGame(makeLiveGame(o), sd)!

describe('utilityScore', () => {
  it('antisoin quand l’ennemi soigne', () => {
    const healers = assess({
      selfChampion: 'Syndra',
      allies: [],
      enemies: [
        { champion: 'Soraka' },
        { champion: 'Aatrox', items: [3072] },
      ],
    })
    const noHeal = assess({ selfChampion: 'Syndra', allies: [], enemies: [{ champion: 'Zed' }] })
    expect(utilityScore(item(3165), healers)).toBeGreaterThan(0.5) // Morellonomicon = Grievous
    expect(utilityScore(item(3165), noHeal)).toBe(0)
  })

  it('QSS quand ≥ 2 CC durs', () => {
    const cc = assess({
      selfChampion: 'Caitlyn',
      allies: [],
      enemies: [{ champion: 'Malphite' }, { champion: 'Malphite' }],
    })
    expect(utilityScore(item(3139), cc)).toBeGreaterThan(0.5) // Mercurial Scimitar
  })

  it('stase quand burst ennemi', () => {
    const burst = assess({
      selfChampion: 'Syndra',
      allies: [],
      enemies: [
        { champion: 'Zed', level: 15, items: [3031, 3072], k: 12, d: 1 },
        { champion: 'Soraka', level: 10, k: 0, d: 6 },
      ],
    })
    expect(utilityScore(item(3157), burst)).toBeGreaterThan(0.3) // Zhonya's (hasActive + Stasis)
  })
})

describe('scoreItem — comparaison marginale', () => {
  const a = assess({
    selfChampion: 'Caitlyn',
    selfPosition: 'BOTTOM',
    championStats: { attackDamage: 130, attackSpeed: 1, critChance: 0.2, maxHealth: 1400, armor: 45 },
    allies: [],
    enemies: [
      { champion: 'Malphite', level: 14, items: [3068] }, // beaucoup d'armure
      { champion: 'Syndra', level: 13 },
    ],
  })
  const target = representativeTarget(a)
  const weights = contextWeights(a)

  it('contre une cible blindée, la pénétration d’armure marque mieux que l’AS pure', () => {
    const ldr = scoreItem(item(3036), a, target, weights, sd) // Lord Dominik's (armor pen)
    const zhonya = scoreItem(item(3157), a, target, weights, sd) // AP/armor — inutile pour Caitlyn
    expect(ldr.breakdown.offense).toBeGreaterThan(zhonya.breakdown.offense)
    expect(ldr.score).toBeGreaterThan(zhonya.score)
  })

  it('renseigne prix, abordabilité et manque d’or', () => {
    const s = scoreItem(item(3031), { ...a, self: { ...a.self, currentGold: 1000 } }, target, weights, sd)
    expect(s.goldTotal).toBe(3450)
    expect(s.affordableNow).toBe(false)
    expect(s.goldShort).toBe(2450)
  })
})
