import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('affiche la vue Accueil par défaut, la navigation et le badge de statut', () => {
    render(<App />)
    expect(screen.getByText('Hextech Client')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Accueil' })).toBeInTheDocument()
    // Sans preload, la connexion reste "idle".
    expect(screen.getByRole('status')).toHaveTextContent(/client non détecté/i)
    expect(screen.getByText(/en attente du client league of legends/i)).toBeInTheDocument()
  })

  it('bascule vers la Kitchen Sink', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Kitchen Sink' }))
    expect(screen.getByRole('heading', { name: /Design System Hextech/i })).toBeInTheDocument()
  })

  it('bascule vers une vue placeholder', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Champ Select' }))
    expect(screen.getByText(/à implémenter dans une phase ultérieure/i)).toBeInTheDocument()
  })
})
