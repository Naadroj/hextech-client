import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'

function Boom({ when }: { when: boolean }) {
  if (when) throw new Error('kaboom')
  return <p>contenu ok</p>
}

afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('rend les enfants tant qu’il n’y a pas d’erreur', () => {
    render(
      <ErrorBoundary>
        <Boom when={false} />
      </ErrorBoundary>,
    )
    expect(screen.getByText('contenu ok')).toBeInTheDocument()
  })

  it('affiche un panneau d’erreur (pas d’écran noir) et le libellé de zone', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary label="lobby">
        <Boom when />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/une erreur est survenue/i)).toBeInTheDocument()
    expect(screen.getByText(/zone : lobby/i)).toBeInTheDocument()
    expect(screen.getByText(/kaboom/)).toBeInTheDocument()
  })

  it('« Réessayer » re-rend les enfants une fois la cause disparue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(
      <ErrorBoundary>
        <Boom when />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/une erreur est survenue/i)).toBeInTheDocument()

    rerender(
      <ErrorBoundary>
        <Boom when={false} />
      </ErrorBoundary>,
    )
    await userEvent.click(screen.getByRole('button', { name: /réessayer/i }))
    expect(screen.getByText('contenu ok')).toBeInTheDocument()
  })
})
