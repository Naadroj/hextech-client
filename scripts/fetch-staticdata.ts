// Régénère le snapshot de données statiques embarqué :
//   resources/staticdata/snapshot.json
//
// Sources : Data Dragon (CDN Riot, sans clé) + Meraki Analytics (profils de
// dégâts). À relancer à chaque patch, puis committer le fichier.
//
// Usage :
//   npm run staticdata            (dernier patch)
//   npm run staticdata -- 16.17.1 (patch précis)

import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchAndBuildSnapshot } from '../src/main/staticdata/index'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outPath = resolve(root, 'resources/staticdata/snapshot.json')

const version = process.argv[2]

console.log(version ? `Patch demandé : ${version}` : 'Patch : dernier publié')
console.time('build')
const snapshot = await fetchAndBuildSnapshot({ version })
console.timeEnd('build')

await mkdir(dirname(outPath), { recursive: true })
await writeFile(outPath, JSON.stringify(snapshot), 'utf8')

const { size } = await stat(outPath)
const profSources = snapshot.damageProfiles.reduce<Record<string, number>>((acc, p) => {
  acc[p.source] = (acc[p.source] ?? 0) + 1
  return acc
}, {})

console.log('')
console.log(`  version        ${snapshot.meta.version}  (meraki: ${snapshot.meta.merakiVersion ?? 'indisponible'})`)
console.log(`  items          ${snapshot.items.length}`)
console.log(`  champions      ${snapshot.champions.length}`)
console.log(`  profils        ${JSON.stringify(profSources)}`)
console.log(`  runes / sorts  ${snapshot.runes.length} / ${snapshot.summonerSpells.length}`)
console.log(`  fichier        ${outPath}  (${(size / 1024 / 1024).toFixed(2)} Mo)`)
