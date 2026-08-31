import { EventEmitter } from 'node:events'

/**
 * Sonde périodiquement la présence du process du client officiel et émet
 * `started` / `stopped` sur les transitions. Ne touche jamais au process :
 * simple test d'existence.
 *
 * Événements : `started`, `stopped`, `error`.
 */

export interface ProcessWatcherOptions {
  /** Test d'existence du process (injecté pour la testabilité). */
  isRunning: () => Promise<boolean>
  /** Intervalle de sonde en millisecondes (défaut : 2000). */
  intervalMs?: number
}

export class ProcessWatcher extends EventEmitter {
  private timer?: ReturnType<typeof setInterval>
  private up = false
  private polling = false

  constructor(private readonly options: ProcessWatcherOptions) {
    super()
  }

  /** `true` si le dernier sondage a vu le process actif. */
  get isUp(): boolean {
    return this.up
  }

  start(): void {
    if (this.timer) return
    void this.poll()
    this.timer = setInterval(() => void this.poll(), this.options.intervalMs ?? 2000)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  private async poll(): Promise<void> {
    if (this.polling) return
    this.polling = true
    try {
      const running = await this.options.isRunning()
      if (running && !this.up) {
        this.up = true
        this.emit('started')
      } else if (!running && this.up) {
        this.up = false
        this.emit('stopped')
      }
    } catch (err) {
      this.emit('error', err)
    } finally {
      this.polling = false
    }
  }
}
