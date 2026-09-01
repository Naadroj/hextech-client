import { IpcChannels } from '../../shared/ipc'
import type { ConnectionInfo, LcuEvent, RankedStats } from '../../shared/lcu-types'
import type { LcuConnection } from '../lcu/connection'
import {
  acceptReadyCheck,
  createCustomLobby,
  createLobby,
  createPracticeToolLobby,
  declineReadyCheck,
  getCurrentRankedStats,
  getTopMasteryChampionId,
  hoverChampion,
  leaveLobby,
  lockChampion,
  setCurrentRunePage,
  setSummonerSpells,
  startMatchmaking,
  stopMatchmaking,
} from '../lcu/endpoints'
import { logger } from '../logger'

/**
 * Surface IPC du pont LCU. Deux principes :
 *  - le token ne franchit jamais cette frontière (seul `ConnectionInfo` /
 *    données de jeu remontent) ;
 *  - `lcu:read` n'autorise que des GET sur une **liste blanche** de préfixes ;
 *    toute mutation a un canal dédié.
 */

const READ_WHITELIST: RegExp[] = [
  /^\/lol-summoner\/v\d+\//,
  /^\/lol-ranked\/v\d+\//,
  /^\/lol-gameflow\/v\d+\//,
  /^\/lol-matchmaking\/v\d+\//,
  /^\/lol-champ-select\/v\d+\//,
  /^\/lol-lobby\/v\d+\//,
  /^\/lol-chat\/v\d+\//,
  /^\/lol-store\/v\d+\//,
  /^\/lol-loot\/v\d+\//,
  /^\/lol-perks\/v\d+\//,
  /^\/lol-game-queues\/v\d+\//,
  /^\/lol-champion-mastery\/v\d+\//,
  /^\/lol-game-data\//,
]

const EVENT_WHITELIST =
  /^\/lol-(matchmaking|champ-select|gameflow|summoner|chat|lobby|store|loot|ranked|perks)\//

export function isReadPathAllowed(path: string): boolean {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.includes('..') &&
    READ_WHITELIST.some((re) => re.test(path))
  )
}

export function isEventUriAllowed(uri: string): boolean {
  return EVENT_WHITELIST.test(uri)
}

/** Sous-ensemble d'`Electron.IpcMain` suffisant ici (injectable pour les tests). */
export interface IpcMainLike {
  handle(
    channel: string,
    listener: (event: unknown, ...args: unknown[]) => unknown | Promise<unknown>,
  ): void
  removeHandler(channel: string): void
}

/** Sous-ensemble d'`Electron.WebContents`. */
export interface SenderLike {
  send(channel: string, payload: unknown): void
  isDestroyed(): boolean
}

export interface RegisterLcuIpcDeps {
  ipcMain: IpcMainLike
  connection: LcuConnection
  /** Cible des événements poussés (WebContents de la fenêtre principale). */
  getSender: () => SenderLike | null
}

const HANDLED_CHANNELS: string[] = [
  IpcChannels.lcuGetConnection,
  IpcChannels.lcuGetRankedStats,
  IpcChannels.lcuGetProfileIcon,
  IpcChannels.lcuGetChampionIcon,
  IpcChannels.lcuGetItemIcon,
  IpcChannels.lcuGetSplash,
  IpcChannels.lcuChampHover,
  IpcChannels.lcuChampLock,
  IpcChannels.lcuSetSpells,
  IpcChannels.lcuSetRunePage,
  IpcChannels.lcuAcceptReadyCheck,
  IpcChannels.lcuDeclineReadyCheck,
  IpcChannels.lcuCreateLobby,
  IpcChannels.lcuCreatePracticeTool,
  IpcChannels.lcuCreateCustomLobby,
  IpcChannels.lcuLeaveLobby,
  IpcChannels.lcuStartMatchmaking,
  IpcChannels.lcuStopMatchmaking,
  IpcChannels.lcuRead,
]

const EMPTY_RANKED: RankedStats = { soloDuo: null, flex: null }

/** Branche les handlers et le relais d'événements. Retourne un `dispose()`. */
export function registerLcuIpc(deps: RegisterLcuIpcDeps): () => void {
  const { ipcMain, connection } = deps

  const push = (channel: string, payload: unknown): void => {
    const sender = deps.getSender()
    if (sender && !sender.isDestroyed()) sender.send(channel, payload)
  }

  const broadcastConnection = (): void => {
    push(IpcChannels.lcuConnectionChanged, connection.info satisfies ConnectionInfo)
  }
  const relayEvent = (event: LcuEvent): void => {
    if (isEventUriAllowed(event.uri)) push(IpcChannels.lcuEvent, event)
  }

  connection.on('connected', broadcastConnection)
  connection.on('disconnected', broadcastConnection)
  connection.on('lcu-event', relayEvent)

  ipcMain.handle(IpcChannels.lcuGetConnection, () => connection.info)

  ipcMain.handle(IpcChannels.lcuGetRankedStats, async () => {
    const rest = connection.restClient
    if (!rest) return EMPTY_RANKED
    try {
      return await getCurrentRankedStats(rest)
    } catch (err) {
      logger.warn('lcu:get-ranked-stats a échoué', String(err))
      return EMPTY_RANKED
    }
  })

  ipcMain.handle(IpcChannels.lcuGetProfileIcon, async (_event, ...args) => {
    const iconId = args[0]
    const rest = connection.restClient
    if (!rest || typeof iconId !== 'number' || !Number.isInteger(iconId)) return null
    try {
      const res = await rest.requestRaw(
        'GET',
        `/lol-game-data/assets/v1/profile-icons/${iconId}.jpg`,
      )
      if (!res.ok || res.body.byteLength === 0) return null
      const mime = res.contentType || 'image/jpeg'
      return `data:${mime};base64,${res.body.toString('base64')}`
    } catch (err) {
      logger.warn('lcu:get-profile-icon a échoué', String(err))
      return null
    }
  })

  ipcMain.handle(IpcChannels.lcuGetChampionIcon, async (_event, ...args) => {
    const championId = args[0]
    const rest = connection.restClient
    if (!rest || typeof championId !== 'number' || !Number.isInteger(championId) || championId <= 0) {
      return null
    }
    try {
      const res = await rest.requestRaw(
        'GET',
        `/lol-game-data/assets/v1/champion-icons/${championId}.png`,
      )
      if (!res.ok || res.body.byteLength === 0) return null
      const mime = res.contentType || 'image/png'
      return `data:${mime};base64,${res.body.toString('base64')}`
    } catch (err) {
      logger.warn('lcu:get-champion-icon a échoué', String(err))
      return null
    }
  })

  ipcMain.handle(IpcChannels.lcuGetItemIcon, async (_event, ...args) => {
    const itemId = args[0]
    const rest = connection.restClient
    if (!rest || typeof itemId !== 'number' || !Number.isInteger(itemId) || itemId <= 0) {
      return null
    }
    try {
      const res = await rest.requestRaw('GET', `/lol-game-data/assets/v1/items/${itemId}.png`)
      if (!res.ok || res.body.byteLength === 0) return null
      const mime = res.contentType || 'image/png'
      return `data:${mime};base64,${res.body.toString('base64')}`
    } catch (err) {
      logger.warn('lcu:get-item-icon a échoué', String(err))
      return null
    }
  })

  ipcMain.handle(IpcChannels.lcuGetSplash, async () => {
    const rest = connection.restClient
    if (!rest) return null
    try {
      const championId = await getTopMasteryChampionId(rest)
      if (!championId) return null
      const skinId = `${championId}000`
      const paths = [
        `/lol-game-data/assets/v1/champion-splashes/${championId}/${skinId}.jpg`,
        `/lol-game-data/assets/v1/champion-splashes/uncentered/${championId}/${skinId}.jpg`,
      ]
      for (const path of paths) {
        const res = await rest.requestRaw('GET', path)
        if (res.ok && res.body.byteLength > 0) {
          const mime = res.contentType || 'image/jpeg'
          return `data:${mime};base64,${res.body.toString('base64')}`
        }
      }
      return null
    } catch (err) {
      logger.warn('lcu:get-splash a échoué', String(err))
      return null
    }
  })

  ipcMain.handle(IpcChannels.lcuAcceptReadyCheck, async () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await acceptReadyCheck(rest)
  })

  ipcMain.handle(IpcChannels.lcuDeclineReadyCheck, async () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await declineReadyCheck(rest)
  })

  ipcMain.handle(IpcChannels.lcuCreateLobby, async (_event, ...args) => {
    const queueId = args[0]
    if (typeof queueId !== 'number' || !Number.isInteger(queueId) || queueId <= 0) {
      throw new Error('queueId invalide')
    }
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await createLobby(rest, queueId)
  })

  ipcMain.handle(IpcChannels.lcuCreatePracticeTool, async () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await createPracticeToolLobby(rest)
  })

  ipcMain.handle(IpcChannels.lcuCreateCustomLobby, async () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await createCustomLobby(rest)
  })

  ipcMain.handle(IpcChannels.lcuLeaveLobby, async () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await leaveLobby(rest)
  })

  ipcMain.handle(IpcChannels.lcuStartMatchmaking, async () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await startMatchmaking(rest)
  })

  ipcMain.handle(IpcChannels.lcuStopMatchmaking, async () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    await stopMatchmaking(rest)
  })

  const requireRest = () => {
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    return rest
  }
  const int = (v: unknown): number => {
    if (typeof v !== 'number' || !Number.isInteger(v)) throw new Error('argument entier attendu')
    return v
  }

  ipcMain.handle(IpcChannels.lcuChampHover, async (_event, ...args) => {
    const actionId = int(args[0])
    const championId = int(args[1])
    await hoverChampion(requireRest(), actionId, championId)
  })

  ipcMain.handle(IpcChannels.lcuChampLock, async (_event, ...args) => {
    const actionId = int(args[0])
    const championId = int(args[1])
    await lockChampion(requireRest(), actionId, championId)
  })

  ipcMain.handle(IpcChannels.lcuSetSpells, async (_event, ...args) => {
    const spell1Id = int(args[0])
    const spell2Id = int(args[1])
    await setSummonerSpells(requireRest(), spell1Id, spell2Id)
  })

  ipcMain.handle(IpcChannels.lcuSetRunePage, async (_event, ...args) => {
    const pageId = int(args[0])
    await setCurrentRunePage(requireRest(), pageId)
  })

  ipcMain.handle(IpcChannels.lcuRead, async (_event, ...args) => {
    const path = args[0]
    if (typeof path !== 'string' || !isReadPathAllowed(path)) {
      logger.warn('lcu:read refusé (hors liste blanche) :', String(path))
      throw new Error(`endpoint LCU non autorisé : ${String(path)}`)
    }
    const rest = connection.restClient
    if (!rest) throw new Error('LCU hors ligne')
    const res = await rest.request('GET', path)
    return { status: res.status, ok: res.ok, data: res.data }
  })

  return () => {
    connection.off('connected', broadcastConnection)
    connection.off('disconnected', broadcastConnection)
    connection.off('lcu-event', relayEvent)
    for (const channel of HANDLED_CHANNELS) ipcMain.removeHandler(channel)
  }
}
