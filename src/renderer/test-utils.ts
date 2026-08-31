import { vi } from 'vitest'
import type { AppApi, LcuBridge } from '@shared/ipc'
import type { ConnectionInfo, LcuEvent } from '@shared/lcu-types'

type WindowWithApp = { app?: AppApi }

/** Installe un `window.app.lcu` factice et rend accessibles les callbacks poussés. */
export function stubLcuBridge(overrides: Partial<LcuBridge> = {}) {
  const emitters = {
    connection: undefined as ((info: ConnectionInfo) => void) | undefined,
    event: undefined as ((event: LcuEvent) => void) | undefined,
  }
  const unsubscribe = vi.fn()

  const bridge: LcuBridge = {
    getConnection: vi.fn(async () => ({ status: 'idle', summoner: null }) as ConnectionInfo),
    getRankedStats: vi.fn(async () => ({ soloDuo: null, flex: null })),
    getProfileIcon: vi.fn(async () => null),
    getSplashBackground: vi.fn(async () => null),
    acceptReadyCheck: vi.fn(async () => {}),
    declineReadyCheck: vi.fn(async () => {}),
    createLobby: vi.fn(async () => {}),
    createPracticeTool: vi.fn(async () => {}),
    createCustomLobby: vi.fn(async () => {}),
    leaveLobby: vi.fn(async () => {}),
    startMatchmaking: vi.fn(async () => {}),
    stopMatchmaking: vi.fn(async () => {}),
    read: vi.fn(async () => ({ status: 200, ok: true, data: null })) as unknown as LcuBridge['read'],
    onConnectionChanged: (cb) => {
      emitters.connection = cb
      return unsubscribe
    },
    onEvent: (cb) => {
      emitters.event = cb
      return unsubscribe
    },
    ...overrides,
  }

  ;(window as unknown as WindowWithApp).app = {
    windowControls: {
      minimize: vi.fn(async () => {}),
      toggleMaximize: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      isMaximized: vi.fn(async () => false),
    },
    lcu: bridge,
  }

  return { bridge, emitters, unsubscribe }
}

export function clearLcuBridge(): void {
  delete (window as unknown as WindowWithApp).app
}
