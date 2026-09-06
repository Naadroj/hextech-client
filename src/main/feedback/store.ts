import { appendFileSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { logger } from '../logger'
import type { FeedbackReport } from '../../shared/feedback-types'

/**
 * File d'attente locale des signalements, en JSONL (une ligne = un rapport).
 *
 * Le clic en jeu ne doit **jamais** dépendre du réseau : on écrit d'abord ici,
 * l'envoi vient après. Tout est tolérant aux lignes corrompues — un fichier
 * abîmé ne doit pas faire perdre les rapports valides ni planter l'app.
 */

/** Garde-fou : au-delà, on jette les plus anciens (réseau HS durablement). */
const MAX_PENDING = 200

export class FeedbackStore {
  constructor(private readonly filePath: string) {}

  append(report: FeedbackReport): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      appendFileSync(this.filePath, JSON.stringify(report) + '\n', 'utf8')
      this.trim()
    } catch (err) {
      logger.warn('feedback: écriture impossible', String(err))
    }
  }

  /** Rapports en attente, lignes illisibles ignorées. */
  readAll(): FeedbackReport[] {
    let raw: string
    try {
      raw = readFileSync(this.filePath, 'utf8')
    } catch {
      return []
    }
    const out: FeedbackReport[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as FeedbackReport
        if (parsed && typeof parsed.id === 'string') out.push(parsed)
      } catch {
        /* ligne corrompue : ignorée */
      }
    }
    return out
  }

  count(): number {
    return this.readAll().length
  }

  /** Rapports pas encore envoyés — les seuls qu'un envoi doit reprendre. */
  pending(): FeedbackReport[] {
    return this.readAll().filter((r) => !r.sentAt)
  }

  countPending(): number {
    return this.pending().length
  }

  /** Retire des rapports de la file locale (par id). Réécriture atomique. */
  remove(ids: Set<string>): void {
    const keep = this.readAll().filter((r) => !ids.has(r.id))
    this.write(keep)
  }

  /**
   * Marque des rapports comme envoyés. Ils restent en file — consultables mais
   * verrouillés — au lieu d'être supprimés : c'est la trace de ce qui est
   * effectivement parti.
   */
  markSent(ids: Set<string>, at: string): void {
    this.write(this.readAll().map((r) => (ids.has(r.id) ? { ...r, sentAt: at } : r)))
  }

  /**
   * Applique une modification à un rapport. `false` si l'id est inconnu **ou
   * déjà envoyé** : une ligne partie en base ne se modifie plus d'ici, et
   * laisser croire le contraire serait pire que refuser.
   */
  patch(id: string, changes: Partial<FeedbackReport>): boolean {
    const all = this.readAll()
    const i = all.findIndex((r) => r.id === id)
    if (i < 0 || all[i].sentAt) return false
    all[i] = { ...all[i], ...changes, id: all[i].id, sentAt: all[i].sentAt }
    this.write(all)
    return true
  }

  clear(): void {
    try {
      rmSync(this.filePath, { force: true })
    } catch {
      /* déjà absent */
    }
  }

  private write(reports: FeedbackReport[]): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      const tmp = `${this.filePath}.${process.pid}.tmp`
      writeFileSync(tmp, reports.map((r) => JSON.stringify(r)).join('\n') + (reports.length ? '\n' : ''), 'utf8')
      renameSync(tmp, this.filePath)
    } catch (err) {
      logger.warn('feedback: réécriture impossible', String(err))
    }
  }

  private trim(): void {
    const all = this.readAll()
    if (all.length <= MAX_PENDING) return
    // On sacrifie d'abord les rapports déjà envoyés : leur ligne est en base, on
    // ne perd qu'un historique de confort. Évincer un rapport encore en attente
    // le perdrait pour de bon.
    const excess = all.length - MAX_PENDING
    const dropped = new Set(
      all
        .filter((r) => r.sentAt)
        .slice(0, excess)
        .map((r) => r.id),
    )
    const kept = all.filter((r) => !dropped.has(r.id))
    this.write(kept.length > MAX_PENDING ? kept.slice(-MAX_PENDING) : kept)
  }
}
