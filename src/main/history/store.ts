import { appendFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { logger } from '../logger'
import type {
  HistoryGame,
  HistoryGameMeta,
  HistoryGameSummary,
  HistoryStep,
} from '../../shared/history-types'

/**
 * Une partie = un fichier JSONL. Première ligne : l'en-tête (`kind: 'meta'`),
 * lignes suivantes : les propositions. Le fichier est donc auto-porteur — pas
 * d'index à tenir synchronisé, et une écriture interrompue ne coûte qu'une
 * ligne, jamais l'historique entier.
 */

/** Parties conservées ; au-delà, les plus anciennes sont supprimées. */
export const MAX_GAMES = 20

const isMeta = (v: unknown): v is HistoryGameMeta =>
  !!v && typeof v === 'object' && (v as HistoryGameMeta).kind === 'meta'

export class HistoryStore {
  constructor(private readonly dir: string) {}

  private file(id: string): string {
    return join(this.dir, `${id}.jsonl`)
  }

  /** Ouvre une partie : écrit l'en-tête et élague les plus anciennes. */
  open(meta: HistoryGameMeta): void {
    try {
      mkdirSync(this.dir, { recursive: true })
      appendFileSync(this.file(meta.id), JSON.stringify(meta) + '\n', 'utf8')
      this.prune()
    } catch (err) {
      logger.warn('history: ouverture impossible', String(err))
    }
  }

  append(id: string, step: HistoryStep): void {
    try {
      mkdirSync(this.dir, { recursive: true })
      appendFileSync(this.file(id), JSON.stringify(step) + '\n', 'utf8')
    } catch (err) {
      logger.warn('history: écriture impossible', String(err))
    }
  }

  /** Une partie complète. `null` si absente ou sans en-tête lisible. */
  read(id: string): HistoryGame | null {
    let raw: string
    try {
      raw = readFileSync(this.file(id), 'utf8')
    } catch {
      return null
    }
    let meta: HistoryGameMeta | null = null
    const steps: HistoryStep[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        continue // ligne tronquée par un arrêt brutal : on garde le reste
      }
      if (isMeta(parsed)) meta = parsed
      else if (parsed && typeof parsed === 'object') steps.push(parsed as HistoryStep)
    }
    return meta ? { meta, steps } : null
  }

  /** Résumés, partie la plus récente en premier. */
  list(): HistoryGameSummary[] {
    let ids: string[]
    try {
      ids = readdirSync(this.dir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => f.slice(0, -6))
    } catch {
      return []
    }
    const out: HistoryGameSummary[] = []
    for (const id of ids) {
      const game = this.read(id)
      if (!game) continue
      const last = [...game.steps].reverse().find((s) => s.primary)?.primary ?? null
      out.push({
        id: game.meta.id,
        startedAt: game.meta.startedAt,
        champion: game.meta.champion,
        role: game.meta.role,
        patch: game.meta.patch,
        steps: game.steps.length,
        lastItem: last ? { itemId: last.itemId, name: last.name } : null,
      })
    }
    return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  /** Supprime les fichiers au-delà de `MAX_GAMES` (les plus anciens d'abord). */
  private prune(): void {
    let files: { path: string; mtime: number }[]
    try {
      files = readdirSync(this.dir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => {
          const path = join(this.dir, f)
          return { path, mtime: statSync(path).mtimeMs }
        })
    } catch {
      return
    }
    if (files.length <= MAX_GAMES) return
    files
      .sort((a, b) => a.mtime - b.mtime)
      .slice(0, files.length - MAX_GAMES)
      .forEach(({ path }) => {
        try {
          rmSync(path, { force: true })
        } catch {
          /* déjà parti */
        }
      })
  }
}
