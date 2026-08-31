import { cn } from '../../lib/cn'

/** Barre de titre custom pour la fenêtre `frame: false`. */
export function TitleBar() {
  const controls = () => window.app?.windowControls

  return (
    <header className="hx-titlebar">
      <span className="hx-titlebar__brand">Hextech Client</span>
      <div className="hx-titlebar__actions">
        <button type="button" aria-label="Réduire" onClick={() => void controls()?.minimize()}>
          &#8211;
        </button>
        <button
          type="button"
          aria-label="Agrandir ou restaurer"
          onClick={() => void controls()?.toggleMaximize()}
        >
          &#9633;
        </button>
        <button
          type="button"
          aria-label="Fermer"
          className={cn('is-close')}
          onClick={() => void controls()?.close()}
        >
          &#10005;
        </button>
      </div>
    </header>
  )
}
