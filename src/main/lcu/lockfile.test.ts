import { describe, it, expect, vi } from 'vitest'
import { parseLockfile, findLockfile } from './lockfile'

describe('parseLockfile', () => {
  it('parse une ligne valide', () => {
    expect(parseLockfile('LeagueClientUx:1234:52001:aB3-xYz_9:https')).toEqual({
      processName: 'LeagueClientUx',
      pid: 1234,
      port: 52001,
      password: 'aB3-xYz_9',
      protocol: 'https',
    })
  })

  it('tolère un retour à la ligne final', () => {
    expect(parseLockfile('LeagueClientUx:1:443:tok:https\n').port).toBe(443)
  })

  it('recompose un token contenant des deux-points', () => {
    const lf = parseLockfile('LeagueClientUx:1:443:aa:bb:cc:https')
    expect(lf.password).toBe('aa:bb:cc')
    expect(lf.protocol).toBe('https')
  })

  it('rejette une ligne incomplète', () => {
    expect(() => parseLockfile('LeagueClientUx:1234:52001')).toThrow(/malformé/)
  })

  it('rejette un port invalide', () => {
    expect(() => parseLockfile('LeagueClientUx:1:0:tok:https')).toThrow(/port invalide/)
    expect(() => parseLockfile('LeagueClientUx:1:99999:tok:https')).toThrow(/port invalide/)
  })

  it('rejette un protocole non https', () => {
    expect(() => parseLockfile('LeagueClientUx:1:443:tok:http')).toThrow(/protocole/)
  })
})

describe('findLockfile', () => {
  it('retourne le premier lockfile lisible et ajoute /lockfile au dossier', async () => {
    const readFile = vi.fn(async (path: string) => {
      if (path.endsWith('lockfile') && path.includes('D:')) {
        return 'LeagueClientUx:9:5000:secret:https'
      }
      throw new Error('ENOENT')
    })

    const found = await findLockfile({
      readFile,
      candidatePaths: ['C:\\Riot Games\\League of Legends', 'D:\\Riot Games\\League of Legends'],
    })

    expect(found?.lockfile.port).toBe(5000)
    expect(found?.path).toMatch(/lockfile$/)
    expect(readFile).toHaveBeenCalledTimes(2)
  })

  it('accepte un chemin direct vers un fichier lockfile', async () => {
    const readFile = vi.fn(async () => 'LeagueClientUx:1:1234:tok:https')
    const found = await findLockfile({
      readFile,
      candidatePaths: ['/custom/path/lockfile'],
    })
    expect(found?.path).toBe('/custom/path/lockfile')
    expect(readFile).toHaveBeenCalledWith('/custom/path/lockfile')
  })

  it('retourne null si aucun candidat ne répond', async () => {
    const found = await findLockfile({
      readFile: async () => {
        throw new Error('ENOENT')
      },
      candidatePaths: ['A:\\x', 'B:\\y'],
    })
    expect(found).toBeNull()
  })

  it('ignore un lockfile illisible et passe au suivant', async () => {
    const readFile = vi.fn(async (path: string) => {
      if (path.includes('bad')) return 'corrompu'
      return 'LeagueClientUx:1:2222:tok:https'
    })
    const found = await findLockfile({
      readFile,
      candidatePaths: ['C:\\bad', 'C:\\good'],
    })
    expect(found?.lockfile.port).toBe(2222)
  })
})
