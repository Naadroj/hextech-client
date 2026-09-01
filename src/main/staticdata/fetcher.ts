/**
 * Accès réseau du pipeline de données statiques. Cible uniquement des CDN
 * publics en HTTPS standard (Data Dragon, Meraki) : `fetch` global suffit,
 * aucune gymnastique TLS. Injectable pour les tests.
 */

export interface FetchResult {
  ok: boolean
  status: number
  text(): Promise<string>
  json(): Promise<unknown>
}

export type Fetcher = (url: string) => Promise<FetchResult>

export interface FetchJsonOptions {
  fetcher?: Fetcher
  /** Timeout par requête en ms (défaut : 15000). */
  timeoutMs?: number
  /** Nombre d'essais (défaut : 3), backoff linéaire 500 ms. */
  attempts?: number
}

const defaultFetcher: Fetcher = (url) =>
  fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' })

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * GET JSON avec réessais. Lève après le dernier échec (réseau, HTTP non-2xx ou
 * corps non-JSON).
 */
export async function fetchJson<T = unknown>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const fetcher = options.fetcher ?? defaultFetcher
  const attempts = Math.max(1, options.attempts ?? 3)
  let lastErr: unknown

  for (let i = 0; i < attempts; i++) {
    if (i > 0) await delay(500 * i)
    try {
      const res = await fetcher(url)
      if (!res.ok) {
        lastErr = new Error(`GET ${url} → HTTP ${res.status}`)
        continue
      }
      return (await res.json()) as T
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`GET ${url} a échoué : ${String(lastErr)}`)
}
