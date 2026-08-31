import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useLobby } from './useLobby'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

type ReadImpl = (path: string) => Promise<{ status: number; ok: boolean; data: unknown }>

function bridgeWithReads(map: Record<string, unknown>) {
  const read: ReadImpl = async (path) => {
    if (path in map) return { status: 200, ok: true, data: map[path] }
    return { status: 404, ok: false, data: null }
  }
  return stubLcuBridge({ read: read as never })
}

describe('useLobby', () => {
  it('charge lobby, recherche et files à la connexion', async () => {
    bridgeWithReads({
      '/lol-lobby/v2/lobby': { partyId: 'p1', gameConfig: { queueId: 430 }, members: [] },
      '/lol-matchmaking/v1/search': { searchState: 'Invalid', timeInQueue: 0 },
      '/lol-game-queues/v1/queues': [{ id: 430, name: 'Blind', shortName: '', description: '', category: 'PvP', gameMode: 'CLASSIC', isRanked: false, mapId: 11 }],
    })
    const { result } = renderHook(() => useLobby(true))
    await waitFor(() => {
      expect(result.current.lobby?.partyId).toBe('p1')
      expect(result.current.queues).toHaveLength(1)
    })
    expect(result.current.inQueue).toBe(false)
  })

  it('ne lit rien si déconnecté', async () => {
    const ctx = stubLcuBridge()
    renderHook(() => useLobby(false))
    await waitFor(() => expect(ctx.bridge.read).not.toHaveBeenCalled())
  })

  it('inQueue suit l’état de recherche via événement', async () => {
    const ctx = bridgeWithReads({})
    const { result } = renderHook(() => useLobby(true))
    await waitFor(() => expect(result.current.lobby).toBeNull())

    act(() => {
      ctx.emitters.event?.({
        eventType: 'Update',
        uri: '/lol-matchmaking/v1/search',
        data: { searchState: 'Searching', timeInQueue: 5 },
      })
    })
    expect(result.current.inQueue).toBe(true)

    act(() => {
      ctx.emitters.event?.({ eventType: 'Delete', uri: '/lol-matchmaking/v1/search', data: null })
    })
    expect(result.current.inQueue).toBe(false)
  })

  it('startSearch appelle le pont et remonte une erreur', async () => {
    const startMatchmaking = vi.fn(async () => {
      throw new Error('not lobby leader')
    })
    const ctx = bridgeWithReads({})
    ctx.bridge.startMatchmaking = startMatchmaking
    const { result } = renderHook(() => useLobby(true))

    await act(async () => {
      await result.current.startSearch()
    })
    expect(startMatchmaking).toHaveBeenCalledOnce()
    expect(result.current.error).toBe('not lobby leader')
    expect(result.current.busy).toBe(false)
  })

  it('createLobby délègue au pont', async () => {
    const ctx = bridgeWithReads({})
    const { result } = renderHook(() => useLobby(true))
    await act(async () => {
      await result.current.createLobby(450)
    })
    expect(ctx.bridge.createLobby).toHaveBeenCalledWith(450)
  })
})
