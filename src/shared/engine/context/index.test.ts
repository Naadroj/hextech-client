import { describe, it, expect } from 'vitest'
import { assessGame } from './index'
import { makeStaticData, makeLiveGame } from './fixtures'

const sd = makeStaticData()

describe('assessGame', () => {
  it('retourne null si le joueur actif est introuvable dans allPlayers', () => {
    const live = makeLiveGame({ selfChampion: 'Caitlyn', allies: [], enemies: [] })
    live.activePlayer.riotId = 'Someone#ELSE'
    live.activePlayer.summonerName = 'Someone Else'
    expect(assessGame(live, sd)).toBeNull()
  })

  it('assemble self / threat / allies / triggers pour une partie type', () => {
    const live = makeLiveGame({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      selfLevel: 13,
      selfGold: 1450,
      selfItems: [3006],
      championStats: { attackDamage: 210, attackSpeed: 1.15, critChance: 0.5, maxHealth: 1600, armor: 55 },
      allies: [
        { champion: 'Malphite', position: 'TOP' },
        { champion: 'LeeSin', spells: ['Smite', 'Flash'] },
        { champion: 'Syndra', position: 'MIDDLE' },
        { champion: 'Soraka', position: 'UTILITY' },
      ],
      enemies: [
        { champion: 'Zed', level: 15, items: [3031, 3072], kills: 11, deaths: 2, assists: 3 },
        { champion: 'Caitlyn', level: 12, items: [3031] },
        { champion: 'Malphite', level: 12, items: [3068] },
        { champion: 'Soraka', level: 11 },
        { champion: 'LeeSin', level: 12, spells: ['Smite', 'Flash'] },
      ],
      gameTime: 1400,
    })

    const a = assessGame(live, sd)!
    expect(a).not.toBeNull()

    // self
    expect(a.self.slug).toBe('Caitlyn')
    expect(a.self.role).toBe('BOT')
    expect(a.self.currentGold).toBe(1450)
    expect(a.self.stats.attackDamage).toBe(210) // lu depuis championStats
    expect(a.self.stats.critChance).toBe(50) // fraction 0.5 → %
    expect(a.self.profile.primary).toBe('physical')

    // threat : Zed fed = menace principale, comp ennemie mixte
    expect(a.threat.primary?.slug).toBe('Zed')
    expect(a.threat.physical + a.threat.magic + a.threat.true).toBeCloseTo(1, 5)
    expect(a.threat.enemies).toHaveLength(5)
    expect(a.threat.enemies.every((e) => e.effectiveStats.health > 0)).toBe(true)

    // allies : Malphite ⇒ frontline
    expect(a.allies.hasFrontline).toBe(true)

    // triggers
    expect(a.triggers.enemyBurstPhysical).toBe(true)
    expect(a.gameTimeSeconds).toBe(1400)
  })

  it('ne plante pas si des champions sont absents du catalogue (patch récent)', () => {
    const live = makeLiveGame({
      selfChampion: 'ChampInexistant',
      allies: [{ champion: 'AutreInconnu' }],
      enemies: [{ champion: 'Zed' }, { champion: 'EnnemiInconnu1' }, { champion: 'EnnemiInconnu2' }],
    })
    const a = assessGame(live, sd)
    expect(a).not.toBeNull()
    expect(a!.self.championId).toBe(0) // profil de repli
    expect(a!.threat.enemies).toHaveLength(3)
    expect(a!.threat.physical + a!.threat.magic + a!.threat.true).toBeCloseTo(1, 5)
  })

  it('détecte la contrainte de mana', () => {
    const live = makeLiveGame({
      selfChampion: 'Syndra',
      selfLevel: 6,
      allies: [],
      enemies: [{ champion: 'Zed' }],
      championStats: { resourceType: 'MANA', resourceMax: 700, resourceValue: 90 },
    })
    expect(assessGame(live, sd)!.self.isManaConstrained).toBe(true)
  })
})
