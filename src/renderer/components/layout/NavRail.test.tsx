import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NavRail, type NavItem } from './NavRail'

const items: NavItem[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'lobby', label: 'Lobby' },
]

describe('NavRail', () => {
  it('marque uniquement l’élément actif', () => {
    render(<NavRail items={items} activeId="lobby" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Lobby' })).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('button', { name: 'Accueil' })).toHaveAttribute('data-active', 'false')
  })

  it('remonte l’identifiant sélectionné', async () => {
    const onSelect = vi.fn()
    render(<NavRail items={items} activeId="home" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: 'Lobby' }))
    expect(onSelect).toHaveBeenCalledWith('lobby')
  })
})
