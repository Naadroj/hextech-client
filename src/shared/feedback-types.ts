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

/**
 * Catégorie du signalement. **Obligatoire** : un rapport sans motif n'est pas
 * exploitable — on ne sait pas quoi rejouer ni quoi corriger. Le clic rapide
 * ouvre donc le choix du motif, il n'envoie jamais tout seul.
 */
export type FeedbackReason = 'too-defensive' | 'wrong-axis' | 'wrong-order' | 'other'

export const FEEDBACK_REASONS: { code: FeedbackReason; label: string }[] = [
  { code: 'too-defensive', label: 'Trop défensif' },
  { code: 'wrong-axis', label: 'Mauvais axe AD/AP' },
  { code: 'wrong-order', label: 'Mauvais ordre' },
  { code: 'other', label: 'Autre' },
]

export const FEEDBACK_REASON_LABELS: Record<FeedbackReason, string> = Object.fromEntries(
  FEEDBACK_REASONS.map((r) => [r.code, r.label]),
) as Record<FeedbackReason, string>

/** Longueur max du commentaire libre ajouté depuis l'app. */
export const FEEDBACK_COMMENT_MAX = 1000

/** Ce que l'overlay demande d'enregistrer (le main complète le reste). */
export interface FeedbackDraft {
  /** Item contesté. `null` = pas de reco affichée (signalement « rien de pertinent »). */
  itemId: number | null
  /** 0 = primaire, 1-2 = alternative. */
  itemRank: number
  /** Motif — jamais `null` : sans lui le rapport n'est pas exploitable. */
  reasonCode: FeedbackReason
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
  reasonCode: FeedbackReason
  /** Précisions ajoutées après coup depuis l'onglet Signalements. */
  comment: string | null
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
  /** Envoi des signalements autorisé (interrupteur des Réglages). */
  enabled: boolean
  /** Rapports en attente d'envoi (file locale). */
  pending: number
  /** Dernier envoi réussi (ISO) ou `null`. */
  lastSentAt: string | null
  /** Identifiants Supabase présents dans ce build (sinon l'envoi est inerte). */
  configured: boolean
}

/** Résultat d'un envoi manuel. */
export interface FeedbackPushResult {
  sent: number
  /** Restés en file (réseau HS, ou envoi non configuré / désactivé). */
  remaining: number
  /** Pourquoi rien n'est parti, le cas échéant. */
  error: 'disabled' | 'not-configured' | 'network' | null
  /**
   * Message brut renvoyé par la base (colonne manquante, policy RLS, DNS…).
   * Affiché tel quel : un envoi qui échoue sans dire pourquoi est indébogable.
   */
  detail: string | null
}

export const IDLE_FEEDBACK_STATE: FeedbackState = {
  enabled: true,
  pending: 0,
  lastSentAt: null,
  configured: false,
}
