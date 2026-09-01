import { describe, it, expect } from 'vitest'
import {
  growthFactor,
  mergeItemStats,
  normalizeChampions,
  normalizeItems,
  normalizeRunes,
  normalizeSummoners,
  parseItemDescriptionStats,
  statsAtLevel,
} from './ddragon'
import type { DdragonChampionStats } from './types'

describe('parseItemDescriptionStats', () => {
  it('extrait les stats modernes du bloc <stats> (dont accélération de compétence)', () => {
    const desc =
      '<mainText><stats><attention>36</attention> Attack Damage<br><attention>30%</attention> Attack Speed<br><attention>333</attention> Health<br><attention>15</attention> Ability Haste</stats><br><br><passive>Spellblade</passive></mainText>'
    expect(parseItemDescriptionStats(desc)).toEqual({
      attackDamage: 36,
      bonusAttackSpeedPercent: 30,
      health: 333,
      abilityHaste: 15,
    })
  })

  it('distingue Move Speed plat et en %', () => {
    const desc =
      '<stats><attention>45</attention> Move Speed<br><attention>4%</attention> Move Speed</stats>'
    expect(parseItemDescriptionStats(desc)).toEqual({ moveSpeed: 45, moveSpeedPercent: 4 })
  })

  it('gère la pénétration magique plate vs %', () => {
    expect(
      parseItemDescriptionStats('<stats><attention>15</attention> Magic Penetration</stats>'),
    ).toEqual({ magicPenetrationFlat: 15 })
    expect(
      parseItemDescriptionStats('<stats><attention>30%</attention> Magic Penetration</stats>'),
    ).toEqual({ magicPenetrationPercent: 30 })
  })

  it('retourne {} sans bloc <stats>', () => {
    expect(parseItemDescriptionStats('<mainText>rien</mainText>')).toEqual({})
    expect(parseItemDescriptionStats('<stats></stats>')).toEqual({})
  })
})

describe('mergeItemStats', () => {
  it('la description a priorité sur le bloc legacy', () => {
    const merged = mergeItemStats(
      '<stats><attention>105</attention> Ability Power<br><attention>50</attention> Armor</stats>',
      { FlatMagicDamageMod: 999, FlatArmorMod: 999, FlatHPPoolMod: 300 },
    )
    expect(merged.abilityPower).toBe(105)
    expect(merged.armor).toBe(50)
    // Stat uniquement présente en legacy : conservée.
    expect(merged.health).toBe(300)
  })
})

describe('growthFactor', () => {
  it('vaut 0 au niveau 1 et 17 au niveau 18', () => {
    expect(growthFactor(1)).toBeCloseTo(0, 6)
    expect(growthFactor(18)).toBeCloseTo(17, 6)
  })
  it('borne les niveaux hors plage', () => {
    expect(growthFactor(0)).toBe(growthFactor(1))
    expect(growthFactor(99)).toBe(growthFactor(18))
  })
})

const AATROX_BASE: DdragonChampionStats = {
  hp: 650,
  hpperlevel: 114,
  mp: 0,
  mpperlevel: 0,
  movespeed: 345,
  armor: 38,
  armorperlevel: 4.8,
  spellblock: 32,
  spellblockperlevel: 2.05,
  attackrange: 175,
  hpregen: 3,
  hpregenperlevel: 0.5,
  mpregen: 0,
  mpregenperlevel: 0,
  crit: 0,
  critperlevel: 0,
  attackdamage: 60,
  attackdamageperlevel: 0,
  attackspeedperlevel: 2.5,
  attackspeed: 0.651,
}

describe('statsAtLevel', () => {
  it('niveau 1 = stats de base', () => {
    const s = statsAtLevel(AATROX_BASE, 1)
    expect(s.health).toBe(650)
    expect(s.armor).toBe(38)
    expect(s.attackDamage).toBe(60)
    expect(s.attackSpeed).toBeCloseTo(0.651, 4)
  })
  it('niveau 18 : interpolation non linéaire', () => {
    const s = statsAtLevel(AATROX_BASE, 18)
    expect(s.health).toBeCloseTo(650 + 114 * 17, 3) // 2588
    expect(s.armor).toBeCloseTo(38 + 4.8 * 17, 3) // 119.6
    expect(s.magicResist).toBeCloseTo(32 + 2.05 * 17, 3)
    // AS(18) = 0.651 * (1 + 0.025 * 17)
    expect(s.attackSpeed).toBeCloseTo(0.651 * (1 + 0.025 * 17), 4)
  })
})

describe('normalizeItems', () => {
  const file = {
    data: {
      '3078': {
        name: 'Trinity Force',
        description:
          '<stats><attention>36</attention> Attack Damage<br><attention>15</attention> Ability Haste</stats><active>x</active>',
        plaintext: 'x',
        from: ['3057', '3044'],
        gold: { base: 133, total: 3333, sell: 2333, purchasable: true },
        tags: ['Damage', 'AbilityHaste'],
        maps: { '11': true, '12': false },
        stats: {},
        depth: 3,
      },
      '2003': {
        name: 'Health Potion',
        description: '<stats></stats>',
        gold: { base: 50, total: 50, sell: 20, purchasable: true },
        tags: ['Consumable'],
        maps: { '11': true },
        stats: {},
      },
      Meta: { name: 'ignored', maps: {}, gold: { base: 0, total: 0, sell: 0, purchasable: false } },
    },
  }

  it('normalise, extrait les stats et les drapeaux', () => {
    const items = normalizeItems(file as never)
    const tf = items.find((i) => i.id === 3078)!
    expect(tf.goldTotal).toBe(3333)
    expect(tf.onSummonersRift).toBe(true)
    expect(tf.isFinal).toBe(true)
    expect(tf.from).toEqual([3057, 3044])
    expect(tf.hasActive).toBe(true)
    expect(tf.stats.abilityHaste).toBe(15)

    const pot = items.find((i) => i.id === 2003)!
    expect(pot.isConsumable).toBe(true)

    // Clé non numérique ignorée.
    expect(items.some((i) => Number.isNaN(i.id))).toBe(false)
  })

  it('attache nameLocalized quand une table de noms est fournie (et diffère)', () => {
    const items = normalizeItems(file as never, new Map([
      [3078, 'Force Trinité'],
      [2003, 'Health Potion'], // identique → non attaché
    ]))
    expect(items.find((i) => i.id === 3078)!.nameLocalized).toBe('Force Trinité')
    expect(items.find((i) => i.id === 2003)!.nameLocalized).toBeUndefined()
    expect(items.find((i) => i.id === 3078)!.name).toBe('Trinity Force') // canonique EN intact
  })
})

describe('normalizeChampions / runes / summoners', () => {
  it('mappe key → id numérique et conserve les stats de base', () => {
    const champs = normalizeChampions({
      data: {
        Aatrox: { key: '266', id: 'Aatrox', name: 'Aatrox', tags: ['Fighter'], partype: 'Blood Well', info: { attack: 8, defense: 4, magic: 3, difficulty: 4 }, stats: AATROX_BASE },
      },
    } as never)
    expect(champs[0].id).toBe(266)
    expect(champs[0].slug).toBe('Aatrox')
    expect(champs[0].base.hp).toBe(650)
  })

  it('marque les keystones (slot 0) et rattache l’arbre', () => {
    const runes = normalizeRunes([
      {
        id: 8100,
        key: 'Domination',
        name: 'Domination',
        slots: [
          { runes: [{ id: 8112, key: 'Electrocute', name: 'Electrocute', shortDesc: 'x' }] },
          { runes: [{ id: 8126, key: 'CheapShot', name: 'Cheap Shot', shortDesc: 'y' }] },
        ],
      },
    ] as never)
    expect(runes.find((r) => r.id === 8112)).toMatchObject({ keystone: true, tree: 'Domination' })
    expect(runes.find((r) => r.id === 8126)!.keystone).toBe(false)
  })

  it('normalise les sorts d’invocateur', () => {
    const spells = normalizeSummoners({
      data: { SummonerFlash: { id: 'SummonerFlash', name: 'Flash', description: 'x', key: '4', modes: ['CLASSIC'] } },
    } as never)
    expect(spells[0]).toMatchObject({ id: 4, key: 'SummonerFlash', name: 'Flash' })
  })
})
