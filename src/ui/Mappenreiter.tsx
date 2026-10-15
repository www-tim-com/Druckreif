// Reiter über den Seiten: jede offene Mappe ist ein Reiter (wie Dokumentfenster). Doppelklick benennt um.

import { useState } from 'react'
import { BookOpen, Plus, X } from 'lucide-react'
import type { Mappe } from '../mappen/mappen'

interface Props {
  mappen: Mappe[] // die offenen, in Reihenfolge der Reiter
  aktiv: string | null
  onWaehlen(id: string): void
  onSchliessen(id: string): void
  onNeu(): void
  onUmbenennen(id: string, name: string): void
}

export function Mappenreiter({ mappen, aktiv, onWaehlen, onSchliessen, onNeu, onUmbenennen }: Props) {
  const [bearbeitet, setBearbeitet] = useState<string | null>(null)
  return (
    <div className="mappenreiter" role="tablist">
      {mappen.map((m) => (
        <div
          key={m.id}
          role="tab"
          aria-selected={m.id === aktiv}
          className={`mappenreiter-reiter${m.id === aktiv ? ' aktiv' : ''}`}
          onClick={() => onWaehlen(m.id)}
          onDoubleClick={() => setBearbeitet(m.id)}
          title="Doppelklick zum Umbenennen"
        >
          <BookOpen size={13} />
          {bearbeitet === m.id ? (
            <input
              autoFocus
              defaultValue={m.name}
              onBlur={(e) => {
                onUmbenennen(m.id, e.target.value)
                setBearbeitet(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                if (e.key === 'Escape') setBearbeitet(null)
              }}
            />
          ) : (
            <span className="name">{m.name}</span>
          )}
          <button
            className="zu"
            onClick={(e) => {
              e.stopPropagation()
              onSchliessen(m.id)
            }}
            aria-label={`${m.name} schließen`}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button className="mappenreiter-neu" onClick={onNeu} title="Neue Mappe">
        <Plus size={15} />
      </button>
    </div>
  )
}
