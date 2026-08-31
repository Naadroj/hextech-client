import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Frame } from './Frame'

describe('Frame', () => {
  it('rend le titre en h2 et le contenu', () => {
    render(
      <Frame title="Classement">
        <p>corps</p>
      </Frame>,
    )
    expect(screen.getByRole('heading', { name: 'Classement' })).toBeInTheDocument()
    expect(screen.getByText('corps')).toBeInTheDocument()
  })

  it('rend headerRight', () => {
    render(
      <Frame title="Lobby" headerRight="Phase : Lobby">
        x
      </Frame>,
    )
    expect(screen.getByText('Phase : Lobby')).toBeInTheDocument()
  })

  it('applique la classe hx-frame et les classes fournies', () => {
    const { container } = render(<Frame className="max-w-xl">x</Frame>)
    expect(container.firstChild).toHaveClass('hx-frame', 'max-w-xl')
  })

  it('sans titre : pas de heading', () => {
    render(<Frame>x</Frame>)
    expect(screen.queryByRole('heading')).toBeNull()
  })
})
