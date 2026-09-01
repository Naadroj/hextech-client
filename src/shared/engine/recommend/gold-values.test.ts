import { describe, it, expect } from 'vitest'
import { statGoldValue, GOLD_PER_STAT } from './gold-values'

describe('statGoldValue', () => {
  it('valorise chaque stat au barème', () => {
    expect(statGoldValue({ attackDamage: 10 })).toBeCloseTo(10 * GOLD_PER_STAT.attackDamage!, 6)
    expect(statGoldValue({ armor: 20, magicResist: 20 })).toBeCloseTo(20 * 20 + 20 * 20, 6)
  })

  it('un item de stats pures a une efficacité proche de 1', () => {
    // ~ Cuirasse d'or : 60 armure + 350 PV pour ~2200 or.
    const eff = statGoldValue({ armor: 60, health: 350 }) / 2200
    expect(eff).toBeGreaterThan(0.7)
    expect(eff).toBeLessThan(1.3)
  })

  it('ignore les stats inconnues', () => {
    expect(statGoldValue({})).toBe(0)
  })
})
