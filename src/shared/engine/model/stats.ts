import type { NormalizedItem, StatBlock } from '../../staticdata-types'

/**
 * Couche modèle — agrégation de stats (A2). Fonctions **pures**, sans accès aux
 * données statiques ni au réseau : elles prennent des `StatBlock` /
 * `NormalizedItem` déjà normalisés en entrée.
 *
 * Rappel de convention : les champs en % de `StatBlock` sont des entiers
 * (« 40 % » → `40`).
 */

export const ATTACK_SPEED_CAP = 2.5
export const CRIT_CHANCE_CAP = 100

/** Champs de `StatBlock` qui s'additionnent simplement entre couches. */
const ADDITIVE_KEYS = [
  'health',
  'healthRegen',
  'mana',
  'manaRegen',
  'armor',
  'magicResist',
  'attackDamage',
  'attackRange',
  'bonusAttackSpeedPercent',
  'moveSpeed',
  'moveSpeedPercent',
  'critChance',
  'abilityPower',
  'abilityHaste',
  'lethality',
  'armorPenetrationPercent',
  'magicPenetrationFlat',
  'magicPenetrationPercent',
  'lifeSteal',
  'omnivamp',
  'healAndShieldPower',
  'tenacity',
] as const satisfies readonly (keyof StatBlock)[]

export const EMPTY_STATS: StatBlock = {
  health: 0,
  healthRegen: 0,
  mana: 0,
  manaRegen: 0,
  armor: 0,
  magicResist: 0,
  attackDamage: 0,
  attackSpeed: 0,
  bonusAttackSpeedPercent: 0,
  attackRange: 0,
  moveSpeed: 0,
  moveSpeedPercent: 0,
  critChance: 0,
  abilityPower: 0,
  abilityHaste: 0,
  lethality: 0,
  armorPenetrationPercent: 0,
  magicPenetrationFlat: 0,
  magicPenetrationPercent: 0,
  lifeSteal: 0,
  omnivamp: 0,
  healAndShieldPower: 0,
  tenacity: 0,
}

/** Somme, champ par champ, une liste de couches de stats partielles. */
export function sumStats(...layers: Partial<StatBlock>[]): Partial<StatBlock> {
  const out: Partial<StatBlock> = {}
  for (const layer of layers) {
    for (const key of ADDITIVE_KEYS) {
      const v = layer[key]
      if (typeof v === 'number' && v !== 0) out[key] = (out[key] ?? 0) + v
    }
    if (typeof layer.attackSpeed === 'number' && layer.attackSpeed !== 0) {
      out.attackSpeed = (out.attackSpeed ?? 0) + layer.attackSpeed
    }
  }
  return out
}

/** Agrège les stats plates de plusieurs items (hors vitesse d'attaque de base). */
export function aggregateItemStats(items: NormalizedItem[]): Partial<StatBlock> {
  return sumStats(...items.map((i) => i.stats))
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/**
 * Combine des stats de **base** (champion à un niveau donné) avec les stats
 * d'**items** et une couche `extra` optionnelle (runes, buffs). Retourne un
 * `StatBlock` complet où :
 *  - `attackSpeed` et `moveSpeed` sont les valeurs **effectives** finales ;
 *  - `bonusAttackSpeedPercent` / `moveSpeedPercent` conservent le bonus agrégé
 *    (pour transparence / affichage), déjà appliqué aux deux champs ci-dessus.
 */
export function effectiveStats(
  base: StatBlock,
  items: NormalizedItem[],
  extra: Partial<StatBlock> = {},
): StatBlock {
  const bonus = sumStats(aggregateItemStats(items), extra)
  const out: StatBlock = { ...base }

  for (const key of ADDITIVE_KEYS) {
    out[key] = (base[key] ?? 0) + (bonus[key] ?? 0)
  }

  const bonusAsPct = bonus.bonusAttackSpeedPercent ?? 0
  out.bonusAttackSpeedPercent = (base.bonusAttackSpeedPercent ?? 0) + bonusAsPct
  out.attackSpeed = clamp(
    base.attackSpeed * (1 + out.bonusAttackSpeedPercent / 100),
    0,
    ATTACK_SPEED_CAP,
  )

  const flatMs = (base.moveSpeed ?? 0) + (bonus.moveSpeed ?? 0)
  out.moveSpeedPercent = (base.moveSpeedPercent ?? 0) + (bonus.moveSpeedPercent ?? 0)
  out.moveSpeed = flatMs * (1 + out.moveSpeedPercent / 100)

  out.critChance = clamp(out.critChance, 0, CRIT_CHANCE_CAP)
  return out
}

/**
 * Ajoute les stats d'**un** item à un `StatBlock` déjà **effectif** (ex. les
 * `championStats` de la Live API). Contrairement à `effectiveStats`, ne replie
 * que le bonus de vitesse d'attaque / déplacement **de cet item** sur les
 * valeurs courantes — pour la comparaison marginale « avec / sans l'item » (A4).
 */
export function addItemStats(current: StatBlock, item: NormalizedItem): StatBlock {
  const s = item.stats
  const out: StatBlock = { ...current }
  for (const key of ADDITIVE_KEYS) {
    if (
      key === 'bonusAttackSpeedPercent' ||
      key === 'moveSpeed' ||
      key === 'moveSpeedPercent'
    ) {
      continue
    }
    out[key] = (current[key] ?? 0) + (s[key] ?? 0)
  }

  const itemAsPct = s.bonusAttackSpeedPercent ?? 0
  out.bonusAttackSpeedPercent = (current.bonusAttackSpeedPercent ?? 0) + itemAsPct
  out.attackSpeed = clamp(current.attackSpeed * (1 + itemAsPct / 100), 0, ATTACK_SPEED_CAP)

  const itemMsPct = s.moveSpeedPercent ?? 0
  out.moveSpeedPercent = (current.moveSpeedPercent ?? 0) + itemMsPct
  out.moveSpeed = (current.moveSpeed + (s.moveSpeed ?? 0)) * (1 + itemMsPct / 100)

  out.critChance = clamp(out.critChance, 0, CRIT_CHANCE_CAP)
  return out
}
