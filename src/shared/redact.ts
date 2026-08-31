/**
 * Masquage des secrets LCU avant écriture dans les logs ou l'UI.
 * Cible : `remoting-auth-token`, en-têtes `Authorization: Basic`, mots de passe
 * embarqués dans une URL (`https://riot:token@127.0.0.1`) et le 4e champ du
 * lockfile (`LeagueClientUx:pid:port:PASSWORD:protocol`).
 */

export function redact(input: string): string {
  return input
    .replace(/(remoting-auth-token["']?\s*[=:]\s*["']?)([\w-]+)/gi, '$1***')
    .replace(/(--remoting-auth-token=)([\w-]+)/gi, '$1***')
    .replace(/(Authorization:\s*Basic\s+)([A-Za-z0-9+/=_-]+)/gi, '$1***')
    .replace(/(\/\/riot:)([^@\s]+)(@)/gi, '$1***$3')
}

/** Masque le champ mot de passe d'une ligne de lockfile. */
export function redactLockfile(content: string): string {
  return content.replace(/^([^:\r\n]+:[^:\r\n]+:[^:\r\n]+:)([^:\r\n]+)(:[^:\r\n]+)$/m, '$1***$3')
}
