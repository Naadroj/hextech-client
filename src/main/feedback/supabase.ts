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
    had_skeleton: r.hadSkeleton,
    skeleton_games: r.skeletonGames,
    snapshot: r.snapshot,
  }
}

export type Poster = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

/**
 * Insère un lot. Retourne les ids acceptés (vide si échec — on réessaiera).
 * `Prefer: resolution=ignore-duplicates` rend l'envoi idempotent sur `id`.
 */
export async function insertReports(
  reports: FeedbackReport[],
  post: Poster = fetch as unknown as Poster,
): Promise<string[]> {
  if (reports.length === 0) return []
  if (!isConfigured()) return []
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
      logger.warn(`feedback: envoi refusé (HTTP ${res.status})`)
      return []
    }
    return reports.map((r) => r.id)
  } catch (err) {
    logger.info('feedback: envoi impossible, on réessaiera —', String(err))
    return []
  }
}
