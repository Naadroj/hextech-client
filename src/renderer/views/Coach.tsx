import type { CoachAdvice } from '@shared/coach-types'
import type { ItemRecommendation } from '@shared/engine/recommend/types'
import { Frame, Tag } from '../components/hextech'
import { ItemIcon } from '../components/ItemIcon'
import { useCoach } from '../lib/useCoach'

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

function ItemRow({ item, primary }: { item: ItemRecommendation; primary?: boolean }) {
  return (
    <div className={`flex gap-4 ${primary ? 'items-start' : 'items-center'}`}>
      <ItemIcon itemId={item.itemId} size={primary ? 56 : 40} title={item.name} />
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

export function CoachView({ advice }: { advice: CoachAdvice }) {
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

      <Frame title="Prochain item conseillé">
        {rec?.primary ? (
          <div className="space-y-5">
            <ItemRow item={rec.primary} primary />

            {rec.alternatives.length > 0 && (
              <div>
                <div className="mb-2 font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                  Alternatives
                </div>
                <div className="space-y-2">
                  {rec.alternatives.map((alt) => (
                    <ItemRow key={alt.itemId} item={alt} />
                  ))}
                </div>
              </div>
            )}

            {rec.boots && (
              <div>
                <div className="mb-2 font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                  Bottes
                </div>
                <ItemRow item={rec.boots} />
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
