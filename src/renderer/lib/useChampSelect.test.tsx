import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { ChampSelectSession } from '@shared/lcu-types'
import { useChampSelect } from './useChampSelect'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

const SESSION: Partial<ChampSelectSession> = {
  localPlayerCellId: 0,
  myTeam: [{ cellId: 0, championPickIntent: 0 } as never],
  theirTeam: [],
  bans: { myTeamBans: [], theirTeamBans: [], numBans: 6 },
  timer: { adjustedTimeLeftInPhase: 25000, totalTimeInPhase: 30000, phase: 'BAN_PICK', isInfinite: false },
  actions: [[{ id: 21, actorCellId: 0, championId: 0, completed: false, isAllyAction: true, isInProgress: true, pickTurn: 1, type: 'pick' } as never]],
  benchChampions: [],
}

function stubReads(map: Record<string, unknown>, over = {}) {
  return stubLcuBridge({
    read: vi.fn(async (path: string) =>
      path in map
        ? { status: 200, ok: true, data: map[path] }
        : { status: 404, ok: false, data: null },
    ) as never,
    ...over,
  })
}

describe('useChampSelect', () => {
  it('reste null si déconnecté', () => {
    stubReads({})
    const { result } = renderHook(() => useChampSelect(false))
    expect(result.current.session).toBeNull()
  })

  it('charge la session et les données de support', async () => {
    const ctx = stubReads({
      '/lol-champ-select/v1/session': SESSION,
      '/lol-champ-select/v1/all-grid-champions': [{ id: 103, name: 'Ahri' }],
      '/lol-champ-select/v1/pickable-champion-ids': [103, 64],
      '/lol-game-data/v1/summoner-spells.json': [{ id: 4, name: 'Flash', gameModes: [] }],
      '/lol-perks/v1/pages': [{ id: 1, name: 'Page', current: true }],
    })
    const { result } = renderHook(() => useChampSelect(true))

    await waitFor(() => {
      expect(result.current.session?.localPlayerCellId).toBe(0)
      expect(result.current.grid).toHaveLength(1)
      expect(result.current.pickable.has(103)).toBe(true)
    })
    expect(ctx.bridge.read).toHaveBeenCalledWith('/lol-champ-select/v1/all-grid-champions')
    expect(result.current.championName(103)).toBe('Ahri')
  })

  it('hover résout l’actionId de mon action active', async () => {
    const ctx = stubReads({ '/lol-champ-select/v1/session': SESSION })
    const { result } = renderHook(() => useChampSelect(true))
    await waitFor(() => expect(result.current.session).not.toBeNull())

    await act(async () => {
      await result.current.hover(103)
    })
    expect(ctx.bridge.champHover).toHaveBeenCalledWith(21, 103)
  })

  it('lock utilise l’action active + le champion survolé', async () => {
    const hovered: Partial<ChampSelectSession> = {
      ...SESSION,
      actions: [[{ ...(SESSION.actions![0][0] as object), championId: 157 } as never]],
    }
    const ctx = stubReads({ '/lol-champ-select/v1/session': hovered })
    const { result } = renderHook(() => useChampSelect(true))
    await waitFor(() => expect(result.current.session).not.toBeNull())

    await act(async () => {
      await result.current.lock()
    })
    expect(ctx.bridge.champLock).toHaveBeenCalledWith(21, 157)
  })

  it('met à jour la session sur événement, la vide sur Delete', async () => {
    const ctx = stubReads({ '/lol-champ-select/v1/session': SESSION })
    const { result } = renderHook(() => useChampSelect(true))
    await waitFor(() => expect(result.current.session).not.toBeNull())

    act(() =>
      ctx.emitters.event?.({
        eventType: 'Delete',
        uri: '/lol-champ-select/v1/session',
        data: null,
      }),
    )
    expect(result.current.session).toBeNull()
  })
})
