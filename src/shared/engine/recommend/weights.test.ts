import { describe, it, expect } from 'vitest'
import { contextWeights } from './weights'
import { assessGame } from '../context'
import { makeStaticData, makeLiveGame } from '../context/fixtures'

const sd = makeStaticData()
const assess = (o: Parameters<typeof makeLiveGame>[0]) => assessGame(makeLiveGame(o), sd)!

describe('contextWeights', () => {
  it('un carry est orienté offense, un tank orienté défense', () => {
    const carry = contextWeights(assess({ selfChampion: 'Caitlyn', allies: [], enemies: [{ champion: 'Zed' }] }))
    const tank = contextWeights(assess({ selfChampion: 'Malphite', allies: [], enemies: [{ champion: 'Zed' }] }))
    expect(carry.label).toBe('carry')
    expect(carry.offense).toBeGreaterThan(carry.defense)
    expect(tank.label).toBe('tank')
    expect(tank.defense).toBeGreaterThan(tank.offense)
  })

  it('les poids somment à 1', () => {
    const w = contextWeights(assess({ selfChampion: 'LeeSin', allies: [], enemies: [{ champion: 'Zed' }] }))
    expect(w.offense + w.defense + w.utility + w.costEfficiency).toBeCloseTo(1, 6)
  })

  it('être focus déplace le poids vers la défense', () => {
    const base = assess({
      selfChampion: 'Caitlyn',
      allies: [],
      enemies: [{ champion: 'Zed' }],
      gameTime: 1200,
      selfScores: { deaths: 1 },
    })
    const focused = assess({
      selfChampion: 'Caitlyn',
      allies: [],
      enemies: [{ champion: 'Zed', level: 15, items: [3031, 3072], k: 12, d: 1 }],
      gameTime: 1200,
      selfScores: { deaths: 6, kills: 1 },
    })
    expect(contextWeights(focused).defense).toBeGreaterThan(contextWeights(base).defense)
  })

  it('retard net augmente l’efficacité or', () => {
    const behind = assess({
      selfChampion: 'Caitlyn',
      allies: [],
      enemies: [{ champion: 'Zed', level: 16, items: [3031, 3072, 3036], k: 15, d: 0 }],
      selfLevel: 9,
      selfScores: { kills: 0, deaths: 8, assists: 1 },
    })
    expect(contextWeights(behind).costEfficiency).toBeGreaterThan(0.1)
  })
})
