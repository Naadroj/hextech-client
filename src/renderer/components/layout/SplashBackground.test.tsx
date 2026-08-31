import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { SplashBackground } from './SplashBackground'
import { stubLcuBridge, clearLcuBridge } from '../../test-utils'

afterEach(() => clearLcuBridge())

describe('SplashBackground', () => {
  it('ne demande pas de splash si déconnecté', () => {
    const ctx = stubLcuBridge()
    render(<SplashBackground connected={false} />)
    expect(ctx.bridge.getSplashBackground).not.toHaveBeenCalled()
  })

  it('applique le splash récupéré comme image de fond', async () => {
    stubLcuBridge({ getSplashBackground: vi.fn(async () => 'data:image/jpeg;base64,AAAA') })
    const { container } = render(<SplashBackground connected />)
    await waitFor(() => {
      const splash = container.querySelector('.hx-bg__splash') as HTMLElement | null
      expect(splash).not.toBeNull()
      expect(splash?.style.backgroundImage).toContain('data:image/jpeg;base64,AAAA')
    })
  })

  it('sans splash : rend seulement la texture', async () => {
    const ctx = stubLcuBridge()
    const { container } = render(<SplashBackground connected />)
    await waitFor(() => expect(ctx.bridge.getSplashBackground).toHaveBeenCalled())
    expect(container.querySelector('.hx-bg__splash')).toBeNull()
    expect(container.querySelector('.hx-bg__grid')).not.toBeNull()
  })

  it('ne plante pas sans preload', () => {
    clearLcuBridge()
    expect(() => render(<SplashBackground connected />)).not.toThrow()
  })
})
