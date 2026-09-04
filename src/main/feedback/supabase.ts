import { logger } from '../logger'
import type { FeedbackReport } from '../../shared/feedback-types'

/**
 * Envoi des signalements vers une table Supabase, en `INSERT` seul.
 *
 * La clé `anon` est **publique par conception** : elle est conçue pour être
 * embarquée dans un client. La sécurité repose sur la RLS côté Supabase, qui ne
 * doit autoriser que l'insertion sur cette table (aucune lecture). Voir
 * `FEEDBACK.md` pour la policy exacte.
 *
 * Surchargeable au build : `HEXTECH_SUPABASE_URL` / `HEXTECH_SUPABASE_ANON_KEY`.
 */

// ⚠️ Notation **pointée** obligatoire : ces deux expressions sont remplacées
// textuellement au build par `define` (electron.vite.config.ts). En notation
// `process.env['…']`, le remplacement n'aurait pas lieu et la valeur serait lue
// à l'exécution sur la machine de l'utilisateur — donc toujours vide.
export const SUPABASE_URL = process.env.HEXTECH_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY = process.env.HEXTECH_SUPABASE_ANON_KEY ?? ''
const TABLE = 'feedback'

export const isConfigured = (): boolean => !!SUPABASE_URL && !!SUPABASE_ANON_KEY

/** Colonnes de la table — `snapshot` porte la fixture rejouable. */
function toRow(r: FeedbackReport): Record<string, unknown> {
  return {
    id: r.id,
    created_at: r.createdAt,
    install_id: r.installId,
    app_version: r.appVersion,
    patch: r.patch,
    builds_patch: r.buildsPatch,
    champion: r.champion,
    role: r.role,
    level: r.level,
    completed_items: r.completedItems,
    item_id: r.itemId,
    item_rank: r.itemRank,
    reason_code: r.reasonCode,
    comment: r.comment,
    had_skeleton: r.hadSkeleton,
    skeleton_games: r.skeletonGames,
    snapshot: r.snapshot,
  }
}

export type Poster = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export interface InsertOutcome {
  /** Ids acceptés par la base. Vide si le lot a été refusé. */
  sent: string[]
  /**
   * Raison lisible de l'échec, à remonter jusqu'à l'écran. Un envoi qui échoue
   * sans dire pourquoi est indébogable à distance — c'est le message de
   * PostgREST qui désigne la colonne ou la policy fautive.
   */
  error: string | null
}

/** Extrait le message utile d'une réponse PostgREST (JSON `{message, hint}`). */
function explain(status: number, body: string): string {
  let detail = body.trim().slice(0, 300)
  try {
    const j = JSON.parse(body) as { message?: string; hint?: string; details?: string }
    detail = [j.message, j.details, j.hint].filter(Boolean).join(' — ') || detail
  } catch {
    /* pas du JSON : on garde le corps brut */
  }
  if (status === 401 || status === 403) {
    return `HTTP ${status} : ${detail || 'refusé par la RLS'} (policy d'insertion pour le rôle anon ?)`
  }
  return `HTTP ${status}${detail ? ` : ${detail}` : ''}`
}

/**
 * Insère un lot. `Prefer: resolution=ignore-duplicates` rend l'envoi idempotent
 * sur `id` : un renvoi après un timeout ne crée pas de doublon.
 */
export async function insertReports(
  reports: FeedbackReport[],
  post: Poster = fetch as unknown as Poster,
): Promise<InsertOutcome> {
  if (reports.length === 0) return { sent: [], error: null }
  if (!isConfigured()) return { sent: [], error: 'identifiants absents de ce build' }
  try {
    const res = await post(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Prefer: 'return=minimal,resolution=ignore-duplicates',
      },
      body: JSON.stringify(reports.map(toRow)),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) {
      const message = explain(res.status, await res.text().catch(() => ''))
      logger.warn(`feedback: envoi refusé — ${message}`)
      return { sent: [], error: message }
    }
    return { sent: reports.map((r) => r.id), error: null }
  } catch (err) {
    const message = String(err)
    logger.info('feedback: envoi impossible —', message)
    return { sent: [], error: message }
  }
}
