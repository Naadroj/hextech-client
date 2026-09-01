import { describe, it, expect } from 'vitest'
import { recommend } from './index'
import { assessGame } from '../context'
import { makeStaticData, makeLiveGame } from '../context/fixtures'

const sd = makeStaticData()
const rec = (o: Parameters<typeof makeLiveGame>[0]) => recommend(assessGame(makeLiveGame(o), sd)!, sd)

describe('recommend', () => {
  it('produit un primaire, 2 alternatives et un contexte', () => {
    const r = rec({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      allies: [],
      enemies: [{ champion: 'Zed' }, { champion: 'Syndra' }, { champion: 'Malphite' }],
    })
    expect(r.primary).not.toBeNull()
    expect(r.alternatives).toHaveLength(2)
    expect(r.primary!.score).toBeGreaterThanOrEqual(r.alternatives[0].score)
    expect(r.primary!.reasons.length).toBeGreaterThan(0)
    expect(r.context.weightProfile).toBe('carry')
    expect(r.context.threatSummary).toMatch(/phys/)
  })

  it('reste robuste si des champions / items sont inconnus du catalogue', () => {
    const r = rec({
      selfChampion: 'ChampInexistant',
      selfItems: [999999, 3006],
      allies: [],
      enemies: [{ champion: 'Zed', items: [888888] }, { champion: 'Inconnu' }],
    })
    expect(r.primary).not.toBeNull()
    expect(r.primary!.reasons.length).toBeGreaterThan(0)
    expect(Number.isFinite(r.primary!.score)).toBe(true)
  })

  it('conseille des bottes seulement si le joueur n’en a pas', () => {
    const without = rec({ selfChampion: 'Caitlyn', allies: [], enemies: [{ champion: 'Zed' }] })
    expect(without.boots).not.toBeNull()
    const withBoots = rec({
      selfChampion: 'Caitlyn',
      selfItems: [3006],
      allies: [],
      enemies: [{ champion: 'Zed' }],
    })
    expect(withBoots.boots).toBeNull()
  })

  it('face à une équipe magique, oriente vers de la résistance magique', () => {
    const r = rec({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      championStats: { maxHealth: 1500, armor: 50, magicResist: 30, attackDamage: 150 },
      allies: [],
      enemies: [
        { champion: 'Syndra', level: 14, items: [3089], k: 9, d: 2 },
        { champion: 'Soraka', level: 12 },
        { champion: 'Malphite', level: 12 },
      ],
    })
    const top3 = [r.primary!, ...r.alternatives]
    expect(top3.some((x) => (sd.getItem(x.itemId)?.stats.magicResist ?? 0) > 0)).toBe(true)
  })

  it('menace vive + tôt + peu d’or utile : bascule en reco de composant défensif', () => {
    const r = rec({
      selfChampion: 'Zed',
      selfPosition: 'MIDDLE',
      championStats: { attackDamage: 170, abilityHaste: 15, maxHealth: 1350, armor: 38, magicResist: 30, physicalLethality: 12 },
      selfItems: [3072],
      gameTime: 680,
      selfScores: { kills: 2, deaths: 4, assists: 1 },
      allies: [{ champion: 'Caitlyn', pos: 'BOTTOM' }],
      enemies: [
        { champion: 'Zed', pos: 'MIDDLE', level: 11, k: 13, d: 1, a: 2, items: [3031, 3072] },
        { champion: 'Caitlyn', pos: 'BOTTOM', level: 8 },
        { champion: 'LeeSin', level: 8, spells: ['Smite', 'Flash'] },
      ],
    })
    expect(r.primary!.kind).toBe('component')
    expect(r.primary!.goldTotal).toBeLessThanOrEqual(1700)
    expect(r.primary!.reasons.join(' ')).toMatch(/reprends ton build/i)
    // l'item complet visé reste proposé en alternative
    expect(r.alternatives.some((x) => x.kind === 'legendary')).toBe(true)
  })

  it('face à une équipe qui stacke l’armure, propose de la pénétration d’armure', () => {
    const r = rec({
      selfChampion: 'Caitlyn',
      selfPosition: 'BOTTOM',
      championStats: { attackDamage: 200, attackSpeed: 1.4, critChance: 0.6, maxHealth: 1600, armor: 60 },
      allies: [],
      enemies: [
        { champion: 'Malphite', level: 15, items: [3068, 3143] },
        { champion: 'Aatrox', level: 15, items: [3068] },
        { champion: 'LeeSin', level: 14, items: [3047] },
      ],
    })
    const top3 = [r.primary!, ...r.alternatives]
    expect(top3.some((x) => (sd.getItem(x.itemId)?.stats.armorPenetrationPercent ?? 0) > 0)).toBe(true)
  })
})
