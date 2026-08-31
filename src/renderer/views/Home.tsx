import type { ConnectionInfo, RankedEntry } from '@shared/lcu-types'
import { Panel } from '../components/hextech'
import { useProfile } from '../lib/useProfile'

function winrate(entry: RankedEntry): number {
  const total = entry.wins + entry.losses
  return total === 0 ? 0 : Math.round((entry.wins / total) * 100)
}

function formatRank(entry: RankedEntry | null): string {
  if (!entry) return 'Non classé'
  const tier = entry.tier.charAt(0) + entry.tier.slice(1).toLowerCase()
  return `${tier} ${entry.division} · ${entry.leaguePoints} LP`
}

function RankRow({ label, entry }: { label: string; entry: RankedEntry | null }) {
  return (
    <div className="flex items-baseline justify-between border-b border-gold-800/50 py-2 last:border-0">
      <span className="font-display text-xs uppercase tracking-widest text-gold-600">{label}</span>
      <span className="text-right">
        <span className="text-gold-100">{formatRank(entry)}</span>
        {entry && (
          <span className="ml-3 text-xs text-gold-600">
            {entry.wins}V / {entry.losses}D · {winrate(entry)}%
          </span>
        )}
      </span>
    </div>
  )
}

export function Home({ connection }: { connection: ConnectionInfo }) {
  const connected = connection.status === 'connected'
  const summoner = connection.summoner
  const { ranked, iconDataUrl, loading } = useProfile(connected, summoner)

  if (!connected || !summoner) {
    return (
      <Panel title="Accueil">
        <p className="text-gold-600">
          {connection.status === 'connecting'
            ? 'Connexion au client League of Legends…'
            : 'En attente du client League of Legends. Lance le client officiel pour continuer.'}
        </p>
      </Panel>
    )
  }

  const xpPct = Math.max(0, Math.min(100, Math.round(summoner.percentCompleteForNextLevel)))

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-24 shrink-0 border-2 border-gold-300 bg-hextech-bg">
            {iconDataUrl && (
              <img
                src={iconDataUrl}
                alt="Icône d'invocateur"
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-hextech-black px-2 font-display text-sm text-gold-300">
              {summoner.summonerLevel}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl">
              {summoner.gameName || summoner.displayName}
              {summoner.tagLine && (
                <span className="ml-1 text-base text-gold-600">#{summoner.tagLine}</span>
              )}
            </h1>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] uppercase tracking-widest text-gold-600">
                <span>Niveau {summoner.summonerLevel}</span>
                <span>{xpPct}%</span>
              </div>
              <div className="h-2 w-full bg-gold-800/60">
                <div
                  className="h-full bg-gold-btn"
                  style={{ width: `${xpPct}%` }}
                  role="progressbar"
                  aria-valuenow={xpPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Classement">
        {loading && !ranked.soloDuo && !ranked.flex ? (
          <p className="text-gold-600">Chargement…</p>
        ) : (
          <div>
            <RankRow label="Solo / Duo" entry={ranked.soloDuo} />
            <RankRow label="Flexible" entry={ranked.flex} />
          </div>
        )}
      </Panel>
    </div>
  )
}
