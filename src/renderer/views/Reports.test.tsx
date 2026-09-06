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
    expect(await screen.findByText(/Aucun signalement\./)).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: /Tout envoyer/ }))
    await waitFor(() => expect(push).toHaveBeenCalledOnce())
    expect(await screen.findByText(/1 signalement\(s\) envoyé\(s\)/)).toBeInTheDocument()
  })

  it('prévient quand le build ne sait pas envoyer et bloque le bouton', async () => {
    stub({ getState: vi.fn(async () => ({ ...ready, configured: false })) })
    render(<Reports />)
    expect(await screen.findByText(/n'embarque pas d'identifiants/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tout envoyer/ })).toBeDisabled()
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

describe('Reports — envoi choisi', () => {
  const second = { ...REPORT, id: 'r2', champion: 'Ashe' } as FeedbackReport

  it('envoie un seul rapport sans toucher aux autres', async () => {
    const push = vi.fn(async () => ({ sent: 1, remaining: 1, error: null, detail: null }))
    stubLcuBridge({}, {}, {}, {}, {}, {}, {
      getState: vi.fn(async () => ({ ...ready, pending: 2 })),
      list: vi.fn(async () => [REPORT, second]),
      push,
    })
    render(<Reports />)
    await screen.findByText('Shaco')

    fireEvent.click(screen.getAllByRole('button', { name: 'Envoyer celui-ci' })[0])
    await waitFor(() => expect(push).toHaveBeenCalledWith(['r1']))
  })

  it('n’envoie que la sélection cochée', async () => {
    const push = vi.fn(async () => ({ sent: 1, remaining: 1, error: null, detail: null }))
    stubLcuBridge({}, {}, {}, {}, {}, {}, {
      getState: vi.fn(async () => ({ ...ready, pending: 2 })),
      list: vi.fn(async () => [REPORT, second]),
      push,
    })
    render(<Reports />)
    await screen.findByText('Ashe')

    // Rien de coché : le bouton de sélection reste inerte.
    expect(screen.getByRole('button', { name: /Envoyer la sélection \(0\)/ })).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/Sélectionner le signalement Ashe/))
    fireEvent.click(screen.getByRole('button', { name: /Envoyer la sélection \(1\)/ }))
    await waitFor(() => expect(push).toHaveBeenCalledWith(['r2']))
  })

  it('enregistre les précisions non sauvegardées avant l’envoi unitaire', async () => {
    // Sinon elles seraient perdues sans le dire : le rapport partirait sans.
    const annotate = vi.fn(async () => true)
    const push = vi.fn(async () => ({ sent: 1, remaining: 0, error: null }))
    stub({ annotate, push })
    render(<Reports />)

    const box = await screen.findByPlaceholderText(/Ce que tu aurais acheté/)
    fireEvent.change(box, { target: { value: 'il fallait Trinité' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer celui-ci' }))

    await waitFor(() => expect(annotate).toHaveBeenCalledWith('r1', 'il fallait Trinité'))
    expect(push).toHaveBeenCalledWith(['r1'])
  })

  it('un rapport envoyé est verrouillé et rangé à part', async () => {
    const sent = { ...REPORT, id: 'r3', sentAt: '2026-09-06T10:00:00.000Z' } as FeedbackReport
    stubLcuBridge({}, {}, {}, {}, {}, {}, {
      getState: vi.fn(async () => ({ ...ready, pending: 0 })),
      list: vi.fn(async () => [sent]),
    })
    render(<Reports />)

    expect(await screen.findByText(/Envoyés \(1\)/)).toBeInTheDocument()
    expect(screen.getByText(/verrouillé/)).toBeInTheDocument()
    // Ni modification, ni renvoi, ni sélection possible.
    expect(screen.getByPlaceholderText('Aucune précision')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Envoyer celui-ci' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    // Il reste retirable de la liste locale — la ligne, elle, est en base.
    expect(screen.getByRole('button', { name: 'Retirer de la liste' })).toBeInTheDocument()
  })
})
