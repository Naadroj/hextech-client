import { describe, it, expect } from 'vitest'
import {
  ATTACK_SPEED_CAP,
  EMPTY_STATS,
  aggregateItemStats,
  effectiveStats,
  sumStats,
} from './stats'
import type { NormalizedItem, StatBlock } from '../../staticdata-types'

const stat = (over: Partial<StatBlock> = {}): StatBlock => ({ ...EMPTY_STATS, ...over })

const item = (id: number, stats: Partial<StatBlock>): NormalizedItem => ({
  id,
  name: `Item ${id}`,
  description: '',
  plaintext: '',
  tags: [],
  goldBase: 0,
  goldTotal: 0,
  goldSell: 0,
  purchasable: true,
  onSummonersRift: true,
  depth: 3,
  from: [],
  into: [],
  isFinal: true,
  isBoots: false,
  isConsumable: false,
  isTrinket: false,
  stats,
  hasActive: false,
})

describe('sumStats / aggregateItemStats', () => {
  it('additionne champ par champ, ignore les zéros', () => {
    expect(sumStats({ attackDamage: 40 }, { attackDamage: 20, armor: 30 }, { abilityPower: 0 })).toEqual({
      attackDamage: 60,
      armor: 30,
    })
  })

  it('agrège les stats de plusieurs items (dont % additifs)', () => {
    const agg = aggregateItemStats([
      item(1, { attackDamage: 45, bonusAttackSpeedPercent: 40 }),
      item(2, { attackDamage: 30, bonusAttackSpeedPercent: 25, lethality: 15 }),
    ])
    expect(agg).toEqual({ attackDamage: 75, bonusAttackSpeedPercent: 65, lethality: 15 })
  })
})

describe('effectiveStats', () => {
  const base = stat({
    health: 1000,
    armor: 40,
    attackDamage: 60,
    attackSpeed: 0.7,
    moveSpeed: 340,
    critChance: 0,
  })

  it('additionne les stats plates de base + items', () => {
    const s = effectiveStats(base, [item(1, { attackDamage: 45, armor: 30, abilityPower: 0 })])
    expect(s.attackDamage).toBe(105)
    expect(s.armor).toBe(70)
    expect(s.health).toBe(1000)
  })

  it('replie le bonus de vitesse d’attaque sur attackSpeed, plafonné', () => {
    const s = effectiveStats(base, [item(1, { bonusAttackSpeedPercent: 100 })])
    expect(s.bonusAttackSpeedPercent).toBe(100)
    expect(s.attackSpeed).toBeCloseTo(0.7 * 2, 5)

    const capped = effectiveStats(base, [item(1, { bonusAttackSpeedPercent: 500 })])
    expect(capped.attackSpeed).toBe(ATTACK_SPEED_CAP)
  })

  it('applique la vitesse de déplacement plate puis en %', () => {
    const s = effectiveStats(base, [item(1, { moveSpeed: 45, moveSpeedPercent: 5 })])
    expect(s.moveSpeed).toBeCloseTo((340 + 45) * 1.05, 5)
    expect(s.moveSpeedPercent).toBe(5)
  })

  it('plafonne la chance de coup critique à 100', () => {
    const s = effectiveStats(base, [item(1, { critChance: 60 }), item(2, { critChance: 60 })])
    expect(s.critChance).toBe(100)
  })

  it('prend en compte la couche extra (runes/buffs)', () => {
    const s = effectiveStats(base, [], { abilityPower: 9, armor: 6 })
    expect(s.abilityPower).toBe(9)
    expect(s.armor).toBe(46)
  })
})
