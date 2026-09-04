import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OverlayView } from '../views/Overlay'
import { CoachView } from '../views/Coach'
import { clearLcuBridge, makeCoachAdvice, stubLcuBridge } from '../test-utils'

/**
 * Le segmenté n'apparaît que pour les couples champion + rôle dont le livre de
 * builds a deux variantes (`axisSwitchAvailable`). Ailleurs il n'y a rien à
 * arbitrer et un bouton de plus serait du bruit.
 */

describe('AxisSwitch — vue Coach', () => {
  beforeEach(() => stubLcuBridge())
  afterEach(() => clearLcuBridge())

  it('reste caché quand le champion n’a pas de variante d’axe', () => {
    render(<CoachView advice={makeCoachAdvice({ axisSwitchAvailable: false })} />)
    expect(screen.queryByRole('group', { name: 'Axe de dégâts' })).not.toBeInTheDocument()
  })

  it('s’affiche sur un champion bimodal, « Auto » actif par défaut', () => {
    render(<CoachView advice={makeCoachAdvice({ axisSwitchAvailable: true })} />)
    expect(screen.getByRole('group', { name: 'Axe de dégâts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'AD' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('un clic sur AP force l’axe côté main et bascule tout de suite', async () => {
    const { coach } = stubLcuBridge()
    render(<CoachView advice={makeCoachAdvice({ axisSwitchAvailable: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'AP' }))
    expect(coach.setAxis).toHaveBeenCalledWith('magic')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'AP' })).toHaveAttribute('aria-pressed', 'true'),
    )
  })

  it('reflète l’axe déjà forcé côté main', () => {
    render(<CoachView advice={makeCoachAdvice({ axisSwitchAvailable: true, axisOverride: 'physical' })} />)
    expect(screen.getByRole('button', { name: 'AD' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('AxisSwitch — overlay', () => {
  beforeEach(() => stubLcuBridge())
  afterEach(() => clearLcuBridge())

  it('mode réduit : pastille AD/AP seulement quand l’axe est forcé', () => {
    const { rerender } = render(
      <OverlayView advice={makeCoachAdvice({ axisSwitchAvailable: true })} />,
    )
    expect(screen.queryByLabelText(/Axe forcé/)).not.toBeInTheDocument()
    rerender(
      <OverlayView advice={makeCoachAdvice({ axisSwitchAvailable: true, axisOverride: 'magic' })} />,
    )
    expect(screen.getByLabelText('Axe forcé AP')).toBeInTheDocument()
  })

  it('mode réduit : pas de segmenté, il n’y a pas la place', () => {
    render(<OverlayView advice={makeCoachAdvice({ axisSwitchAvailable: true })} />)
    expect(screen.queryByRole('group', { name: 'Axe de dégâts' })).not.toBeInTheDocument()
  })

  it('mode déplié : le segmenté est là et pilote le main', async () => {
    const { coach } = stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice({ axisSwitchAvailable: true })} />)
    fireEvent.click(screen.getByLabelText('Déplier'))
    const group = await screen.findByRole('group', { name: 'Axe de dégâts' })
    expect(group).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'AD' }))
    expect(coach.setAxis).toHaveBeenCalledWith('physical')
  })
})
