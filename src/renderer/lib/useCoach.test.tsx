import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useCoach } from './useCoach'
import { stubLcuBridge, clearLcuBridge, makeCoachAdvice } from '../test-utils'

afterEach(() => clearLcuBridge())

describe('useCoach', () => {
  it('démarre en idle', async () => {
    stubLcuBridge()
    const { result } = renderHook(() => useCoach())
    expect(result.current.status).toBe('idle')
    await waitFor(() => expect(result.current.status).toBe('idle'))
  })

  it('lit le conseil initial', async () => {
    const advice = makeCoachAdvice()
    stubLcuBridge({}, {}, {}, { getAdvice: vi.fn(async () => advice) })
    const { result } = renderHook(() => useCoach())
    await waitFor(() => expect(result.current.status).toBe('active'))
    expect(result.current.recommendation?.primary?.name).toBe('Cimeterre mercuriel')
  })

  it('suit les conseils poussés', async () => {
    const ctx = stubLcuBridge()
    const { result } = renderHook(() => useCoach())
    act(() => ctx.emitters.coachAdvice(makeCoachAdvice({ gameTimeSeconds: 1500 })))
    await waitFor(() => {
      expect(result.current.status).toBe('active')
      expect(result.current.gameTimeSeconds).toBe(1500)
    })
  })
})
