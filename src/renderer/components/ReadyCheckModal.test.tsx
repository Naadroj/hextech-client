import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LcuEvent } from '@shared/lcu-types'
import { ReadyCheckModal } from './ReadyCheckModal'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

const inProgress: LcuEvent = {
  eventType: 'Update',
  uri: '/lol-matchmaking/v1/ready-check',
  data: { state: 'InProgress', playerResponse: 'None', timer: 2 },
}

function emit(fn: ((e: LcuEvent) => void) | undefined, event: LcuEvent) {
  act(() => fn?.(event))
}

describe('ReadyCheckModal', () => {
  it('ne rend rien sans ready-check', () => {
    stubLcuBridge()
    render(<ReadyCheckModal />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('s’ouvre sur un événement InProgress', () => {
    const ctx = stubLcuBridge()
    render(<ReadyCheckModal />)
    emit(ctx.emitters.event, inProgress)
    expect(screen.getByRole('dialog', { name: /partie trouvée/i })).toBeInTheDocument()
    expect(screen.getByText(/accepte la partie/i)).toBeInTheDocument()
  })

  it('appelle acceptReadyCheck au clic et verrouille les boutons', async () => {
    const ctx = stubLcuBridge()
    render(<ReadyCheckModal />)
    emit(ctx.emitters.event, inProgress)

    await userEvent.click(screen.getByRole('button', { name: 'Accepter' }))
    expect(ctx.bridge.acceptReadyCheck).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(screen.getByText(/en attente des autres invocateurs/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Accepter' })).toBeDisabled()
    })
  })

  it('se ferme sur un événement Delete', () => {
    const ctx = stubLcuBridge()
    render(<ReadyCheckModal />)
    emit(ctx.emitters.event, inProgress)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    emit(ctx.emitters.event, { eventType: 'Delete', uri: '/lol-matchmaking/v1/ready-check', data: null })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('s’ouvre si un ready-check est déjà en cours au montage', async () => {
    stubLcuBridge({
      read: vi.fn(async () => ({
        status: 200,
        ok: true,
        data: { state: 'InProgress', playerResponse: 'None', timer: 4 },
      })) as never,
    })
    render(<ReadyCheckModal />)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})
