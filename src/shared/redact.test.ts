import { describe, it, expect } from 'vitest'
import { redact, redactLockfile } from './redact'

describe('redact', () => {
  it('masque le remoting-auth-token en ligne de commande', () => {
    expect(redact('--remoting-auth-token=abc-123_XYZ')).toBe('--remoting-auth-token=***')
  })

  it('masque le remoting-auth-token en JSON', () => {
    expect(redact('"remoting-auth-token": "s3cr3t-Value"')).toBe('"remoting-auth-token": "***"')
  })

  it('masque un en-tête Authorization Basic', () => {
    expect(redact('Authorization: Basic cmlvdDpzZWNyZXQ=')).toBe('Authorization: Basic ***')
  })

  it('masque le mot de passe dans une URL', () => {
    expect(redact('https://riot:s3cr3t@127.0.0.1:2999/path')).toBe(
      'https://riot:***@127.0.0.1:2999/path',
    )
  })

  it('laisse un texte sans secret intact', () => {
    expect(redact('summonerLevel=345 gameId=42')).toBe('summonerLevel=345 gameId=42')
  })
})

describe('redactLockfile', () => {
  it('masque le 4e champ (mot de passe)', () => {
    expect(redactLockfile('LeagueClientUx:1234:52001:SUPERSECRET:https')).toBe(
      'LeagueClientUx:1234:52001:***:https',
    )
  })
})
