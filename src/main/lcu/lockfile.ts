import { join } from 'node:path'

/**
 * Le client officiel écrit un fichier `lockfile` à la racine de son répertoire
 * d'installation tant qu'il tourne. Format (séparateur `:`) :
 *
 *   LeagueClientUx:<pid>:<port>:<remoting-auth-token>:<protocol>
 */

export interface LcuLockfile {
  processName: string
  pid: number
  port: number
  password: string
  protocol: string
}

/** Répertoires d'installation Windows les plus courants. */
export const DEFAULT_INSTALL_DIRS: string[] = [
  'C:\\Riot Games\\League of Legends',
  'D:\\Riot Games\\League of Legends',
  'E:\\Riot Games\\League of Legends',
  'C:\\Program Files\\Riot Games\\League of Legends',
  'C:\\Program Files (x86)\\Riot Games\\League of Legends',
]

export function parseLockfile(content: string): LcuLockfile {
  const parts = content.trim().split(':')
  if (parts.length < 5) {
    throw new Error(`lockfile malformé (${parts.length} champs au lieu de 5)`)
  }
  // Le token peut théoriquement contenir des `:` — on recompose le milieu.
  const processName = parts[0]
  const pid = Number(parts[1])
  const port = Number(parts[2])
  const protocol = parts[parts.length - 1]
  const password = parts.slice(3, parts.length - 1).join(':')

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`port invalide dans le lockfile : "${parts[2]}"`)
  }
  if (!password) {
    throw new Error('remoting-auth-token absent du lockfile')
  }
  if (protocol !== 'https') {
    throw new Error(`protocole inattendu dans le lockfile : "${protocol}"`)
  }

  return {
    processName,
    pid: Number.isInteger(pid) ? pid : 0,
    port,
    password,
    protocol,
  }
}

export interface FindLockfileDeps {
  /** Lecture d'un fichier texte ; doit rejeter si le fichier est absent. */
  readFile: (path: string) => Promise<string>
  /** Répertoires d'installation candidats (ou chemins directs vers un lockfile). */
  candidatePaths: string[]
}

export interface FoundLockfile {
  path: string
  lockfile: LcuLockfile
}

/**
 * Parcourt les chemins candidats et retourne le premier `lockfile` lisible et
 * valide. Retourne `null` si aucun n'est trouvé (client fermé).
 */
export async function findLockfile(deps: FindLockfileDeps): Promise<FoundLockfile | null> {
  for (const candidate of deps.candidatePaths) {
    const path = candidate.toLowerCase().endsWith('lockfile')
      ? candidate
      : join(candidate, 'lockfile')
    try {
      const content = await deps.readFile(path)
      return { path, lockfile: parseLockfile(content) }
    } catch {
      // fichier absent ou illisible : on essaie le candidat suivant
    }
  }
  return null
}
