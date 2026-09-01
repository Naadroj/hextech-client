// Client Riot minimal pour la moisson de parties (phase A4.2).
// Clé via variable d'environnement RIOT_API_KEY (ou fichier .env local,
// gitignored) — jamais committée.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Charge un .env à la racine du projet s'il existe : KEY=VALUE, une par ligne.
// L'environnement réel a priorité sur le fichier.
try {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env')
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  /* pas de .env : on se rabat sur l'environnement du shell */
}

const KEY = process.env.RIOT_API_KEY ?? ''
/** Plateforme (LEAGUE/SUMMONER) : euw1, na1, kr, eun1… */
export const PLATFORM = process.env.RIOT_PLATFORM ?? 'euw1'
/** Région (MATCH-V5) : europe, americas, asia, sea */
export const REGION = process.env.RIOT_REGION ?? 'europe'

if (!KEY) {
  console.error('RIOT_API_KEY manquante. Ex : RIOT_API_KEY=RGAPI-xxxx npm run harvest')
  process.exit(1)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Limiteur simple : au plus une requête toutes les `MIN_INTERVAL` ms (clé dev). */
const MIN_INTERVAL = 1300
let lastAt = 0

async function throttle(): Promise<void> {
  const wait = lastAt + MIN_INTERVAL - Date.now()
  if (wait > 0) await sleep(wait)
  lastAt = Date.now()
}

export type Routing = 'platform' | 'region'

export async function riot<T = unknown>(path: string, routing: Routing = 'region'): Promise<T> {
  const host = routing === 'platform' ? PLATFORM : REGION
  const url = `https://${host}.api.riotgames.com${path}`
  for (let attempt = 0; attempt < 4; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { 'X-Riot-Token': KEY } })
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') ?? '5')
      console.warn(`  429 — pause ${retry}s`)
      await sleep((retry + 1) * 1000)
      continue
    }
    if (res.status === 404) throw new Error(`404 ${path}`)
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} ${path} ${body.slice(0, 120)}`)
    }
    return (await res.json()) as T
  }
  throw new Error(`abandon après plusieurs 429 : ${path}`)
}
