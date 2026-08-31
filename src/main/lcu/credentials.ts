import { findLockfile, DEFAULT_INSTALL_DIRS } from './lockfile'

/**
 * Identifiants de connexion à la LCU. Deux sources possibles :
 *  1. le `lockfile` (méthode documentée) ;
 *  2. la ligne de commande de `LeagueClientUx.exe`, qui contient
 *     `--app-port=` et `--remoting-auth-token=` (repli si le lockfile est
 *     introuvable, ex. installation sur un chemin non standard).
 */

export interface LcuCredentials {
  port: number
  token: string
  pid?: number
  protocol: 'https'
  source: 'lockfile' | 'command-line'
}

/** Vue publique : sans le token, sûre à transmettre au renderer / aux logs. */
export interface PublicCredentials {
  port: number
  protocol: 'https'
  source: LcuCredentials['source']
}

export function toPublicCredentials(creds: LcuCredentials): PublicCredentials {
  return { port: creds.port, protocol: creds.protocol, source: creds.source }
}

export function parseCredentialsFromCommandLine(commandLine: string): LcuCredentials | null {
  const port = commandLine.match(/--app-port[=\s]+"?(\d+)"?/)?.[1]
  const token = commandLine.match(/--remoting-auth-token[=\s]+"?([\w-]+)"?/)?.[1]
  if (!port || !token) return null
  const pid = commandLine.match(/--app-pid[=\s]+"?(\d+)"?/)?.[1]
  return {
    port: Number(port),
    token,
    pid: pid ? Number(pid) : undefined,
    protocol: 'https',
    source: 'command-line',
  }
}

export interface GetCredentialsDeps {
  readFile: (path: string) => Promise<string>
  candidatePaths?: string[]
  /** Retourne la ligne de commande de LeagueClientUx.exe, ou `null`. */
  getCommandLine?: () => Promise<string | null>
}

export async function getCredentials(deps: GetCredentialsDeps): Promise<LcuCredentials | null> {
  const found = await findLockfile({
    readFile: deps.readFile,
    candidatePaths: deps.candidatePaths ?? DEFAULT_INSTALL_DIRS,
  })
  if (found) {
    return {
      port: found.lockfile.port,
      token: found.lockfile.password,
      pid: found.lockfile.pid || undefined,
      protocol: 'https',
      source: 'lockfile',
    }
  }

  if (deps.getCommandLine) {
    const commandLine = await deps.getCommandLine()
    if (commandLine) {
      const fromCli = parseCredentialsFromCommandLine(commandLine)
      if (fromCli) return fromCli
    }
  }

  return null
}
