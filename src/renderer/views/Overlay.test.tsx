import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OverlayView } from './Overlay'
import { clearLcuBridge, makeCoachAdvice, stubLcuBridge } from '../test-utils'
import { IDLE_ADVICE } from '@shared/coach-types'

describe('OverlayView', () => {
  beforeEach(() => stubLcuBridge())
  afterEach(() => clearLcuBridge())

  it('affiche l’item conseillé, son prix et la première raison', () => {
    render(<OverlayView advice={makeCoachAdvice()} />)
    expect(screen.getByText('Cimeterre mercuriel')).toBeInTheDocument()
    expect(screen.getByText(/3200 or/)).toBeInTheDocument()
    expect(screen.getByText(/résistance magique/i)).toBeInTheDocument()
    expect(screen.getByText('Caitlyn')).toBeInTheDocument()
  })

  it('se replie et se déplie', () => {
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Replier'))
    expect(screen.queryByText('Cimeterre mercuriel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Déplier'))
    expect(screen.getByText('Cimeterre mercuriel')).toBeInTheDocument()
  })

  it('hors partie, affiche un message d’attente', () => {
    render(<OverlayView advice={IDLE_ADVICE} />)
    expect(screen.getByText(/aucune partie en cours/i)).toBeInTheDocument()
  })

  it('le bouton fermer désactive l’overlay', () => {
    const { overlay } = stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Fermer l’overlay'))
    expect(overlay.setEnabled).toHaveBeenCalledWith(false)
  })
})
