import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Reports } from './Reports'
import { clearLcuBridge, stubLcuBridge } from '../test-utils'
import { IDLE_FEEDBACK_STATE, type FeedbackReport } from '@shared/feedback-types'

const REPORT = {
  id: 'r1',
  createdAt: '2026-09-04T18:00:00.000Z',
  installId: 'inst',
  appVersion: '0.1.11',
  patch: '16.17',
  buildsPatch: null,
  champion: 'Shaco',
  role: 'JUNGLE',
  level: 9,
  completedItems: 1,
  itemId: 3142,
  itemRank: 0,
  reasonCode: 'wrong-axis',
  comment: null,
  hadSkeleton: false,
  skeletonGames: null,
  snapshot: { meta: {}, live: {} },
} as unknown as FeedbackReport

const ready = { ...IDLE_FEEDBACK_STATE, enabled: true, configured: true, pending: 1 }

afterEach(() => clearLcuBridge())

/** `stubLcuBridge` prend ses surcharges dans l'ordre des ponts ; le 7e est feedback. */
const stub = (over: Record<string, unknown>) =>
  stubLcuBridge({}, {}, {}, {}, {}, {}, {
    getState: vi.fn(async () => ready),
    list: vi.fn(async () => [REPORT]),
    ...over,
  })

describe('Reports', () => {
  it('dit quoi faire quand la file est vide', async () => {
    stub({ list: vi.fn(async () => []) })
    render(<Reports />)
    expect(await screen.findByText(/Aucun signalement en attente/)).toBeInTheDocument()
  })

  it('affiche un signalement avec son motif', async () => {
    stub({})
    render(<Reports />)
    expect(await screen.findByText('Shaco')).toBeInTheDocument()
    expect(screen.getByText('Mauvais axe AD/AP')).toBeInTheDocument()
  })

  it('enregistre les précisions saisies', async () => {
    const annotate = vi.fn(async () => true)
    stub({ annotate })
    render(<Reports />)

    const box = await screen.findByPlaceholderText(/Ce que tu aurais acheté/)
    fireEvent.change(box, { target: { value: 'il fallait Trinité' } })
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer les précisions/ }))
    await waitFor(() => expect(annotate).toHaveBeenCalledWith('r1', 'il fallait Trinité'))
  })

  it('n’envoie rien tant qu’on ne clique pas sur Envoyer', async () => {
    const push = vi.fn(async () => ({ sent: 1, remaining: 0, error: null }))
    stub({ push })
    render(<Reports />)
    await screen.findByText('Shaco')
    expect(push).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/ }))
    await waitFor(() => expect(push).toHaveBeenCalledOnce())
    expect(await screen.findByText(/1 signalement\(s\) envoyé\(s\)/)).toBeInTheDocument()
  })

  it('prévient quand le build ne sait pas envoyer et bloque le bouton', async () => {
    stub({ getState: vi.fn(async () => ({ ...ready, configured: false })) })
    render(<Reports />)
    expect(await screen.findByText(/n'embarque pas d'identifiants/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Envoyer/ })).toBeDisabled()
  })

  it('prévient quand les signalements sont désactivés', async () => {
    stub({ getState: vi.fn(async () => ({ ...ready, enabled: false })) })
    render(<Reports />)
    expect(await screen.findByText(/désactivés dans les Réglages/)).toBeInTheDocument()
  })

  it('permet de jeter un rapport sans l’envoyer', async () => {
    const discard = vi.fn(async () => true)
    stub({ discard })
    render(<Reports />)
    fireEvent.click(await screen.findByRole('button', { name: 'Jeter' }))
    await waitFor(() => expect(discard).toHaveBeenCalledWith('r1'))
  })
})
