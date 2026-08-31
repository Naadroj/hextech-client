import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import https from 'node:https'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createRestClient, buildBasicAuthHeader } from './rest-client'

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../test/fixtures')
const KEY = readFileSync(resolve(FIXTURES, 'localhost-key.pem'))
const CERT = readFileSync(resolve(FIXTURES, 'localhost-cert.pem'))

interface Recorded {
  method?: string
  url?: string
  auth?: string
  body: string
}

let server: https.Server
let origin: string
let last: Recorded

beforeAll(async () => {
  server = https.createServer({ key: KEY, cert: CERT }, (req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      last = {
        method: req.method,
        url: req.url,
        auth: req.headers.authorization,
        body: Buffer.concat(chunks).toString('utf8'),
      }
      if (req.url === '/boom') {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ errorCode: 'RPC_ERROR' }))
        return
      }
      if (req.url === '/no-content') {
        res.writeHead(204)
        res.end()
        return
      }
      if (req.url === '/text') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('ChampSelect')
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, echoUrl: req.url }))
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const { port } = server.address() as AddressInfo
  origin = `https://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()))
})

const creds = { port: 0, token: 'my-secret-token' }

describe('buildBasicAuthHeader', () => {
  it('encode riot:<token> en base64', () => {
    expect(buildBasicAuthHeader('abc')).toBe('Basic ' + Buffer.from('riot:abc').toString('base64'))
  })
})

describe('createRestClient', () => {
  it('accepte le certificat auto-signé (sans CA) et envoie le Basic Auth', async () => {
    const client = createRestClient(creds, { origin })
    const res = await client.get<{ ok: boolean; echoUrl: string }>('/lol-summoner/v1/current-summoner')

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
    expect(res.data.echoUrl).toBe('/lol-summoner/v1/current-summoner')
    expect(last.auth).toBe(buildBasicAuthHeader('my-secret-token'))
    expect(last.method).toBe('GET')
  })

  it('sérialise le corps JSON en POST', async () => {
    const client = createRestClient(creds, { origin })
    await client.post('/action', { a: 1 })
    expect(last.method).toBe('POST')
    expect(last.body).toBe('{"a":1}')
  })

  it('marque ok=false sur une réponse 500 et remonte le corps', async () => {
    const client = createRestClient(creds, { origin })
    const res = await client.get('/boom')
    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
    expect(res.data).toEqual({ errorCode: 'RPC_ERROR' })
  })

  it('gère une réponse 204 sans corps', async () => {
    const client = createRestClient(creds, { origin })
    const res = await client.post('/no-content')
    expect(res.status).toBe(204)
    expect(res.ok).toBe(true)
    expect(res.data).toBeNull()
  })

  it('retourne le texte brut si la réponse n’est pas du JSON', async () => {
    const client = createRestClient(creds, { origin })
    const res = await client.get<string>('/text')
    expect(res.data).toBe('ChampSelect')
  })

  it('requestRaw retourne le corps binaire et le content-type', async () => {
    const client = createRestClient(creds, { origin })
    const res = await client.requestRaw('GET', '/text')
    expect(res.ok).toBe(true)
    expect(res.contentType).toContain('text/plain')
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.toString('utf8')).toBe('ChampSelect')
    expect(last.auth).toBe(buildBasicAuthHeader('my-secret-token'))
  })

  it('rejette avec une erreur de timeout', async () => {
    const slow = https.createServer({ key: KEY, cert: CERT }, () => {
      /* ne répond jamais */
    })
    await new Promise<void>((r) => slow.listen(0, '127.0.0.1', r))
    const { port } = slow.address() as AddressInfo
    const client = createRestClient(creds, {
      origin: `https://127.0.0.1:${port}`,
      timeoutMs: 100,
    })
    await expect(client.get('/hang')).rejects.toThrow(/timeout/)
    await new Promise<void>((r) => slow.close(() => r()))
  })
})
