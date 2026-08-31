import { describe, it, expect, vi, afterEach } from 'vitest'
import { logger } from './logger'

afterEach(() => vi.restoreAllMocks())

describe('logger', () => {
  it('masque un remoting-auth-token dans les arguments string', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logger.info('connexion via --remoting-auth-token=abc-123_XYZ')
    expect(spy).toHaveBeenCalledWith('[hextech]', 'connexion via --remoting-auth-token=***')
  })

  it('masque un en-tête Authorization Basic', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logger.warn('Authorization: Basic cmlvdDpzZWNyZXQ=')
    expect(spy).toHaveBeenCalledWith('[hextech]', 'Authorization: Basic ***')
  })

  it('laisse passer les arguments non-string tels quels', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const obj = { port: 52001 }
    logger.error('échec', obj, 42)
    expect(spy).toHaveBeenCalledWith('[hextech]', 'échec', obj, 42)
  })
})
