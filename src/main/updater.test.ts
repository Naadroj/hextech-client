import { describe, it, expect, vi, beforeEach } from 'vitest'

const { electronMock, auMock } = vi.hoisted(() => {
  // Mini-émetteur (vi.hoisted est remonté au-dessus des imports ESM).
  type Listener = (...args: unknown[]) => void
  const listeners = new Map<string, Listener[]>()
  const au = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    logger: {} as unknown,
    checkForUpdates: vi.fn(async () => {}),
    downloadUpdate: vi.fn(async () => {}),
    quitAndInstall: vi.fn(),
    on(event: string, fn: Listener) {
      const arr = listeners.get(event) ?? []
      arr.push(fn)
      listeners.set(event, arr)
      return au
    },
    emit(event: string, ...args: unknown[]) {
      for (const fn of listeners.get(event) ?? []) fn(...args)
      return (listeners.get(event)?.length ?? 0) > 0
    },
    removeAllListeners() {
      listeners.clear()
      return au
    },
  }
  return {
    electronMock: { app: { isPackaged: true, getVersion: () => '1.2.3' } },
    auMock: au,
  }
})

vi.mock('electron', () => electronMock)
vi.mock('electron-updater', () => ({ autoUpdater: auMock }))

const { Updater } = await import('./updater')

beforeEach(() => {
  electronMock.app.isPackaged = true
  auMock.removeAllListeners()
  vi.clearAllMocks()
})

describe('Updater', () => {
  it('est "unsupported" hors application packagée', () => {
    electronMock.app.isPackaged = false
    const u = new Updater()
    expect(u.info()).toMatchObject({ supported: false, currentVersion: '1.2.3' })
    expect(u.info().state.phase).toBe('unsupported')
  })

  it('configure autoUpdater et démarre à "idle" quand packagé', () => {
    const u = new Updater()
    expect(auMock.autoDownload).toBe(false)
    expect(auMock.autoInstallOnAppQuit).toBe(true)
    expect(u.info().state.phase).toBe('idle')
  })

  it('reflète les événements autoUpdater dans son état + émet "state"', () => {
    const u = new Updater()
    const states: string[] = []
    u.on('state', (s) => states.push(s.phase))

    auMock.emit('checking-for-update')
    auMock.emit('update-available', { version: '2.0.0', releaseNotes: 'notes' })
    auMock.emit('download-progress', { percent: 42.7 })
    auMock.emit('update-downloaded', { version: '2.0.0' })

    expect(states).toEqual(['checking', 'available', 'downloading', 'downloaded'])
    expect(u.info().state).toMatchObject({ phase: 'downloaded', version: '2.0.0', percent: 100 })
  })

  it('download() n’agit que depuis "available"', async () => {
    const u = new Updater()
    await u.download()
    expect(auMock.downloadUpdate).not.toHaveBeenCalled()

    auMock.emit('update-available', { version: '2.0.0' })
    await u.download()
    expect(auMock.downloadUpdate).toHaveBeenCalledOnce()
  })

  it('install() n’agit que depuis "downloaded"', () => {
    const u = new Updater()
    u.install()
    expect(auMock.quitAndInstall).not.toHaveBeenCalled()

    auMock.emit('update-downloaded', { version: '2.0.0' })
    u.install()
    expect(auMock.quitAndInstall).toHaveBeenCalledOnce()
  })

  it('check() délègue à autoUpdater et capture les erreurs', async () => {
    ;(auMock.checkForUpdates as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'))
    const u = new Updater()
    await u.check()
    expect(u.info().state.phase).toBe('error')
    expect(u.info().state.message).toContain('boom')
  })

  it('un Updater non supporté ignore check/download/install', async () => {
    electronMock.app.isPackaged = false
    const u = new Updater()
    await u.check()
    await u.download()
    u.install()
    expect(auMock.checkForUpdates).not.toHaveBeenCalled()
    expect(auMock.downloadUpdate).not.toHaveBeenCalled()
    expect(auMock.quitAndInstall).not.toHaveBeenCalled()
  })
})
