import { describe, it, expect } from 'vitest'
import { inferRole } from './roles'
import { livePlayer } from './fixtures'
import type { DamageProfile } from '../../staticdata-types'

const prof = (roles: string[]): DamageProfile => ({
  championId: 1,
  slug: 'x',
  physical: 0.5,
  magic: 0.45,
  true: 0.05,
  attackType: 'RANGED',
  primary: 'mixed',
  pattern: 'mixed',
  roles,
  source: 'meraki',
})

describe('inferRole', () => {
  it('privilégie la position Live quand elle est renseignée', () => {
    expect(inferRole(livePlayer({ champion: 'Zed', position: 'MIDDLE' }), prof(['MARKSMAN']))).toBe(
      'MID',
    )
    expect(inferRole(livePlayer({ champion: 'Thresh', position: 'UTILITY' }), prof([]))).toBe(
      'SUPPORT',
    )
  })

  it('Smite ⇒ JUNGLE en l’absence de position', () => {
    expect(
      inferRole(livePlayer({ champion: 'LeeSin', spells: ['Smite', 'Flash'] }), prof(['SKIRMISHER'])),
    ).toBe('JUNGLE')
  })

  it('repli sur les rôles Meraki', () => {
    expect(inferRole(livePlayer({ champion: 'Caitlyn' }), prof(['MARKSMAN']))).toBe('BOT')
    expect(inferRole(livePlayer({ champion: 'Syndra' }), prof(['MAGE', 'BURST']))).toBe('MID')
    expect(inferRole(livePlayer({ champion: 'Soraka' }), prof(['ENCHANTER']))).toBe('SUPPORT')
    expect(inferRole(livePlayer({ champion: 'Ornn' }), prof(['TANK', 'JUGGERNAUT']))).toBe('TOP')
  })

  it('un warden solo-lane ne bascule support que s’il porte Exhaust', () => {
    expect(inferRole(livePlayer({ champion: 'Poppy', spells: ['Flash', 'Teleport'] }), prof(['WARDEN', 'VANGUARD']))).toBe('TOP')
    expect(inferRole(livePlayer({ champion: 'Poppy', spells: ['Flash', 'Exhaust'] }), prof(['WARDEN']))).toBe('SUPPORT')
  })
})
