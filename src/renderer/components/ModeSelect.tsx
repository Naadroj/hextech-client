import { useEffect, useMemo, useRef, useState } from 'react'
import type { ModeCategory, ModeItem } from '../lib/gameModes'
import { Button, Frame, Tag } from './hextech'

export interface ModeSelectProps {
  categories: ModeCategory[]
  busy?: boolean
  error?: string | null
  onConfirm: (item: ModeItem) => void
}

/** Sélecteur de mode à deux niveaux : catégorie → file, puis confirmation. */
export function ModeSelect({ categories, busy = false, error, onConfirm }: ModeSelectProps) {
  const [activeCatId, setActiveCatId] = useState(categories[0]?.id ?? '')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const userPicked = useRef(false)

  // Les catégories arrivent de façon asynchrone (chargement des files) :
  // recale la catégorie active sur la première tant que l'utilisateur n'a
  // pas choisi, ou si la sélection courante a disparu.
  const catKey = categories.map((c) => c.id).join(',')
  useEffect(() => {
    if (!userPicked.current || !categories.some((c) => c.id === activeCatId)) {
      setActiveCatId(categories[0]?.id ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catKey])

  const activeCat = useMemo(
    () => categories.find((c) => c.id === activeCatId) ?? categories[0],
    [categories, activeCatId],
  )

  const pickCategory = (id: string) => {
    userPicked.current = true
    setActiveCatId(id)
  }
  const selected = useMemo(
    () => categories.flatMap((c) => c.items).find((i) => i.key === selectedKey) ?? null,
    [categories, selectedKey],
  )

  if (!activeCat) {
    return (
      <Frame title="Choisir un mode" className="mx-auto max-w-3xl">
        <p className="text-parchment">Aucun mode disponible pour le moment.</p>
      </Frame>
    )
  }

  return (
    <Frame title="Choisir un mode" className="mx-auto max-w-4xl">
      <div className="hx-modeselect">
        <ul className="hx-modeselect__cats" role="tablist" aria-label="Catégories de mode">
          {categories.map((cat) => (
            <li key={cat.id}>
              <button
                type="button"
                role="tab"
                aria-selected={cat.id === activeCat.id}
                data-active={cat.id === activeCat.id}
                className="hx-modeselect__cat"
                onClick={() => pickCategory(cat.id)}
              >
                <span>{cat.label}</span>
                <span className="hx-modeselect__count">{cat.items.length}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="hx-modeselect__pane" role="tabpanel" aria-label={activeCat.label}>
          {activeCat.items.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={!item.available || busy}
              data-active={item.key === selectedKey}
              className="hx-modeselect__item"
              onClick={() => setSelectedKey(item.key)}
            >
              <span className="hx-modeselect__item-title">
                {item.label}
                {item.isRanked && <Tag tone="cyan">Classé</Tag>}
              </span>
              <span className="hx-modeselect__item-sub">{item.subtitle}</span>
              {!item.available && (
                <span className="hx-modeselect__item-reason">{item.unavailableReason}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-decline">{error}</p>}

      <div className="hx-modeselect__footer">
        <span className="text-sm text-parchment">
          {selected ? (
            <>
              Sélection : <span className="text-gold-100">{selected.label}</span>
            </>
          ) : (
            'Choisis un mode dans la liste'
          )}
        </span>
        <Button
          variant="gold"
          disabled={!selected || busy}
          onClick={() => selected && onConfirm(selected)}
        >
          Créer le lobby
        </Button>
      </div>
    </Frame>
  )
}
