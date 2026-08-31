import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App', () => {
  it('rend la barre de titre, la navigation et la vitrine par défaut', () => {
    render(<App />)
    expect(screen.getByText('Hextech Client')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Navigation principale' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Design System Hextech/i }),
    ).toBeInTheDocument()
  })

  it('bascule vers une vue placeholder au clic sur un item de nav', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Lobby' }))
    expect(screen.getByRole('heading', { name: 'Lobby' })).toBeInTheDocument()
    expect(screen.getByText(/à implémenter dans une phase ultérieure/i)).toBeInTheDocument()
  })
})
