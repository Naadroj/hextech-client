import { describe, it, expect, vi } from 'vitest'

// `overlay.ts` importe `electron` (BrowserWindow/screen/shell) au niveau module.
// On le neutralise : seules les fonctions pures sont testées ici.
vi.mock('electron', () => ({
  BrowserWindow: class {},
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {},
}))

const { dragBoundsFor, overlayShouldShow } = await import('./overlay')

describe('dragBoundsFor', () => {
  it('déplace la fenêtre sans jamais changer sa taille', () => {
    const size = { width: 340, height: 260 }
    const offset = { x: 20, y: 10 }

    const a = dragBoundsFor({ x: 500, y: 400 }, offset, size)
    const b = dragBoundsFor({ x: 900, y: 650 }, offset, size)

    expect(a).toEqual({ x: 480, y: 390, width: 340, height: 260 })
    expect(b).toEqual({ x: 880, y: 640, width: 340, height: 260 })
    // La largeur/hauteur restent identiques quel que soit le curseur
    expect(b.width).toBe(a.width)
    expect(b.height).toBe(a.height)
  })

  it('arrondit les coordonnées fractionnaires (anti-drift DPI)', () => {
    const r = dragBoundsFor({ x: 100.6, y: 200.4 }, { x: 0.2, y: 0.7 }, { width: 340.9, height: 260.1 })
    expect(r).toEqual({ x: 100, y: 200, width: 341, height: 260 })
  })
})

describe('overlayShouldShow', () => {
  const base = {
    enabled: true,
    isDev: false,
    dragging: false,
    gameActive: true,
    gameForeground: false,
    foregroundUnavailable: false,
  }

  it('caché si désactivé', () => {
    expect(overlayShouldShow({ ...base, enabled: false, gameForeground: true })).toBe(false)
  })

  it('caché hors partie, même si la fenêtre est au premier plan', () => {
    expect(overlayShouldShow({ ...base, gameActive: false, gameForeground: true })).toBe(false)
  })

  it('visible seulement quand le jeu est au premier plan', () => {
    expect(overlayShouldShow({ ...base, gameForeground: false })).toBe(false)
    expect(overlayShouldShow({ ...base, gameForeground: true })).toBe(true)
  })

  it('visible pendant un déplacement même si le jeu n’est pas au premier plan', () => {
    expect(overlayShouldShow({ ...base, dragging: true })).toBe(true)
  })

  it('visible en dev (pas de gate premier-plan)', () => {
    expect(overlayShouldShow({ ...base, isDev: true, gameActive: false })).toBe(true)
  })

  it('visible si la détection de premier plan est HS (ne pas piéger l’utilisateur)', () => {
    expect(overlayShouldShow({ ...base, foregroundUnavailable: true })).toBe(true)
    // …mais toujours pas hors partie.
    expect(
      overlayShouldShow({ ...base, gameActive: false, foregroundUnavailable: true }),
    ).toBe(false)
  })
})
