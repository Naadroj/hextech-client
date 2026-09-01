import { describe, it, expect } from 'vitest'
import { autoAttackDps, critFactor, damageOutputIndex } from './offense'
import { EMPTY_STATS } from './stats'
import type { DamageProfile, StatBlock } from '../../staticdata-types'

const stat = (over: Partial<StatBlock> = {}): StatBlock => ({ ...EMPTY_STATS, ...over })

const profile = (over: Partial<DamageProfile> = {}): DamageProfile => ({
  championId: 0,
  slug: 'x',
  physical: 0.7,
  magic: 0.25,
  true: 0.05,
  attackType: 'MELEE',
  primary: 'physical',
  pattern: 'mixed',
  roles: [],
  source: 'meraki',
  ...over,
})

describe('critFactor', () => {
  it('0 % → 1 ; 100 % → multiplicateur ; borné', () => {
    expect(critFactor(0)).toBe(1)
    expect(critFactor(100, 1.75)).toBeCloseTo(1.75, 6)
    expect(critFactor(50, 2)).toBeCloseTo(1.5, 6)
    expect(critFactor(999)).toBe(critFactor(100))
  })
})

describe('autoAttackDps', () => {
  it('AD 100, AS 1.0, sans crit, cible sans armure → 100', () => {
    expect(autoAttackDps(stat({ attackDamage: 100, attackSpeed: 1 }), { armor: 0 })).toBeCloseTo(100, 6)
  })
  it('cible avec 100 d’armure → moitié', () => {
    expect(autoAttackDps(stat({ attackDamage: 100, attackSpeed: 1 }), { armor: 100 })).toBeCloseTo(50, 6)
  })
  it('la létalité de l’attaquant restaure une partie du DPS', () => {
    const s = stat({ attackDamage: 100, attackSpeed: 1, lethality: 50 })
    expect(autoAttackDps(s, { armor: 100 })).toBeGreaterThan(50)
  })
})

describe('damageOutputIndex — monotonie', () => {
  const target = { armor: 80, magicResist: 40 }

  it('↑ AP augmente l’index pour un profil magique', () => {
    const mage = profile({ physical: 0.1, magic: 0.85, true: 0.05, pattern: 'burst' })
    const lo = damageOutputIndex(stat({ abilityPower: 100 }), mage, target)
    const hi = damageOutputIndex(stat({ abilityPower: 200 }), mage, target)
    expect(hi).toBeGreaterThan(lo)
  })

  it('↑ AD / vitesse d’attaque augmente l’index pour un profil physique', () => {
    const adc = profile({ physical: 0.9, magic: 0.05, true: 0.05, pattern: 'sustained' })
    const lo = damageOutputIndex(stat({ attackDamage: 100, attackSpeed: 0.8 }), adc, target)
    const hi = damageOutputIndex(stat({ attackDamage: 160, attackSpeed: 1.2 }), adc, target)
    expect(hi).toBeGreaterThan(lo)
  })

  it('↑ pénétration d’armure augmente l’index contre une cible blindée', () => {
    const adc = profile({ physical: 0.9, magic: 0.05, true: 0.05, pattern: 'sustained' })
    const base = stat({ attackDamage: 120, attackSpeed: 1 })
    const pen = stat({ attackDamage: 120, attackSpeed: 1, armorPenetrationPercent: 35 })
    expect(damageOutputIndex(pen, adc, target)).toBeGreaterThan(damageOutputIndex(base, adc, target))
  })

  it('↑ pénétration magique augmente l’index contre de la RM', () => {
    const mage = profile({ physical: 0, magic: 0.95, true: 0.05, pattern: 'burst' })
    const base = stat({ abilityPower: 150 })
    const pen = stat({ abilityPower: 150, magicPenetrationPercent: 40 })
    expect(damageOutputIndex(pen, mage, { armor: 0, magicResist: 80 })).toBeGreaterThan(
      damageOutputIndex(base, mage, { armor: 0, magicResist: 80 }),
    )
  })

  it('↑ accélération de compétence augmente l’index', () => {
    const p = profile({ pattern: 'burst' })
    const lo = damageOutputIndex(stat({ attackDamage: 80, abilityPower: 80 }), p, target)
    const hi = damageOutputIndex(
      stat({ attackDamage: 80, abilityPower: 80, abilityHaste: 40 }),
      p,
      target,
    )
    expect(hi).toBeGreaterThan(lo)
  })
})
