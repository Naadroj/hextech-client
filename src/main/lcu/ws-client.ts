import { EventEmitter } from 'node:events'
import { existsSync, readFileSync } from 'node:fs'
import WebSocket from 'ws'

/**
 * WebSocket LCU (sous-protocole type WAMP).
 *
 *  - Souscription : envoyer `[5, "OnJsonApiEvent"]` à l'ouverture.
 *  - Événement reçu : `[8, "OnJsonApiEvent", { eventType, uri, data }]`.
 *
 * Émet : `open`, `event` (LcuEvent), `event:<uri>` (LcuEvent), `close`, `error`.
 */

export type LcuEventType = 'Create' | 'Update' | 'Delete'

export interface LcuEvent<T = unknown> {
  eventType: LcuEventType
  uri: string
  data: T
}

/** Extrait un `LcuEvent` d'une trame WAMP brute, ou `null` si non pertinent. */
export function parseWampEvent(raw: string): LcuEvent | null {
  if (!raw) return null
  let message: unknown
  try {
    message = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(message) || message[0] !== 8 || message[1] !== 'OnJsonApiEvent') {
    return null
  }
  const payload = message[2]
  if (!payload || typeof payload !== 'object') return null
  const { eventType, uri, data } = payload as Record<string, unknown>
  if (typeof uri !== 'string' || typeof eventType !== 'string') return null
  return { eventType: eventType as LcuEventType, uri, data }
}

export interface WsClientOptions {
  /** URL complète, ex. `wss://127.0.0.1:<port>`. */
  url: string
  /** En-tête `Authorization: Basic ...`. */
  authHeader: string
  /** Chemin vers `riotgames.pem` ; ignoré s'il n'existe pas. */
  caPath?: string
  /** Délai avant reconnexion en ms (défaut : 1500). */
  reconnectDelayMs?: number
  /** Reconnexion automatique après une fermeture non sollicitée (défaut : true). */
  autoReconnect?: boolean
}

export class LcuWebSocket extends EventEmitter {
  private ws?: WebSocket
  private stopped = false
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private readonly reconnectDelay: number
  private readonly autoReconnect: boolean

  constructor(private readonly options: WsClientOptions) {
    super()
    this.reconnectDelay = options.reconnectDelayMs ?? 1500
    this.autoReconnect = options.autoReconnect ?? true
  }

  connect(): void {
    this.stopped = false
    this.clearReconnect()

    const wsOptions: WebSocket.ClientOptions = {
      headers: { Authorization: this.options.authHeader },
    }
    if (this.options.caPath && existsSync(this.options.caPath)) {
      wsOptions.ca = readFileSync(this.options.caPath)
    } else {
      wsOptions.rejectUnauthorized = false
    }

    const ws = new WebSocket(this.options.url, wsOptions)
    this.ws = ws

    ws.on('open', () => {
      ws.send(JSON.stringify([5, 'OnJsonApiEvent']))
      this.emit('open')
    })

    ws.on('message', (raw: WebSocket.RawData) => {
      const event = parseWampEvent(raw.toString())
      if (!event) return
      this.emit('event', event)
      this.emit(`event:${event.uri}`, event)
    })

    ws.on('close', () => {
      this.emit('close')
      if (!this.stopped && this.autoReconnect) {
        this.reconnectTimer = setTimeout(() => {
          if (!this.stopped) this.connect()
        }, this.reconnectDelay)
      }
    })

    ws.on('error', (err: Error) => this.emit('error', err))
  }

  disconnect(): void {
    this.stopped = true
    this.clearReconnect()
    this.ws?.removeAllListeners()
    this.ws?.close()
    this.ws = undefined
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
  }
}
