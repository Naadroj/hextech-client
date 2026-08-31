import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { ConnectionInfo } from '@shared/lcu-types'
import { useLcuConnection } from './useLcuConnection'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

describe('useLcuConnection', () => {
  it('démarre à "idle" puis adopte l’instantané initial', async () => {
    stubLcuBridge({
      getConnection: vi.fn(
        async (): Promise<ConnectionInfo> => ({
          status: 'connected',
          summoner: { summonerId: 1 } as never,
        }),
      ),
    })
    const { result } = renderHook(() => useLcuConnection())
    expect(result.current.status).toBe('idle')
    await waitFor(() => expect(result.current.status).toBe('connected'))
  })

  it('réagit aux événements connection-changed', async () => {
    const ctx = stubLcuBridge()
    const { result } = renderHook(() => useLcuConnection())
    await waitFor(() => expect(result.current.status).toBe('idle'))

    act(() => ctx.emitters.connection?.({ status: 'connecting', summoner: null }))
    await waitFor(() => expect(result.current.status).toBe('connecting'))

    act(() => ctx.emitters.connection?.({ status: 'connected', summoner: { summonerId: 9 } as never }))
    await waitFor(() => expect(result.current.summoner?.summonerId).toBe(9))
  })

  it('reste "idle" sans preload', () => {
    clearLcuBridge()
    const { result } = renderHook(() => useLcuConnection())
    expect(result.current).toEqual({ status: 'idle', summoner: null })
  })
})
