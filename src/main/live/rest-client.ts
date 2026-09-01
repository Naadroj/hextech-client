import https from 'node:https'
import { existsSync, readFileSync } from 'node:fs'

/**
 * Client HTTP minimal vers la **Live Client Data API** (serveur local du client
 * de jeu, `https://127.0.0.1:2999`), basé sur `node:https` (aucune dépendance
 * externe).
 *
 * Aucune authentification : l'API n'en demande pas. Le certificat est
 * auto-signé — validation stricte si `riotgames.pem` est fourni et présent,
 * sinon tolérée (l'hôte est `127.0.0.1`, la surface d'attaque est nulle),
 * exactement comme le client REST LCU.
 *
 * Lecture seule : la Live Client Data API n'expose aucune mutation.
 */

export interface LiveResponse<T = unknown> {
  status: number
  ok: boolean
  data: T
}

export interface LiveHttpClient {
  readonly origin: string
  get<T = unknown>(path: string): Promise<LiveResponse<T>>
}

export interface LiveRestClientOptions {
  /** Chemin vers `riotgames.pem`. Ignoré si le fichier n'existe pas. */
  caPath?: string
  /** Timeout par requête en ms (défaut : 5000). */
  timeoutMs?: number
  /** Origine explicite (tests). Défaut : `https://127.0.0.1:2999`. */
  origin?: string
}

export function createLiveRestClient(options: LiveRestClientOptions = {}): LiveHttpClient {
  const origin = options.origin ?? 'https://127.0.0.1:2999'
  const timeout = options.timeoutMs ?? 5000

  const ca =
    options.caPath && existsSync(options.caPath) ? readFileSync(options.caPath) : undefined

  const agent = new https.Agent({
    keepAlive: true,
    ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
  })

  function get<T>(path: string): Promise<LiveResponse<T>> {
    const url = new URL(path, origin)

    return new Promise<LiveResponse<T>>((resolve, reject) => {
      const req = https.request(
        url,
        { method: 'GET', agent, headers: { Accept: 'application/json' } },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8')
            let data: unknown = null
            if (raw.length > 0) {
              try {
                data = JSON.parse(raw)
              } catch {
                // L'API renvoie parfois du texte/HTML pendant le chargement.
                data = raw
              }
            }
            const status = res.statusCode ?? 0
            resolve({ status, ok: status >= 200 && status < 300, data: data as T })
          })
        },
      )

      req.setTimeout(timeout, () => {
        req.destroy(new Error(`Live API : timeout de GET ${path} après ${timeout}ms`))
      })
      req.on('error', reject)
      req.end()
    })
  }

  return { origin, get }
}
