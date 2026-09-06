import { describe, it, expect } from 'vitest'
import { inferCommittedAxis, isOffCommittedAxis, isOffCommittedAxisItem } from './committed-axis'
import type { StaticData, NormalizedItem } from '../../staticdata-types'
import type { GameAssessment } from '../context'

const item = (id: number, stats: NormalizedItem['stats'], over: Partial<NormalizedItem> = {}): NormalizedItem =>
  ({
    id,
    name: `i${id}`,
    description: '',
    plaintext: '',
    tags: [],
    goldBase: 0,
    goldTotal: 3000,
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
    ...over,
  }) as NormalizedItem

const AD_LEGENDARY = item(1, { attackDamage: 60, lethality: 18, abilityHaste: 15 }) // → ad-carry
const AD_COMPONENT = item(2, { lethality: 10, attackDamage: 25 }, { isFinal: false, goldTotal: 1100 })
const AP_LEGENDARY = item(3, { abilityPower: 90, abilityHaste: 20 }) // → ap-damage
const TANK = item(4, { health: 400, armor: 50 })
const BOOTS = item(5, { moveSpeed: 45 }, { isBoots: true })

const sd = { getItem: (id: number) => ({ 1: AD_LEGENDARY, 2: AD_COMPONENT, 3: AP_LEGENDARY, 4: TANK, 5: BOOTS })[id] } as unknown as StaticData

const assess = (ids: number[]): GameAssessment =>
  ({ self: { items: ids } }) as GameAssessment

describe('inferCommittedAxis', () => {
  it('undefined si aucun item offensif', () => {
    expect(inferCommittedAxis(assess([4, 5]), sd)).toBeUndefined()
    expect(inferCommittedAxis(assess([]), sd)).toBeUndefined()
  })

  it('physical avec un légendaire AD', () => {
    expect(inferCommittedAxis(assess([1]), sd)).toBe('physical')
  })

  it('physical avec un simple composant AD (les composants comptent)', () => {
    expect(inferCommittedAxis(assess([2, 4, 5]), sd)).toBe('physical')
  })

  it('magic avec un légendaire AP', () => {
    expect(inferCommittedAxis(assess([3]), sd)).toBe('magic')
  })

  it('undefined si AD et AP se valent (build vraiment hybride)', () => {
    expect(inferCommittedAxis(assess([1, 3]), sd)).toBeUndefined()
  })
})

describe('isOffCommittedAxis', () => {
  it('AP est hors-axe quand on est engagé AD, et inversement', () => {
    expect(isOffCommittedAxis('ap-damage', 'physical')).toBe(true)
    expect(isOffCommittedAxis('ad-carry', 'physical')).toBe(false)
    expect(isOffCommittedAxis('ad-onhit', 'magic')).toBe(true)
    expect(isOffCommittedAxis('ap-damage', 'magic')).toBe(false)
  })
  it('rien n’est hors-axe sans axe engagé', () => {
    expect(isOffCommittedAxis('ap-damage', undefined)).toBe(false)
  })
  it('tank / haste ne sont jamais hors-axe', () => {
    expect(isOffCommittedAxis('tank', 'physical')).toBe(false)
    expect(isOffCommittedAxis('haste', 'magic')).toBe(false)
  })
})

describe('isOffCommittedAxisItem — l’or mort compte aussi', () => {
  it('écarte un item neutre qui porte trop de stats de l’axe opposé', () => {
    // Le Cimeterre mercuriel est classé `qss` — on l'achète pour le nettoyage
    // de CC — mais ses 40 AD sont de l'or mort sur un champion AP. Proposé à
    // une Annie le 6 septembre 2026.
    const scimitar = item(3139, { attackDamage: 40, magicResist: 40, lifeSteal: 8 }, {
      description: '<active>Quicksilver</active> Removes all crowd control.',
    })
    expect(isOffCommittedAxisItem(scimitar, 'magic')).toBe(true)
    // Sur un champion AD, c'est exactement l'item qu'il faut : rien de mort.
    expect(isOffCommittedAxisItem(scimitar, 'physical')).toBe(false)
  })

  it('garde les items réellement neutres', () => {
    // Aucun or de dégâts d'un côté ni de l'autre : proposable quel que soit l'axe.
    const visage = item(3065, { health: 450, magicResist: 55, abilityHaste: 10 })
    expect(isOffCommittedAxisItem(visage, 'magic')).toBe(false)
    expect(isOffCommittedAxisItem(visage, 'physical')).toBe(false)
  })

  it('sans axe engagé, rien n’est écarté', () => {
    const ie = item(3031, { attackDamage: 70, critChance: 20 })
    expect(isOffCommittedAxisItem(ie, undefined)).toBe(false)
  })
})
