import { describe, it, expect } from 'vitest'
import { assessAllies, assessThreat, baseDamageWeight } from './threat'
import { assessFed } from './fed'
import { inferRoles } from './roles'
import { playerKey } from './live-adapter'
import { makeStaticData, livePlayer } from './fixtures'
import type { LivePlayer } from '../../live-types'

const sd = makeStaticData()
const prof = (slug: string) => sd.getDamageProfile(slug)
const rolesOf = (players: LivePlayer[]) => inferRoles(players, prof, playerKey)

describe('baseDamageWeight', () => {
  it('un carry pèse plus qu’un enchanteur', () => {
    expect(baseDamageWeight(prof('Caitlyn'))).toBeGreaterThan(baseDamageWeight(prof('Soraka')))
    expect(baseDamageWeight(prof('Malphite'))).toBeLessThan(baseDamageWeight(prof('Zed')))
  })
})

describe('assessThreat', () => {
  it('reflète l’axe de dégâts de la composition ennemie', () => {
    const enemies = [
      livePlayer({ champion: 'Syndra', team: 'CHAOS' }),
      livePlayer({ champion: 'Malphite', team: 'CHAOS' }),
      livePlayer({ champion: 'Soraka', team: 'CHAOS' }),
    ]
    const fed = assessFed(enemies, sd)
    const t = assessThreat({ enemies, fed, roles: rolesOf(enemies), staticData: sd })
    expect(t.magic).toBeGreaterThan(0.7)
    expect(t.physical).toBeLessThan(0.2)
    expect(t.physical + t.magic + t.true).toBeCloseTo(1, 5)
  })

  it('un ennemi fed pèse plus lourd et devient la menace principale', () => {
    const enemies = [
      livePlayer({ champion: 'Zed', team: 'CHAOS', level: 15, items: [3031, 3072], kills: 12, deaths: 1, assists: 3 }),
      livePlayer({ champion: 'Caitlyn', team: 'CHAOS', level: 10, items: [], kills: 1, deaths: 6, assists: 2 }),
      livePlayer({ champion: 'Soraka', team: 'CHAOS', level: 10, items: [], kills: 0, deaths: 5, assists: 4 }),
    ]
    const fed = assessFed(enemies, sd)
    const t = assessThreat({ enemies, fed, roles: rolesOf(enemies), staticData: sd })
    expect(t.primary?.slug).toBe('Zed')
    expect(t.primary!.fed).toBeGreaterThan(0.3)
    expect(t.burst).toBeGreaterThan(0.3) // Zed burst domine
  })

  it('calcule des résistances effectives pour chaque ennemi (base@niveau + items)', () => {
    const enemies = [livePlayer({ champion: 'Malphite', team: 'CHAOS', level: 13, items: [3068] })]
    const fed = assessFed(enemies, sd)
    const t = assessThreat({ enemies, fed, roles: rolesOf(enemies), staticData: sd })
    const malph = t.enemies[0]
    // base armure niv 13 (~37 + 5.2·g) + Sunfire 50
    expect(malph.effectiveStats.armor).toBeGreaterThan(90)
    expect(malph.effectiveStats.health).toBeGreaterThan(1800)
  })
})

describe('assessAllies', () => {
  it('mélange les profils alliés (soi inclus) et détecte une frontline', () => {
    const selfProfile = prof('Caitlyn')!
    const allies = [
      livePlayer({ champion: 'Malphite' }),
      livePlayer({ champion: 'Soraka' }),
    ]
    const a = assessAllies(allies, selfProfile, sd)
    expect(a.hasFrontline).toBe(true)
    expect(a.physical + a.magic + a.true).toBeCloseTo(1, 5)

    const noTank = assessAllies([livePlayer({ champion: 'Syndra' })], selfProfile, sd)
    expect(noTank.hasFrontline).toBe(false)
  })
})

describe('menace corrigée par les items portés', () => {
  // Le profil DDragon est une étiquette d'identité, pas une observation : une
  // Katarina full AD y reste magique. Signalé le 6 septembre 2026 par un Maokai
  // à qui on conseillait de la RM contre une équipe qui tapait physique.
  const mixOfEnemies = (enemies: LivePlayer[]) =>
    assessThreat({ enemies, fed: assessFed(enemies, sd), roles: rolesOf(enemies), staticData: sd })

  it('un champion au profil magique parti full AD bascule côté physique', () => {
    const nu = [livePlayer({ champion: 'Syndra', team: 'CHAOS' })]
    const ad = [
      livePlayer({ champion: 'Syndra', team: 'CHAOS', items: [3031, 3072, 3036] }),
    ]
    const t0 = mixOfEnemies(nu)
    const t1 = mixOfEnemies(ad)

    expect(t0.magic).toBeGreaterThan(0.7)
    expect(t1.physical).toBeGreaterThan(t0.physical)
    expect(t1.magic).toBeLessThan(t0.magic)
  })

  it('sans item, le profil du champion fait toujours foi', () => {
    const t = mixOfEnemies([livePlayer({ champion: 'Syndra', team: 'CHAOS' })])
    expect(t.magic).toBeCloseTo(prof('Syndra')!.magic, 5)
  })

  it('des items défensifs purs ne déplacent pas l’axe', () => {
    // Coques en acier / Visage spirituel ne disent rien de ce qu'il tape.
    const t0 = mixOfEnemies([livePlayer({ champion: 'Syndra', team: 'CHAOS' })])
    const t1 = mixOfEnemies([
      livePlayer({ champion: 'Syndra', team: 'CHAOS', items: [3068, 3065] }),
    ])
    expect(t1.magic).toBeCloseTo(t0.magic, 5)
  })
})
