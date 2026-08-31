// Sonde LCU autonome : lit le lockfile et teste la création de lobby
// (normal + personnalisé + practice tool) en affichant les réponses brutes.
//
//   node scripts/lcu-probe.mjs
//
// À lancer avec le client officiel ouvert sur l'écran d'accueil, SANS lobby.
// N'écrit rien de façon permanente (chaque lobby créé est immédiatement supprimé).

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import https from 'node:https'

const DIRS = [
  'C:\\Riot Games\\League of Legends',
  'D:\\Riot Games\\League of Legends',
  'C:\\Program Files\\Riot Games\\League of Legends',
  'C:\\Program Files (x86)\\Riot Games\\League of Legends',
]

function readLockfile() {
  for (const d of DIRS) {
    const p = join(d, 'lockfile')
    if (existsSync(p)) {
      const [, , port, password, protocol] = readFileSync(p, 'utf8').trim().split(':')
      return { port: Number(port), password, protocol }
    }
  }
  throw new Error('lockfile introuvable — adapte le tableau DIRS dans ce script')
}

const lf = readLockfile()
const auth = 'Basic ' + Buffer.from(`riot:${lf.password}`).toString('base64')
const agent = new https.Agent({ rejectUnauthorized: false })

function req(method, path, body) {
  const payload = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
  return new Promise((resolve, reject) => {
    const r = https.request(
      new URL(path, `https://127.0.0.1:${lf.port}`),
      {
        method,
        agent,
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          ...(payload
            ? { 'Content-Type': 'application/json', 'Content-Length': payload.byteLength }
            : {}),
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let data
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
          resolve({ status: res.statusCode, data })
        })
      },
    )
    r.on('error', reject)
    if (payload) r.write(payload)
    r.end()
  })
}

const PRACTICE = {
  isCustom: true,
  customGameLobby: {
    lobbyName: 'PROBE',
    lobbyPassword: '',
    configuration: {
      gameMode: 'PRACTICETOOL',
      gameMutator: '',
      gameServerRegion: '',
      mapId: 11,
      mutators: { id: 1 },
      spectatorPolicy: 'AllAllowed',
      teamSize: 5,
    },
  },
}

function show(label, res) {
  console.log(`\n=== ${label} → HTTP ${res.status}`)
  console.log(JSON.stringify(res.data, null, 2))
}

const run = async () => {
  console.log(`lockfile OK — port ${lf.port}`)
  show('GET /lol-summoner/v1/current-summoner', await req('GET', '/lol-summoner/v1/current-summoner'))
  show('GET /lol-gameflow/v1/gameflow-phase', await req('GET', '/lol-gameflow/v1/gameflow-phase'))
  show('DELETE /lol-lobby/v2/lobby (nettoyage)', await req('DELETE', '/lol-lobby/v2/lobby'))

  show(
    'POST /lol-lobby/v2/lobby { queueId: 430 } (lobby normal)',
    await req('POST', '/lol-lobby/v2/lobby', { queueId: 430 }),
  )
  show('DELETE /lol-lobby/v2/lobby', await req('DELETE', '/lol-lobby/v2/lobby'))

  show(
    'GET /lol-lobby/v2/lobby/custom/available-bots',
    await req('GET', '/lol-lobby/v2/lobby/custom/available-bots'),
  )

  show(
    'POST /lol-lobby/v2/lobby (PRACTICETOOL)',
    await req('POST', '/lol-lobby/v2/lobby', PRACTICE),
  )
  show('GET /lol-lobby/v2/lobby (résultat)', await req('GET', '/lol-lobby/v2/lobby'))
  show('DELETE /lol-lobby/v2/lobby (nettoyage)', await req('DELETE', '/lol-lobby/v2/lobby'))
}

run().catch((e) => {
  console.error('ÉCHEC :', e)
  process.exit(1)
})
