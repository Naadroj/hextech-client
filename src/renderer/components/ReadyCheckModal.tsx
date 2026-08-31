import { useEffect, useState } from 'react'
import type { ReadyCheck } from '@shared/lcu-types'
import { Button, Modal } from './hextech'
import { getLcu } from '../lib/lcuBridge'
import { useLcuEvent } from '../lib/useLcuEvent'

const READY_CHECK_DURATION = 10

/**
 * Modale globale de ready-check. Écoute les événements
 * `/lol-matchmaking/v1/ready-check` et n'agit que sur un clic explicite de
 * l'utilisateur (aucune acceptation automatique).
 */
export function ReadyCheckModal() {
  const [readyCheck, setReadyCheck] = useState<ReadyCheck | null>(null)
  const [responding, setResponding] = useState(false)

  // L'app peut démarrer alors qu'un ready-check est déjà en cours.
  useEffect(() => {
    let active = true
    try {
      getLcu()
        .read<ReadyCheck>('/lol-matchmaking/v1/ready-check')
        .then((res) => {
          if (active && res.ok && res.data && res.data.state === 'InProgress') {
            setReadyCheck(res.data)
          }
        })
        .catch(() => {})
    } catch {
      /* preload indisponible */
    }
    return () => {
      active = false
    }
  }, [])

  useLcuEvent('/lol-matchmaking/v1/ready-check', (event) => {
    if (event.eventType === 'Delete') {
      setReadyCheck(null)
      setResponding(false)
      return
    }
    const data = event.data as ReadyCheck | undefined
    if (data && (data.state === 'InProgress' || data.state === 'EveryoneReady')) {
      setReadyCheck(data)
      if (data.playerResponse !== 'None') setResponding(true)
    } else {
      setReadyCheck(null)
      setResponding(false)
    }
  })

  if (!readyCheck) return null

  const locked = responding || readyCheck.playerResponse !== 'None'
  const secondsLeft = Math.max(0, READY_CHECK_DURATION - Math.floor(readyCheck.timer))

  const accept = async () => {
    setResponding(true)
    try {
      await getLcu().acceptReadyCheck()
    } catch {
      setResponding(false)
    }
  }
  const decline = async () => {
    setResponding(true)
    try {
      await getLcu().declineReadyCheck()
    } catch {
      setResponding(false)
    }
  }

  return (
    <Modal open dismissable={false} title="Partie trouvée" className="text-center">
      <p className="text-sm text-gold-100/80">
        {locked
          ? 'En attente des autres invocateurs…'
          : `Accepte la partie pour continuer — ${secondsLeft}s`}
      </p>
      <div className="mt-5 flex justify-center gap-4">
        <Button variant="accept" disabled={locked} onClick={accept}>
          Accepter
        </Button>
        <Button variant="ban" disabled={locked} onClick={decline}>
          Décliner
        </Button>
      </div>
    </Modal>
  )
}
