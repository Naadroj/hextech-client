import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChampSelectSession, ConnectionInfo } from '@shared/lcu-types'
import { ChampSelect } from './ChampSelect'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

const CONNECTED: ConnectionInfo = { status: 'connected', summoner: { summonerId: 1 } as never }
const IDLE: ConnectionInfo = { status: 'idle', summoner: null }

const SESSION: Partial<ChampSelectSession> = {
  localPlayerCellId: 0,
  myTeam: [{ cellId: 0, championId: 0, championPickIntent: 0, assignedPosition: 'middle', spell1Id: 4, spell2Id: 14 } as never],
  theirTeam: [{ cellId: 5, championId: 103, assignedPosition: 'top', spell1Id: 4, spell2Id: 12 } as never],
  bans: { myTeamBans: [64], theirTeamBans: [], numBans: 6 },
  timer: { adjustedTimeLeftInPhase: 20000, totalTimeInPhase: 30000, phase: 'BAN_PICK', isInfinite: false },
  actions: [[{ id: 21, actorCellId: 0, championId: 0, completed: false, isAllyAction: true, isInProgress: true, pickTurn: 1, type: 'pick' } as never]],
  benchChampions: [],
}

function stubReads(map: Record<string, unknown>) {
  return stubLcuBridge({
    read: vi.fn(async (path: string) =>
      path in map
        ? { status: 200, ok: true, data: map[path] }
        : { status: 404, ok: false, data: null },
    ) as never,
  })
}

describe('ChampSelect', () => {
  it('placeholder si déconnecté', () => {
    stubReads({})
    render(<ChampSelect connection={IDLE} />)
    expect(screen.getByText(/la sélection des champions s'affichera ici/i)).toBeInTheDocument()
  })

  it('placeholder si connecté mais hors sélection (404)', async () => {
    const ctx = stubReads({})
    render(<ChampSelect connection={CONNECTED} />)
    await waitFor(() => expect(ctx.bridge.read).toHaveBeenCalledWith('/lol-champ-select/v1/session'))
    expect(screen.getByText(/la sélection des champions s'affichera ici/i)).toBeInTheDocument()
  })

  it('affiche le plateau, la grille et déclenche un hover', async () => {
    const ctx = stubReads({
      '/lol-champ-select/v1/session': SESSION,
      '/lol-champ-select/v1/all-grid-champions': [
        { id: 103, name: 'Ahri', disabled: false },
        { id: 64, name: 'Lee Sin', disabled: false },
      ],
      '/lol-champ-select/v1/pickable-champion-ids': [103, 64],
    })
    render(<ChampSelect connection={CONNECTED} />)

    expect(await screen.findByRole('heading', { name: /Bans & sélection/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ton équipe' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Équipe adverse' })).toBeInTheDocument()

    const ahri = await screen.findByRole('button', { name: 'Ahri' })
    await userEvent.click(ahri)
    expect(ctx.bridge.champHover).toHaveBeenCalledWith(21, 103)

    expect(screen.getByRole('button', { name: 'Verrouiller' })).toBeInTheDocument()
  })

  it('recherche filtre la grille', async () => {
    stubReads({
      '/lol-champ-select/v1/session': SESSION,
      '/lol-champ-select/v1/all-grid-champions': [
        { id: 103, name: 'Ahri', disabled: false },
        { id: 64, name: 'Lee Sin', disabled: false },
      ],
      '/lol-champ-select/v1/pickable-champion-ids': [103, 64],
    })
    render(<ChampSelect connection={CONNECTED} />)

    await screen.findByRole('button', { name: 'Ahri' })
    await userEvent.type(screen.getByPlaceholderText(/rechercher un champion/i), 'lee')
    expect(screen.queryByRole('button', { name: 'Ahri' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Lee Sin' })).toBeInTheDocument()
  })
})
