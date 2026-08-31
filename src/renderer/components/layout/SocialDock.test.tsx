import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SocialDock } from './SocialDock'

describe('SocialDock', () => {
  it('est déplié par défaut et affiche les groupes', () => {
    render(<SocialDock />)
    expect(screen.getByRole('complementary', { name: 'Amis' })).toBeInTheDocument()
    expect(screen.getByText('En jeu')).toBeInTheDocument()
    expect(screen.getByText('Hors ligne')).toBeInTheDocument()
  })

  it('se replie puis se déplie', async () => {
    render(<SocialDock />)
    await userEvent.click(screen.getByRole('button', { name: /replier le panneau des amis/i }))
    expect(screen.getByRole('complementary', { name: 'Amis (replié)' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /déplier le panneau des amis/i }))
    expect(screen.getByRole('complementary', { name: 'Amis' })).toBeInTheDocument()
  })
})
