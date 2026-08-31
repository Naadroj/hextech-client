// Sonde LCU autonome.
//
//   node scripts/lcu-probe.mjs
//
// Deux modes automatiques :
//  A) si un lobby existe déjà  -> dump complet (référence : ce que le client
//     produit). Crée un "Outil d'entraînement" À LA MAIN dans le client, laisse-le
//     ouvert, puis lance la sonde : elle affiche le gameConfig exact à répliquer.
//  B) si aucun lobby           -> teste la création (files dispo + practice tool).

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
      const [, , port, password] = readFileSync(p, 'utf8').trim().split(':')
      return { port: Number(port), password }
    }
  }
  throw new Error('lockfile introuvable — adapte DIRS dans ce script')
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

const show = (label, res) => {
  console.log(`\n=== ${label} → HTTP ${res.status}`)
  console.log(JSON.stringify(res.data, null, 2))
}

const run = async () => {
  console.log(`lockfile OK — port ${lf.port}`)
  show('GET /lol-gameflow/v1/gameflow-phase', await req('GET', '/lol-gameflow/v1/gameflow-phase'))

  const lobby = await req('GET', '/lol-lobby/v2/lobby')

  if (lobby.status === 200) {
    console.log('\n########################################################')
    console.log('# MODE A : un lobby existe — voici la référence exacte. #')
    console.log('########################################################')
    show('GET /lol-lobby/v2/lobby', lobby)
    return
  }

  console.log('\n############################################')
  console.log('# MODE B : aucun lobby — tests de création. #')
  console.log('############################################')

  const queues = await req('GET', '/lol-game-queues/v1/queues')
  if (Array.isArray(queues.data)) {
    console.log('\n=== Files PvP/VersusAi disponibles (id | availability | name)')
    for (const q of queues.data) {
      if (q && (q.category === 'PvP' || q.category === 'VersusAi')) {
        console.log(`  ${q.id}\t${q.queueAvailability}\t${q.name}`)
      }
    }
  }

  for (const queueId of [450, 400, 430, 490]) {
    const res = await req('POST', '/lol-lobby/v2/lobby', { queueId })
    show(`POST /lol-lobby/v2/lobby { queueId: ${queueId} }`, res)
    if (res.status === 200) await req('DELETE', '/lol-lobby/v2/lobby')
  }

  const practice = {
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
  show('POST /lol-lobby/v2/lobby (PRACTICETOOL)', await req('POST', '/lol-lobby/v2/lobby', practice))
  await req('DELETE', '/lol-lobby/v2/lobby')
}

run().catch((e) => {
  console.error('ÉCHEC :', e)
  process.exit(1)
})
