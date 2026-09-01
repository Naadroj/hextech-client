/**
 * Moteur de recommandation d'itémisation (sous-projet « Coach »).
 *
 * - `model/`   — A2 : stats effectives, résistances/EHP, débit de dégâts (pur).
 * - `context/` — A3 : évaluation menace, fed-o-meter, rôles, déclencheurs (pur).
 * - `recommend/` — A4 : génération de candidats + scoring + justifications (pur).
 */
export * from './model'
export * from './context'
export * from './recommend'
