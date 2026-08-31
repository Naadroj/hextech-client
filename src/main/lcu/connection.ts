import { EventEmitter } from 'node:events'
import {
  toPublicCredentials,
  type LcuCredentials,
  type PublicCredentials,
} from './credentials'
import type { LcuRestClient } from './rest-client'
import { getCurrentSummoner, type CurrentSummoner } from './endpoints'
import type { LcuEvent } from './ws-client'
import type { ConnectionInfo, ConnectionStatus } from '../../shared/lcu-types'

/**
 * Orchestrateur : relie le `ProcessWatcher`, la récupération des identifiants,
 * le client REST et le WebSocket en une machine à états simple.
 *
 * États : `idle` → `connecting` → `connected` → `idle`.
 * Événements : `connected` ({ summoner, credentials }), `disconnected`,
 * `lcu-event` (LcuEvent), `error`, `ws-error`.
 *
 * Le token n'est jamais émis : `connected` ne porte que `PublicCredentials`.
 */

export type ConnectionState = ConnectionStatus

/** Sous-ensemble d'un émetteur type `ProcessWatcher`. */
export interface WatcherLike {
  on(event: 'started', listener: () => void): unknown
  on(event: 'stopped', listener: () => void): unknown
  on(event: 'error', listener: (err: unknown) => void): unknown
  start(): void
  stop(): void
}

/** Sous-ensemble d'un émetteur type `LcuWebSocket`. */
export interface WebSocketLike {
  on(event: 'event', listener: (e: LcuEvent) => void): unknown
  on(event: 'error', listener: (err: Error) => void): unknown
  connect(): void
  disconnect(): void
}

export interface LcuConnectionDeps {
  watcher: WatcherLike
  getCredentials: () => Promise<LcuCredentials | null>
  createRestClient: (creds: LcuCredentials) => LcuRestClient
  createWebSocket: (creds: LcuCredentials) => WebSocketLike
  /** Délai entre tentatives quand le client démarre encore (défaut : 2000). */
  retryDelayMs?: number
  /** Nombre maximum de tentatives par cycle (défaut : 30). */
  maxAttempts?: number
}

export interface ConnectedPayload {
  summoner: CurrentSummoner
  credentials: PublicCredentials
}

export class LcuConnection extends EventEmitter {
  private _state: ConnectionState = 'idle'
  private rest?: LcuRestClient
  private ws?: WebSocketLike
  private credentials?: LcuCredentials
  private lastSummoner: CurrentSummoner | null = null
  private attempt = 0
  private retryTimer?: ReturnType<typeof setTimeout>

  constructor(private readonly deps: LcuConnectionDeps) {
    super()
  }

  get state(): ConnectionState {
    return this._state
  }

  /** Instantané sûr à exposer au renderer (jamais de token). */
  get info(): ConnectionInfo {
    return { status: this._state, summoner: this.lastSummoner }
  }

  /** Client REST courant (undefined tant que non connecté). */
  get restClient(): LcuRestClient | undefined {
    return this.rest
  }

  get publicCredentials(): PublicCredentials | undefined {
    return this.credentials ? toPublicCredentials(this.credentials) : undefined
  }

  start(): void {
    this.deps.watcher.on('started', () => {
      this.attempt = 0
      void this.tryConnect()
    })
    this.deps.watcher.on('stopped', () => this.teardown())
    this.deps.watcher.on('error', (err) => this.emit('error', err))
    this.deps.watcher.start()
  }

  stop(): void {
    this.clearRetry()
    this.deps.watcher.stop()
    this.teardown()
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = undefined
    }
  }

  private scheduleRetry(): void {
    this.clearRetry()
    const max = this.deps.maxAttempts ?? 30
    if (this.attempt >= max) {
      this._state = 'idle'
      this.emit('error', new Error(`LCU : connexion abandonnée après ${max} tentatives`))
      return
    }
    this.retryTimer = setTimeout(() => void this.tryConnect(), this.deps.retryDelayMs ?? 2000)
  }

  private async tryConnect(): Promise<void> {
    if (this._state === 'connected') return
    this._state = 'connecting'
    this.attempt += 1

    let creds: LcuCredentials | null
    try {
      creds = await this.deps.getCredentials()
    } catch (err) {
      this.emit('error', err)
      this.scheduleRetry()
      return
    }
    if (!creds) {
      this.scheduleRetry()
      return
    }

    const rest = this.deps.createRestClient(creds)
    try {
      // Sonde : confirme que l'API répond et que l'auth est valide.
      const summoner = await getCurrentSummoner(rest)
      this.credentials = creds
      this.rest = rest
      this.lastSummoner = summoner
      this._state = 'connected'
      this.attempt = 0
      this.clearRetry()
      this.emit('connected', {
        summoner,
        credentials: toPublicCredentials(creds),
      } satisfies ConnectedPayload)
      this.startWebSocket(creds)
    } catch {
      // API pas encore prête (client en cours de démarrage) : on retente.
      this.scheduleRetry()
    }
  }

  private startWebSocket(creds: LcuCredentials): void {
    const ws = this.deps.createWebSocket(creds)
    this.ws = ws
    ws.on('event', (e) => this.emit('lcu-event', e))
    ws.on('error', (err) => this.emit('ws-error', err))
    ws.connect()
  }

  private teardown(): void {
    this.clearRetry()
    this.ws?.disconnect()
    this.ws = undefined
    this.rest = undefined
    this.credentials = undefined
    this.lastSummoner = null
    if (this._state !== 'idle') {
      this._state = 'idle'
      this.emit('disconnected')
    }
  }
}
