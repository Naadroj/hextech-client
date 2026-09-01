import { describe, it, expect } from 'vitest'
import { deriveSpellDamage, unitToRatioStat } from './spell-damage'
import type { NormalizedChampion } from './types'

const champ = (id: number, slug: string): NormalizedChampion => ({
  id,
  slug,
  name: slug,
  tags: [],
  resource: 'Mana',
  info: { attack: 5, defense: 5, magic: 5, difficulty: 5 },
  base: {
    hp: 600, hpperlevel: 100, mp: 400, mpperlevel: 40, movespeed: 340,
    armor: 28, armorperlevel: 4, spellblock: 30, spellblockperlevel: 1.3,
    attackrange: 175, hpregen: 6, hpregenperlevel: 0.6, mpregen: 8, mpregenperlevel: 0.7,
    crit: 0, critperlevel: 0, attackdamage: 58, attackdamageperlevel: 3,
    attackspeedperlevel: 2, attackspeed: 0.65,
  },
})

const lvl = (attribute: string, mods: { values: number[]; units: string[] }[]) => ({
  attribute,
  modifiers: mods,
})

const MERAKI = {
  Syndra: {
    id: 134,
    abilities: {
      Q: [
        {
          damageType: 'MAGIC_DAMAGE',
          effects: [
            {
              leveling: [
                lvl('Magic Damage', [
                  { values: [75, 110, 145, 180, 215], units: ['', '', '', '', ''] },
                  { values: [60, 60, 60, 60, 60], units: ['% AP', '% AP', '% AP', '% AP', '% AP'] },
                ]),
              ],
            },
          ],
        },
      ],
      W: [{ damageType: 'MAGIC_DAMAGE', effects: [{ leveling: [] }] }],
      R: [
        {
          damageType: 'MAGIC_DAMAGE',
          effects: [{ leveling: [lvl('Magic Damage', [{ values: [140], units: ['% AP'] }])] }],
        },
      ],
    },
  },
  Zed: {
    id: 238,
    abilities: {
      Q: [
        {
          damageType: 'PHYSICAL_DAMAGE',
          effects: [
            {
              leveling: [
                lvl('Physical Damage', [
                  { values: [80, 120, 160, 200, 240], units: ['', '', '', '', ''] },
                  { values: [100, 100, 100, 100, 100], units: Array(5).fill('% bonus AD') },
                ]),
                lvl('Reduced Damage', [{ values: [48], units: ['% bonus AD'] }]),
              ],
            },
          ],
        },
      ],
    },
  },
  Vayne: {
    id: 67,
    abilities: {
      W: [
        {
          damageType: 'TRUE_DAMAGE',
          effects: [
            {
              leveling: [
                lvl('True Damage', [{ values: [6, 6.5, 7, 7.5, 8], units: Array(5).fill("% of target's maximum health") }]),
              ],
            },
          ],
        },
      ],
    },
  },
}

describe('unitToRatioStat', () => {
  it('mappe les unités courantes', () => {
    expect(unitToRatioStat('% AP')).toBe('ap')
    expect(unitToRatioStat('% bonus AD')).toBe('bonusAD')
    expect(unitToRatioStat('% AD')).toBe('totalAD')
    expect(unitToRatioStat("% of target's maximum health")).toBe('targetMaxHP')
    expect(unitToRatioStat('% of his missing health')).toBe(null) // attaquant, non géré
    expect(unitToRatioStat("% of target's missing health")).toBe('targetMissingHP')
    expect(unitToRatioStat('% bonus armor')).toBe('armor')
  })
  it('rejette ce qui n’est pas une stat', () => {
    expect(unitToRatioStat(' seconds')).toBe(null)
    expect(unitToRatioStat('% per 100 AP')).toBe(null)
    expect(unitToRatioStat('per Soul collected')).toBe(null)
  })
})

describe('deriveSpellDamage', () => {
  const champions = [champ(134, 'Syndra'), champ(238, 'Zed'), champ(67, 'Vayne')]
  const table = deriveSpellDamage(champions, MERAKI as never)

  it('extrait flat + ratio par rang', () => {
    const syndra = table.find((c) => c.slug === 'Syndra')!
    const q = syndra.abilities.find((a) => a.slot === 'Q')!
    expect(q.damageType).toBe('magic')
    expect(q.flat).toEqual([75, 110, 145, 180, 215])
    expect(q.ratios).toEqual([{ stat: 'ap', pct: [0.6, 0.6, 0.6, 0.6, 0.6] }])
    // W sans dégâts → absent
    expect(syndra.abilities.some((a) => a.slot === 'W')).toBe(false)
    // R : 3 rangs
    expect(syndra.abilities.find((a) => a.slot === 'R')!.ratios[0].pct).toEqual([1.4])
  })

  it('gère « % bonus AD » et ignore « Reduced Damage »', () => {
    const zed = table.find((c) => c.slug === 'Zed')!
    const q = zed.abilities.find((a) => a.slot === 'Q')!
    expect(q.damageType).toBe('physical')
    expect(q.flat).toEqual([80, 120, 160, 200, 240])
    expect(q.ratios).toEqual([{ stat: 'bonusAD', pct: [1, 1, 1, 1, 1] }])
  })

  it('gère « % PV max de la cible » et les dégâts vrais', () => {
    const w = table.find((c) => c.slug === 'Vayne')!.abilities.find((a) => a.slot === 'W')!
    expect(w.damageType).toBe('true')
    expect(w.ratios).toEqual([{ stat: 'targetMaxHP', pct: [0.06, 0.065, 0.07, 0.075, 0.08] }])
  })
})
