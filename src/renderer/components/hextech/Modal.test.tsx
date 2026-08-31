import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('ne rend rien quand open=false', () => {
    render(
      <Modal open={false} title="X">
        <p>contenu</p>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('rend le titre et le contenu quand open', () => {
    render(
      <Modal open title="Partie trouvée">
        <p>corps</p>
      </Modal>,
    )
    expect(screen.getByRole('dialog', { name: 'Partie trouvée' })).toBeInTheDocument()
    expect(screen.getByText('corps')).toBeInTheDocument()
  })

  it('ferme au clic sur le fond', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="T">
        <p>corps</p>
      </Modal>,
    )
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ne ferme pas au clic sur le contenu (stopPropagation)', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="T">
        <p>corps</p>
      </Modal>,
    )
    fireEvent.click(screen.getByText('corps'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('ferme sur la touche Échap', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="T">
        <p>corps</p>
      </Modal>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignore fond et Échap quand dismissable=false', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} dismissable={false} title="T">
        <p>corps</p>
      </Modal>,
    )
    fireEvent.click(screen.getByRole('presentation'))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })
})
