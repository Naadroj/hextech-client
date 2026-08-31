import { vi } from 'vitest'
import type { AppApi, LcuBridge } from '@shared/ipc'
import type { ConnectionInfo, LcuEvent } from '@shared/lcu-types'

type WindowWithApp = { app?: AppApi }

/** Installe un `window.app.lcu` factice et rend accessibles les callbacks poussés. */
export function stubLcuBridge(overrides: Partial<LcuBridge> = {}) {
  const connectionCbs: ((info: ConnectionInfo) => void)[] = []
  const eventCbs: ((event: LcuEvent) => void)[] = []
  const unsubscribe = vi.fn()

  // Fan-out : plusieurs abonnés possibles (comme le vrai preload).
  const emitters = {
    connection: (info: ConnectionInfo) => connectionCbs.forEach((cb) => cb(info)),
    event: (event: LcuEvent) => eventCbs.forEach((cb) => cb(event)),
  }
  const remove = <T>(arr: T[], item: T) => {
    const i = arr.indexOf(item)
    if (i >= 0) arr.splice(i, 1)
  }

  const bridge: LcuBridge = {
    getConnection: vi.fn(async () => ({ status: 'idle', summoner: null }) as ConnectionInfo),
    getRankedStats: vi.fn(async () => ({ soloDuo: null, flex: null })),
    getProfileIcon: vi.fn(async () => null),
    getChampionIcon: vi.fn(async () => null),
    getSplashBackground: vi.fn(async () => null),
    acceptReadyCheck: vi.fn(async () => {}),
    declineReadyCheck: vi.fn(async () => {}),
    createLobby: vi.fn(async () => {}),
    createPracticeTool: vi.fn(async () => {}),
    createCustomLobby: vi.fn(async () => {}),
    leaveLobby: vi.fn(async () => {}),
    startMatchmaking: vi.fn(async () => {}),
    stopMatchmaking: vi.fn(async () => {}),
    champHover: vi.fn(async () => {}),
    champLock: vi.fn(async () => {}),
    setSummonerSpells: vi.fn(async () => {}),
    setRunePage: vi.fn(async () => {}),
    read: vi.fn(async () => ({ status: 200, ok: true, data: null })) as unknown as LcuBridge['read'],
    onConnectionChanged: (cb) => {
      connectionCbs.push(cb)
      return () => {
        unsubscribe()
        remove(connectionCbs, cb)
      }
    },
    onEvent: (cb) => {
      eventCbs.push(cb)
      return () => {
        unsubscribe()
        remove(eventCbs, cb)
      }
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
