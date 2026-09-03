import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** Étiquette de la zone protégée (affichée dans le message). */
  label?: string
  /** Rendu de repli. Si absent, un panneau d'erreur générique est affiché. */
  fallback?: (error: Error, reset: () => void) => ReactNode
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

/**
 * Empêche qu'une exception de rendu ne laisse la fenêtre entièrement noire.
 * Affiche l'erreur + la pile de composants, avec un bouton de réinitialisation.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info })
    // Visible dans la console de développement.
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack)
  }

  private reset = (): void => this.setState({ error: null, info: null })

  render(): ReactNode {
    const { error, info } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="m-6 max-w-2xl border-2 border-decline bg-hextech-black/80 p-6 text-gold-100">
        <h2 className="text-lg text-decline">Une erreur est survenue</h2>
        {this.props.label && (
          <p className="mt-1 text-xs uppercase tracking-hexwide text-gold-700">
            Zone : {this.props.label}
          </p>
        )}
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap bg-hextech-black/60 p-3 text-xs text-parchment">
          {error.message}
          {info?.componentStack ? `\n${info.componentStack}` : ''}
        </pre>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            className="hx-btn hx-btn--sm"
            onClick={this.reset}
          >
            <span className="hx-btn__sheen" aria-hidden="true" />
            <span>Réessayer</span>
          </button>
          <button
            type="button"
            className="hx-btn hx-btn--sm"
            onClick={() => window.location.reload()}
          >
            <span className="hx-btn__sheen" aria-hidden="true" />
            <span>Recharger l'application</span>
          </button>
        </div>
      </div>
    )
  }
}
