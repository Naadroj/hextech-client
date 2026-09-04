import type { BuildAxis } from './build-types'

/**
 * Historique **local** des propositions du coach, une entrée par changement de
 * recommandation. Ne sort jamais de la machine de son propre chef : il sert à
 * relire sa partie après coup (« pourquoi il m'a dit ça à la 14e minute ? ») et
 * il est joint aux signalements pour donner le fil de la décision contestée.
 */

/** Un item tel qu'il a été proposé, réduit à ce qu'on veut relire. */
export interface HistoryItem {
  itemId: number
  name: string
}

/** Une proposition, horodatée dans le temps de jeu. */
export interface HistoryStep {
  /** Temps de jeu (secondes). */
  t: number
  /** Horodatage réel (ISO), pour recouper avec les logs. */
  at: string
  gold: number
  level: number
  /** Items du cœur de build déjà possédés à cet instant. */
  completedItems: number
  /** Axe forcé par l'utilisateur à cet instant (`null` = auto). */
  axis: BuildAxis | null
  primary: (HistoryItem & { goldTotal: number; affordable: boolean; reason: string | null }) | null
  alternatives: HistoryItem[]
  boots: HistoryItem | null
}

/** En-tête d'une partie enregistrée (1re ligne du fichier). */
export interface HistoryGameMeta {
  kind: 'meta'
  id: string
  startedAt: string
  champion: string
  role: string
  patch: string
}

/** Ce que le renderer reçoit : en-tête + nombre d'étapes, sans le détail. */
export interface HistoryGameSummary {
  id: string
  startedAt: string
  champion: string
  role: string
  patch: string
  steps: number
  /** Dernier item proposé de la partie (`null` si aucun). */
  lastItem: HistoryItem | null
}

/** Une partie complète, en-tête + étapes. */
export interface HistoryGame {
  meta: HistoryGameMeta
  steps: HistoryStep[]
}
