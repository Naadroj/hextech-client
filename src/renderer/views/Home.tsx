import type { ConnectionInfo, RankedEntry } from '@shared/lcu-types'
import { Frame, IconFrame } from '../components/hextech'
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

function RankTile({ label, entry }: { label: string; entry: RankedEntry | null }) {
  return (
    <div className="flex items-center gap-4 border border-gold-800 bg-hextech-black/40 p-4">
      <span
        aria-hidden="true"
        className="grid h-12 w-12 shrink-0 rotate-45 place-items-center border border-gold-600 bg-gun-grad"
      >
        <span className="-rotate-45 font-display text-lg text-gold-300">
          {entry ? entry.tier.charAt(0) : '–'}
        </span>
      </span>
      <div className="min-w-0">
        <div className="font-display text-xs uppercase tracking-hexwide text-gold-700">{label}</div>
        <div className="text-gold-100">{formatRank(entry)}</div>
        {entry && (
          <div className="text-xs text-parchment">
            {entry.wins}V / {entry.losses}D · {winrate(entry)}%
          </div>
        )}
      </div>
    </div>
  )
}

export function Home({ connection }: { connection: ConnectionInfo }) {
  const connected = connection.status === 'connected'
  const summoner = connection.summoner
  const { ranked, iconDataUrl } = useProfile(connected, summoner)

  if (!connected || !summoner) {
    return (
      <Frame title="Accueil" className="mx-auto max-w-2xl">
        <p className="text-parchment">
          {connection.status === 'connecting'
            ? 'Connexion au client League of Legends…'
            : 'En attente du client League of Legends. Lance le client officiel pour continuer.'}
        </p>
      </Frame>
    )
  }

  const xpPct = Math.max(0, Math.min(100, Math.round(summoner.percentCompleteForNextLevel)))

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Frame>
        <div className="flex items-center gap-6">
          <IconFrame
            src={iconDataUrl}
            alt="Icône d'invocateur"
            size={104}
            level={summoner.summonerLevel}
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-3xl">
              {summoner.gameName || summoner.displayName}
              {summoner.tagLine && (
                <span className="ml-2 align-middle text-lg text-parchment">
                  #{summoner.tagLine}
                </span>
              )}
            </h1>
            <div className="mt-4">
              <div className="mb-1 flex justify-between font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                <span>Niveau {summoner.summonerLevel}</span>
                <span>{xpPct}%</span>
              </div>
              <div className="h-2 w-full border border-gold-800 bg-hextech-black/60">
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
      </Frame>

      <Frame title="Classement">
        <div className="grid gap-4 md:grid-cols-2">
          <RankTile label="Solo / Duo" entry={ranked.soloDuo} />
          <RankTile label="Flexible" entry={ranked.flex} />
        </div>
      </Frame>
    </div>
  )
}
