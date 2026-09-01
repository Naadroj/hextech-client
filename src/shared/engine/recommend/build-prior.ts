import type { NormalizedItem } from '../../staticdata-types'
import type { BuildBook, BuildItem, RoleBuild } from '../../build-types'
import type { GameAssessment } from '../context'
import type { ItemKind } from './types'

/**
 * *Prior de build* (phase A4.3) : bonus de score quand un item candidat fait
 * partie du build que les joueurs hi-elo achètent réellement sur ce champion +
 * rôle. Corrige les cas que le modèle de stats ne peut pas deviner (Nasus veut
 * de l'accélération avant du tank pour empiler son Q).
 *
 * Ce n'est qu'un terme du score : l'heuristique situationnelle (menace, tempo,
 * antisoin, QSS, stase) peut toujours faire remonter un item hors squelette.
 */

/** En-dessous de ce nombre d'échantillons, on ne fait pas confiance au squelette. */
export const BUILD_MIN_GAMES = 5
/** Poids d'un item `core` à l'ordre parfait (× pickRate × facteur d'ordre). */
export const BUILD_W_CORE = 1.7
/** Poids d'un item `situational` (× pickRate ; pas de signal d'ordre). */
export const BUILD_W_SITUATIONAL = 0.45
/** Poids des bottes du squelette (× pickRate). */
export const BUILD_W_BOOTS = 0.8
/** Largeur (en slots) de la fenêtre d'ordre autour de `avgSlot`. */
export const BUILD_SLOT_TOLERANCE = 2.5
/** Plancher du facteur d'ordre (un item core reste un peu favorisé hors fenêtre). */
export const BUILD_MIN_ORDER_FACTOR = 0.3

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

export interface BuildPrior {
  /** Terme additif du score (0 si l'item n'est pas dans le squelette). */
  value: number
  /** D'où vient le bonus, pour la justification. */
  kind: 'core' | 'situational' | 'boots' | null
  entry: BuildItem | null
  role: RoleBuild['role'] | null
  games: number
  /** Renseigné si l'entrée a été complétée avec le patch précédent. */
  patchSpan?: string
  /** Position de légendaire visée (`completedItemCount + 1`). */
  nextSlot: number
}

const NONE: BuildPrior = { value: 0, kind: null, entry: null, role: null, games: 0, nextSlot: 0 }

/**
 * Facteur d'ordre : 1 quand `avgSlot` colle au prochain légendaire à acheter,
 * décroît linéairement jusqu'à `BUILD_MIN_ORDER_FACTOR` au-delà de la fenêtre.
 */
function orderFactor(avgSlot: number, nextSlot: number): number {
  const gap = Math.abs(avgSlot - nextSlot)
  return clamp(1 - gap / BUILD_SLOT_TOLERANCE, BUILD_MIN_ORDER_FACTOR, 1)
}

export function buildPrior(
  item: NormalizedItem,
  a: GameAssessment,
  book: BuildBook | undefined,
  kind: ItemKind,
): BuildPrior {
  if (!book) return NONE
  const rb = book.getBuild(a.self.slug, a.self.role)
  if (!rb || rb.games < BUILD_MIN_GAMES) return NONE

  const nextSlot = a.self.completedItemCount + 1
  const common = { role: rb.role, games: rb.games, patchSpan: rb.patchSpan, nextSlot }

  if (kind === 'boots') {
    const b = rb.boots.find((x) => x.id === item.id)
    if (!b) return NONE
    return { value: BUILD_W_BOOTS * b.pickRate, kind: 'boots', entry: b, ...common }
  }

  const core = rb.core.find((x) => x.id === item.id)
  if (core) {
    const value = BUILD_W_CORE * core.pickRate * orderFactor(core.avgSlot, nextSlot)
    return { value, kind: 'core', entry: core, ...common }
  }

  const sit = rb.situational.find((x) => x.id === item.id)
  if (sit) {
    return { value: BUILD_W_SITUATIONAL * sit.pickRate, kind: 'situational', entry: sit, ...common }
  }

  return NONE
}
