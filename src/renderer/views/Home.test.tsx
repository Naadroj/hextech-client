import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ConnectionInfo, CurrentSummoner } from '@shared/lcu-types'
import { Home } from './Home'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

const summoner = {
  displayName: 'Sudzi',
  gameName: 'Sudzi',
  tagLine: 'EUW',
  profileIconId: 29,
  summonerLevel: 312,
  percentCompleteForNextLevel: 65,
} as unknown as CurrentSummoner

describe('Home', () => {
  it('invite à lancer le client quand déconnecté', () => {
    stubLcuBridge()
    const conn: ConnectionInfo = { status: 'idle', summoner: null }
    render(<Home connection={conn} />)
    expect(screen.getByText(/en attente du client league of legends/i)).toBeInTheDocument()
  })

  it('affiche le pseudo, le niveau, la barre d’XP et le classement', async () => {
    stubLcuBridge({
      getRankedStats: vi.fn(async () => ({
        soloDuo: {
          queueType: '',
          tier: 'DIAMOND',
          division: 'III',
          leaguePoints: 21,
          wins: 40,
          losses: 30,
        },
        flex: null,
      })),
      getProfileIcon: vi.fn(async () => null),
    })
    const conn: ConnectionInfo = { status: 'connected', summoner }
    render(<Home connection={conn} />)

    expect(screen.getByRole('heading', { name: /Sudzi/ })).toHaveTextContent('#EUW')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '65')
    expect(await screen.findByText(/Diamond III · 21 LP/)).toBeInTheDocument()
    expect(await screen.findByText(/40V \/ 30D · 57%/)).toBeInTheDocument()
  })
})
