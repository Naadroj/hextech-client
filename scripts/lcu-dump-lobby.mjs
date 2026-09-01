// Dump du lobby courant — RÉFÉRENCE.
//
//   1. Dans le client officiel : crée un "Outil d'entraînement" À LA MAIN.
//   2. Laisse le lobby ouvert.
//   3. node scripts/lcu-dump-lobby.mjs
//
// Affiche la config exacte que le client produit, pour la répliquer dans l'app.

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
  throw new Error('lockfile introuvable — adapte DIRS')
}

const lf = readLockfile()
const auth = 'Basic ' + Buffer.from(`riot:${lf.password}`).toString('base64')
const agent = new https.Agent({ rejectUnauthorized: false })

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .request(
        new URL(path, `https://127.0.0.1:${lf.port}`),
        { method: 'GET', agent, headers: { Authorization: auth, Accept: 'application/json' } },
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
      .on('error', reject)
      .end()
  })
}

const show = (label, res) => {
  console.log(`\n=== ${label} → HTTP ${res.status}`)
  console.log(JSON.stringify(res.data, null, 2))
}

const run = async () => {
  console.log(`port ${lf.port}`)
  const lobby = await get('/lol-lobby/v2/lobby')
  if (lobby.status !== 200) {
    console.log(
      '\n⚠  AUCUN LOBBY DÉTECTÉ.',
      '\n   Dans le CLIENT OFFICIEL : Jouer → Personnalisée → Outil d\'entraînement → CONFIRMER.',
      "\n   Laisse le lobby ouvert, puis relance : node scripts/lcu-dump-lobby.mjs\n",
    )
    // Endpoints de découverte (utiles même sans lobby)
    show('GET /lol-lobby/v2/lobby/custom/available-bots', await get('/lol-lobby/v2/lobby/custom/available-bots'))
    show('GET /lol-lobby/v1/parties/gamemode', await get('/lol-lobby/v1/parties/gamemode'))
    show('GET /lol-game-modes', await get('/lol-game-modes'))
    return
  }
  show('GET /lol-lobby/v2/lobby', lobby)
  show('GET /lol-lobby/v1/lobby', await get('/lol-lobby/v1/lobby'))
  show('GET /lol-gameflow/v1/session', await get('/lol-gameflow/v1/session'))
}

run().catch((e) => {
  console.error('ÉCHEC :', e)
  process.exit(1)
})
