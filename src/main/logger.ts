import { redact } from '../shared/redact'

/**
 * Logger du process principal. Toute chaîne passée en argument est filtrée par
 * `redact()` avant affichage : aucun `remoting-auth-token`, en-tête Basic ou
 * mot de passe de lockfile ne doit jamais atteindre la sortie standard.
 *
 * Règle d'usage : ne jamais placer de secret dans un objet loggé — seuls les
 * arguments de type `string` sont assainis, pas les propriétés d'objets.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const PREFIX = '[hextech]'

function sanitize(args: unknown[]): unknown[] {
  return args.map((arg) => (typeof arg === 'string' ? redact(arg) : arg))
}

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export const logger: Logger = {
  debug: (...args) => console.debug(PREFIX, ...sanitize(args)),
  info: (...args) => console.info(PREFIX, ...sanitize(args)),
  warn: (...args) => console.warn(PREFIX, ...sanitize(args)),
  error: (...args) => console.error(PREFIX, ...sanitize(args)),
}
