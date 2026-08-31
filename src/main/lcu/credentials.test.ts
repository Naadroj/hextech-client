import { describe, it, expect, vi } from 'vitest'
import {
  parseCredentialsFromCommandLine,
  getCredentials,
  toPublicCredentials,
} from './credentials'

describe('parseCredentialsFromCommandLine', () => {
  it('extrait port, token et pid de la ligne de commande', () => {
    const cl =
      '"C:\\Riot Games\\League of Legends\\LeagueClientUx.exe" ' +
      '--riotclient-app-port=51234 --app-port=52999 --remoting-auth-token=abcDEF-123_x --app-pid=8080'
    expect(parseCredentialsFromCommandLine(cl)).toEqual({
      port: 52999,
      token: 'abcDEF-123_x',
      pid: 8080,
      protocol: 'https',
      source: 'command-line',
    })
  })

  it('gère les valeurs entre guillemets', () => {
    const cl = '--app-port="443" --remoting-auth-token="tok123"'
    const creds = parseCredentialsFromCommandLine(cl)
    expect(creds?.port).toBe(443)
    expect(creds?.token).toBe('tok123')
  })

  it('retourne null si le token manque', () => {
    expect(parseCredentialsFromCommandLine('--app-port=52999')).toBeNull()
  })

  it('retourne null sur une chaîne vide', () => {
    expect(parseCredentialsFromCommandLine('')).toBeNull()
  })
})

describe('getCredentials', () => {
  const validLockfile = 'LeagueClientUx:4321:52001:lock-token:https'

  it('privilégie le lockfile', async () => {
    const creds = await getCredentials({
      readFile: async () => validLockfile,
      candidatePaths: ['C:\\Riot Games\\League of Legends'],
      getCommandLine: async () => '--app-port=1 --remoting-auth-token=cli',
    })
    expect(creds).toMatchObject({ port: 52001, token: 'lock-token', source: 'lockfile' })
  })

  it('bascule sur la ligne de commande si aucun lockfile', async () => {
    const getCommandLine = vi.fn(async () => '--app-port=52999 --remoting-auth-token=cli-token')
    const creds = await getCredentials({
      readFile: async () => {
        throw new Error('ENOENT')
      },
      candidatePaths: ['C:\\nope'],
      getCommandLine,
    })
    expect(creds).toMatchObject({ port: 52999, token: 'cli-token', source: 'command-line' })
    expect(getCommandLine).toHaveBeenCalledOnce()
  })

  it('retourne null si aucune source ne répond', async () => {
    const creds = await getCredentials({
      readFile: async () => {
        throw new Error('ENOENT')
      },
      candidatePaths: ['C:\\nope'],
      getCommandLine: async () => null,
    })
    expect(creds).toBeNull()
  })
})

describe('toPublicCredentials', () => {
  it('retire le token', () => {
    const pub = toPublicCredentials({
      port: 443,
      token: 'SECRET',
      protocol: 'https',
      source: 'lockfile',
    })
    expect(pub).toEqual({ port: 443, protocol: 'https', source: 'lockfile' })
    expect(JSON.stringify(pub)).not.toContain('SECRET')
  })
})
