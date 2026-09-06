import { describe, it, expect } from 'vitest'
import { recommend } from './index'
import { assessGame } from '../context'
import { makeLiveGame, makeStaticData } from '../context/fixtures'
import type { ItemRecommendation } from './types'

/**
 * Ces justifications sont affichées juste sous l'item : le lecteur les prend
 * pour sa raison d'être. Une phrase qui décrit la partie mais pas l'item passe
 * pour un mensonge sur un fait vérifiable — c'est ce qui a produit les « wtf »
 * du 6 septembre 2026.
 */

const sd = makeStaticData()
const all = (o: Parameters<typeof makeLiveGame>[0]): ItemRecommendation[] => {
  const rec = recommend(assessGame(makeLiveGame(o), sd)!, sd)
  return [rec.primary, ...rec.alternatives].filter((x): x is ItemRecommendation => !!x)
}

describe('justifications d’axe de menace', () => {
  it('ne promet de la résistance magique que sur un item qui en donne', () => {
    // Équipe adverse très magique : le déclencheur est armé pour tout le monde.
    const picks = all({
      selfChampion: 'Caitlyn',
      allies: [],
      enemies: [{ champion: 'Syndra' }, { champion: 'Soraka' }, { champion: 'Malphite' }],
      selfGold: 3500,
    })
    expect(picks.length).toBeGreaterThan(0)
    for (const p of picks) {
      if (p.reasons.some((r) => r.includes('résistance magique'))) {
        expect(sd.getItem(p.itemId)?.stats.magicResist ?? 0).toBeGreaterThan(0)
      }
    }
  })

  it('ne promet de l’armure que sur un item qui en donne', () => {
    const picks = all({
      selfChampion: 'Syndra',
      allies: [],
      enemies: [{ champion: 'Caitlyn' }, { champion: 'Zed' }, { champion: 'LeeSin' }],
      selfGold: 3500,
    })
    expect(picks.length).toBeGreaterThan(0)
    for (const p of picks) {
      if (p.reasons.some((r) => r.includes('→ armure'))) {
        expect(sd.getItem(p.itemId)?.stats.armor ?? 0).toBeGreaterThan(0)
      }
    }
  })

  it('ne parle pas de « courbe de dégâts » à un enchanteur', () => {
    // Soraka n'a pas de courbe de dégâts à préserver : son or utile part
    // ailleurs. Signalé sur un Thresh (Morellonomicon justifié ainsi).
    const picks = all({
      selfChampion: 'Soraka',
      allies: [],
      enemies: [{ champion: 'Caitlyn' }, { champion: 'Zed' }, { champion: 'LeeSin' }],
      selfGold: 3500,
    })
    for (const p of picks) {
      expect(p.reasons.some((r) => r.includes('courbe de dégâts'))).toBe(false)
    }
  })
})
