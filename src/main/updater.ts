import { EventEmitter } from 'node:events'
import { app } from 'electron'
// `electron-updater` est un module CommonJS : en sortie ESM (build packagé), le
// loader Node refuse l'import nommé. On passe par l'export par défaut.
import electronUpdater from 'electron-updater'
import { logger } from './logger'

const { autoUpdater } = electronUpdater
import {
  IDLE_UPDATE_STATE,
  type UpdateState,
  type UpdaterInfo,
} from '../shared/update-types'

/**
 * Mise à jour automatique via `electron-updater` (fournisseur GitHub Releases,
 * configuré dans `electron-builder.yml`). L'application télécharge et applique
 * un nouvel installateur — aucun rebuild local, aucun Node requis chez
 * l'utilisateur.
 *
 * Inerte hors application packagée (`app.isPackaged === false`) : en
 * développement, `checkForUpdates()` échouerait faute de `app-update.yml`.
 *
 * Émet `state` (UpdateState) à chaque transition.
 */
export class Updater extends EventEmitter {
  private state: UpdateState = { ...IDLE_UPDATE_STATE }
  private readonly supported = app.isPackaged
  private targetVersion: string | null = null

  constructor() {
    super()
    if (!this.supported) {
      this.state = {
        ...IDLE_UPDATE_STATE,
        phase: 'unsupported',
        message: 'Mise à jour auto disponible uniquement dans la version installée.',
      }
      return
    }
    this.wire()
  }

  private set(patch: Partial<UpdateState>): void {
    this.state = { ...IDLE_UPDATE_STATE, ...this.state, ...patch }
    this.emit('state', this.state)
  }

  private wire(): void {
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = null

    autoUpdater.on('checking-for-update', () => this.set({ phase: 'checking', message: null }))
    autoUpdater.on('update-available', (info) => {
      this.targetVersion = info.version
      this.set({
        phase: 'available',
        version: info.version,
        notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null,
      })
    })
    autoUpdater.on('update-not-available', (info) =>
      this.set({ phase: 'not-available', version: info.version, percent: 0 }),
    )
    autoUpdater.on('download-progress', (p) =>
      this.set({
        phase: 'downloading',
        version: this.targetVersion,
        percent: Math.max(0, Math.min(100, Math.round(p.percent))),
      }),
    )
    autoUpdater.on('update-downloaded', (info) =>
      this.set({ phase: 'downloaded', version: info.version, percent: 100 }),
    )
    autoUpdater.on('error', (err) => {
      logger.warn('updater:', String(err?.message ?? err))
      this.set({ phase: 'error', message: String(err?.message ?? err) })
    })
  }

  info(): UpdaterInfo {
    return { currentVersion: app.getVersion(), supported: this.supported, state: this.state }
  }

  async check(): Promise<UpdateState> {
    if (!this.supported) return this.state
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      this.set({ phase: 'error', message: String(err) })
    }
    return this.state
  }

  async download(): Promise<UpdateState> {
    if (!this.supported || (this.state.phase !== 'available' && this.state.phase !== 'error')) {
      return this.state
    }
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      this.set({ phase: 'error', message: String(err) })
    }
    return this.state
  }

  install(): void {
    if (!this.supported || this.state.phase !== 'downloaded') return
    autoUpdater.quitAndInstall()
  }
}
