import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('affiche le libellé, la classe de base et type=button', () => {
    render(<Button>Jouer</Button>)
    const btn = screen.getByRole('button', { name: 'Jouer' })
    expect(btn).toHaveClass('hx-btn')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('applique la classe de variante accept', () => {
    render(<Button variant="accept">Accepter</Button>)
    expect(screen.getByRole('button', { name: 'Accepter' })).toHaveClass('hx-btn--accept')
  })

  it('applique la classe de variante ban', () => {
    render(<Button variant="ban">Bannir</Button>)
    expect(screen.getByRole('button', { name: 'Bannir' })).toHaveClass('hx-btn--ban')
  })

  it('conserve les classes fournies via className', () => {
    render(<Button className="w-full">X</Button>)
    const btn = screen.getByRole('button', { name: 'X' })
    expect(btn).toHaveClass('hx-btn', 'w-full')
  })

  it('déclenche onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche pas onClick quand disabled', async () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
