import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoachView } from './Coach'
import { stubLcuBridge, clearLcuBridge, makeCoachAdvice } from '../test-utils'
import { IDLE_ADVICE } from '@shared/coach-types'

afterEach(() => clearLcuBridge())

describe('CoachView', () => {
  it('état hors partie : message d’attente', () => {
    stubLcuBridge()
    render(<CoachView advice={IDLE_ADVICE} />)
    expect(screen.getByText(/Aucune partie en cours/i)).toBeInTheDocument()
  })

  it('affiche le champion, l’item conseillé, ses raisons et la menace', () => {
    stubLcuBridge()
    render(<CoachView advice={makeCoachAdvice()} />)

    expect(screen.getByRole('heading', { name: 'Caitlyn' })).toBeInTheDocument()
    expect(screen.getByText('Cimeterre mercuriel')).toBeInTheDocument()
    expect(screen.getByText(/manque 1750/)).toBeInTheDocument()
    expect(screen.getByText(/60 % magique/)).toBeInTheDocument()

    // alternatives + bottes
    expect(screen.getByText('Gueule de Malmortius')).toBeInTheDocument()
    expect(screen.getByText('Bottes de Mercure')).toBeInTheDocument()

    // menace : barres + menace principale
    expect(screen.getByText('Burst 55%')).toBeInTheDocument()
    expect(screen.getByText('Syndra')).toBeInTheDocument()
    expect(screen.getByText('(en avance)')).toBeInTheDocument() // marqueur menace fed
    expect(screen.getByText('En avance')).toBeInTheDocument() // tag fed du joueur
  })

  it('gère une reco absente sans planter', () => {
    stubLcuBridge()
    render(<CoachView advice={makeCoachAdvice({ recommendation: null })} />)
    expect(screen.getByText(/Pas encore de recommandation/i)).toBeInTheDocument()
  })
})
