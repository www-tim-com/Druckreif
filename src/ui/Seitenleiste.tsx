// Ordnerbaum mit Suche nach Titel und Filter nach Frontmatter.

import { useMemo, useState } from 'react'
import { type Notiz, passtZuFilter } from '../vault/notizen'

interface Props {
  notizen: Notiz[]
  auswahl: string | null
  onAuswahl(pfad: string): void
}

interface Ordner {
  name: string
  pfad: string
  ordner: Ordner[]
  notizen: Notiz[]
}

export function Seitenleiste({ notizen, auswahl, onAuswahl }: Props) {
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('')

  const baum = useMemo(() => {
    const s = suche.trim().toLowerCase()
    const sichtbar = notizen.filter((n) => n.name.toLowerCase().includes(s) && passtZuFilter(n, filter))
    return baumBauen(sichtbar)
  }, [notizen, suche, filter])

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
        <OrdnerAnsicht ordner={baum} auswahl={auswahl} onAuswahl={onAuswahl} offen={!!(suche || filter)} />
      </div>
    </aside>
  )
}

function OrdnerAnsicht({ ordner, auswahl, onAuswahl, offen }: { ordner: Ordner; auswahl: string | null; onAuswahl(p: string): void; offen: boolean }) {
  return (
    <ul>
      {ordner.ordner.map((o) => (
        <li key={o.pfad}>
          <details open={offen || (auswahl?.startsWith(o.pfad + '/') ?? false)}>
            <summary>{o.name}</summary>
            <OrdnerAnsicht ordner={o} auswahl={auswahl} onAuswahl={onAuswahl} offen={offen} />
          </details>
        </li>
      ))}
      {ordner.notizen.map((n) => (
        <li key={n.pfad}>
          <button className={n.pfad === auswahl ? 'notiz aktiv' : 'notiz'} onClick={() => onAuswahl(n.pfad)} title={n.pfad}>
            {n.istReihenfolge && <span className="reihenfolge-symbol" title="Reihenfolgedatei">☰ </span>}
            {n.name}
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
