import { readFile } from 'node:fs/promises'
import { getCredentials, type LcuCredentials } from './credentials'
import { ProcessWatcher } from './process-watcher'
import { createRestClient, buildBasicAuthHeader } from './rest-client'
import { LcuWebSocket } from './ws-client'
import { LcuConnection } from './connection'
import { isLeagueClientRunning, getLeagueClientCommandLine } from './system'

export * from './lockfile'
export * from './credentials'
export * from './process-watcher'
export * from './rest-client'
export * from './ws-client'
export * from './endpoints'
export * from './connection'
export {
  isLeagueClientRunning,
  getLeagueClientCommandLine,
  minimizeLeagueClientWindow,
} from './system'

export interface CreateLcuConnectionOptions {
  /** Chemin vers `riotgames.pem` embarqué (validation TLS stricte si présent). */
  caPath?: string
  pollIntervalMs?: number
}

/**
 * Assemble un `LcuConnection` prêt à l'emploi avec les implémentations Windows
 * réelles. Le process principal n'a plus qu'à `start()` et écouter les
 * événements.
 */
export function createLcuConnection(options: CreateLcuConnectionOptions = {}): LcuConnection {
  const watcher = new ProcessWatcher({
    isRunning: isLeagueClientRunning,
    intervalMs: options.pollIntervalMs ?? 2000,
  })

  return new LcuConnection({
    watcher,
    getCredentials: () =>
      getCredentials({
        readFile: (path) => readFile(path, 'utf8'),
        getCommandLine: getLeagueClientCommandLine,
      }),
    createRestClient: (creds: LcuCredentials) => createRestClient(creds, { caPath: options.caPath }),
    createWebSocket: (creds: LcuCredentials) =>
      new LcuWebSocket({
        url: `wss://127.0.0.1:${creds.port}`,
        authHeader: buildBasicAuthHeader(creds.token),
        caPath: options.caPath,
      }),
  })
}
