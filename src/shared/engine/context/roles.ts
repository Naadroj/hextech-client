import type { LivePlayer } from '../../live-types'
import type { DamageProfile } from '../../staticdata-types'
import type { InferredRole } from './types'

/**
 * Déduction du rôle d'un joueur : `position` de la Live API si fiable, sinon
 * repli sorts d'invocateur + rôles Meraki.
 */

function hasSpell(p: LivePlayer, needle: string): boolean {
  const spells = [p.summonerSpells?.summonerSpellOne, p.summonerSpells?.summonerSpellTwo]
  return spells.some(
    (s) =>
      s?.displayName?.toLowerCase().includes(needle) ||
      s?.rawDisplayName?.toLowerCase().includes(needle),
  )
}

const POSITION_MAP: Record<string, InferredRole> = {
  TOP: 'TOP',
  JUNGLE: 'JUNGLE',
  MIDDLE: 'MID',
  MID: 'MID',
  BOTTOM: 'BOT',
  BOT: 'BOT',
  UTILITY: 'SUPPORT',
  SUPPORT: 'SUPPORT',
}

export function inferRole(p: LivePlayer, profile: DamageProfile | undefined): InferredRole {
  const pos = POSITION_MAP[(p.position ?? '').toUpperCase()]
  if (pos) return pos

  if (hasSpell(p, 'smite')) return 'JUNGLE'

  const roles = (profile?.roles ?? []).map((r) => r.toUpperCase())
  if (roles.includes('SUPPORT') || roles.includes('ENCHANTER')) return 'SUPPORT'
  // Un « catcher » / « warden » peut être solo lane (Poppy top…) : on ne tranche
  // support que s'il porte aussi Exhaust.
  if ((roles.includes('CATCHER') || roles.includes('WARDEN')) && hasSpell(p, 'exhaust')) {
    return 'SUPPORT'
  }
  if (roles.includes('MARKSMAN')) return 'BOT'
  if (roles.includes('MAGE') || roles.includes('ASSASSIN') || roles.includes('BURST')) return 'MID'
  return 'TOP'
}

/** Rôles pour tous les joueurs d'une liste, indexés par `playerKey`. */
export function inferRoles(
  players: LivePlayer[],
  profileFor: (slug: string) => DamageProfile | undefined,
  keyOf: (p: LivePlayer) => string,
): Map<string, InferredRole> {
  const out = new Map<string, InferredRole>()
  for (const p of players) out.set(keyOf(p), inferRole(p, profileFor(p.championName)))
  return out
}
