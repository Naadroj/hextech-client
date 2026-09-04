import type { HistoryStep } from './history-types'
import type { LiveGameData } from './live-types'

/**
 * Signalement utilisateur : « l'item proposé n'est pas cohérent ».
 *
 * Le rapport embarque l'**instantané brut de la partie** (`LiveGameData`) au
 * moment du clic. C'est volontaire : il suffit à rejouer la décision hors ligne
 * (`assessGame` → `recommend`) et il a exactement la forme d'une fixture
 * `test/fixtures/pro-scenarios/`, donc un signalement traité devient un test de
 * non-régression en une commande.
 */

/** Catégorie optionnelle, proposée en mode déplié seulement. */
export type FeedbackReason = 'too-defensive' | 'wrong-axis' | 'wrong-order' | 'other'

export const FEEDBACK_REASONS: { code: FeedbackReason; label: string }[] = [
  { code: 'too-defensive', label: 'Trop défensif' },
  { code: 'wrong-axis', label: 'Mauvais axe AD/AP' },
  { code: 'wrong-order', label: 'Mauvais ordre' },
  { code: 'other', label: 'Autre' },
]

/** Ce que l'overlay demande d'envoyer (le main complète le reste). */
export interface FeedbackDraft {
  /** Item contesté. `null` = pas de reco affichée (signalement « rien de pertinent »). */
  itemId: number | null
  /** 0 = primaire, 1-2 = alternative. */
  itemRank: number
  reasonCode: FeedbackReason | null
}

/** Une ligne de la table `feedback`. */
export interface FeedbackReport {
  id: string
  createdAt: string
  /** UUID anonyme d'installation — aucune identité Riot. */
  installId: string
  appVersion: string
  /** Patch du catalogue statique. */
  patch: string
  /** Patch du squelette de build utilisé (`null` si aucun). */
  buildsPatch: string | null
  champion: string
  role: string
  level: number
  completedItems: number
  itemId: number | null
  itemRank: number
  reasonCode: FeedbackReason | null
  hadSkeleton: boolean
  skeletonGames: number | null
  /** Même forme qu'une fixture golden : rejouable tel quel. */
  snapshot: {
    meta: {
      champion: string
      role: string
      atSeconds: number
      patch: string
      expectedItemId: number | null
      expectedItemName: string | null
      expectedCategory: string
    }
    live: LiveGameData
    /**
     * Fil des propositions de la partie jusqu'au clic. Absent = pas
     * d'historique disponible. Vit dans `snapshot` (jsonb) exprès : le
     * rejeu golden n'en a pas besoin et la table n'a pas à changer.
     */
    history?: HistoryStep[]
  }
}

/** État exposé au renderer. */
export interface FeedbackState {
  /** Envoi des signalements activé. */
  enabled: boolean
  /** Rapports en attente d'envoi (file locale). */
  pending: number
  /** Dernier envoi réussi (ISO) ou `null`. */
  lastSentAt: string | null
}

export const IDLE_FEEDBACK_STATE: FeedbackState = {
  enabled: true,
  pending: 0,
  lastSentAt: null,
}
