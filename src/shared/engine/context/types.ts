import type { DamageProfile, StatBlock } from '../../staticdata-types'

/**
 * Types de la couche **contexte** (A3) : transforme un instantané de partie en
 * jeu (Live Client Data API) + le catalogue statique en une évaluation prête
 * pour le recommandeur (A4).
 */

export type InferredRole = 'TOP' | 'JUNGLE' | 'MID' | 'BOT' | 'SUPPORT' | 'UNKNOWN'
export type HealingLevel = 'none' | 'moderate' | 'heavy'
export type TeamId = 'ORDER' | 'CHAOS'

export interface DamageMixShares {
  physical: number
  magic: number
  true: number
}

/** Estimation d'avance/retard d'un joueur, auto-calibrée sur la moyenne du lobby. */
export interface FedAssessment {
  key: string
  slug: string
  /** -1,5 (très en retard) … 0 (à égalité) … +2,5 (fed). */
  score: number
  itemGoldValue: number
  kdaProxy: number
}

export interface EnemyThreat {
  key: string
  championId: number
  slug: string
  role: InferredRole
  level: number
  /** Poids de menace = poids de rôle × facteur d'avance. */
  weight: number
  fed: number
  profile: DamageProfile
  /** Résistances effectives estimées (stats de base au niveau + items portés). */
  effectiveStats: StatBlock
  items: number[]
}

export interface ThreatAssessment extends DamageMixShares {
  /** Part de la menace qui est burst (0..1). */
  burst: number
  sustained: number
  enemies: EnemyThreat[]
  /** Somme des poids de menace — « combien de dégâts arrive ». */
  totalScore: number
  primary: EnemyThreat | null
}

export interface SelfAssessment {
  key: string
  championId: number
  slug: string
  level: number
  role: InferredRole
  currentGold: number
  items: number[]
  completedItemCount: number
  profile: DamageProfile
  /**
   * Axe de dégâts **déjà engagé** par les achats (légendaires + composants), si
   * la répartition valeur-or est nette (≥ 70 % d'un côté). Renseigné par le
   * recommandeur (A4), pas par la couche contexte. Sert aux champions flex
   * (Shaco, Kayle…) : une fois un 1er item AD posé, on arrête de conseiller de l'AP.
   */
  committedAxis?: 'physical' | 'magic'
  /**
   * `true` si le champion n'a pas d'échappatoire fiable (dash / blink /
   * intangibilité). Rend le CC dur ennemi bien plus dangereux → poids QSS accru.
   */
  selfImmobile: boolean
  /** Stats effectives réelles, lues dans `activePlayer.championStats`. */
  stats: StatBlock
  /** AD de base au niveau (sans items) — pour les ratios « % bonus AD ». */
  baseAttackDamage: number
  /** PV de base au niveau (sans items) — pour les ratios « % bonus health ». */
  baseHealth: number
  resourceType: string
  isManaConstrained: boolean
  fed: number
}

export interface AllyAssessment extends DamageMixShares {
  hasFrontline: boolean
}

export interface SituationalTriggers {
  /** Sustain ennemi (kits + items de vol de vie/omnivamp) → antisoin. */
  enemyHealing: HealingLevel
  /** ≥ 2 ennemis à CC dur fiable → QSS / tenacité. */
  enemyHardCC: boolean
  /** Nombre d'ennemis à CC dur fiable (module la force du signal QSS/ténacité). */
  enemyHardCcCount: number
  /**
   * Létalité **graduée** du burst de la menace principale envers *moi*
   * maintenant (0 = négligeable, 1 = risque de one-shot). Combine avance de la
   * menace, poids de rôle, part burst et ma fragilité (EHP effectif).
   */
  burstSeverity: number
  /** `burstSeverity` élevée ET menace principale à dominante physique. */
  enemyBurstPhysical: boolean
  /** `burstSeverity` élevée ET menace principale à dominante magique. */
  enemyBurstMagic: boolean
  /** ≥ 2 tireurs / on-hit → Randuin / Cœur gelé / Épines. */
  enemyAutoAttackers: boolean
  /** On meurt beaucoup et on n'est pas en avance → spike défensif anticipé. */
  beingFocused: boolean
  /** Très en avance → build gourmand / snowball. */
  aheadHard: boolean
  /** Très en retard → build efficace / sûr. */
  behindHard: boolean
}

export interface GameAssessment {
  gameTimeSeconds: number
  self: SelfAssessment
  threat: ThreatAssessment
  allies: AllyAssessment
  triggers: SituationalTriggers
}
