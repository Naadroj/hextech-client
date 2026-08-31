import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayButton } from './PlayButton'

describe('PlayButton', () => {
  it('affiche « Jouer » par défaut et déclenche onClick', async () => {
    const onClick = vi.fn()
    render(<PlayButton onClick={onClick} />)
    const btn = screen.getByRole('button', { name: /jouer/i })
    expect(btn).toHaveClass('hx-play')
    await userEvent.click(btn)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('mode recherche : classe cancel + libellé + minuterie', () => {
    render(<PlayButton searching elapsedLabel="1:23" />)
    const btn = screen.getByRole('button', { name: /annuler/i })
    expect(btn).toHaveClass('hx-play--cancel')
    expect(screen.getByText('1:23')).toBeInTheDocument()
  })

  it('respecte disabled', async () => {
    const onClick = vi.fn()
    render(<PlayButton disabled onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
