import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from './StatusBadge'

describe('StatusBadge', () => {
  it('affiche le libellé connecté', () => {
    render(<StatusBadge status="connected" />)
    expect(screen.getByRole('status')).toHaveTextContent(/client connecté/i)
  })

  it('affiche le libellé de connexion en cours', () => {
    render(<StatusBadge status="connecting" />)
    expect(screen.getByRole('status')).toHaveTextContent(/connexion/i)
  })

  it('affiche le libellé non détecté', () => {
    render(<StatusBadge status="idle" />)
    expect(screen.getByRole('status')).toHaveTextContent(/non détecté/i)
  })
})
