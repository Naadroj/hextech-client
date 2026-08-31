import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useGameflow } from './useGameflow'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

describe('useGameflow', () => {
  it('lit la phase initiale quand connecté', async () => {
    stubLcuBridge({
      read: vi.fn(async () => ({ status: 200, ok: true, data: 'Lobby' })) as never,
    })
    const { result } = renderHook(() => useGameflow(true))
    await waitFor(() => expect(result.current).toBe('Lobby'))
  })

  it('reste "None" si déconnecté', () => {
    stubLcuBridge()
    const { result } = renderHook(() => useGameflow(false))
    expect(result.current).toBe('None')
  })

  it('suit les événements gameflow-phase', async () => {
    const ctx = stubLcuBridge({
      read: vi.fn(async () => ({ status: 200, ok: true, data: 'None' })) as never,
    })
    const { result } = renderHook(() => useGameflow(true))
    await waitFor(() => expect(result.current).toBe('None'))

    act(() =>
      ctx.emitters.event?.({
        eventType: 'Update',
        uri: '/lol-gameflow/v1/gameflow-phase',
        data: 'Matchmaking',
      }),
    )
    await waitFor(() => expect(result.current).toBe('Matchmaking'))

    act(() =>
      ctx.emitters.event?.({
        eventType: 'Delete',
        uri: '/lol-gameflow/v1/gameflow-phase',
        data: null,
      }),
    )
    await waitFor(() => expect(result.current).toBe('None'))
  })
})
