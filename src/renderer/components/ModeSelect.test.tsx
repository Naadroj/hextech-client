import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ModeCategory } from '../lib/gameModes'
import { ModeSelect } from './ModeSelect'

const categories: ModeCategory[] = [
  {
    id: 'rift',
    label: "Faille de l'invocateur",
    items: [
      {
        key: 'queue:420',
        label: 'Classé Solo/Duo',
        subtitle: 'classé',
        isRanked: true,
        available: true,
        kind: 'queue',
        queueId: 420,
      },
      {
        key: 'queue:430',
        label: 'Partie normale',
        subtitle: 'aveugle',
        isRanked: false,
        available: false,
        unavailableReason: 'Indisponible actuellement',
        kind: 'queue',
        queueId: 430,
      },
    ],
  },
  {
    id: 'aram',
    label: 'ARAM',
    items: [
      { key: 'queue:450', label: 'ARAM', subtitle: 'abîme', isRanked: false, available: true, kind: 'queue', queueId: 450 },
    ],
  },
]

describe('ModeSelect', () => {
  it('affiche la première catégorie et ses files', () => {
    render(<ModeSelect categories={categories} onConfirm={() => {}} />)
    expect(screen.getByRole('tab', { name: /Faille de l'invocateur/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('button', { name: /Classé Solo\/Duo/ })).toBeInTheDocument()
  })

  it('change de catégorie au clic', async () => {
    render(<ModeSelect categories={categories} onConfirm={() => {}} />)
    await userEvent.click(screen.getByRole('tab', { name: 'ARAM 1' }))
    expect(screen.getByRole('button', { name: /^ARAM/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Classé Solo\/Duo/ })).toBeNull()
  })

  it('désactive les files indisponibles et montre la raison', () => {
    render(<ModeSelect categories={categories} onConfirm={() => {}} />)
    expect(screen.getByRole('button', { name: /Partie normale/ })).toBeDisabled()
    expect(screen.getByText('Indisponible actuellement')).toBeInTheDocument()
  })

  it('sélection puis confirmation appelle onConfirm avec l’item', async () => {
    const onConfirm = vi.fn()
    render(<ModeSelect categories={categories} onConfirm={onConfirm} />)

    const confirm = screen.getByRole('button', { name: /créer le lobby/i })
    expect(confirm).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: /Classé Solo\/Duo/ }))
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ queueId: 420, kind: 'queue' }))
  })
})
