import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OverlayView } from './Overlay'
import { clearLcuBridge, makeCoachAdvice, stubLcuBridge } from '../test-utils'
import { IDLE_ADVICE } from '@shared/coach-types'

/** `makeCoachAdvice` : 1450 or, 930 s de jeu → ne doivent jamais s'afficher. */
const GOLD = /1450\s*or/
const TIMER = /15:30/

describe('OverlayView — mode réduit (défaut)', () => {
  beforeEach(() => stubLcuBridge())
  afterEach(() => clearLcuBridge())

  it('n’affiche que l’icône du prochain item, sans son nom', () => {
    render(<OverlayView advice={makeCoachAdvice()} />)
    expect(screen.getByTitle('Cimeterre mercuriel')).toBeInTheDocument()
    expect(screen.queryByText('Cimeterre mercuriel')).not.toBeInTheDocument()
  })

  it('n’affiche ni or ni chrono', () => {
    render(<OverlayView advice={makeCoachAdvice()} />)
    expect(screen.queryByText(GOLD)).not.toBeInTheDocument()
    expect(screen.queryByText(TIMER)).not.toBeInTheDocument()
  })

  it('n’expose pas de bouton fermer (on passe par l’app)', () => {
    render(<OverlayView advice={makeCoachAdvice()} />)
    expect(screen.queryByLabelText('Fermer l’overlay')).not.toBeInTheDocument()
  })

  it('le bouton bug signale en un clic, sans déplier ni rien demander', async () => {
    // En pleine partie, choisir un motif dans une liste coûtait plus d'attention
    // que ça n'en valait la peine : il se choisit à froid, dans l'onglet.
    const { feedback, overlay } = stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Signaler un item incohérent'))

    expect(feedback.report).toHaveBeenCalledWith({
      itemId: 3139,
      itemRank: 0,
      reasonCode: 'other',
    })
    // Il ne déplie plus rien : en mode réduit l'accusé de réception est le ✓.
    expect(overlay.setCompact).not.toHaveBeenCalledWith(false)
    expect(await screen.findByText('✓')).toBeInTheDocument()
  })

  it('reste déplaçable', () => {
    const { overlay } = stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.mouseDown(screen.getByLabelText('Déplacer l’overlay'), { button: 0 })
    expect(overlay.dragStart).toHaveBeenCalledOnce()
    fireEvent.mouseUp(window)
    expect(overlay.dragEnd).toHaveBeenCalledOnce()
  })

})

describe('OverlayView — dépliage', () => {
  beforeEach(() => stubLcuBridge())
  afterEach(() => clearLcuBridge())

  it('la flèche déplie le détail et prévient le process principal', async () => {
    const { overlay } = stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)

    fireEvent.click(screen.getByLabelText('Déplier'))
    expect(overlay.setCompact).toHaveBeenCalledWith(false)

    // Détail : nom, prix, raison, chemin de build.
    expect(await screen.findByText('Cimeterre mercuriel')).toBeInTheDocument()
    expect(screen.getByText(/3200 or/)).toBeInTheDocument()
    expect(screen.getByText(/résistance magique/i)).toBeInTheDocument()
    expect(screen.getByTitle(/Salutations de Dominik/)).toBeInTheDocument()
  })

  it('les motifs n’apparaissent qu’après un clic sur le bug', () => {
    stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Déplier'))
    expect(screen.queryByText('Mauvais axe AD/AP')).not.toBeInTheDocument()
  })

  it('met le rapport en file et accuse réception, sans rien envoyer en réseau', async () => {
    const { feedback } = stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Déplier'))
    fireEvent.click(screen.getByLabelText('Signaler un item incohérent'))

    expect(feedback.report).toHaveBeenCalledWith({
      itemId: 3139,
      itemRank: 0,
      reasonCode: 'other',
    })
    // Le rapport attend dans l'onglet Signalements : rien ne part d'ici.
    expect(feedback.push).not.toHaveBeenCalled()
    expect(await screen.findByText(/onglet Signalements/)).toBeInTheDocument()
  })

  it('ne demande plus de motif en jeu', () => {
    stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Déplier'))
    fireEvent.click(screen.getByLabelText('Signaler un item incohérent'))
    expect(screen.queryByText(/Qu’est-ce qui cloche/)).not.toBeInTheDocument()
    expect(screen.queryByText('Mauvais axe AD/AP')).not.toBeInTheDocument()
  })

  it('déplié, toujours ni or ni chrono', () => {
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Déplier'))
    expect(screen.queryByText(GOLD)).not.toBeInTheDocument()
    expect(screen.queryByText(TIMER)).not.toBeInTheDocument()
  })

  it('replie et repasse en mode réduit', () => {
    const { overlay } = stubLcuBridge()
    render(<OverlayView advice={makeCoachAdvice()} />)
    fireEvent.click(screen.getByLabelText('Déplier'))
    fireEvent.click(screen.getByLabelText('Replier'))
    expect(overlay.setCompact).toHaveBeenLastCalledWith(true)
    expect(screen.queryByText('Cimeterre mercuriel')).not.toBeInTheDocument()
  })

  it('hors partie, le détail affiche un message d’attente', () => {
    render(<OverlayView advice={IDLE_ADVICE} />)
    fireEvent.click(screen.getByLabelText('Déplier'))
    expect(screen.getByText(/aucune partie en cours/i)).toBeInTheDocument()
  })

  it('restaure le mode persisté au montage', async () => {
    stubLcuBridge({}, {}, {}, {}, {}, {
      getState: async () => ({ enabled: true, compact: false, bounds: null }),
    })
    render(<OverlayView advice={makeCoachAdvice()} />)
    await waitFor(() => expect(screen.getByText('Cimeterre mercuriel')).toBeInTheDocument())
  })
})
