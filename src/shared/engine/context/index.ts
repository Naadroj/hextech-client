import type { LiveGameData } from '../../live-types'
import type { StaticData } from '../../staticdata-types'
import { fromLiveChampionStats, playerKey, splitTeams } from './live-adapter'
import { inferRoles } from './roles'
import { assessFed } from './fed'
import { assessAllies, assessThreat, FALLBACK_PROFILE } from './threat'
import { assessTriggers } from './triggers'
import type { GameAssessment, SelfAssessment } from './types'

export * from './types'
export * from './live-adapter'
export * from './roles'
export * from './fed'
export * from './threat'
export * from './triggers'

/**
 * Transforme un instantané de partie en jeu (Live Client Data API) + le
 * catalogue statique en une **évaluation** complète pour le recommandeur (A4).
 * Fonction pure. `null` si le joueur actif est introuvable dans `allPlayers`.
 */
export function assessGame(live: LiveGameData, staticData: StaticData): GameAssessment | null {
  const teams = splitTeams(live)
  if (!teams) return null
  const { selfPlayer, selfActive, allies, enemies } = teams
  const gameTimeSeconds = live.gameData?.gameTime ?? 0

  const roles = inferRoles(
    live.allPlayers,
    (slug) => staticData.getDamageProfile(slug),
    playerKey,
  )

  const fed = assessFed(live.allPlayers, staticData)
  const selfKey = playerKey(selfPlayer)
  const selfFed = fed.get(selfKey)?.score ?? 0

  const selfProfile = staticData.getDamageProfile(selfPlayer.championName) ?? FALLBACK_PROFILE
  const selfBase = staticData.getChampionStatsAtLevel(selfPlayer.championName, selfPlayer.level)
  const cs = selfActive.championStats
  const resourceType = cs.resourceType || 'None'
  const manaConstrained =
    /mana/i.test(resourceType) &&
    cs.resourceMax > 0 &&
    (cs.resourceValue / cs.resourceMax < 0.25 || (selfPlayer.level <= 9 && cs.resourceMax < 900))

  const self: SelfAssessment = {
    key: selfKey,
    championId: selfProfile.championId,
    slug: selfPlayer.championName,
    level: selfPlayer.level,
    role: roles.get(selfKey) ?? 'UNKNOWN',
    currentGold: Math.round(selfActive.currentGold ?? 0),
    items: (selfPlayer.items ?? []).map((i) => i.itemID),
    completedItemCount: (selfPlayer.items ?? []).filter((i) => {
      const it = staticData.getItem(i.itemID)
      return !!it && it.isFinal && !it.isBoots && it.goldTotal >= 2000
    }).length,
    profile: selfProfile,
    stats: fromLiveChampionStats(cs),
    baseAttackDamage: selfBase?.attackDamage ?? cs.attackDamage * 0.5,
    baseHealth: selfBase?.health ?? cs.maxHealth * 0.6,
    resourceType,
    isManaConstrained: manaConstrained,
    fed: selfFed,
  }

  const threat = assessThreat({ enemies, fed, roles, staticData })

  return {
    gameTimeSeconds,
    self,
    threat,
    allies: assessAllies(allies, selfProfile, staticData),
    triggers: assessTriggers({
      enemies,
      selfPlayer,
      selfStats: self.stats,
      threat,
      selfFed,
      gameTimeSeconds,
      staticData,
    }),
  }
}
