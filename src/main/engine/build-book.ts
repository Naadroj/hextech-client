import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { logger } from '../logger'
import { fetchJson, type Fetcher } from '../staticdata/fetcher'
import {
  EMPTY_BUILD_BOOK,
  indexBuildBook,
  type BuildBook,
  type BuildBookFile,
} from '../../shared/build-types'

/**
 * Squelette de build hi-elo (phase A4.3). Deux sources sur disque —
 * `resources/builds.json` **embarqué** (repli offline) et une copie **cache**
 * dans `userData/` rafraîchie depuis une Release GitHub — plus un
 * téléchargement en tâche de fond au démarrage. Aucune clé Riot côté client :
 * le fichier est pré-agrégé par la CI (`.github/workflows/build-book.yml`).
 */

/**
 * URL du `builds.json` publié. **Aligner `owner/repo` sur `electron-builder.yml`**
 * (bloc `publish:`). Surchargeable par `HEXTECH_BUILDS_URL` (tests / fork).
 */
export const BUILD_BOOK_URL =
  process.env['HEXTECH_BUILDS_URL'] ??
  'https://github.com/Naadroj/hextech-client/releases/download/builds-latest/builds.json'

function isValidBuildBookFile(v: unknown): v is BuildBookFile {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o['patch'] === 'string' && Array.isArray(o['builds'])
}

function readLocal(path: string): BuildBookFile | null {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    return isValidBuildBookFile(parsed) ? parsed : null
  } catch {
    return null
  }
}

export interface ResolveOptions {
  /** `resources/builds.json` embarqué. */
  bundledPath: string
  /** `userData/builds.json` — copie rafraîchie (peut ne pas exister). */
  cachePath: string
  /** Patch du catalogue courant : on préfère un livre au même patch. */
  currentPatch?: string
}

/**
 * Choisit le meilleur livre disponible **sur disque** (synchrone, au démarrage).
 * Préférence : patch == `currentPatch`, sinon le plus gros échantillon.
 */
export function resolveBuildBook(opts: ResolveOptions): BuildBook {
  const cache = readLocal(opts.cachePath)
  const bundled = readLocal(opts.bundledPath)
  const candidates = [cache, bundled].filter((x): x is BuildBookFile => !!x)
  if (candidates.length === 0) {
    logger.info('Squelette de build : aucun fichier lisible — prior de build désactivé')
    return EMPTY_BUILD_BOOK
  }
  const pick =
    candidates.find((c) => !!opts.currentPatch && c.patch === opts.currentPatch) ??
    [...candidates].sort((a, b) => (b.sampleGames ?? 0) - (a.sampleGames ?? 0))[0]
  const book = indexBuildBook(pick)
  logger.info(
    `Squelette de build : patch ${pick.patch}, ${book.entryCount} couples champion+rôle ` +
      `(${pick.sampleGames} parties, ${pick === cache ? 'cache' : 'embarqué'})`,
  )
  return book
}

export interface RefreshOptions {
  cachePath: string
  /** Patch du catalogue courant : un livre distant d'un autre patch est ignoré. */
  currentPatch: string
  url?: string
  fetcher?: Fetcher
}

/**
 * Télécharge le livre publié et l'écrit dans le cache **si et seulement si** il
 * correspond au patch courant. Retourne le nouveau livre, ou `null` si rien n'a
 * changé (réseau KO, format invalide, patch différent).
 */
export async function refreshBuildBook(opts: RefreshOptions): Promise<BuildBook | null> {
  const url = opts.url ?? BUILD_BOOK_URL
  let file: BuildBookFile
  try {
    const raw = await fetchJson<unknown>(url, { fetcher: opts.fetcher, attempts: 2 })
    if (!isValidBuildBookFile(raw)) {
      logger.warn('Squelette de build distant : format invalide, ignoré')
      return null
    }
    file = raw
  } catch (err) {
    logger.info(`Squelette de build distant indisponible (${String(err)}) — version locale conservée`)
    return null
  }

  if (file.patch !== opts.currentPatch) {
    logger.info(
      `Squelette de build distant en patch ${file.patch} ≠ catalogue ${opts.currentPatch} — ignoré`,
    )
    return null
  }

  try {
    await mkdir(dirname(opts.cachePath), { recursive: true })
    const tmp = `${opts.cachePath}.${process.pid}.tmp`
    await writeFile(tmp, JSON.stringify(file), 'utf8')
    await rename(tmp, opts.cachePath)
  } catch (err) {
    logger.warn(`Cache squelette de build non écrit : ${String(err)}`)
  }

  const book = indexBuildBook(file)
  logger.info(
    `Squelette de build rafraîchi : patch ${file.patch}, ${book.entryCount} couples ` +
      `(${file.sampleGames} parties)`,
  )
  return book
}
