import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { indexSnapshot } from '../../src/shared/static-index'
import type { StaticData } from '../../src/shared/staticdata-types'
import { EMPTY_BUILD_BOOK, indexBuildBook, type BuildBook } from '../../src/shared/build-types'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const RAW_DIR = resolve(ROOT, 'bench/raw')
export const SCENARIOS_DIR = resolve(ROOT, 'test/fixtures/pro-scenarios')

/** Catalogue statique depuis le snapshot embarqué. */
export function loadStaticData(): { data: StaticData; patch: string } {
  const snap = JSON.parse(readFileSync(resolve(ROOT, 'resources/staticdata/snapshot.json'), 'utf8'))
  return { data: indexSnapshot(snap), patch: patchOfVersion(snap.meta.version) }
}

/** Squelette de build committé (`resources/builds.json`) ; vide s'il n'existe pas. */
export function loadBuildBook(): BuildBook {
  try {
    return indexBuildBook(JSON.parse(readFileSync(resolve(ROOT, 'resources/builds.json'), 'utf8')))
  } catch {
    return EMPTY_BUILD_BOOK
  }
}

export function patchOfVersion(version: string): string {
  const p = String(version).split('.')
  return p.length >= 2 ? `${p[0]}.${p[1]}` : String(version)
}

/** Patch mineur précédent (`"16.17"` → `"16.16"`) ; `null` si indéterminable. */
export function previousPatch(patch: string): string | null {
  const [maj, min] = patch.split('.').map((n) => Number.parseInt(n, 10))
  if (!Number.isFinite(maj) || !Number.isFinite(min) || min <= 1) return null
  return `${maj}.${min - 1}`
}

/** Ids de matchs présents dans bench/raw/ (fichiers *.match.json). */
export function rawMatchIds(): string[] {
  try {
    return readdirSync(RAW_DIR)
      .filter((f) => f.endsWith('.match.json'))
      .map((f) => f.replace(/\.match\.json$/, ''))
  } catch {
    return []
  }
}

export function readRaw<T>(matchId: string, kind: 'match' | 'timeline'): T {
  return JSON.parse(readFileSync(resolve(RAW_DIR, `${matchId}.${kind}.json`), 'utf8')) as T
}
