import { vi } from 'vitest'
import type {
  AppApi,
  CoachBridge,
  LcuBridge,
  LiveBridge,
  OverlayBridge,
  StaticDataBridge,
  UpdaterBridge,
} from '@shared/ipc'
import type { ConnectionInfo, LcuEvent } from '@shared/lcu-types'
import type { LiveSnapshot, LiveStatus } from '@shared/live-types'
import type { StaticDataSummary } from '@shared/staticdata-types'
import type { CoachAdvice } from '@shared/coach-types'
import { IDLE_ADVICE } from '@shared/coach-types'
import type { UpdateState, UpdaterInfo } from '@shared/update-types'
import { IDLE_UPDATE_STATE } from '@shared/update-types'
import type { OverlayState } from '@shared/overlay-types'
import { IDLE_OVERLAY_STATE } from '@shared/overlay-types'

type WindowWithApp = { app?: AppApi }

const DEFAULT_STATIC_SUMMARY: StaticDataSummary = {
  version: '0.0.0',
  locale: 'en_US',
  source: 'bundled',
  fetchedAt: '2026-01-01T00:00:00.000Z',
  merakiVersion: null,
  itemCount: 0,
  championCount: 0,
  runeCount: 0,
  summonerSpellCount: 0,
  damageProfileSources: { meraki: 0, ddragon: 0, override: 0 },
  updating: false,
}

/**
 * Installe un `window.app` factice (`lcu` + `live` + `staticData`) et rend
 * accessibles les callbacks poussés via `emitters`.
 *
 * `liveOverrides` / `staticDataOverrides` sont additifs : les tests axés LCU
 * peuvent les ignorer.
 */
export function stubLcuBridge(
  overrides: Partial<LcuBridge> = {},
  liveOverrides: Partial<LiveBridge> = {},
  staticDataOverrides: Partial<StaticDataBridge> = {},
  coachOverrides: Partial<CoachBridge> = {},
  updaterOverrides: Partial<UpdaterBridge> = {},
  overlayOverrides: Partial<OverlayBridge> = {},
) {
  const connectionCbs: ((info: ConnectionInfo) => void)[] = []
  const eventCbs: ((event: LcuEvent) => void)[] = []
  const liveSnapshotCbs: ((snapshot: LiveSnapshot) => void)[] = []
  const liveStatusCbs: ((status: LiveStatus) => void)[] = []
  const staticUpdatedCbs: ((summary: StaticDataSummary) => void)[] = []
  const coachAdviceCbs: ((advice: CoachAdvice) => void)[] = []
  const updaterStateCbs: ((state: UpdateState) => void)[] = []
  const overlayStateCbs: ((state: OverlayState) => void)[] = []
  const unsubscribe = vi.fn()

  // Fan-out : plusieurs abonnés possibles (comme le vrai preload).
  const emitters = {
    connection: (info: ConnectionInfo) => connectionCbs.forEach((cb) => cb(info)),
    event: (event: LcuEvent) => eventCbs.forEach((cb) => cb(event)),
    liveSnapshot: (snapshot: LiveSnapshot) => liveSnapshotCbs.forEach((cb) => cb(snapshot)),
    liveStatus: (status: LiveStatus) => liveStatusCbs.forEach((cb) => cb(status)),
    staticDataUpdated: (summary: StaticDataSummary) =>
      staticUpdatedCbs.forEach((cb) => cb(summary)),
    coachAdvice: (advice: CoachAdvice) => coachAdviceCbs.forEach((cb) => cb(advice)),
    updaterState: (state: UpdateState) => updaterStateCbs.forEach((cb) => cb(state)),
    overlayState: (state: OverlayState) => overlayStateCbs.forEach((cb) => cb(state)),
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
    getItemIcon: vi.fn(async () => null),
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

  const live: LiveBridge = {
    getSnapshot: vi.fn(async () => null),
    getStatus: vi.fn(async () => 'idle' as LiveStatus),
    onSnapshot: (cb) => {
      liveSnapshotCbs.push(cb)
      return () => {
        unsubscribe()
        remove(liveSnapshotCbs, cb)
      }
    },
    onStatusChanged: (cb) => {
      liveStatusCbs.push(cb)
      return () => {
        unsubscribe()
        remove(liveStatusCbs, cb)
      }
    },
    ...liveOverrides,
  }

  const staticData: StaticDataBridge = {
    getSummary: vi.fn(async () => DEFAULT_STATIC_SUMMARY),
    refresh: vi.fn(async () => false),
    onUpdated: (cb) => {
      staticUpdatedCbs.push(cb)
      return () => {
        unsubscribe()
        remove(staticUpdatedCbs, cb)
      }
    },
    ...staticDataOverrides,
  }

  const coach: CoachBridge = {
    getAdvice: vi.fn(async () => IDLE_ADVICE),
    onAdvice: (cb) => {
      coachAdviceCbs.push(cb)
      return () => {
        unsubscribe()
        remove(coachAdviceCbs, cb)
      }
    },
    ...coachOverrides,
  }

  const DEFAULT_UPDATER_INFO: UpdaterInfo = {
    currentVersion: '0.1.0',
    supported: false,
    state: { ...IDLE_UPDATE_STATE, phase: 'unsupported', message: 'dev' },
  }
  const updater: UpdaterBridge = {
    getInfo: vi.fn(async () => DEFAULT_UPDATER_INFO),
    check: vi.fn(async () => ({ ...IDLE_UPDATE_STATE })),
    download: vi.fn(async () => ({ ...IDLE_UPDATE_STATE })),
    install: vi.fn(async () => {}),
    onState: (cb) => {
      updaterStateCbs.push(cb)
      return () => {
        unsubscribe()
        remove(updaterStateCbs, cb)
      }
    },
    ...updaterOverrides,
  }

  const overlay: OverlayBridge = {
    getState: vi.fn(async () => ({ ...IDLE_OVERLAY_STATE })),
    setEnabled: vi.fn(async (enabled: boolean) => ({ ...IDLE_OVERLAY_STATE, enabled })),
    toggle: vi.fn(async () => ({ ...IDLE_OVERLAY_STATE, enabled: true })),
    setCompact: vi.fn(async (compact: boolean) => ({ ...IDLE_OVERLAY_STATE, compact })),
    setInteractive: vi.fn(async () => {}),
    dragStart: vi.fn(async () => {}),
    dragEnd: vi.fn(async () => {}),
    onState: (cb) => {
      overlayStateCbs.push(cb)
      return () => {
        unsubscribe()
        remove(overlayStateCbs, cb)
      }
    },
    ...overlayOverrides,
  }

  ;(window as unknown as WindowWithApp).app = {
    windowControls: {
      minimize: vi.fn(async () => {}),
      toggleMaximize: vi.fn(async () => {}),
      close: vi.fn(async () => {}),
      isMaximized: vi.fn(async () => false),
    },
    lcu: bridge,
    live,
    staticData,
    coach,
    updater,
    overlay,
  }

  return { bridge, live, staticData, coach, updater, overlay, emitters, unsubscribe }
}

export function clearLcuBridge(): void {
  delete (window as unknown as WindowWithApp).app
}

/** Conseil Coach « actif » plausible pour les tests de vue / hook. */
export function makeCoachAdvice(over: Partial<CoachAdvice> = {}): CoachAdvice {
  return {
    status: 'active',
    dataWarning: null,
    computedAt: 123,
    gameTimeSeconds: 930,
    self: {
      slug: 'Caitlyn',
      role: 'BOT',
      level: 12,
      currentGold: 1450,
      profilePrimary: 'physical',
      fed: 0.8,
      isManaConstrained: false,
    },
    threat: {
      physical: 0.35,
      magic: 0.6,
      true: 0.05,
      burst: 0.55,
      primarySlug: 'Syndra',
      primaryFed: 0.9,
    },
    recommendation: {
      primary: {
        itemId: 3139,
        name: 'Cimeterre mercuriel',
        kind: 'legendary',
        goldTotal: 3200,
        affordableNow: false,
        goldShort: 1750,
        score: 0.42,
        breakdown: { offense: 0.1, defense: 0.2, utility: 0.7, costEfficiency: 0.1, tempo: -0.12 },
        reasons: ['Équipe ennemie 60 % magique → résistance magique.', 'Burst ennemi → retrait des contrôles.'],
      },
      alternatives: [
        {
          itemId: 3156,
          name: 'Gueule de Malmortius',
          kind: 'legendary',
          goldTotal: 3100,
          affordableNow: false,
          goldShort: 1650,
          score: 0.38,
          breakdown: { offense: 0.2, defense: 0.2, utility: 0.4, costEfficiency: 0.2, tempo: -0.08 },
          reasons: [],
        },
        {
          itemId: 3091,
          name: "Bout du monde",
          kind: 'legendary',
          goldTotal: 2800,
          affordableNow: false,
          goldShort: 1350,
          score: 0.31,
          breakdown: { offense: 0.3, defense: 0.15, utility: 0.35, costEfficiency: 0.2, tempo: -0.05 },
          reasons: [],
        },
      ],
      boots: {
        itemId: 3111,
        name: 'Bottes de Mercure',
        kind: 'boots',
        goldTotal: 1250,
        affordableNow: true,
        goldShort: 0,
        score: 0.2,
        breakdown: { offense: 0, defense: 0.1, utility: 0.9, costEfficiency: 0, tempo: 0 },
        reasons: ['Menace magique + tenacité contre le CC.'],
      },
      buildPath: [
        { itemId: 3031, name: "Lame d'infini", owned: true, slot: 1 },
        { itemId: 3036, name: 'Salutations de Dominik', owned: false, slot: 2 },
      ],
      skeleton: {
        games: 84,
        roleAgnostic: false,
        patchSpan: null,
        starters: [{ itemId: 1055, name: 'Lame de Doran', pickRate: 0.72 }],
      },
      context: {
        representativeTargetSlug: 'Syndra',
        threatSummary: '35 % phys / 60 % mag / 5 % vrai · burst 55 %',
        weightProfile: 'carry',
      },
    },
    ...over,
  }
}
