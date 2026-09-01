import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { UpdaterInfo } from '@shared/update-types'
import { IDLE_UPDATE_STATE } from '@shared/update-types'
import { useUpdater } from './useUpdater'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

const info = (over: Partial<UpdaterInfo> = {}): UpdaterInfo => ({
  currentVersion: '1.4.0',
  supported: true,
  state: { ...IDLE_UPDATE_STATE },
  ...over,
})

describe('useUpdater', () => {
  it('charge getInfo au montage', async () => {
    stubLcuBridge({}, {}, {}, {}, { getInfo: vi.fn(async () => info()) })
    const { result } = renderHook(() => useUpdater())
    await waitFor(() => {
      expect(result.current.currentVersion).toBe('1.4.0')
      expect(result.current.supported).toBe(true)
    })
  })

  it('suit les changements d’état poussés et calcule busy', async () => {
    const ctx = stubLcuBridge({}, {}, {}, {}, { getInfo: vi.fn(async () => info()) })
    const { result } = renderHook(() => useUpdater())
    await waitFor(() => expect(result.current.supported).toBe(true))

    act(() => ctx.emitters.updaterState({ ...IDLE_UPDATE_STATE, phase: 'downloading', percent: 40 }))
    expect(result.current.state.phase).toBe('downloading')
    expect(result.current.busy).toBe(true)

    act(() => ctx.emitters.updaterState({ ...IDLE_UPDATE_STATE, phase: 'downloaded', version: '2.0.0' }))
    expect(result.current.busy).toBe(false)
  })

  it('les actions délèguent au pont', async () => {
    const check = vi.fn(async () => ({ ...IDLE_UPDATE_STATE }))
    const download = vi.fn(async () => ({ ...IDLE_UPDATE_STATE }))
    const install = vi.fn(async () => {})
    stubLcuBridge({}, {}, {}, {}, { getInfo: vi.fn(async () => info()), check, download, install })
    const { result } = renderHook(() => useUpdater())

    await act(async () => {
      await result.current.check()
      await result.current.download()
      await result.current.install()
    })
    expect(check).toHaveBeenCalledOnce()
    expect(download).toHaveBeenCalledOnce()
    expect(install).toHaveBeenCalledOnce()
  })

  it('ne plante pas sans preload', () => {
    clearLcuBridge()
    const { result } = renderHook(() => useUpdater())
    expect(result.current.state.phase).toBe('idle')
    expect(result.current.supported).toBe(false)
  })
})
