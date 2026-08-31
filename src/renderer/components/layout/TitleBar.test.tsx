import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TitleBar } from './TitleBar'

const minimize = vi.fn()
const toggleMaximize = vi.fn()
const close = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as unknown as { app: unknown }).app = {
    windowControls: {
      minimize,
      toggleMaximize,
      close,
      isMaximized: vi.fn().mockResolvedValue(false),
    },
  }
})

describe('TitleBar', () => {
  it('appelle windowControls.minimize', async () => {
    render(<TitleBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Réduire' }))
    expect(minimize).toHaveBeenCalledTimes(1)
  })

  it('appelle windowControls.toggleMaximize', async () => {
    render(<TitleBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Agrandir ou restaurer' }))
    expect(toggleMaximize).toHaveBeenCalledTimes(1)
  })

  it('appelle windowControls.close', async () => {
    render(<TitleBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('ne plante pas quand window.app est absent', async () => {
    delete (window as unknown as { app?: unknown }).app
    render(<TitleBar />)
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(close).not.toHaveBeenCalled()
  })
})
