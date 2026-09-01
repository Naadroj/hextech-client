import { describe, it, expect } from 'vitest'
import { damageAxisKeys, onAxisGoldFraction, tempoPenalty, tempoWeight } from './tempo'
import { assessGame } from '../context'
import { makeStaticData, makeLiveGame } from '../context/fixtures'

const sd = makeStaticData()
const item = (id: number) => sd.getItem(id)!
const assess = (o: Parameters<typeof makeLiveGame>[0]) => assessGame(makeLiveGame(o), sd)!

const enemies = [{ champion: 'Zed', pos: 'MIDDLE' }, { champion: 'Soraka', pos: 'UTILITY' }]

describe('damageAxisKeys', () => {
  it('mage → axe AP ; tireur → axe AD/crit ; assassin AD → axe bruiser', () => {
    expect(damageAxisKeys(assess({ selfChampion: 'Syndra', allies: [], enemies }))).toContain(
      'abilityPower',
    )
    const adc = damageAxisKeys(assess({ selfChampion: 'Caitlyn', allies: [], enemies }))
    expect(adc).toContain('attackDamage')
    expect(adc).toContain('critChance')
    expect(damageAxisKeys(assess({ selfChampion: 'Zed', allies: [], enemies }))).not.toContain(
      'abilityPower',
    )
  })
})

describe('onAxisGoldFraction', () => {
  it('Sablier pour une mage = détour léger ; pour un AD = détour total', () => {
    const magicAxis = damageAxisKeys(assess({ selfChampion: 'Syndra', allies: [], enemies }))
    const adAxis = damageAxisKeys(assess({ selfChampion: 'Zed', allies: [], enemies }))
    expect(onAxisGoldFraction(item(3157), magicAxis)).toBeGreaterThan(0.4) // Zhonya : AP compte
    expect(onAxisGoldFraction(item(3157), adAxis)).toBeLessThan(0.1)
  })
  it('objet 100 % sur axe ≈ 1 ; objet 0 % sur axe ≈ 0', () => {
    const magicAxis = damageAxisKeys(assess({ selfChampion: 'Syndra', allies: [], enemies }))
    expect(onAxisGoldFraction(item(3089), magicAxis)).toBeGreaterThan(0.95) // Rabadon
    expect(onAxisGoldFraction(item(3143), magicAxis)).toBe(0) // Randuin (PV/armure)
  })
})

describe('tempoWeight', () => {
  const scene = (o: Partial<Parameters<typeof makeLiveGame>[0]>) =>
    tempoWeight(
      assess({
        selfChampion: 'Syndra',
        allies: [],
        enemies,
        gameTime: 800,
        selfItems: [3089],
        ...o,
      }),
    )

  it('décroît avec le nombre d’items finis', () => {
    expect(scene({ selfItems: [3089] })).toBeGreaterThan(scene({ selfItems: [3089, 3157, 3165] }))
  })
  it('décroît en fin de partie', () => {
    expect(scene({ gameTime: 600 })).toBeGreaterThan(scene({ gameTime: 1800 }))
  })
  it('biais d’avance neutre : à égalité ~1, en retard plus bas', () => {
    const even = scene({})
    const behind = scene({
      enemies: [{ champion: 'Zed', k: 15, d: 0, items: [3031, 3072] }],
      selfLevel: 8,
      selfItems: [],
      selfScores: { kills: 0, deaths: 9, assists: 1 },
    })
    expect(behind).toBeLessThan(even)
  })
})

describe('tempoPenalty', () => {
  it('objet 100 % défensif hors axe : pénalité non nulle, plus forte tôt', () => {
    const early = assess({ selfChampion: 'Syndra', allies: [], enemies, gameTime: 600, selfItems: [3089] })
    const late = assess({
      selfChampion: 'Syndra',
      allies: [],
      enemies,
      gameTime: 1800,
      selfItems: [3089, 3157, 3165, 3135],
    })
    const axis = damageAxisKeys(early)
    expect(tempoPenalty(item(3143), early, axis)).toBeGreaterThan(0)
    expect(tempoPenalty(item(3143), early, axis)).toBeGreaterThan(tempoPenalty(item(3143), late, axis))
  })
  it('Sablier : pénalité bien plus faible pour une mage que pour un AD', () => {
    const syndra = assess({ selfChampion: 'Syndra', allies: [], enemies, selfItems: [3089] })
    const zed = assess({ selfChampion: 'Zed', allies: [], enemies, selfItems: [3089] })
    expect(tempoPenalty(item(3157), syndra, damageAxisKeys(syndra))).toBeLessThan(
      tempoPenalty(item(3157), zed, damageAxisKeys(zed)),
    )
  })
})
