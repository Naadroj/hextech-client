import { Button, Frame, Tag } from '../components/hextech'
import { useUpdater } from '../lib/useUpdater'
import { useOverlay } from '../lib/useOverlay'

export function Settings() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">Réglages</h1>
        <p className="mt-1 text-sm text-parchment">Overlay in-game et mises à jour.</p>
      </div>
      <OverlayPanel />
      <UpdatePanel />
    </div>
  )
}

function OverlayPanel() {
  const { state, setEnabled } = useOverlay()
  return (
    <Frame
      title="Overlay in-game"
      headerRight={<Tag tone={state.enabled ? 'cyan' : undefined}>{state.enabled ? 'Actif' : 'Inactif'}</Tag>}
    >
      <p className="text-sm text-parchment">
        Affiche le conseil du Coach dans une petite fenêtre transparente par-dessus le jeu,
        déplaçable à la souris. Raccourci : <span className="text-gold-100">Ctrl+Maj+O</span>.
      </p>
      <p className="mt-2 text-xs text-parchment">
        League doit tourner en mode <span className="text-gold-100">Sans bordure</span> — le plein
        écran exclusif passe devant toute fenêtre.
      </p>
      <div className="hx-divider" />
      <Button onClick={() => void setEnabled(!state.enabled)}>
        {state.enabled ? "Désactiver l'overlay" : "Activer l'overlay"}
      </Button>
    </Frame>
  )
}

function UpdatePanel() {
  const u = useUpdater()
  const { phase } = u.state

  const line = (() => {
    switch (phase) {
      case 'checking':
        return 'Vérification en cours…'
      case 'available':
        return `Version ${u.state.version} disponible.`
      case 'not-available':
        return `Tu es à jour (version ${u.state.version ?? u.currentVersion}).`
      case 'downloading':
        return `Téléchargement… ${u.state.percent}%`
      case 'downloaded':
        return `Version ${u.state.version} prête à être installée.`
      case 'error':
        return u.state.message ?? 'Échec de la mise à jour.'
      case 'unsupported':
        return (
          u.state.message ??
          "Mise à jour auto disponible uniquement dans la version installée."
        )
      default:
        return 'Recherche une nouvelle version publiée sur GitHub Releases.'
    }
  })()

  const action = (() => {
    if (phase === 'unsupported') return null
    if (phase === 'downloaded') {
      return (
        <Button variant="gold" onClick={() => void u.install()}>
          Redémarrer et installer
        </Button>
      )
    }
    if (phase === 'available') {
      return (
        <Button variant="primary" disabled={u.busy} onClick={() => void u.download()}>
          Télécharger la mise à jour
        </Button>
      )
    }
    if (phase === 'error') {
      return (
        <Button disabled={u.busy} onClick={() => void u.check()}>
          Réessayer
        </Button>
      )
    }
    return (
      <Button disabled={u.busy} onClick={() => void u.check()}>
        Vérifier les mises à jour
      </Button>
    )
  })()

  return (
    <Frame
      title="Mise à jour"
      headerRight={<Tag>{`Version ${u.currentVersion}`}</Tag>}
    >
      <p
        className={
          phase === 'error' ? 'text-sm text-decline' : 'text-sm text-gold-100/80'
        }
      >
        {line}
      </p>

      {phase === 'downloading' && (
        <div className="mt-3 h-2 w-full border border-gold-800 bg-hextech-black/60">
          <div
            className="h-full bg-gold-btn transition-[width] duration-300"
            style={{ width: `${u.state.percent}%` }}
            role="progressbar"
            aria-valuenow={u.state.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      )}

      {phase === 'available' && u.state.notes && (
        <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap border border-gold-800 bg-hextech-black/40 p-3 text-xs text-parchment">
          {u.state.notes}
        </pre>
      )}

      {action && <div className="mt-4">{action}</div>}
    </Frame>
  )
}
