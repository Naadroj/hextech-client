import { EventEmitter } from 'node:events'
import { DDRAGON_LOCALE } from './ddragon'
import {
  fetchLatestVersion,
  fetchLocalizedItemNames,
  fetchRawChampions,
  fetchRawItems,
  fetchRawRunes,
  fetchRawSummoners,
  normalizeChampions,
  normalizeItems,
  normalizeRunes,
  normalizeSummoners,
} from './ddragon'
import { deriveDamageProfiles, fetchMerakiChampions } from './meraki'
import { deriveSpellDamage } from './spell-damage'
import { compareVersions, readSnapshot, writeSnapshot } from './snapshot'
import type { Fetcher } from './fetcher'
import type { SnapshotMeta, StaticSnapshot } from './types'
import { indexSnapshot } from '../../shared/static-index'
import type { StaticData, StaticDataSummary } from '../../shared/staticdata-types'

export * from './types'
export { indexSnapshot } from '../../shared/static-index'
export { DDRAGON_LOCALE } from './ddragon'
export { compareVersions } from './snapshot'

// ─── Construction d'un snapshot depuis le réseau ──────────────────────────

export interface BuildSnapshotOptions {
  fetcher?: Fetcher
  /** Version cible ; par défaut la dernière publiée. */
  version?: string
  now?: () => Date
}

/**
 * Récupère Data Dragon (+ Meraki) et assemble un `StaticSnapshot` complet.
 * Si Meraki est injoignable, les profils de dégâts retombent sur le repli
 * Data Dragon pour ce build (corrigé au rafraîchissement suivant).
 */
export async function fetchAndBuildSnapshot(
  options: BuildSnapshotOptions = {},
): Promise<StaticSnapshot> {
  const now = options.now ?? (() => new Date())
  const version = options.version ?? (await fetchLatestVersion({ fetcher: options.fetcher }))

  const [rawItems, rawChamps, rawRunes, rawSummoners, itemNamesFr] = await Promise.all([
    fetchRawItems(version, { fetcher: options.fetcher }),
    fetchRawChampions(version, { fetcher: options.fetcher }),
    fetchRawRunes(version, { fetcher: options.fetcher }),
    fetchRawSummoners(version, { fetcher: options.fetcher }),
    fetchLocalizedItemNames(version, { fetcher: options.fetcher }),
  ])

  let meraki = null
  try {
    meraki = await fetchMerakiChampions({ fetcher: options.fetcher })
  } catch {
    // Meraki en retard sur le patch : repli Data Dragon pour ce build.
  }

  const champions = normalizeChampions(rawChamps)
  return {
    meta: {
      version,
      locale: DDRAGON_LOCALE,
      fetchedAt: now().toISOString(),
      merakiVersion: meraki ? version : null,
      origin: 'cache',
    },
    items: normalizeItems(rawItems, itemNamesFr),
    champions,
    damageProfiles: deriveDamageProfiles(champions, meraki),
    spellDamage: deriveSpellDamage(champions, meraki),
    runes: normalizeRunes(rawRunes),
    summonerSpells: normalizeSummoners(rawSummoners),
  }
}

// ─── Contrôleur ───────────────────────────────────────────────────────────

export interface StaticDataController {
  readonly data: StaticData
  readonly meta: SnapshotMeta
  /** Promesse du rafraîchissement lancé au démarrage (`null` si désactivé). */
  readonly refreshing: Promise<boolean> | null
  /** Force une vérification de patch. Retourne `true` si le snapshot a changé. */
  refresh(force?: boolean): Promise<boolean>
  /** Résumé compact pour le renderer / diagnostics. */
  summary(): StaticDataSummary
  onUpdated(cb: (meta: SnapshotMeta) => void): () => void
  dispose(): void
}

export interface CreateStaticDataOptions {
  /** `resources/staticdata/snapshot.json` embarqué (obligatoire, offline). */
  bundledSnapshotPath: string
  /** `userData/staticdata/snapshot.json` : cible des rafraîchissements. */
  cacheSnapshotPath: string
  fetcher?: Fetcher
  /** Coupe tout accès réseau (tests / offline forcé). */
  offline?: boolean
  /** Lance un rafraîchissement en tâche de fond au démarrage (défaut : true). */
  autoRefresh?: boolean
  /** Fournisseur d'horloge (tests). */
  now?: () => Date
}

/**
 * Charge le meilleur snapshot disponible (cache userData sinon embarqué) et,
 * sauf `offline`, lance un rafraîchissement en tâche de fond si un patch plus
 * récent est publié. L'app est utilisable immédiatement, hors ligne inclus.
 */
export async function createStaticData(
  opts: CreateStaticDataOptions,
): Promise<StaticDataController> {
  const now = opts.now ?? (() => new Date())
  const fromCache = await readSnapshot(opts.cacheSnapshotPath)
  const fromBundle = fromCache ? null : await readSnapshot(opts.bundledSnapshotPath)
  const initial = fromCache ?? fromBundle

  if (!initial) {
    throw new Error(
      `Aucun snapshot de données statiques : ni ${opts.cacheSnapshotPath} ni ${opts.bundledSnapshotPath}`,
    )
  }
  initial.meta.origin = fromCache ? 'cache' : 'bundled'

  const emitter = new EventEmitter()
  let currentSnapshot: StaticSnapshot = initial
  let indexed: StaticData = indexSnapshot(initial)
  let running: Promise<boolean> | null = null

  async function doRefresh(force: boolean): Promise<boolean> {
    if (opts.offline) return false
    const version = await fetchLatestVersion({ fetcher: opts.fetcher })
    const current = currentSnapshot.meta
    const newerPatch = compareVersions(version, current.version) > 0

    // On (re)construit si : demandé explicitement, ou patch plus récent publié,
    // ou on tourne encore sur l'embarqué (pas encore de copie cache figée).
    if (!force && !newerPatch && current.origin === 'cache') return false

    const next = await fetchAndBuildSnapshot({ fetcher: opts.fetcher, version, now })
    await writeSnapshot(opts.cacheSnapshotPath, next)
    currentSnapshot = next
    indexed = indexSnapshot(next)
    emitter.emit('updated', next.meta)
    return true
  }

  function refresh(force = false): Promise<boolean> {
    if (running) return running
    running = doRefresh(force).finally(() => {
      running = null
    })
    return running
  }

  if (opts.autoRefresh !== false && !opts.offline) {
    running = doRefresh(false)
      .catch(() => false)
      .finally(() => {
        running = null
      })
  }

  function summary(): StaticDataSummary {
    const snap = currentSnapshot
    const sources = { meraki: 0, ddragon: 0, override: 0 }
    for (const p of snap.damageProfiles) sources[p.source] += 1
    return {
      version: snap.meta.version,
      locale: snap.meta.locale,
      source: snap.meta.origin,
      fetchedAt: snap.meta.fetchedAt,
      merakiVersion: snap.meta.merakiVersion,
      itemCount: snap.items.length,
      championCount: snap.champions.length,
      runeCount: snap.runes.length,
      summonerSpellCount: snap.summonerSpells.length,
      damageProfileSources: sources,
      updating: running !== null,
    }
  }

  return {
    get data() {
      return indexed
    },
    get meta() {
      return currentSnapshot.meta
    },
    get refreshing() {
      return running
    },
    refresh,
    summary,
    onUpdated(cb) {
      emitter.on('updated', cb)
      return () => emitter.off('updated', cb)
    },
    dispose() {
      emitter.removeAllListeners()
    },
  }
}
