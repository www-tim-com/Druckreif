// Ordnerbaum mit Suche nach Titel und Filter nach Frontmatter.
// Klick auf eine Notiz = nur diese Notiz drucken, "+" = ans Dokument anhängen.

import { useMemo, useState } from 'react'
import { type Notiz, passtZuFilter } from '../vault/notizen'
import { Druckliste } from './Druckliste'

interface Props {
  notizen: Notiz[]
  liste: string[]
  onListe(liste: string[]): void
}

interface Ordner {
  name: string
  pfad: string
  ordner: Ordner[]
  notizen: Notiz[]
}

export function Seitenleiste({ notizen, liste, onListe }: Props) {
  const [suche, setSuche] = useState('')
  const [filter, setFilter] = useState('')

  const baum = useMemo(() => {
    const s = suche.trim().toLowerCase()
    const sichtbar = notizen.filter((n) => n.name.toLowerCase().includes(s) && passtZuFilter(n, filter))
    return baumBauen(sichtbar)
  }, [notizen, suche, filter])

  const ansicht = { liste, onListe }

  return (
    <aside className="seitenleiste">
      <Druckliste liste={liste} onAendern={onListe} />
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

function OrdnerAnsicht({ ordner, liste, onListe, offen }: { ordner: Ordner; liste: string[]; onListe(l: string[]): void; offen: boolean }) {
  return (
    <ul>
      {ordner.ordner.map((o) => (
        <li key={o.pfad}>
          <details open={offen || liste.some((p) => p.startsWith(o.pfad + '/'))}>
            <summary>{o.name}</summary>
            <OrdnerAnsicht ordner={o} liste={liste} onListe={onListe} offen={offen} />
          </details>
        </li>
      ))}
      {ordner.notizen.map((n) => (
        <li key={n.pfad} className="notiz-zeile">
          <button className={liste.includes(n.pfad) ? 'notiz aktiv' : 'notiz'} onClick={() => onListe([n.pfad])} title={n.pfad}>
            {n.istReihenfolge && <span className="reihenfolge-symbol" title="Reihenfolgedatei">☰ </span>}
            {n.name}
          </button>
          <button className="dazu" onClick={() => onListe([...liste, n.pfad])} title="ans Dokument anhängen">
            +
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
