import type { LiveActivePlayer, LiveChampionStats, LiveGameData, LivePlayer } from '../../live-types'
import type { StatBlock } from '../../staticdata-types'
import { EMPTY_STATS } from '../model/stats'

/**
 * Adaptateurs Live Client Data API → types du moteur.
 */

/** Identifiant stable d'un joueur dans un instantané : Riot ID sinon nom d'invocateur. */
export function playerKey(p: { riotId?: string; summonerName?: string }): string {
  return p.riotId && p.riotId.length > 0 ? p.riotId : (p.summonerName ?? '')
}

/**
 * Convertit les stats calculées du joueur actif (Live API) en `StatBlock`
 * (convention : pourcentages en nombre entier).
 *
 * `critChance` / `lifeSteal` / `omnivamp` / `tenacity` sont des fractions 0..1
 * côté Live → multipliées par 100. Idem pour les % de pénétration (valeur de
 * base 0 en jeu ; TODO : re-vérifier la sémantique exacte en partie réelle).
 */
export function fromLiveChampionStats(cs: LiveChampionStats): StatBlock {
  const fracToPct = (v: number): number =>
    Number.isFinite(v) && v > 0 ? Math.max(0, Math.min(100, v * 100)) : 0
  return {
    ...EMPTY_STATS,
    health: cs.maxHealth,
    healthRegen: cs.healthRegenRate,
    mana: cs.resourceMax,
    manaRegen: cs.resourceRegenRate,
    armor: cs.armor,
    magicResist: cs.magicResist,
    attackDamage: cs.attackDamage,
    attackSpeed: cs.attackSpeed,
    attackRange: cs.attackRange,
    moveSpeed: cs.moveSpeed,
    critChance: fracToPct(cs.critChance),
    abilityPower: cs.abilityPower,
    abilityHaste: cs.abilityHaste,
    lethality: cs.physicalLethality,
    armorPenetrationPercent: fracToPct(cs.armorPenetrationPercent),
    magicPenetrationFlat: cs.magicPenetrationFlat,
    magicPenetrationPercent: fracToPct(cs.magicPenetrationPercent),
    lifeSteal: fracToPct(cs.lifeSteal),
    omnivamp: fracToPct(cs.omnivamp),
    tenacity: fracToPct(cs.tenacity),
  }
}

export interface SplitTeams {
  selfPlayer: LivePlayer
  selfActive: LiveActivePlayer
  allies: LivePlayer[]
  enemies: LivePlayer[]
}

/**
 * Localise le joueur actif dans `allPlayers` et répartit les 9 autres en alliés
 * / ennemis. `null` si le joueur actif est introuvable (spectateur, données
 * partielles).
 */
export function splitTeams(live: LiveGameData): SplitTeams | null {
  const active = live.activePlayer
  if (!active) return null
  const candidates = [active.riotId, active.summonerName]
    .filter((v): v is string => !!v && v.length > 0)
    .map((v) => v.toLowerCase())

  const selfPlayer = live.allPlayers.find((p) => {
    const keys = [playerKey(p), p.summonerName, p.riotIdGameName]
      .filter((v): v is string => !!v)
      .map((v) => v.toLowerCase())
    return keys.some((k) => candidates.includes(k))
  })
  if (!selfPlayer) return null

  const myTeam = selfPlayer.team
  return {
    selfPlayer,
    selfActive: active,
    allies: live.allPlayers.filter((p) => p.team === myTeam && p !== selfPlayer),
    enemies: live.allPlayers.filter((p) => p.team !== myTeam),
  }
}
