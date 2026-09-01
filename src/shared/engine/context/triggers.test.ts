import { describe, it, expect } from 'vitest'
import { assessTriggers } from './triggers'
import { assessThreat } from './threat'
import { assessFed } from './fed'
import { inferRoles } from './roles'
import { playerKey } from './live-adapter'
import { makeStaticData, livePlayer } from './fixtures'
import { EMPTY_STATS } from '../model'
import type { LivePlayer } from '../../live-types'

const SELF_STATS = { ...EMPTY_STATS, health: 1900, armor: 55, magicResist: 40 }

const sd = makeStaticData()
const rolesOf = (players: LivePlayer[]) => inferRoles(players, (s) => sd.getDamageProfile(s), playerKey)

function threatFor(enemies: LivePlayer[]) {
  const fed = assessFed(enemies, sd)
  return assessThreat({ enemies, fed, roles: rolesOf(enemies), staticData: sd })
}

const base = {
  selfPlayer: livePlayer({ champion: 'Caitlyn' }),
  selfStats: SELF_STATS,
  selfFed: 0,
  gameTimeSeconds: 1200,
  staticData: sd,
}

describe('assessTriggers — soin ennemi', () => {
  it('champion sustain + item de vol de vie ⇒ heavy', () => {
    const enemies = [
      livePlayer({ champion: 'Soraka', team: 'CHAOS' }),
      livePlayer({ champion: 'Aatrox', team: 'CHAOS', items: [3072] }), // Bloodthirster 15% LS
    ]
    const t = assessTriggers({ ...base, enemies, threat: threatFor(enemies) })
    expect(t.enemyHealing).toBe('heavy')
  })

  it('aucun soin ⇒ none', () => {
    const enemies = [livePlayer({ champion: 'Zed', team: 'CHAOS' }), livePlayer({ champion: 'Syndra', team: 'CHAOS' })]
    expect(assessTriggers({ ...base, enemies, threat: threatFor(enemies) }).enemyHealing).toBe('none')
  })
})

describe('assessTriggers — CC / burst / auto-attaquants', () => {
  it('≥ 2 rôles à CC dur ⇒ enemyHardCC', () => {
    const enemies = [
      livePlayer({ champion: 'Malphite', team: 'CHAOS' }), // TANK/VANGUARD
      livePlayer({ champion: 'Soraka', team: 'CHAOS' }),
    ]
    // Soraka = ENCHANTER, pas CC dur → un seul → false
    expect(assessTriggers({ ...base, enemies, threat: threatFor(enemies) }).enemyHardCC).toBe(false)

    const twoCC = [
      livePlayer({ champion: 'Malphite', team: 'CHAOS' }),
      livePlayer({ champion: 'Malphite', team: 'CHAOS' }),
    ]
    expect(assessTriggers({ ...base, enemies: twoCC, threat: threatFor(twoCC) }).enemyHardCC).toBe(true)
  })

  it('menace principale = Zed fed ⇒ enemyBurstPhysical', () => {
    const enemies = [
      livePlayer({ champion: 'Zed', team: 'CHAOS', level: 15, items: [3031, 3072], kills: 12, deaths: 1 }),
      livePlayer({ champion: 'Soraka', team: 'CHAOS', level: 10, kills: 0, deaths: 6 }),
    ]
    const t = assessTriggers({ ...base, enemies, threat: threatFor(enemies) })
    expect(t.enemyBurstPhysical).toBe(true)
    expect(t.enemyBurstMagic).toBe(false)
  })

  it('≥ 2 tireurs ⇒ enemyAutoAttackers', () => {
    const enemies = [
      livePlayer({ champion: 'Caitlyn', team: 'CHAOS' }),
      livePlayer({ champion: 'Caitlyn', team: 'CHAOS' }),
      livePlayer({ champion: 'Soraka', team: 'CHAOS' }),
    ]
    expect(assessTriggers({ ...base, enemies, threat: threatFor(enemies) }).enemyAutoAttackers).toBe(true)
  })
})

describe('assessTriggers — état du joueur', () => {
  const enemies = [livePlayer({ champion: 'Zed', team: 'CHAOS' })]
  it('beaucoup de morts sans avance ⇒ beingFocused', () => {
    const t = assessTriggers({
      ...base,
      enemies,
      threat: threatFor(enemies),
      selfPlayer: livePlayer({ champion: 'Caitlyn', deaths: 6 }),
      selfFed: -0.3,
    })
    expect(t.beingFocused).toBe(true)
  })
  it('avance nette ⇒ aheadHard, retard net ⇒ behindHard', () => {
    expect(assessTriggers({ ...base, enemies, threat: threatFor(enemies), selfFed: 1.3 }).aheadHard).toBe(true)
    expect(assessTriggers({ ...base, enemies, threat: threatFor(enemies), selfFed: -0.9 }).behindHard).toBe(true)
  })
})
