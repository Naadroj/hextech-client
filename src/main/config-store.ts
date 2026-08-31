import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { logger } from './logger'

/**
 * Préférences persistées dans un simple fichier JSON (aucune dépendance).
 * Lecture tolérante : fichier absent ou corrompu → valeurs par défaut.
 */

export interface AppConfig {
  /** Réduire le client officiel dans la zone de notification à la connexion. */
  minimizeOfficialClientOnConnect: boolean
  /** Démarrer l'application réduite dans le systray. */
  startMinimizedToTray: boolean
  /** Fermer vers le systray plutôt que quitter. */
  closeToTray: boolean
}

export const DEFAULT_CONFIG: AppConfig = {
  minimizeOfficialClientOnConnect: false,
  startMinimizedToTray: false,
  closeToTray: true,
}

const BOOLEAN_KEYS = Object.keys(DEFAULT_CONFIG) as (keyof AppConfig)[]

function coerce(parsed: unknown): AppConfig {
  const out: AppConfig = { ...DEFAULT_CONFIG }
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    for (const key of BOOLEAN_KEYS) {
      if (typeof record[key] === 'boolean') out[key] = record[key] as boolean
    }
  }
  return out
}

export class ConfigStore {
  private data: AppConfig

  constructor(private readonly filePath: string) {
    this.data = this.read()
  }

  private read(): AppConfig {
    try {
      return coerce(JSON.parse(readFileSync(this.filePath, 'utf8')))
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.data[key]
  }

  getAll(): AppConfig {
    return { ...this.data }
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.data = { ...this.data, [key]: value }
    this.persist()
  }

  private persist(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
    } catch (err) {
      logger.warn('ConfigStore: écriture impossible', String(err))
    }
  }
}
