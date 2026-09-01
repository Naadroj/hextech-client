import { describe, it, expect } from 'vitest'
import { assessFed, kdaProxy } from './fed'
import { makeStaticData, livePlayer } from './fixtures'
import { playerKey } from './live-adapter'

describe('kdaProxy', () => {
  it('borne le dénominateur à 1', () => {
    expect(kdaProxy({ kills: 5, deaths: 0, assists: 3, creepScore: 0, wardScore: 0 })).toBe(13)
    expect(kdaProxy({ kills: 0, deaths: 4, assists: 0, creepScore: 0, wardScore: 0 })).toBe(0)
  })
})

describe('assessFed — auto-calibré sur la moyenne du lobby', () => {
  const sd = makeStaticData()

  it('un joueur au-dessus de la moyenne (or + niveau + KDA) a un score positif', () => {
    const players = [
      livePlayer({ champion: 'Caitlyn', level: 14, items: [3031, 3072, 3006], kills: 10, deaths: 1, assists: 4 }),
      ...['Syndra', 'Zed', 'Malphite', 'Soraka'].map((c) =>
        livePlayer({ champion: c, level: 10, items: [3006], kills: 2, deaths: 5, assists: 3 }),
      ),
    ]
    const fed = assessFed(players, sd)
    const cait = fed.get(playerKey(players[0]))!
    const other = fed.get(playerKey(players[1]))!
    expect(cait.score).toBeGreaterThan(0.6)
    expect(other.score).toBeLessThan(0)
    expect(cait.itemGoldValue).toBeGreaterThan(other.itemGoldValue)
  })

  it('un lobby homogène ⇒ scores proches de 0', () => {
    const players = ['Caitlyn', 'Syndra', 'Zed', 'Malphite', 'Soraka'].map((c) =>
      livePlayer({ champion: c, level: 11, items: [3006], kills: 3, deaths: 3, assists: 5 }),
    )
    for (const f of assessFed(players, sd).values()) {
      expect(Math.abs(f.score)).toBeLessThan(0.15)
    }
  })
})
