import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useLiveGame } from './useLiveGame'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'
import type { LiveSnapshot } from '@shared/live-types'

afterEach(() => clearLcuBridge())

const SNAP: LiveSnapshot = {
  receivedAt: 999,
  data: {
    activePlayer: { summonerName: 'me', currentGold: 1300, level: 6 },
    allPlayers: [],
    events: { Events: [] },
    gameData: { gameMode: 'CLASSIC', gameTime: 320, mapName: 'x', mapNumber: 11, mapTerrain: 'y' },
  } as unknown as LiveSnapshot['data'],
}

describe('useLiveGame', () => {
  it('démarre idle / sans snapshot', async () => {
    stubLcuBridge()
    const { result } = renderHook(() => useLiveGame())
    expect(result.current).toEqual({ status: 'idle', snapshot: null })
    // Laisse les lectures initiales (getStatus/getSnapshot) se résoudre.
    await waitFor(() => expect(result.current.status).toBe('idle'))
  })

  it('lit le statut et le snapshot initiaux', async () => {
    stubLcuBridge(
      {},
      {
        getStatus: vi.fn(async () => 'active' as const),
        getSnapshot: vi.fn(async () => SNAP),
      },
    )
    const { result } = renderHook(() => useLiveGame())
    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(result.current.snapshot).toEqual(SNAP)
  })

  it('suit les snapshots poussés', async () => {
    const ctx = stubLcuBridge()
    const { result } = renderHook(() => useLiveGame())

    act(() => ctx.emitters.liveStatus('active'))
    act(() => ctx.emitters.liveSnapshot(SNAP))

    await waitFor(() => {
      expect(result.current.status).toBe('active')
      expect(result.current.snapshot).toEqual(SNAP)
    })
  })

  it('efface le snapshot au retour en idle', async () => {
    const ctx = stubLcuBridge()
    const { result } = renderHook(() => useLiveGame())

    act(() => ctx.emitters.liveStatus('active'))
    act(() => ctx.emitters.liveSnapshot(SNAP))
    await waitFor(() => expect(result.current.snapshot).toEqual(SNAP))

    act(() => ctx.emitters.liveStatus('idle'))
    await waitFor(() => {
      expect(result.current.status).toBe('idle')
      expect(result.current.snapshot).toBeNull()
    })
  })

  it('se désabonne au démontage', () => {
    const ctx = stubLcuBridge()
    const { unmount } = renderHook(() => useLiveGame())
    unmount()
    expect(ctx.unsubscribe).toHaveBeenCalled()
  })
})
