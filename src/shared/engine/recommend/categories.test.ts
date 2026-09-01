import { describe, it, expect } from 'vitest'
import { categoriesOverlap, itemCategories, itemCategory } from './categories'
import { makeStaticData } from '../context/fixtures'

const sd = makeStaticData()
const cat = (id: number) => itemCategory(sd.getItem(id)!)

describe('itemCategory', () => {
  it('classe par fonction, du spécifique au générique', () => {
    expect(cat(3006)).toBe('boots') // Berserker's Greaves
    expect(cat(3165)).toBe('antiheal') // Morellonomicon (Grievous Wounds)
    expect(cat(3139)).toBe('qss') // Mercurial Scimitar
    expect(cat(3157)).toBe('stasis') // Zhonya's Hourglass
    expect(cat(3155)).toBe('lifeline') // Hexdrinker
    expect(cat(3036)).toBe('armor-pen') // Lord Dominik's Regards
    expect(cat(3135)).toBe('magic-pen') // Void Staff
    expect(cat(3143)).toBe('armor') // Randuin's Omen (PV + armure, pas de pen)
    expect(cat(3065)).toBe('magic-resist') // Spirit Visage
    expect(cat(3031)).toBe('crit') // Infinity Edge
    expect(cat(3089)).toBe('ability-power') // Rabadon's
    expect(cat(3072)).toBe('attack-damage') // Bloodthirster
  })

  it('un item peut appartenir à plusieurs catégories', () => {
    // Vestige mortel (fixture 3033 absent → on prend Morellonomicon 3165 : antisoin + PV + AP)
    const cats = itemCategories(sd.getItem(3165)!)
    expect(cats).toContain('antiheal')
    expect(cats.length).toBeGreaterThan(1)
  })

  it('categoriesOverlap : intersection non vide', () => {
    // Zhonya (stasis/armure/AP) vs Sablier des chercheurs (stasis/armure/AP)
    expect(categoriesOverlap(sd.getItem(3157)!, sd.getItem(2420)!)).toBe(true)
    // Infinity Edge (crit/AD) vs Rabadon (AP) → aucun recoupement
    expect(categoriesOverlap(sd.getItem(3031)!, sd.getItem(3089)!)).toBe(false)
  })
})
