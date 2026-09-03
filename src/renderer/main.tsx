import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root introuvable')

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary label="application">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
