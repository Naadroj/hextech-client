import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ConfigStore, DEFAULT_CONFIG } from './config-store'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hextech-cfg-'))
  file = join(dir, 'nested', 'config.json')
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('ConfigStore', () => {
  it('retourne les valeurs par défaut si le fichier est absent', () => {
    const store = new ConfigStore(file)
    expect(store.getAll()).toEqual(DEFAULT_CONFIG)
  })

  it('fusionne un fichier partiel avec les défauts', () => {
    writeFileSync(dir + '/partial.json', JSON.stringify({ minimizeOfficialClientOnConnect: true }))
    const store = new ConfigStore(dir + '/partial.json')
    expect(store.get('minimizeOfficialClientOnConnect')).toBe(true)
    expect(store.get('closeToTray')).toBe(DEFAULT_CONFIG.closeToTray)
  })

  it('ignore les valeurs de type incorrect', () => {
    writeFileSync(dir + '/bad-types.json', JSON.stringify({ closeToTray: 'yes', startMinimizedToTray: 1 }))
    const store = new ConfigStore(dir + '/bad-types.json')
    expect(store.getAll()).toEqual(DEFAULT_CONFIG)
  })

  it('retombe sur les défauts si le JSON est corrompu', () => {
    writeFileSync(dir + '/corrupt.json', '{ not json')
    expect(new ConfigStore(dir + '/corrupt.json').getAll()).toEqual(DEFAULT_CONFIG)
  })

  it('persiste set() et le relit (en créant les dossiers)', () => {
    const store = new ConfigStore(file)
    store.set('startMinimizedToTray', true)
    expect(existsSync(file)).toBe(true)
    expect(JSON.parse(readFileSync(file, 'utf8')).startMinimizedToTray).toBe(true)

    const reloaded = new ConfigStore(file)
    expect(reloaded.get('startMinimizedToTray')).toBe(true)
  })

  it('getAll() renvoie une copie (pas la référence interne)', () => {
    const store = new ConfigStore(file)
    const a = store.getAll()
    a.closeToTray = !a.closeToTray
    expect(store.get('closeToTray')).toBe(DEFAULT_CONFIG.closeToTray)
  })

  it('persiste et relit overlayBounds (objet, pas booléen)', () => {
    const store = new ConfigStore(file)
    store.set('overlayBounds', { x: 12, y: 34, width: 340, height: 260 })
    expect(new ConfigStore(file).get('overlayBounds')).toEqual({
      x: 12,
      y: 34,
      width: 340,
      height: 260,
    })
  })

  it('ignore un overlayBounds malformé', () => {
    writeFileSync(dir + '/bad-bounds.json', JSON.stringify({ overlayBounds: { x: 'nope', y: 1 } }))
    expect(new ConfigStore(dir + '/bad-bounds.json').get('overlayBounds')).toBeNull()
  })
})
