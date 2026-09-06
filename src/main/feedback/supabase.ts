import { logger } from '../logger'
import type { FeedbackReport } from '../../shared/feedback-types'

/**
 * Envoi des signalements vers une table Supabase, en `INSERT` seul.
 *
 * La clé est **publique par conception** — `sb_publishable_…` aujourd'hui, ou
 * l'ancienne `anon` : elle est faite pour être embarquée dans un client. La
 * sécurité repose sur la RLS côté Supabase, qui ne doit autoriser que
 * l'insertion sur cette table (aucune lecture). Voir `FEEDBACK.md` pour la
 * policy exacte.
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

/**
 * En-têtes d'authentification, selon le format de la clé.
 *
 * Une clé au nouveau format (`sb_publishable_…`) **n'est pas un JWT**, et la doc
 * Supabase demande de l'envoyer sur `apikey` plutôt que sur `Authorization:
 * Bearer`, où la couche d'auth tenterait de la vérifier comme un jeton.
 *
 * Mesuré le 6 septembre 2026 : l'envoyer quand même en `Bearer` fonctionne
 * (HTTP 201). Ce n'est donc pas un correctif de bug mais une mise en conformité,
 * pour ne pas dépendre d'une compatibilité que Supabase présente comme
 * transitoire.
 *
 * Les clés héritées (`eyJ…`) sont, elles, de vrais JWT : PostgREST y lit le
 * rôle, et elles gardent les deux en-têtes.
 */
export function authHeaders(key: string): Record<string, string> {
  return key.startsWith('eyJ') ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key }
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

/** Une ligne déjà en base : `id` est la clé primaire (PostgREST `23505`). */
function isDuplicate(status: number, body: string): boolean {
  return status === 409 || body.includes('23505')
}

/** `POST` d'un lot, en insertion simple. */
async function postRows(
  reports: FeedbackReport[],
  post: Poster,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await post(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(SUPABASE_ANON_KEY),
      // Surtout **pas** de `resolution=ignore-duplicates` : cet en-tête ferait
      // un upsert, et un upsert sous RLS réclame plus que la seule policy
      // `INSERT` — la table est en « insertion seule », donc il est rejeté par
      // la RLS alors même que la policy est correcte. L'idempotence est reprise
      // plus bas, sur le `409`, plutôt qu'achetée au prix d'une policy `SELECT`
      // ou `UPDATE` qui ouvrirait la lecture des signalements.
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(reports.map(toRow)),
    signal: AbortSignal.timeout(15000),
  })
  return { ok: res.ok, status: res.status, body: res.ok ? '' : await res.text().catch(() => '') }
}

/**
 * Insère un lot, puis rattrape les doublons un par un.
 *
 * Le lot part en une requête — le cas courant. S'il bute sur un `id` déjà
 * présent, tout le lot échoue : Postgres est atomique. On rejoue alors rapport
 * par rapport, et un doublon compte comme **envoyé** — la ligne est en base,
 * c'est tout ce qui compte, et la garder en file la ferait échouer à chaque
 * tentative suivante.
 *
 * Ce cas n'arrive que si une insertion a réussi sans que la réponse nous
 * parvienne (timeout réseau) : le rapport est resté en file et repart au coup
 * d'après.
 */
export async function insertReports(
  reports: FeedbackReport[],
  post: Poster = fetch as unknown as Poster,
): Promise<InsertOutcome> {
  if (reports.length === 0) return { sent: [], error: null }
  if (!isConfigured()) return { sent: [], error: 'identifiants absents de ce build' }
  try {
    const batch = await postRows(reports, post)
    if (batch.ok) return { sent: reports.map((r) => r.id), error: null }

    if (!isDuplicate(batch.status, batch.body) || reports.length === 1) {
      const message = explain(batch.status, batch.body)
      logger.warn(`feedback: envoi refusé — ${message}`)
      return { sent: [], error: message }
    }

    logger.info('feedback: doublon dans le lot, reprise rapport par rapport')
    const sent: string[] = []
    let error: string | null = null
    for (const report of reports) {
      const one = await postRows([report], post)
      if (one.ok || isDuplicate(one.status, one.body)) sent.push(report.id)
      else error ??= explain(one.status, one.body)
    }
    if (error) logger.warn(`feedback: envoi partiel — ${error}`)
    return { sent, error }
  } catch (err) {
    const message = String(err)
    logger.info('feedback: envoi impossible —', message)
    return { sent: [], error: message }
  }
}
