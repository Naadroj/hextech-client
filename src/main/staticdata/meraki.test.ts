import { describe, it, expect } from 'vitest'
import { deriveDamageProfiles, type MerakiChampionsFile } from './meraki'
import type { NormalizedChampion } from './types'

function champ(id: number, slug: string, over: Partial<NormalizedChampion> = {}): NormalizedChampion {
  return {
    id,
    slug,
    name: slug,
    tags: over.tags ?? ['Fighter'],
    resource: 'Mana',
    info: over.info ?? { attack: 5, defense: 5, magic: 5, difficulty: 5 },
    base: {
      hp: 600, hpperlevel: 100, mp: 300, mpperlevel: 40, movespeed: 340,
      armor: 30, armorperlevel: 4, spellblock: 30, spellblockperlevel: 1.3,
      attackrange: over.base?.attackrange ?? 175,
      hpregen: 5, hpregenperlevel: 0.5, mpregen: 7, mpregenperlevel: 0.5,
      crit: 0, critperlevel: 0, attackdamage: 60, attackdamageperlevel: 3,
      attackspeedperlevel: 2, attackspeed: 0.65,
    },
    ...over,
  }
}

describe('deriveDamageProfiles', () => {
  it('utilise Meraki : adaptiveType + comptage des sorts', () => {
    const champions = [champ(134, 'Syndra', { tags: ['Mage'], base: { ...champ(0, 'x').base, attackrange: 550 } })]
    const meraki: MerakiChampionsFile = {
      Syndra: {
        id: 134,
        adaptiveType: 'MAGIC_DAMAGE',
        attackType: 'RANGED',
        roles: ['BURST', 'MAGE'],
        abilities: {
          Q: [{ damageType: 'MAGIC_DAMAGE' }],
          W: [{ damageType: 'MAGIC_DAMAGE' }],
          E: [{ damageType: 'MAGIC_DAMAGE' }],
          R: [{ damageType: 'MAGIC_DAMAGE' }],
        },
      },
    }
    const [p] = deriveDamageProfiles(champions, meraki)
    expect(p.source).toBe('meraki')
    expect(p.magic).toBeGreaterThan(0.9)
    expect(p.primary).toBe('magic')
    expect(p.pattern).toBe('burst')
    expect(p.attackType).toBe('RANGED')
  })

  it('booste la part physique des tireurs à distance', () => {
    const champions = [champ(22, 'Ashe', { tags: ['Marksman'] })]
    const meraki: MerakiChampionsFile = {
      Ashe: {
        id: 22,
        adaptiveType: 'PHYSICAL_DAMAGE',
        attackType: 'RANGED',
        roles: ['MARKSMAN'],
        abilities: { R: [{ damageType: 'MAGIC_DAMAGE' }], Q: [{ damageType: 'PHYSICAL_DAMAGE' }] },
      },
    }
    const [p] = deriveDamageProfiles(champions, meraki)
    expect(p.physical).toBeGreaterThan(0.7)
    expect(p.pattern).toBe('sustained')
  })

  it('jointure par slug normalisé quand l’id diffère', () => {
    const champions = [champ(145, 'Kaisa')]
    const meraki: MerakiChampionsFile = {
      KaiSa: { id: 0, key: 'KaiSa', adaptiveType: 'PHYSICAL_DAMAGE', attackType: 'RANGED', roles: ['MARKSMAN'], abilities: {} },
    }
    const [p] = deriveDamageProfiles(champions, meraki)
    // Override Kaisa présent dans overrides.json → il gagne.
    expect(p.source).toBe('override')
  })

  it('repli Data Dragon quand Meraki manque le champion', () => {
    const champions = [champ(999, 'Locke', { tags: ['Mage'], base: { ...champ(0, 'x').base, attackrange: 525 } })]
    const [p] = deriveDamageProfiles(champions, null)
    expect(p.source).toBe('ddragon')
    expect(p.magic).toBeGreaterThan(0.7)
    expect(p.attackType).toBe('RANGED') // déduit de attackrange >= 285
  })

  it('les overrides ont toujours la priorité et sont normalisés', () => {
    const champions = [champ(67, 'Vayne', { tags: ['Marksman'] })]
    const meraki: MerakiChampionsFile = {
      Vayne: { id: 67, adaptiveType: 'PHYSICAL_DAMAGE', attackType: 'RANGED', roles: ['MARKSMAN'], abilities: {} },
    }
    const [p] = deriveDamageProfiles(champions, meraki)
    expect(p.source).toBe('override')
    expect(p.true).toBeGreaterThan(0.3)
    expect(p.physical + p.magic + p.true).toBeCloseTo(1, 5)
  })
})
