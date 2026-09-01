import { describe, it, expect } from 'vitest'
import { abilityDamage, abilityRawDamage, rankAtLevel, rotationDamage } from './spell-damage'
import { EMPTY_STATS } from './stats'
import type { AbilityDamage, StatBlock } from '../../staticdata-types'

const stat = (over: Partial<StatBlock> = {}): StatBlock => ({ ...EMPTY_STATS, ...over })

const attacker = (over: Partial<StatBlock> = {}, base = { ad: 60, hp: 600, level: 11 }) => ({
  stats: stat(over),
  baseAttackDamage: base.ad,
  baseHealth: base.hp,
  level: base.level,
})

const SYNDRA_Q: AbilityDamage = {
  slot: 'Q',
  damageType: 'magic',
  flat: [75, 110, 145, 180, 215],
  ratios: [{ stat: 'ap', pct: [0.6, 0.6, 0.6, 0.6, 0.6] }],
}
const ZED_E: AbilityDamage = {
  slot: 'E',
  damageType: 'physical',
  flat: [70, 95, 120, 145, 170],
  ratios: [{ stat: 'bonusAD', pct: [0.8, 0.8, 0.8, 0.8, 0.8] }],
}
const VAYNE_W: AbilityDamage = {
  slot: 'W',
  damageType: 'true',
  flat: [],
  ratios: [{ stat: 'targetMaxHP', pct: [0.06, 0.065, 0.07, 0.075, 0.08] }],
}

describe('rankAtLevel', () => {
  it('R : 0 avant 6, puis 1 / 2 / 3', () => {
    expect(rankAtLevel('R', 5)).toBe(0)
    expect(rankAtLevel('R', 6)).toBe(1)
    expect(rankAtLevel('R', 11)).toBe(2)
    expect(rankAtLevel('R', 16)).toBe(3)
  })
  it('Q/W/E : borné 1..5, ~maxé vers 12', () => {
    expect(rankAtLevel('Q', 1)).toBe(1)
    expect(rankAtLevel('Q', 12)).toBe(5)
    expect(rankAtLevel('Q', 18)).toBe(5)
  })
})

describe('abilityRawDamage', () => {
  it('flat + ratio AP', () => {
    expect(abilityRawDamage(SYNDRA_Q, 5, attacker({ abilityPower: 200 }), { armor: 0, magicResist: 0, maxHealth: 2000 })).toBe(
      215 + 0.6 * 200,
    )
  })
  it('ratio « bonus AD » = AD total − AD de base', () => {
    // AD total 180, base 60 → bonus 120 ; rang 1 : 70 + 0.8·120 = 166
    expect(abilityRawDamage(ZED_E, 1, attacker({ attackDamage: 180 }), { armor: 0, magicResist: 0, maxHealth: 2000 })).toBe(
      70 + 0.8 * 120,
    )
  })
  it('ratio « % PV max cible »', () => {
    // rang 3 : 7 % de 2500
    expect(
      abilityRawDamage(VAYNE_W, 3, attacker(), { armor: 0, magicResist: 0, maxHealth: 2500 }),
    ).toBeCloseTo(0.07 * 2500, 5)
  })
})

describe('abilityDamage — application des résistances', () => {
  it('magique : réduit par la RM effective', () => {
    const d = abilityDamage(SYNDRA_Q, 5, attacker({ abilityPower: 100 }), {
      armor: 0,
      magicResist: 100,
      maxHealth: 2000,
    })
    expect(d.magic).toBeCloseTo((215 + 60) * (100 / 200), 4)
    expect(d.physical).toBe(0)
  })
  it('vrai : non réduit', () => {
    const d = abilityDamage(VAYNE_W, 1, attacker(), { armor: 200, magicResist: 200, maxHealth: 2000 })
    expect(d.true).toBeCloseTo(0.06 * 2000, 4)
  })
  it('la pénétration magique de l’attaquant augmente les dégâts', () => {
    const noPen = abilityDamage(SYNDRA_Q, 5, attacker({ abilityPower: 100 }), { armor: 0, magicResist: 80, maxHealth: 2000 })
    const withPen = abilityDamage(SYNDRA_Q, 5, attacker({ abilityPower: 100 }), {
      armor: 0,
      magicResist: 80,
      maxHealth: 2000,
      magicPen: { percent: 40 },
    })
    expect(withPen.magic).toBeGreaterThan(noPen.magic)
  })
})

describe('rotationDamage', () => {
  it('somme les slots Q/W/E/R au rang du niveau', () => {
    const rot = rotationDamage([SYNDRA_Q, VAYNE_W, ZED_E], attacker({ abilityPower: 150, attackDamage: 150 }, { ad: 60, hp: 600, level: 16 }), {
      armor: 40,
      magicResist: 40,
      maxHealth: 2200,
    })
    expect(rot.magic).toBeGreaterThan(0)
    expect(rot.physical).toBeGreaterThan(0)
    expect(rot.true).toBeGreaterThan(0)
  })
})
