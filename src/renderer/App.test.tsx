import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { clearLcuBridge } from './test-utils'

afterEach(() => clearLcuBridge())

describe('App', () => {
  it('affiche la vue Accueil par défaut, la navigation et le badge de statut', () => {
    render(<App />)
    expect(screen.getByText('Hextech Client')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accueil' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/client non détecté/i)
    expect(screen.getByText(/en attente du client league of legends/i)).toBeInTheDocument()
  })

  it('bascule vers la vue Jouer', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Jouer' }))
    expect(screen.getByRole('heading', { name: 'Lobby' })).toBeInTheDocument()
    expect(screen.getByText(/lance le client officiel pour créer un lobby/i)).toBeInTheDocument()
  })

  it('bascule vers la galerie de composants', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Composants' }))
    expect(screen.getByRole('heading', { name: /Design System Hextech/i })).toBeInTheDocument()
  })

  it('affiche un placeholder pour les vues non implémentées', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Sélection' }))
    expect(screen.getByText(/à implémenter dans une phase ultérieure/i)).toBeInTheDocument()
  })
})
