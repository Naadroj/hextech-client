import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createLiveRestClient } from './rest-client'

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../test/fixtures')
const KEY = readFileSync(resolve(FIXTURES, 'localhost-key.pem'))
const CERT = readFileSync(resolve(FIXTURES, 'localhost-cert.pem'))

let server: https.Server
let origin: string
let lastUrl: string | undefined

beforeAll(async () => {
  server = https.createServer({ key: KEY, cert: CERT }, (req, res) => {
    lastUrl = req.url
    if (req.url === '/liveclientdata/allgamedata') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ gameData: { gameTime: 42 }, allPlayers: [], activePlayer: {} }))
      return
    }
    if (req.url === '/liveclientdata/loading') {
      // Pendant le chargement, l'API renvoie parfois du HTML.
      res.writeHead(404, { 'Content-Type': 'text/html' })
      res.end('<html>not ready</html>')
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  origin = `https://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()))
})

describe('createLiveRestClient', () => {
  it('accepte le certificat auto-signé et parse le JSON, sans en-tête Authorization', async () => {
    const client = createLiveRestClient({ origin })
    const res = await client.get<{ gameData: { gameTime: number } }>(
      '/liveclientdata/allgamedata',
    )
    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.data.gameData.gameTime).toBe(42)
    expect(lastUrl).toBe('/liveclientdata/allgamedata')
  })

  it('retourne le corps brut si la réponse n’est pas du JSON', async () => {
    const client = createLiveRestClient({ origin })
    const res = await client.get<string>('/liveclientdata/loading')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(404)
    expect(res.data).toContain('not ready')
  })

  it('rejette quand le serveur est injoignable (hors partie)', async () => {
    const dead = https.createServer({ key: KEY, cert: CERT })
    await new Promise<void>((r) => dead.listen(0, '127.0.0.1', r))
    const { port } = dead.address() as AddressInfo
    await new Promise<void>((r) => dead.close(() => r()))

    const client = createLiveRestClient({ origin: `https://127.0.0.1:${port}`, timeoutMs: 500 })
    await expect(client.get('/liveclientdata/allgamedata')).rejects.toThrow()
  })

  it('rejette avec une erreur de timeout', async () => {
    const slow = https.createServer({ key: KEY, cert: CERT }, () => {
      /* ne répond jamais */
    })
    await new Promise<void>((r) => slow.listen(0, '127.0.0.1', r))
    const { port } = slow.address() as AddressInfo
    const client = createLiveRestClient({
      origin: `https://127.0.0.1:${port}`,
      timeoutMs: 100,
    })
    await expect(client.get('/liveclientdata/allgamedata')).rejects.toThrow(/timeout/)
    await new Promise<void>((r) => slow.close(() => r()))
  })
})
