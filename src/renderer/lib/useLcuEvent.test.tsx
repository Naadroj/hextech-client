import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLcuEvent } from './useLcuEvent'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

let ctx: ReturnType<typeof stubLcuBridge>

beforeEach(() => {
  ctx = stubLcuBridge()
})
afterEach(() => clearLcuBridge())

describe('useLcuEvent', () => {
  it('n’appelle le handler que pour les URIs préfixées', () => {
    const handler = vi.fn()
    renderHook(() => useLcuEvent('/lol-gameflow/', handler))

    ctx.emitters.event?.({ eventType: 'Update', uri: '/lol-gameflow/v1/gameflow-phase', data: 1 })
    ctx.emitters.event?.({ eventType: 'Update', uri: '/lol-chat/v1/me', data: 2 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ uri: '/lol-gameflow/v1/gameflow-phase' }),
    )
  })

  it('accepte une liste de préfixes', () => {
    const handler = vi.fn()
    renderHook(() => useLcuEvent(['/lol-gameflow/', '/lol-chat/'], handler))
    ctx.emitters.event?.({ eventType: 'Create', uri: '/lol-chat/v1/me', data: {} })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('se désabonne au démontage', () => {
    const { unmount } = renderHook(() => useLcuEvent('/x', vi.fn()))
    unmount()
    expect(ctx.unsubscribe).toHaveBeenCalled()
  })

  it('ne plante pas si le preload est absent', () => {
    clearLcuBridge()
    expect(() => renderHook(() => useLcuEvent('/x', vi.fn()))).not.toThrow()
  })
})
