import type { CoachAdvice } from '@shared/coach-types'
import type { ItemRecommendation, Recommendation, SkeletonInfo } from '@shared/engine/recommend/types'
import { Frame, Tag } from '../components/hextech'
import { ItemIcon } from '../components/ItemIcon'
import { useCoach } from '../lib/useCoach'
import { useStaticData } from '../lib/useStaticData'

function fedLabel(fed: number): string {
  if (fed >= 1) return 'Très en avance'
  if (fed >= 0.3) return 'En avance'
  if (fed <= -0.6) return 'En retard'
  return 'À égalité'
}

function clock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function MixBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 font-display text-[10px] uppercase tracking-hexwide text-gold-700">
        {label}
      </span>
      <div className="h-2 flex-1 border border-gold-800 bg-hextech-black/60">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs text-parchment">{pct}%</span>
    </div>
  )
}

function ItemRow({
  item,
  primary,
  version,
}: {
  item: ItemRecommendation
  primary?: boolean
  version?: string | null
}) {
  return (
    <div className={`flex gap-4 ${primary ? 'items-start' : 'items-center'}`}>
      <ItemIcon itemId={item.itemId} version={version} size={primary ? 56 : 40} title={item.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={primary ? 'text-lg text-gold-100' : 'text-gold-100'}>{item.name}</span>
          {item.kind === 'component' && <Tag tone="cyan">achat de sécurité</Tag>}
          <span className="text-xs text-parchment">
            {item.goldTotal} or ·{' '}
            {item.affordableNow ? (
              <span className="text-ok">abordable</span>
            ) : (
              <span className="text-warn">manque {item.goldShort}</span>
            )}
          </span>
        </div>
        {primary && (
          <ul className="mt-2 space-y-1">
            {item.reasons.map((r, i) => (
              <li key={i} className="text-sm text-gold-100/80">
                • {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SkeletonBadge({ skeleton }: { skeleton: SkeletonInfo | null }) {
  if (!skeleton) return <Tag>Reco heuristique · pas de build hi-elo</Tag>
  const thin = skeleton.games < 40
  const bits = [`${skeleton.games} parties`]
  if (thin) bits.push('données fines')
  if (skeleton.roleAgnostic) bits.push('tous rôles')
  if (skeleton.patchSpan) bits.push(`patch ${skeleton.patchSpan}`)
  return <Tag tone={thin ? undefined : 'cyan'}>{`Build hi-elo · ${bits.join(' · ')}`}</Tag>
}

function BuildPath({ rec, version }: { rec: Recommendation; version: string | null }) {
  if (rec.buildPath.length === 0 && (!rec.skeleton || rec.skeleton.starters.length === 0)) return null
  return (
    <div className="space-y-3">
      {rec.skeleton && rec.skeleton.starters.length > 0 && (
        <div>
          <div className="mb-2 font-display text-[10px] uppercase tracking-hexwide text-gold-700">Départ</div>
          <div className="flex flex-wrap items-center gap-2">
            {rec.skeleton.starters.map((s) => (
              <span key={s.itemId} className="flex items-center gap-1.5 text-sm text-gold-100/90">
                <ItemIcon itemId={s.itemId} version={version} size={24} title={s.name} />
                {s.name} <span className="text-parchment">{Math.round(s.pickRate * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {rec.buildPath.length > 0 && (
        <div>
          <div className="mb-2 font-display text-[10px] uppercase tracking-hexwide text-gold-700">
            Cœur de build hi-elo
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {rec.buildPath.map((step, i) => (
              <span key={step.itemId} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gold-700">→</span>}
                <span
                  className={`flex items-center gap-1.5 text-sm ${step.owned ? 'text-parchment line-through' : 'text-gold-100'}`}
                  title={step.owned ? `${step.name} (déjà acheté)` : step.name}
                >
                  <ItemIcon itemId={step.itemId} version={version} size={24} title={step.name} />
                  {step.name}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function CoachView({ advice }: { advice: CoachAdvice }) {
  const version = useStaticData().summary?.version ?? null

  if (advice.status === 'idle' || !advice.self || !advice.threat) {
    return (
      <Frame title="Coach" className="mx-auto max-w-2xl">
        <p className="text-parchment">
          Aucune partie en cours. Le coach s'active automatiquement dès qu'une partie démarre et
          propose le prochain item selon l'état de la partie.
        </p>
      </Frame>
    )
  }

  const { self, threat, recommendation: rec } = advice

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {advice.dataWarning === 'stale' && (
        <div className="border border-warn/50 bg-warn/10 px-4 py-2 text-sm text-warn">
          Catalogue en cours de mise à jour pour ce patch — recommandations approximatives.
        </div>
      )}
      <Frame>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl">{self.slug}</h1>
          <Tag>{self.role}</Tag>
          <Tag>Niv {self.level}</Tag>
          <Tag tone="cyan">{self.currentGold} or</Tag>
          <Tag>{fedLabel(self.fed)}</Tag>
          {self.isManaConstrained && <Tag>mana court</Tag>}
          <span className="ml-auto text-xs text-parchment">{clock(advice.gameTimeSeconds)}</span>
        </div>
      </Frame>

      <Frame
        title="Prochain item conseillé"
        headerRight={rec?.primary ? <SkeletonBadge skeleton={rec.skeleton} /> : undefined}
      >
        {rec?.primary ? (
          <div className="space-y-5">
            <ItemRow item={rec.primary} primary version={version} />

            {rec.alternatives.length > 0 && (
              <div>
                <div className="mb-2 font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                  Alternatives
                </div>
                <div className="space-y-2">
                  {rec.alternatives.map((alt) => (
                    <ItemRow key={alt.itemId} item={alt} version={version} />
                  ))}
                </div>
              </div>
            )}

            <BuildPath rec={rec} version={version} />

            {rec.boots && (
              <div>
                <div className="mb-2 font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                  Bottes
                </div>
                <ItemRow item={rec.boots} version={version} />
                {rec.boots.reasons[0] && (
                  <p className="mt-1 text-sm text-gold-100/80">• {rec.boots.reasons[0]}</p>
                )}
              </div>
            )}

            <div className="hx-divider" />
            <p className="text-xs text-parchment">
              Profil : {rec.context.weightProfile}
              {rec.context.representativeTargetSlug &&
                ` · cible de référence : ${rec.context.representativeTargetSlug}`}
            </p>
          </div>
        ) : (
          <p className="text-parchment">Pas encore de recommandation (données de partie partielles).</p>
        )}
      </Frame>

      <Frame title="Menace ennemie">
        <div className="space-y-2">
          <MixBar label="Physique" value={threat.physical} tone="bg-gold-btn" />
          <MixBar label="Magique" value={threat.magic} tone="bg-rune-teal" />
          <MixBar label="Vrai" value={threat.true} tone="bg-parchment" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-parchment">
          <Tag>Burst {Math.round(threat.burst * 100)}%</Tag>
          {threat.primarySlug && (
            <span>
              Menace principale : <span className="text-gold-100">{threat.primarySlug}</span>
              {threat.primaryFed > 0.4 && <span className="text-warn"> (en avance)</span>}
            </span>
          )}
        </div>
      </Frame>
    </div>
  )
}

export function Coach() {
  return <CoachView advice={useCoach()} />
}
