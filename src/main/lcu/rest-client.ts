import https from 'node:https'
import { existsSync, readFileSync } from 'node:fs'
import type { LcuCredentials } from './credentials'

/**
 * Client REST minimal vers la LCU, basé sur `node:https` (aucune dépendance
 * externe). Authentification HTTP Basic : utilisateur `riot`, mot de passe =
 * `remoting-auth-token`.
 *
 * TLS : si un CA racine Riot (`riotgames.pem`) est fourni et présent, la
 * validation est stricte ; sinon on tolère le certificat auto-signé — l'hôte
 * est toujours `127.0.0.1`, la surface d'attaque est donc nulle.
 */

export interface LcuResponse<T = unknown> {
  status: number
  ok: boolean
  data: T
}

export interface LcuRawResponse {
  status: number
  ok: boolean
  contentType: string
  body: Buffer
}

export interface LcuRestClient {
  readonly origin: string
  request<T = unknown>(method: string, path: string, body?: unknown): Promise<LcuResponse<T>>
  get<T = unknown>(path: string): Promise<LcuResponse<T>>
  post<T = unknown>(path: string, body?: unknown): Promise<LcuResponse<T>>
  delete<T = unknown>(path: string): Promise<LcuResponse<T>>
  /** Récupère une ressource binaire (ex. icône d'invocateur servie localement). */
  requestRaw(method: string, path: string): Promise<LcuRawResponse>
}

export interface RestClientOptions {
  /** Chemin vers `riotgames.pem`. Ignoré si le fichier n'existe pas. */
  caPath?: string
  /** Timeout par requête en ms (défaut : 8000). */
  timeoutMs?: number
  /** Origine explicite (tests). Défaut : `https://127.0.0.1:<port>`. */
  origin?: string
}

export function buildBasicAuthHeader(token: string): string {
  return 'Basic ' + Buffer.from(`riot:${token}`).toString('base64')
}

export function createRestClient(
  creds: Pick<LcuCredentials, 'port' | 'token'>,
  options: RestClientOptions = {},
): LcuRestClient {
  const origin = options.origin ?? `https://127.0.0.1:${creds.port}`
  const timeout = options.timeoutMs ?? 8000
  const authHeader = buildBasicAuthHeader(creds.token)

  const ca =
    options.caPath && existsSync(options.caPath) ? readFileSync(options.caPath) : undefined

  const agent = new https.Agent({
    keepAlive: true,
    ...(ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false }),
  })

  function request<T>(method: string, path: string, body?: unknown): Promise<LcuResponse<T>> {
    const url = new URL(path, origin)
    const payload =
      body === undefined || body === null ? undefined : Buffer.from(JSON.stringify(body), 'utf8')

    return new Promise<LcuResponse<T>>((resolve, reject) => {
      const req = https.request(
        url,
        {
          method,
          agent,
          headers: {
            Authorization: authHeader,
            Accept: 'application/json',
            ...(payload
              ? { 'Content-Type': 'application/json', 'Content-Length': payload.byteLength }
              : {}),
          },
        },
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
                data = raw
              }
            }
            const status = res.statusCode ?? 0
            resolve({ status, ok: status >= 200 && status < 300, data: data as T })
          })
        },
      )

      req.setTimeout(timeout, () => {
        req.destroy(new Error(`LCU: timeout de la requête ${method} ${path} après ${timeout}ms`))
      })
      req.on('error', reject)
      if (payload) req.write(payload)
      req.end()
    })
  }

  function requestRaw(method: string, path: string): Promise<LcuRawResponse> {
    const url = new URL(path, origin)
    return new Promise<LcuRawResponse>((resolve, reject) => {
      const req = https.request(
        url,
        { method, agent, headers: { Authorization: authHeader } },
        (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => {
            const status = res.statusCode ?? 0
            resolve({
              status,
              ok: status >= 200 && status < 300,
              contentType: String(res.headers['content-type'] ?? ''),
              body: Buffer.concat(chunks),
            })
          })
        },
      )
      req.setTimeout(timeout, () => {
        req.destroy(new Error(`LCU: timeout de la requête ${method} ${path} après ${timeout}ms`))
      })
      req.on('error', reject)
      req.end()
    })
  }

  return {
    origin,
    request,
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    delete: (path) => request('DELETE', path),
    requestRaw,
  }
}
