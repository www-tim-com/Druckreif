// Hinweisliste unter der Vorschau (ersetzt den Bericht der Export-Anweisung).

import type { Hinweis } from '../hinweise'

interface Props {
  hinweise: Hinweis[]
  onLayoutEintragLoeschen(notiz: string, index: number): void
}

const REIHENFOLGE = { rot: 0, gelb: 1, info: 2 }

export function Hinweise({ hinweise, onLayoutEintragLoeschen }: Props) {
  if (hinweise.length === 0) return <div className="hinweise leer">Keine Hinweise.</div>
  const sortiert = [...hinweise].sort((a, b) => REIHENFOLGE[a.stufe] - REIHENFOLGE[b.stufe])
  return (
    <ul className="hinweise">
      {sortiert.map((h, i) => (
        <li key={i} className={`hinweis ${h.stufe}`}>
          <span className="text">{h.text}</span>
          {h.notiz && <span className="notiz">{h.notiz}</span>}
          {h.layoutEintrag !== undefined && h.stufe === 'rot' && (
            <button onClick={() => onLayoutEintragLoeschen(h.notiz, h.layoutEintrag!)}>Löschen</button>
          )}
        </li>
      ))}
    </ul>
  )
}
