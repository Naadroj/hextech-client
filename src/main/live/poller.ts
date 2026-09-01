import { EventEmitter } from 'node:events'
import type { LiveGameData, LiveSnapshot, LiveStatus } from '../../shared/live-types'
import type { LiveHttpClient } from './rest-client'

/**
 * Sonde la Live Client Data API et émet un `snapshot` par tick tant qu'une
 * partie est en cours.
 *
 * Auto-détection, sans dépendance au LCU (fonctionne donc même si l'app est
 * lancée en cours de partie) :
 *  - en `idle`, sonde lentement (`idleIntervalMs`) ;
 *  - au premier succès → passe en `active`, émet `status` puis `game-start`,
 *    et sonde vite (`activeIntervalMs`) ;
 *  - après `endThreshold` échecs consécutifs en `active` → revient en `idle`,
 *    émet `status` puis `game-end`.
 *
 * Événements : `snapshot` (LiveSnapshot), `status` (LiveStatus), `game-start`,
 * `game-end`, `poll-error` (unknown ; non fatal — un `ECONNREFUSED` hors partie
 * est normal). Le nom `poll-error` évite le cas spécial `error` d'EventEmitter
 * (crash si aucun auditeur).
 */

export interface LiveClientPollerOptions {
  client: LiveHttpClient
  /** Intervalle de sonde hors partie (défaut : 5000). */
  idleIntervalMs?: number
  /** Intervalle de sonde en partie (défaut : 1000). */
  activeIntervalMs?: number
  /** Échecs consécutifs avant de considérer la partie terminée (défaut : 3). */
  endThreshold?: number
  /** Fournisseur d'horloge (tests). Défaut : `Date.now`. */
  now?: () => number
}

const GAME_DATA_PATH = '/liveclientdata/allgamedata'

export class LiveClientPoller extends EventEmitter {
  private status: LiveStatus = 'idle'
  private timer?: ReturnType<typeof setTimeout>
  private polling = false
  private consecutiveFailures = 0
  private lastSnapshot: LiveSnapshot | null = null
  private stopped = true

  constructor(private readonly options: LiveClientPollerOptions) {
    super()
  }

  get currentStatus(): LiveStatus {
    return this.status
  }

  /** Dernier snapshot connu (`null` hors partie). */
  get snapshot(): LiveSnapshot | null {
    return this.lastSnapshot
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.scheduleNext(0)
  }

  stop(): void {
    this.stopped = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    this.status = 'idle'
    this.consecutiveFailures = 0
    this.lastSnapshot = null
  }

  private scheduleNext(delayMs: number): void {
    if (this.stopped) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.poll(), delayMs)
  }

  private currentInterval(): number {
    return this.status === 'active'
      ? (this.options.activeIntervalMs ?? 1000)
      : (this.options.idleIntervalMs ?? 5000)
  }

  private async poll(): Promise<void> {
    if (this.polling || this.stopped) return
    this.polling = true
    try {
      const res = await this.options.client.get<LiveGameData>(GAME_DATA_PATH)
      if (res.ok && isLiveGameData(res.data)) this.onSuccess(res.data)
      else this.onFailure()
    } catch (err) {
      this.emit('poll-error', err)
      this.onFailure()
    } finally {
      this.polling = false
      this.scheduleNext(this.currentInterval())
    }
  }

  private onSuccess(data: LiveGameData): void {
    this.consecutiveFailures = 0
    const now = this.options.now ?? Date.now
    const snap: LiveSnapshot = { receivedAt: now(), data }
    this.lastSnapshot = snap
    if (this.status === 'idle') {
      this.status = 'active'
      this.emit('status', this.status)
      this.emit('game-start')
    }
    this.emit('snapshot', snap)
  }

  private onFailure(): void {
    if (this.status !== 'active') return
    this.consecutiveFailures += 1
    if (this.consecutiveFailures >= (this.options.endThreshold ?? 3)) {
      this.status = 'idle'
      this.consecutiveFailures = 0
      this.lastSnapshot = null
      this.emit('status', this.status)
      this.emit('game-end')
    }
  }
}

/** Garde de forme minimale : suffisant pour distinguer une vraie réponse. */
export function isLiveGameData(v: unknown): v is LiveGameData {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o['activePlayer'] === 'object' &&
    o['activePlayer'] !== null &&
    Array.isArray(o['allPlayers']) &&
    typeof o['gameData'] === 'object' &&
    o['gameData'] !== null
  )
}
