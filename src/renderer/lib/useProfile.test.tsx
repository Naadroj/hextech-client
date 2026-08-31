import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import type { CurrentSummoner } from '@shared/lcu-types'
import { useProfile } from './useProfile'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

const summoner = { profileIconId: 7, summonerLevel: 42 } as unknown as CurrentSummoner

describe('useProfile', () => {
  it('charge classement + icône quand connecté', async () => {
    const ctx = stubLcuBridge({
      getRankedStats: vi.fn(async () => ({
        soloDuo: {
          queueType: '',
          tier: 'GOLD',
          division: 'II',
          leaguePoints: 44,
          wins: 10,
          losses: 8,
        },
        flex: null,
      })),
      getProfileIcon: vi.fn(async () => 'data:image/jpeg;base64,AAAA'),
    })

    const { result } = renderHook(() => useProfile(true, summoner))

    await waitFor(() => {
      expect(result.current.ranked.soloDuo?.tier).toBe('GOLD')
      expect(result.current.iconDataUrl).toBe('data:image/jpeg;base64,AAAA')
    })
    expect(ctx.bridge.getProfileIcon).toHaveBeenCalledWith(7)
  })

  it('ne récupère rien si déconnecté', async () => {
    const ctx = stubLcuBridge()
    const { result } = renderHook(() => useProfile(false, null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(ctx.bridge.getRankedStats).not.toHaveBeenCalled()
    expect(result.current.iconDataUrl).toBeNull()
  })

  it('rafraîchit le classement sur un événement /lol-ranked/', async () => {
    const getRankedStats = vi
      .fn()
      .mockResolvedValueOnce({ soloDuo: null, flex: null })
      .mockResolvedValue({
        soloDuo: { queueType: '', tier: 'PLATINUM', division: 'I', leaguePoints: 3, wins: 1, losses: 0 },
        flex: null,
      })
    const ctx = stubLcuBridge({ getRankedStats })

    const { result } = renderHook(() => useProfile(true, summoner))
    await waitFor(() => expect(getRankedStats).toHaveBeenCalledTimes(1))

    act(() =>
      ctx.emitters.event?.({
        eventType: 'Update',
        uri: '/lol-ranked/v1/current-ranked-stats',
        data: {},
      }),
    )
    await waitFor(() => expect(result.current.ranked.soloDuo?.tier).toBe('PLATINUM'))
  })
})
