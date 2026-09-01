import { LiveClientPoller } from './poller'
import { createLiveRestClient } from './rest-client'

export * from './rest-client'
export * from './poller'

export interface CreateLiveClientOptions {
  /** Chemin vers `riotgames.pem` embarqué (validation TLS stricte si présent). */
  caPath?: string
  idleIntervalMs?: number
  activeIntervalMs?: number
}

/**
 * Assemble un `LiveClientPoller` prêt à l'emploi avec un vrai client HTTP vers
 * `https://127.0.0.1:2999`. Le process principal n'a plus qu'à `start()` et
 * écouter les événements.
 */
export function createLiveClient(options: CreateLiveClientOptions = {}): LiveClientPoller {
  return new LiveClientPoller({
    client: createLiveRestClient({ caPath: options.caPath }),
    idleIntervalMs: options.idleIntervalMs,
    activeIntervalMs: options.activeIntervalMs,
  })
}
