import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexSnapshot } from '../../static-index'
import { assessGame } from '../context'
import { makeLiveGame, type LiveGameSpec } from '../context/fixtures'
import { recommend } from './index'
import type { ItemRecommendation } from './types'

/**
 * Golden-file : scénarios de partie curés, joués contre le **snapshot embarqué
 * réel** (patch committé). Chaque scénario place le joueur en **milieu/fin de
 * partie** (3 items + bottes) — là où le choix d'item est réellement piloté par
 * le contexte.
 *
 * Assertions **catégorielles** (l'item conseillé appartient à une famille
 * attendue), pas des ids figés — robuste aux ré-équilibrages, mais garde un
 * signal de régression. Cross-check manuel U.GG / Mobalytics à l'écriture.
 */

const SNAPSHOT = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../../resources/staticdata/snapshot.json'),
    'utf8',
  ),
)
const sd = indexSnapshot(SNAPSHOT)

const run = (spec: LiveGameSpec) => {
  const a = assessGame(makeLiveGame(spec), sd)
  expect(a).not.toBeNull()
  return recommend(a!, sd)
}
const topN = (r: ReturnType<typeof recommend>, n: number): ItemRecommendation[] =>
  [r.primary, ...r.alternatives].filter((x): x is ItemRecommendation => !!x).slice(0, n)
const stat = (id: number, key: string): number =>
  (sd.getItem(id)?.stats as Record<string, number> | undefined)?.[key] ?? 0
const descHas = (id: number, re: RegExp): boolean => re.test(sd.getItem(id)?.description ?? '')
const isDefensive = (id: number): boolean =>
  stat(id, 'armor') > 0 ||
  stat(id, 'magicResist') > 0 ||
  stat(id, 'health') >= 200 ||
  descHas(id, /\bstasis\b|guardian angel|lifeline|revive/i)

// Caitlyn / Jinx à 3 items offensifs + bottes.
const ADC_STATS = { attackDamage: 260, attackSpeed: 1.6, critChance: 0.75, maxHealth: 1900, armor: 60, magicResist: 40 }
const MAGE_STATS = { abilityPower: 480, maxHealth: 1800, armor: 50, magicResist: 42, abilityHaste: 35 }

describe('scénarios golden — recommandeur', () => {
  it('1. ADC vs équipe qui stacke l’armure → pénétration d’armure conseillée', () => {
    const r = run({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      championStats: ADC_STATS,
      selfItems: [3006, 3031, 3094, 3072],
      selfGold: 3200,
      allies: [],
      enemies: [
        { champion: 'Malphite', level: 16, items: [3068, 3143, 3047] },
        { champion: 'Ornn', level: 16, items: [3068, 3110, 3075] },
        { champion: 'Darius', level: 16, items: [3068, 3053] },
        { champion: 'Sejuani', level: 15, items: [3143, 3068] },
        { champion: 'Leona', level: 14, items: [3047, 3068] },
      ],
    })
    expect(topN(r, 3).some((x) => stat(x.itemId, 'armorPenetrationPercent') > 0)).toBe(true)
  })

  it('2. ADC fragile vs burst magique fed → résistance magique dans le top 4', () => {
    const r = run({
      selfChampion: 'Jinx',
      selfPosition: 'BOTTOM',
      championStats: { ...ADC_STATS, magicResist: 30, maxHealth: 1750 },
      selfItems: [3006, 3031, 3094, 6672],
      allies: [],
      enemies: [
        { champion: 'Syndra', level: 17, items: [3089, 3135, 3157, 3020], k: 16, d: 2 },
        { champion: 'Veigar', level: 16, items: [3089, 3157, 3135] },
        { champion: 'Orianna', level: 16, items: [3089, 3135] },
        { champion: 'Vladimir', level: 16, items: [3089, 3135] },
        { champion: 'Nautilus', level: 14, items: [3068] },
      ],
    })
    expect(topN(r, 4).some((x) => stat(x.itemId, 'magicResist') > 0)).toBe(true)
  })

  it('3. ADC vs sustain lourd → antisoin dans le top 3', () => {
    const r = run({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      championStats: ADC_STATS,
      selfItems: [3006, 3031, 3094, 3072],
      allies: [],
      enemies: [
        { champion: 'Aatrox', level: 16, items: [3072, 3053, 6333] },
        { champion: 'Vladimir', level: 16, items: [3089, 3135] },
        { champion: 'Soraka', level: 14, items: [3011] },
        { champion: 'Vayne', level: 16, items: [3153, 3072] },
        { champion: 'Leona', level: 13 },
      ],
    })
    expect(topN(r, 3).some((x) => descHas(x.itemId, /grievous wounds/i))).toBe(true)
  })

  it('4. ADC focus par un assassin AD fed → option défensive dans le top 3', () => {
    const r = run({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      championStats: { ...ADC_STATS, maxHealth: 1650, armor: 45 },
      selfItems: [3006, 3031, 3094, 6672],
      selfScores: { deaths: 6, kills: 2 },
      gameTime: 1500,
      allies: [],
      enemies: [
        { champion: 'Zed', level: 17, items: [6694, 3036, 3814], k: 15, d: 2, pos: 'MIDDLE' },
        { champion: 'LeeSin', level: 15, items: [6694, 6693], k: 9, d: 4 },
        { champion: 'Caitlyn', level: 13, pos: 'BOTTOM' },
        { champion: 'Nautilus', level: 13, pos: 'UTILITY' },
        { champion: 'Malphite', level: 13 },
      ],
    })
    expect(topN(r, 3).some((x) => isDefensive(x.itemId))).toBe(true)
  })

  it('5. mage vs équipe qui stacke la RM → pénétration magique dans le top 3', () => {
    const r = run({
      selfChampion: 'Syndra',
      selfPosition: 'MIDDLE',
      championStats: MAGE_STATS,
      selfItems: [3020, 3089, 3157, 3116],
      allies: [],
      enemies: [
        { champion: 'Ornn', level: 16, items: [4401, 2504, 3065] },
        { champion: 'Kaisa', level: 16, items: [3139, 3156] },
        { champion: 'Sejuani', level: 15, items: [4401, 2504] },
        { champion: 'Nautilus', level: 14, items: [2504, 3065] },
        { champion: 'Aatrox', level: 16, items: [3065, 3053] },
      ],
    })
    expect(topN(r, 3).some((x) => stat(x.itemId, 'magicPenetrationPercent') > 0)).toBe(true)
  })

  it('6. tank focus → primaire défensif, profil « tank »', () => {
    const r = run({
      selfChampion: 'Ornn',
      selfPosition: 'TOP',
      championStats: { attackDamage: 120, maxHealth: 3400, armor: 180, magicResist: 140, abilityHaste: 50 },
      selfItems: [3047, 3068, 3110, 3065],
      selfScores: { deaths: 7, kills: 1 },
      gameTime: 1600,
      allies: [],
      enemies: [
        { champion: 'Zed', level: 16, items: [3036, 6694], k: 12, d: 3 },
        { champion: 'Syndra', level: 16, items: [3089, 3135], k: 9, d: 3 },
        { champion: 'Caitlyn', level: 15, items: [3031, 3094] },
        { champion: 'LeeSin', level: 14 },
        { champion: 'Leona', level: 13 },
      ],
    })
    expect(r.context.weightProfile).toBe('tank')
    expect(isDefensive(r.primary!.itemId)).toBe(true)
  })

  it('7. carry vs CC dur (3 vanguards) → QSS/Quicksilver dans le top 3', () => {
    const r = run({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      championStats: ADC_STATS,
      selfItems: [3006, 3031, 3094, 3072],
      allies: [],
      enemies: [
        { champion: 'Leona', level: 14, pos: 'UTILITY' },
        { champion: 'Nautilus', level: 14 },
        { champion: 'Malphite', level: 15, pos: 'TOP' },
        { champion: 'Zed', level: 15, pos: 'MIDDLE', k: 9, d: 4 },
        { champion: 'Jinx', level: 14, pos: 'BOTTOM' },
      ],
    })
    expect(topN(r, 3).some((x) => descHas(x.itemId, /quicksilver|removes all crowd control/i))).toBe(true)
  })

  it('8. bottes : conseillées si absentes, choix orienté par la menace', () => {
    const magic = run({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      championStats: ADC_STATS,
      allies: [],
      enemies: [
        { champion: 'Syndra', level: 14, items: [3089], k: 8 },
        { champion: 'Leona', level: 12 },
        { champion: 'Nautilus', level: 12 },
        { champion: 'Veigar', level: 13, items: [3089] },
      ],
    })
    expect(magic.boots).not.toBeNull()
    expect(sd.getItem(magic.boots!.itemId)?.isBoots).toBe(true)

    const withBoots = run({
      selfChampion: 'Caitlyn',
      selfItems: [3006, 3031],
      allies: [],
      enemies: [{ champion: 'Zed' }],
    })
    expect(withBoots.boots).toBeNull()
  })

  it('9. enchanteur support → profil « utilitaire »', () => {
    const r = run({
      selfChampion: 'Soraka',
      selfPosition: 'UTILITY',
      selfSpells: ['Flash', 'Exhaust'],
      championStats: { abilityPower: 120, maxHealth: 1700, armor: 55, magicResist: 55, abilityHaste: 60 },
      selfItems: [3158, 3011, 6621],
      allies: [{ champion: 'Caitlyn', pos: 'BOTTOM' }],
      enemies: [
        { champion: 'Zed', pos: 'MIDDLE', k: 8, d: 4 },
        { champion: 'Jinx', pos: 'BOTTOM' },
        { champion: 'Leona', pos: 'UTILITY' },
      ],
    })
    expect(r.context.weightProfile).toBe('utilitaire')
    expect(r.primary).not.toBeNull()
  })

  // ─── Défense vs tempo (A4.1) ───

  const MAGE_MID = { abilityPower: 320, maxHealth: 1650, armor: 40, magicResist: 38, abilityHaste: 25 }
  const AD_MID = { attackDamage: 230, abilityHaste: 25, maxHealth: 1600, armor: 50, magicResist: 34, physicalLethality: 18 }

  it('11. mage vs Zed PEU fed → item de dégâts, pas de détour défensif', () => {
    const r = run({
      selfChampion: 'Syndra',
      selfPosition: 'MIDDLE',
      championStats: MAGE_MID,
      selfItems: [3020, 3089],
      gameTime: 900,
      allies: [{ champion: 'Ashe', pos: 'BOTTOM' }, { champion: 'Ornn', pos: 'TOP' }],
      enemies: [
        { champion: 'Zed', pos: 'MIDDLE', level: 11, k: 3, d: 3, a: 3 },
        { champion: 'Caitlyn', pos: 'BOTTOM', level: 11, k: 3, d: 3 },
        { champion: 'Malphite', pos: 'TOP', level: 11 },
        { champion: 'LeeSin', level: 10, spells: ['Smite', 'Flash'] },
        { champion: 'Nautilus', pos: 'UTILITY', level: 10 },
      ],
    })
    const p = r.primary!
    expect(stat(p.itemId, 'armor')).toBe(0)
    expect(stat(p.itemId, 'abilityPower')).toBeGreaterThan(0)
    expect(p.breakdown.tempo).toBeGreaterThan(-0.05)
  })

  it('12. mage vs Zed 12/1 et mage en retard → détour défensif (Zhonya/armure), justif citant Zed', () => {
    const r = run({
      selfChampion: 'Syndra',
      selfPosition: 'MIDDLE',
      championStats: { ...MAGE_MID, maxHealth: 1500 },
      selfItems: [3020, 3089],
      gameTime: 1100,
      selfScores: { kills: 1, deaths: 6, assists: 2 },
      allies: [{ champion: 'Ashe', pos: 'BOTTOM' }, { champion: 'Ornn', pos: 'TOP' }],
      enemies: [
        { champion: 'Zed', pos: 'MIDDLE', level: 14, k: 12, d: 1, a: 4, items: [6694, 3814] },
        { champion: 'Caitlyn', pos: 'BOTTOM', level: 11 },
        { champion: 'Malphite', pos: 'TOP', level: 11 },
        { champion: 'LeeSin', level: 11, spells: ['Smite', 'Flash'] },
        { champion: 'Nautilus', pos: 'UTILITY', level: 10 },
      ],
    })
    const p = r.primary!
    expect(stat(p.itemId, 'armor') > 0 || descHas(p.itemId, /\bstasis\b/i)).toBe(true)
    expect(p.reasons.join(' ')).toMatch(/Zed/)
  })

  it('13. mid AD vs Zed fed → défensif qui donne de l’AD (GA/Maw), jamais Zhonya', () => {
    const r = run({
      selfChampion: 'Zed',
      selfPosition: 'MIDDLE',
      championStats: AD_MID,
      selfItems: [6692, 3814],
      gameTime: 1200,
      selfScores: { kills: 3, deaths: 4, assists: 1 },
      allies: [{ champion: 'Ashe', pos: 'BOTTOM' }, { champion: 'Ornn', pos: 'TOP' }],
      enemies: [
        { champion: 'Zed', pos: 'MIDDLE', level: 15, k: 11, d: 2, a: 3, items: [6692, 6694, 3814] },
        { champion: 'Caitlyn', pos: 'BOTTOM', level: 13, items: [3031] },
        { champion: 'Malphite', pos: 'TOP', level: 13 },
        { champion: 'LeeSin', level: 12, spells: ['Smite', 'Flash'] },
        { champion: 'Nautilus', pos: 'UTILITY', level: 11 },
      ],
    })
    const defensive = topN(r, 3).filter((x) => isDefensive(x.itemId))
    expect(defensive.length).toBeGreaterThan(0)
    expect(defensive.every((x) => stat(x.itemId, 'attackDamage') > 0)).toBe(true)
    expect(r.primary!.name).not.toBe("Zhonya's Hourglass")
  })

  it('14. mid AD, 1 item, tôt, vs Zed 14/1 → primaire défensif + justif du compromis de tempo', () => {
    const r = run({
      selfChampion: 'Zed',
      selfPosition: 'MIDDLE',
      championStats: { attackDamage: 175, abilityHaste: 20, maxHealth: 1400, armor: 40, magicResist: 30, physicalLethality: 15 },
      selfItems: [6692],
      gameTime: 700,
      selfScores: { kills: 2, deaths: 4, assists: 1 },
      allies: [{ champion: 'Ashe', pos: 'BOTTOM' }, { champion: 'Ornn', pos: 'TOP' }],
      enemies: [
        { champion: 'Zed', pos: 'MIDDLE', level: 12, k: 14, d: 1, a: 2, items: [6692, 6694, 3814] },
        { champion: 'Caitlyn', pos: 'BOTTOM', level: 8 },
        { champion: 'Malphite', pos: 'TOP', level: 8 },
        { champion: 'LeeSin', level: 8, spells: ['Smite', 'Flash'] },
        { champion: 'Nautilus', pos: 'UTILITY', level: 7 },
      ],
    })
    const p = r.primary!
    expect(isDefensive(p.itemId)).toBe(true)
    // le compromis de tempo est nommé (détour / powerspike / reprise du build)
    expect(p.reasons.join(' ')).toMatch(/détour|powerspike|reprends ton build|assumé/i)
    // un mid AD ne se voit jamais conseiller le Sablier (0 AD → tempo écrasant)
    expect(topN(r, 3).every((x) => x.name !== "Zhonya's Hourglass")).toBe(true)
  })

  it('10. sortie complète : primaire + 2 alternatives + justifications non vides', () => {
    const r = run({
      selfChampion: 'Kaisa',
      selfPosition: 'BOTTOM',
      championStats: ADC_STATS,
      selfItems: [3006, 6672, 3094],
      allies: [{ champion: 'Ornn', pos: 'TOP' }, { champion: 'Soraka', pos: 'UTILITY' }],
      enemies: [
        { champion: 'Zed', pos: 'MIDDLE', k: 7, d: 3 },
        { champion: 'Caitlyn', pos: 'BOTTOM' },
        { champion: 'Malphite', pos: 'TOP' },
        { champion: 'LeeSin' },
        { champion: 'Nautilus', pos: 'UTILITY' },
      ],
    })
    expect(r.primary).not.toBeNull()
    expect(r.alternatives).toHaveLength(2)
    expect(r.primary!.reasons.length).toBeGreaterThan(0)
    expect(r.primary!.score).toBeGreaterThanOrEqual(r.alternatives[0].score)
    expect(r.context.threatSummary).toMatch(/phys.*mag.*vrai/)
  })
})
