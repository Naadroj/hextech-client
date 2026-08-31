import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ConnectionInfo } from '@shared/lcu-types'
import { Lobby } from './Lobby'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

const CONNECTED: ConnectionInfo = { status: 'connected', summoner: { summonerId: 1 } as never }
const IDLE: ConnectionInfo = { status: 'idle', summoner: null }

function stubReads(map: Record<string, unknown>) {
  return stubLcuBridge({
    read: (async (path: string) =>
      path in map
        ? { status: 200, ok: true, data: map[path] }
        : { status: 404, ok: false, data: null }) as never,
  })
}

describe('Lobby', () => {
  it('invite à lancer le client quand déconnecté', () => {
    stubLcuBridge()
    render(<Lobby connection={IDLE} />)
    expect(screen.getByText(/lance le client officiel pour créer un lobby/i)).toBeInTheDocument()
  })

  it('affiche la grille de modes et crée un lobby au clic', async () => {
    const ctx = stubReads({
      '/lol-game-queues/v1/queues': [
        { id: 450, name: 'ARAM', shortName: '', description: '', category: 'PvP', gameMode: 'ARAM', isRanked: false, mapId: 12 },
        { id: 420, name: 'Ranked Solo/Duo', shortName: '', description: '', category: 'PvP', gameMode: 'CLASSIC', isRanked: true, mapId: 11 },
      ],
    })
    render(<Lobby connection={CONNECTED} />)

    const ranked = await screen.findByRole('button', { name: /Ranked Solo\/Duo/ })
    // 420 est prioritaire → apparaît avant ARAM
    expect(screen.getByText('Classé')).toBeInTheDocument()
    await userEvent.click(ranked)
    expect(ctx.bridge.createLobby).toHaveBeenCalledWith(420)
  })

  it('permet de lancer la recherche quand le lobby est prêt', async () => {
    const ctx = stubReads({
      '/lol-lobby/v2/lobby': {
        partyId: 'p1',
        canStartActivity: true,
        gameConfig: { queueId: 450, maxLobbySize: 5 },
        members: [{ summonerId: 1 }],
        localMember: { summonerId: 1 },
      },
      '/lol-game-queues/v1/queues': [
        { id: 450, name: 'ARAM', shortName: '', description: '', category: 'PvP', gameMode: 'ARAM', isRanked: false, mapId: 12 },
      ],
    })
    render(<Lobby connection={CONNECTED} />)

    const search = await screen.findByRole('button', { name: /rechercher une partie/i })
    expect(search).toBeEnabled()
    await userEvent.click(search)
    expect(ctx.bridge.startMatchmaking).toHaveBeenCalledOnce()
  })

  it('affiche le chrono et le bouton Annuler pendant la recherche', async () => {
    stubReads({
      '/lol-lobby/v2/lobby': {
        partyId: 'p1',
        canStartActivity: true,
        gameConfig: { queueId: 450, maxLobbySize: 5 },
        members: [{ summonerId: 1 }],
        localMember: { summonerId: 1 },
      },
      '/lol-matchmaking/v1/search': { searchState: 'Searching', timeInQueue: 42, estimatedQueueTime: 90 },
    })
    render(<Lobby connection={CONNECTED} />)

    await waitFor(() => expect(screen.getByText(/recherche en cours/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /annuler/i })).toBeInTheDocument()
    expect(screen.getByText(/0:42/)).toBeInTheDocument()
  })
})
