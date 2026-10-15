// Ordnerbaum mit Suche nach Titel und Filter nach Frontmatter.
// Klick auf eine Notiz = an die aktive Mappe anhängen, Ordner-Symbol = in einer neuen Mappe öffnen.

import { useMemo, useState } from 'react'
import { Check, FolderPlus } from 'lucide-react'
import { type Notiz, passtZuFilter } from '../vault/notizen'

interface Props {
  notizen: Notiz[]
  /** Pfade, die schon in der aktiven Mappe stehen */
  inMappe: Set<string>
  onKlick(pfad: string): void
  onNeueMappe(pfad: string): void
}

interface AnsichtProps {
  inMappe: Set<string>
  onKlick(pfad: string): void
  onNeueMappe(pfad: string): void
}

interface Ordner {
  name: string
  pfad: string
  ordner: Ordner[]
  notizen: Notiz[]
}

export function Seitenleiste({ notizen, inMappe, onKlick, onNeueMappe }: Props) {
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('')

  const baum = useMemo(() => {
    const s = suche.trim().toLowerCase()
    const sichtbar = notizen.filter((n) => n.name.toLowerCase().includes(s) && passtZuFilter(n, filter))
    return baumBauen(sichtbar)
  }, [notizen, suche, filter])

  const ansicht = { inMappe, onKlick, onNeueMappe }

  return (
    <aside className="seitenleiste">
      <input type="search" placeholder="Titel suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
      <input
        type="search"
        placeholder="Filter, z. B. lernfeld: 3"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="baum">
        <OrdnerAnsicht ordner={baum} {...ansicht} offen={!!(suche || filter)} />
      </div>
    </aside>
  )
}

function OrdnerAnsicht({ ordner, offen, ...ansicht }: AnsichtProps & { ordner: Ordner; offen: boolean }) {
  const { inMappe, onKlick, onNeueMappe } = ansicht
  return (
    <ul>
      {ordner.ordner.map((o) => (
        <li key={o.pfad}>
          <details open={offen || [...inMappe].some((p) => p.startsWith(o.pfad + '/'))}>
            <summary>{o.name}</summary>
            <OrdnerAnsicht ordner={o} {...ansicht} offen={offen} />
          </details>
        </li>
      ))}
      {ordner.notizen.map((n) => (
        <li key={n.pfad} className="notiz-zeile">
          <button
            className={inMappe.has(n.pfad) ? 'notiz aktiv' : 'notiz'}
            onClick={() => onKlick(n.pfad)}
            title={inMappe.has(n.pfad) ? 'Steht in der Mappe – klicken springt hin' : 'Zur Mappe hinzufügen'}
          >
            {n.istReihenfolge && <span className="reihenfolge-symbol" title="Reihenfolgedatei">☰ </span>}
            {n.name}
          </button>
          {inMappe.has(n.pfad) && <Check size={13} className="in-mappe" />}
          <button className="dazu" onClick={() => onNeueMappe(n.pfad)} title="In neuer Mappe öffnen">
            <FolderPlus size={14} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function baumBauen(notizen: Notiz[]): Ordner {
  const wurzel: Ordner = { name: '', pfad: '', ordner: [], notizen: [] }
  for (const notiz of notizen) {
    let aktuell = wurzel
    const teile = notiz.pfad.split('/').slice(0, -1)
    teile.forEach((teil, i) => {
      const pfad = teile.slice(0, i + 1).join('/')
      let kind = aktuell.ordner.find((o) => o.pfad === pfad)
      if (!kind) aktuell.ordner.push((kind = { name: teil, pfad, ordner: [], notizen: [] }))
      aktuell = kind
    })
    aktuell.notizen.push(notiz)
  }
  return wurzel
}
