import type { NormalizedItem } from '../../staticdata-types'
import type { BuildBook } from '../../build-types'
import type { GameAssessment } from '../context'
import { buildPrior } from './build-prior'
import { damageAxisKeys, onAxisGoldFraction } from './tempo'
import type { RepresentativeTarget } from './target'
import type { Weights } from './weights'
import type { ItemRecommendation } from './types'

/**
 * Génération des phrases de justification (français), en citant les chiffres qui
 * ont réellement porté le score.
 */

const pct = (v: number): string => `${Math.round(v * 100)} %`

const isDefensive = (item: NormalizedItem): boolean =>
  (item.stats.armor ?? 0) > 0 || (item.stats.magicResist ?? 0) > 0 || (item.stats.health ?? 0) >= 150

const ORDINAL = ['', '1er', '2e', '3e', '4e', '5e', '6e']

/**
 * En dessous, on ne parle plus de « build hi-elo » mais du nombre de parties.
 *
 * Le prior s'applique dès `BUILD_MIN_GAMES` (5) — c'est un réglage mesuré au
 * benchmark, on n'y touche pas ici. Mais annoncer « 80 % des parties MID » sur
 * un échantillon de 5 est un abus de langage qui se paie en confiance.
 */
const THIN_SAMPLE_GAMES = 30

/**
 * Rôles pour qui « ta courbe de dégâts » ne veut rien dire : leur or utile part
 * en résistances, en soins et en contrôle, pas en scaling offensif. Signalé sur
 * un Thresh à qui on justifiait un Morellonomicon par « 100 % de l'or reste sur
 * ta courbe de dégâts ».
 */
const NON_CARRY_ROLES = new Set(['TANK', 'WARDEN', 'CATCHER', 'ENCHANTER', 'VANGUARD'])

const isDamageCarry = (a: GameAssessment): boolean => {
  const roles = a.self.profile.roles.map((x) => x.toUpperCase())
  return roles.length === 0 || roles.some((x) => !NON_CARRY_ROLES.has(x))
}

export function reasonsFor(
  scored: ItemRecommendation,
  item: NormalizedItem,
  a: GameAssessment,
  weights: Weights,
  target: RepresentativeTarget,
  book?: BuildBook,
): string[] {
  const b = scored.breakdown
  const drivers: [keyof typeof b, number][] = [
    ['offense', b.offense * weights.offense],
    ['defense', b.defense * weights.defense],
    ['utility', b.utility * weights.utility],
    ['costEfficiency', b.costEfficiency * weights.costEfficiency],
  ]
  drivers.sort((x, y) => y[1] - x[1])
  const top = drivers[0][0]
  const r: string[] = []

  // Squelette de build hi-elo : cité en premier quand il a réellement pesé.
  if (book && (b.buildPrior ?? 0) >= 0.15) {
    const p = buildPrior(item, a, book, scored.kind)
    if (p.entry && p.kind) {
      const rate = `${Math.round(p.entry.pickRate * 100)} % des parties ${p.role}`
      const span = p.patchSpan ? ` · patch ${p.patchSpan}` : ''
      // Échantillon maigre : on donne le nombre de parties au lieu de laisser
      // croire à un consensus hi-elo. « 80 % des parties MID » sur 5 parties
      // n'est pas une statistique, et le lire comme telle produit exactement le
      // signalement reçu le 6 septembre 2026 sur un Briar MID.
      if (p.games < THIN_SAMPLE_GAMES) {
        r.push(`Vu sur ce champion, mais sur ${p.games} parties seulement — à prendre avec des pincettes.`)
      } else if (p.kind === 'boots') {
        r.push(`Bottes standard sur ce champion (${rate}${span}).`)
      } else if (p.kind === 'core') {
        const slot = ORDINAL[Math.round(p.entry.avgSlot)] ?? `${Math.round(p.entry.avgSlot)}e`
        r.push(`Cœur de build hi-elo (${rate}, ~${slot} item${span}).`)
      } else {
        r.push(`Option de build récurrente sur ce champion (${rate}${span}).`)
      }
    }
  }

  // Axe de menace dominant — **seulement si l'item y répond vraiment**.
  //
  // Cette phrase est affichée juste sous l'item : le lecteur la lit comme sa
  // raison d'être. La pousser sur le seul état de la partie faisait dire au
  // coach « → résistance magique » sous un Glaive d'ombre (0 RM) et
  // « → armure » sous une Fleur de crypte (0 armure). Une justification qui
  // ment sur un fait vérifiable coûte plus cher que pas de justification.
  if (a.threat.magic >= 0.55 && (item.stats.magicResist ?? 0) > 0) {
    r.push(`Équipe ennemie ${pct(a.threat.magic)} magique → résistance magique.`)
  } else if (a.threat.physical >= 0.55 && (item.stats.armor ?? 0) > 0) {
    r.push(`Équipe ennemie ${pct(a.threat.physical)} physique → armure.`)
  }

  // Menace principale.
  const prim = a.threat.primary
  if (prim && prim.fed > 0.4) {
    r.push(`${prim.slug} en avance (${prim.profile.pattern}) — menace principale.`)
  }

  // Compromis de tempo : pourquoi (ne pas) prendre un détour défensif.
  if (isDefensive(item)) {
    const frac = onAxisGoldFraction(item, damageAxisKeys(a))
    if (frac >= 0.35 && isDamageCarry(a)) {
      r.push(`${pct(frac)} de l'or reste sur ta courbe de dégâts — détour léger.`)
    } else if (b.tempo <= -0.18) {
      r.push(
        prim
          ? `Détour défensif assumé : ${prim.slug} le justifie.`
          : 'Détour défensif — retarde ton powerspike.',
      )
    }
  } else if (b.tempo > -0.05 && a.triggers.burstSeverity > 0.45) {
    r.push('Menace gérable pour l’instant — priorité au powerspike.')
  }

  // Déclencheurs situationnels réellement servis par l'item.
  if (a.triggers.enemyHealing !== 'none' && /grievous wounds/i.test(item.description)) {
    r.push(
      `Antisoin : sustain ennemi ${
        a.triggers.enemyHealing === 'heavy' ? 'important' : 'présent'
      }.`,
    )
  }
  if (a.triggers.enemyHardCC && /quicksilver|removes all crowd control/i.test(item.description)) {
    r.push('CC dur ennemi (≥ 2) → retrait des contrôles.')
  }
  if ((a.triggers.enemyBurstPhysical || a.triggers.enemyBurstMagic) && /\bstasis\b/i.test(item.description)) {
    r.push('Burst ennemi → stase défensive.')
  }
  if (a.self.isManaConstrained && (item.stats.mana ?? 0) >= 200) {
    r.push('Réserve de mana courte → soutien de ressource.')
  }

  // Cible pour le sous-score offensif.
  if (top === 'offense' && target.slug) {
    r.push(
      `Cible ${target.slug} : ${Math.round(target.armor)} armure / ${Math.round(
        target.magicResist,
      )} RM effectives.`,
    )
  }
  if (top === 'defense' && a.triggers.beingFocused) {
    r.push('Tu es focus — spike défensif anticipé.')
  }

  if (b.costEfficiency > 0.3) r.push('Excellent rapport stats/or.')
  if (!scored.affordableNow) r.push(`À ${scored.goldShort} or : économiser avant l'achat.`)

  return r.slice(0, 3)
}

/** Justifications d'une reco de composant défensif (mode « sécuriser sans casser le build »). */
export function reasonsForComponent(
  scored: ItemRecommendation,
  item: NormalizedItem,
  a: GameAssessment,
  continueToward: string | null,
): string[] {
  const r: string[] = []
  const prim = a.threat.primary
  r.push(
    prim
      ? `Sécurise contre ${prim.slug} (menace ${pct(a.triggers.burstSeverity)}) sans casser ton build.`
      : `Sécurité à bas coût (menace ${pct(a.triggers.burstSeverity)}).`,
  )
  if (/\bstasis\b/i.test(item.description)) r.push('Stase à usage unique en attendant l’item complet.')
  else if (/quicksilver|removes all crowd control/i.test(item.description)) {
    r.push('Retrait de contrôle immédiat, peu cher.')
  }
  if (continueToward) r.push(`Puis reprends ton build vers ${continueToward}.`)
  if (!scored.affordableNow) r.push(`À ${scored.goldShort} or.`)
  return r.slice(0, 3)
}

export function reasonsForBoots(scored: ItemRecommendation, a: GameAssessment): string[] {
  const r: string[] = []
  if (a.threat.magic >= 0.5 && /mercury|treads|chainlaced/i.test(scored.name)) {
    r.push(`Menace magique ${pct(a.threat.magic)} + tenacité contre le CC.`)
  } else if (a.threat.physical >= 0.55 && /steelcaps|plated|armored/i.test(scored.name)) {
    r.push(`Menace physique ${pct(a.threat.physical)} + anti auto-attaques.`)
  }
  if (a.triggers.enemyHardCC && /mercury|treads|chainlaced/i.test(scored.name)) {
    r.push('CC dur ennemi → 30 % de tenacité.')
  }
  if (r.length === 0) r.push('Bottes adaptées au profil de la partie.')
  return r.slice(0, 2)
}
