import { describe, it, expect } from 'vitest'
import {
  damageMultiplier,
  effectiveHp,
  effectiveHpVsProfile,
  effectiveResist,
} from './defense'

describe('damageMultiplier', () => {
  it('0 → 1, 100 → 0.5, 200 → 1/3', () => {
    expect(damageMultiplier(0)).toBe(1)
    expect(damageMultiplier(100)).toBeCloseTo(0.5, 10)
    expect(damageMultiplier(200)).toBeCloseTo(1 / 3, 10)
  })
  it('résistance négative : amplification bornée par la formule du jeu', () => {
    expect(damageMultiplier(-100)).toBeCloseTo(1.5, 10) // 2 - 100/200
    expect(damageMultiplier(-25)).toBeCloseTo(2 - 100 / 125, 10)
  })
})

describe('effectiveResist', () => {
  it('ordre : réduction plate → % → pénétration plate', () => {
    // 100 → (100 - 10) = 90 → ×(1-0.3) = 63 → -20 = 43
    expect(effectiveResist(100, { flatReduction: 10, percent: 30, flat: 20 })).toBeCloseTo(43, 6)
  })
  it('peut devenir négative', () => {
    expect(effectiveResist(20, { flat: 30 })).toBe(-10)
  })
  it('sans pénétration : identité', () => {
    expect(effectiveResist(75)).toBe(75)
  })
})

describe('effectiveHp', () => {
  it('PV effectifs = PV × (1 + résistance/100)', () => {
    const ehp = effectiveHp({ health: 1000, armor: 100, magicResist: 50 })
    expect(ehp.flat).toBe(1000)
    expect(ehp.vsPhysical).toBeCloseTo(2000, 6)
    expect(ehp.vsMagic).toBeCloseTo(1500, 6)
  })
})

describe('effectiveHpVsProfile', () => {
  const target = { health: 1000, armor: 100, magicResist: 0 }

  it('profil 100 % physique = PV effectifs vs physique', () => {
    expect(effectiveHpVsProfile(target, { physical: 1, magic: 0, true: 0 })).toBeCloseTo(2000, 6)
  })
  it('profil 100 % vrai = PV bruts', () => {
    expect(effectiveHpVsProfile(target, { physical: 0, magic: 0, true: 1 })).toBeCloseTo(1000, 6)
  })
  it('un profil mixte se situe entre les deux', () => {
    const v = effectiveHpVsProfile(target, { physical: 0.5, magic: 0, true: 0.5 })
    expect(v).toBeGreaterThan(1000)
    expect(v).toBeLessThan(2000)
  })
  it('la pénétration de l’attaquant baisse les PV effectifs', () => {
    const withPen = effectiveHpVsProfile(
      target,
      { physical: 1, magic: 0, true: 0 },
      { armor: { flat: 30 } },
    )
    expect(withPen).toBeLessThan(2000)
  })
})
