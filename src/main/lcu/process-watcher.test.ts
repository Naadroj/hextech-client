import { describe, it, expect, vi } from 'vitest'
import { ProcessWatcher } from './process-watcher'

function makeSequence(values: boolean[]): () => Promise<boolean> {
  let i = 0
  return async () => values[Math.min(i++, values.length - 1)]
}

describe('ProcessWatcher', () => {
  it('émet "started" puis "stopped" sur les transitions', async () => {
    const watcher = new ProcessWatcher({
      isRunning: makeSequence([false, true, true, false, false]),
      intervalMs: 5,
    })
    const events: string[] = []
    watcher.on('started', () => events.push('started'))
    watcher.on('stopped', () => events.push('stopped'))

    watcher.start()
    await vi.waitFor(() => expect(events).toEqual(['started', 'stopped']), { timeout: 1000 })
    watcher.stop()
  })

  it('n’émet pas deux fois "started" pour un état stable', async () => {
    const watcher = new ProcessWatcher({
      isRunning: async () => true,
      intervalMs: 5,
    })
    const started = vi.fn()
    watcher.on('started', started)

    watcher.start()
    await vi.waitFor(() => expect(started).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 40))
    watcher.stop()
    expect(started).toHaveBeenCalledTimes(1)
  })

  it('expose isUp', async () => {
    const watcher = new ProcessWatcher({ isRunning: async () => true, intervalMs: 5 })
    expect(watcher.isUp).toBe(false)
    watcher.start()
    await vi.waitFor(() => expect(watcher.isUp).toBe(true))
    watcher.stop()
  })

  it('émet "error" si la sonde lève, sans planter la boucle', async () => {
    let calls = 0
    const watcher = new ProcessWatcher({
      isRunning: async () => {
        calls++
        if (calls === 1) throw new Error('tasklist indisponible')
        return true
      },
      intervalMs: 5,
    })
    const onError = vi.fn()
    watcher.on('error', onError)
    const onStarted = vi.fn()
    watcher.on('started', onStarted)

    watcher.start()
    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalled()
      expect(onStarted).toHaveBeenCalled()
    })
    watcher.stop()
  })

  it('stop() arrête les sondes', async () => {
    const isRunning = vi.fn(async () => false)
    const watcher = new ProcessWatcher({ isRunning, intervalMs: 5 })
    watcher.start()
    await vi.waitFor(() => expect(isRunning).toHaveBeenCalled())
    watcher.stop()
    const countAfterStop = isRunning.mock.calls.length
    await new Promise((r) => setTimeout(r, 40))
    expect(isRunning.mock.calls.length).toBe(countAfterStop)
  })
})
