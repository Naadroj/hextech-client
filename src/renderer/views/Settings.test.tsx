import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UpdaterInfo } from '@shared/update-types'
import { IDLE_UPDATE_STATE } from '@shared/update-types'
import { Settings } from './Settings'
import { stubLcuBridge, clearLcuBridge } from '../test-utils'

afterEach(() => clearLcuBridge())

function stubUpdater(info: UpdaterInfo, extra = {}) {
  return stubLcuBridge({}, {}, {}, {}, { getInfo: vi.fn(async () => info), ...extra })
}

const base: UpdaterInfo = {
  currentVersion: '0.3.0',
  supported: true,
  state: { ...IDLE_UPDATE_STATE },
}

describe('Settings — Mise à jour', () => {
  it('affiche la version et le bouton "Vérifier"', async () => {
    const ctx = stubUpdater(base)
    render(<Settings />)
    expect(screen.getByRole('heading', { name: 'Réglages' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/version 0\.3\.0/i)).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /vérifier les mises à jour/i }))
    expect(ctx.updater.check).toHaveBeenCalledOnce()
  })

  it('propose "Télécharger" quand une version est disponible', async () => {
    stubUpdater({ ...base, state: { ...IDLE_UPDATE_STATE, phase: 'available', version: '0.4.0', notes: 'Corrige X' } })
    render(<Settings />)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /télécharger la mise à jour/i })).toBeInTheDocument(),
    )
    expect(screen.getByText(/0\.4\.0 disponible/i)).toBeInTheDocument()
    expect(screen.getByText('Corrige X')).toBeInTheDocument()
  })

  it('affiche la barre de progression pendant le téléchargement', async () => {
    stubUpdater({ ...base, state: { ...IDLE_UPDATE_STATE, phase: 'downloading', percent: 63 } })
    render(<Settings />)
    await waitFor(() =>
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '63'),
    )
  })

  it('propose "Redémarrer et installer" quand téléchargé', async () => {
    const ctx = stubUpdater({ ...base, state: { ...IDLE_UPDATE_STATE, phase: 'downloaded', version: '0.4.0' } })
    render(<Settings />)
    const btn = await screen.findByRole('button', { name: /redémarrer et installer/i })
    await userEvent.click(btn)
    expect(ctx.updater.install).toHaveBeenCalledOnce()
  })

  it('cache le bouton en mode non supporté (dev)', async () => {
    stubUpdater({
      currentVersion: '0.3.0',
      supported: false,
      state: { ...IDLE_UPDATE_STATE, phase: 'unsupported', message: 'version installée uniquement' },
    })
    render(<Settings />)
    await waitFor(() =>
      expect(screen.getByText(/version installée uniquement/i)).toBeInTheDocument(),
    )
    // Aucune action de mise à jour (le bouton overlay, lui, reste disponible).
    expect(
      screen.queryByRole('button', { name: /vérifier|télécharger|redémarrer/i }),
    ).toBeNull()
  })
})

describe('Settings — Overlay', () => {
  it('bascule l’overlay et reflète l’état', async () => {
    const ctx = stubUpdater(base)
    render(<Settings />)
    const btn = await screen.findByRole('button', { name: /activer l['’]overlay/i })
    await userEvent.click(btn)
    expect(ctx.overlay.setEnabled).toHaveBeenCalledWith(true)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /désactiver l['’]overlay/i })).toBeInTheDocument(),
    )
  })
})
