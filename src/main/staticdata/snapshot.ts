import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { StaticSnapshot } from './types'

/**
 * Lecture / écriture d'un snapshot de données statiques sur disque. Un snapshot
 * = un unique fichier JSON (`meta` + items + champions + profils + runes +
 * sorts) pour un patch donné.
 */

/** Garde de forme : suffisant pour rejeter un fichier corrompu ou d'une autre version du schéma. */
export function isValidSnapshot(v: unknown): v is StaticSnapshot {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  const meta = o['meta'] as Record<string, unknown> | undefined
  return (
    !!meta &&
    typeof meta['version'] === 'string' &&
    Array.isArray(o['items']) &&
    (o['items'] as unknown[]).length > 0 &&
    Array.isArray(o['champions']) &&
    (o['champions'] as unknown[]).length > 0 &&
    Array.isArray(o['damageProfiles']) &&
    Array.isArray(o['runes']) &&
    Array.isArray(o['summonerSpells'])
  )
}

export async function readSnapshot(filePath: string): Promise<StaticSnapshot | null> {
  try {
    const raw = await readFile(filePath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    return isValidSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Écriture atomique : fichier temporaire puis `rename`. */
export async function writeSnapshot(filePath: string, snapshot: StaticSnapshot): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(snapshot), 'utf8')
  await rename(tmp, filePath)
}

/**
 * Compare deux versions de patch façon « 16.17.1 ». Retourne <0, 0 ou >0.
 * Les segments non numériques sont traités comme 0.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.')
  const pb = b.split('.')
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = Number.parseInt(pa[i] ?? '0', 10) || 0
    const nb = Number.parseInt(pb[i] ?? '0', 10) || 0
    if (na !== nb) return na - nb
  }
  return 0
}
