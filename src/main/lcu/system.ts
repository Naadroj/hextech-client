import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { logger } from '../logger'

/**
 * Implémentations Windows réelles injectées dans les modules LCU. Elles se
 * contentent d'invoquer des utilitaires système en lecture seule
 * (`tasklist`, requête WMI via PowerShell) — jamais d'écriture, jamais
 * d'accès au process du jeu.
 *
 * Isolées ici pour que le reste du cœur LCU reste testable sans shell.
 */

const execAsync = promisify(exec)
const CLIENT_PROCESS = 'LeagueClientUx.exe'

/** `true` si `LeagueClientUx.exe` est présent dans la table des process. */
export async function isLeagueClientRunning(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(
      `tasklist /FI "IMAGENAME eq ${CLIENT_PROCESS}" /NH`,
      { windowsHide: true, timeout: 4000 },
    )
    return stdout.toLowerCase().includes(CLIENT_PROCESS.toLowerCase())
  } catch (err) {
    logger.warn('isLeagueClientRunning: échec de tasklist', String(err))
    return false
  }
}

/**
 * Ligne de commande complète de `LeagueClientUx.exe` (contient `--app-port` et
 * `--remoting-auth-token`), ou `null` si le process est absent / illisible.
 */
export async function getLeagueClientCommandLine(): Promise<string | null> {
  const ps =
    `Get-CimInstance Win32_Process -Filter "name='${CLIENT_PROCESS}'" ` +
    `| Select-Object -ExpandProperty CommandLine`
  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "${ps}"`,
      { windowsHide: true, timeout: 5000 },
    )
    const line = stdout.trim()
    return line.length > 0 ? line : null
  } catch (err) {
    logger.warn('getLeagueClientCommandLine: échec de la requête WMI', String(err))
    return null
  }
}
