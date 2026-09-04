import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HistoryPanel } from './HistoryPanel'
import { clearLcuBridge, stubLcuBridge } from '../test-utils'
import type { HistoryGame, HistoryGameSummary } from '@shared/history-types'

const SUMMARY: HistoryGameSummary = {
  id: 'g1',
  startedAt: '2026-09-04T18:00:00.000Z',
  champion: 'Shaco',
  role: 'JUNGLE',
  patch: '16.17',
  steps: 2,
  lastItem: { itemId: 6699, name: 'Voltaïque' },
}

const GAME: HistoryGame = {
  meta: { kind: 'meta', id: 'g1', startedAt: SUMMARY.startedAt, champion: 'Shaco', role: 'JUNGLE', patch: '16.17' },
  steps: [
    {
      t: 754,
      at: '2026-09-04T18:12:00.000Z',
      gold: 1200,
      level: 9,
      completedItems: 1,
      axis: 'magic',
      primary: { itemId: 3142, name: 'Gantelet', goldTotal: 3000, affordable: false, reason: 'burst ennemi' },
      alternatives: [],
      boots: null,
    },
  ],
}

afterEach(() => clearLcuBridge())

describe('HistoryPanel', () => {
  it('explique quoi faire quand il n’y a encore rien', async () => {
    stubLcuBridge({}, {}, {}, {}, {}, {}, {}, { list: vi.fn(async () => []) })
    render(<HistoryPanel version="16.17.1" />)
    expect(await screen.findByText(/Rien pour l'instant/)).toBeInTheDocument()
  })

  it('liste les parties enregistrées', async () => {
    stubLcuBridge({}, {}, {}, {}, {}, {}, {}, { list: vi.fn(async () => [SUMMARY]) })
    render(<HistoryPanel version="16.17.1" />)
    expect(await screen.findByText('Shaco')).toBeInTheDocument()
    expect(screen.getByText('2 propositions')).toBeInTheDocument()
  })

  it('déplie une partie et montre le fil horodaté', async () => {
    const get = vi.fn(async () => GAME)
    stubLcuBridge({}, {}, {}, {}, {}, {}, {}, { list: vi.fn(async () => [SUMMARY]), get })
    render(<HistoryPanel version="16.17.1" />)

    fireEvent.click(await screen.findByRole('button', { expanded: false }))
    expect(get).toHaveBeenCalledWith('g1')
    await waitFor(() => expect(screen.getByText('Gantelet')).toBeInTheDocument())
    expect(screen.getByText('12:34')).toBeInTheDocument()
    expect(screen.getByText('niv 9 · 1200 or')).toBeInTheDocument()
    expect(screen.getByText('AP forcé')).toBeInTheDocument()
    expect(screen.getByText('• burst ennemi')).toBeInTheDocument()
  })

  it('ne plante pas si le preload est absent', () => {
    clearLcuBridge()
    expect(() => render(<HistoryPanel version={null} />)).not.toThrow()
  })
})
