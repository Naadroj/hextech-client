import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopNav, type NavItem } from './TopNav'

const items: NavItem[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'lobby', label: 'Jouer' },
]

describe('TopNav', () => {
  it('marque uniquement l’onglet actif', () => {
    render(<TopNav items={items} activeId="lobby" onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Jouer' })).toHaveAttribute('data-active', 'true')
    expect(screen.getByRole('button', { name: 'Accueil' })).toHaveAttribute('data-active', 'false')
    expect(screen.getByRole('button', { name: 'Jouer' })).toHaveAttribute('aria-current', 'page')
  })

  it('remonte l’identifiant sélectionné', async () => {
    const onSelect = vi.fn()
    render(<TopNav items={items} activeId="home" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: 'Jouer' }))
    expect(onSelect).toHaveBeenCalledWith('lobby')
  })

  it('rend la zone de droite', () => {
    render(
      <TopNav items={items} activeId="home" onSelect={() => {}} right={<span>badge</span>} />,
    )
    expect(screen.getByText('badge')).toBeInTheDocument()
  })
})
