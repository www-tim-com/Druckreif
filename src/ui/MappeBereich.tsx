// Bereich „Mappe“ im Navigationsbereich: welche Notizen in welcher Reihenfolge im Dokument stehen.
// Pro Notiz: ziehen zum Umsortieren, „neue Seite“ oder direkt anschließen, nur einzelne Abschnitte übernehmen.

import { useState } from 'react'
import { ChevronDown, ChevronRight, FilePlus2, GripVertical, ArrowDownToLine, X } from 'lucide-react'
import type { NotizTeil } from '../dokument/aufbauen'
import type { Mappe, MappenEintrag } from '../mappen/mappen'
import { notizName } from '../vault/vault'

interface Props {
  mappe: Mappe
  teile: NotizTeil[]
  onVerschieben(von: number, nach: number): void
  onEntfernen(index: number): void
  onSetzen(index: number, teil: Partial<MappenEintrag>): void
  onSprung(index: number): void
}

export function MappeBereich({ mappe, teile, onVerschieben, onEntfernen, onSetzen, onSprung }: Props) {
  const [offen, setOffen] = useState<number | null>(null)
  const [gezogen, setGezogen] = useState<number | null>(null)
  const [ziel, setZiel] = useState<number | null>(null)

  if (mappe.items.length === 0) {
    return <p className="mappe-leer">Die Mappe ist leer. Unter „Notizen“ eine Notiz anklicken, um sie hinzuzufügen.</p>
  }

  return (
    <ol className="mappe">
      {mappe.items.map((eintrag, i) => {
        const teil = teile.find((t) => t.mappenIndex === i && t.pfad === eintrag.note)
        // Reihenfolgedatei: steht für mehrere Notizen, Auszüge gibt es dafür nicht
        const reihenfolge = !teil && teile.some((t) => t.mappenIndex === i)
        const neueSeite = eintrag.newPage !== false
        return (
          <li
            key={`${eintrag.note}-${i}`}
            className={`${gezogen === i ? 'wird-gezogen' : ''}${ziel === i ? ' ziel' : ''}`}
            draggable
            onDragStart={(e) => {
              setGezogen(i)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setZiel(i)
            }}
            onDragLeave={() => setZiel(null)}
            onDrop={(e) => {
              e.preventDefault()
              if (gezogen !== null && gezogen !== i) onVerschieben(gezogen, i)
              setGezogen(null)
              setZiel(null)
            }}
            onDragEnd={() => {
              setGezogen(null)
              setZiel(null)
            }}
          >
            <div className="mappe-zeile">
              <GripVertical size={14} className="griff" />
              <button className="aufklappen" onClick={() => setOffen(offen === i ? null : i)} aria-label="Abschnitte">
                {offen === i ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <button className="name" onClick={() => onSprung(i)} title={eintrag.note}>
                <span className="nummer">{i + 1}.</span> {notizName(eintrag.note)}
                {eintrag.sections && <span className="markierung">Auszug</span>}
              </button>
              <button
                className={`seite${neueSeite ? ' an' : ''}`}
                onClick={() => onSetzen(i, { newPage: !neueSeite })}
                title={neueSeite ? 'Beginnt auf neuer Seite – klicken: direkt anschließen' : 'Schließt direkt an – klicken: neue Seite'}
                disabled={i === 0}
              >
                {neueSeite ? <FilePlus2 size={14} /> : <ArrowDownToLine size={14} />}
              </button>
              <button className="entfernen" onClick={() => onEntfernen(i)} title="Aus der Mappe entfernen">
                <X size={14} />
              </button>
            </div>
            {offen === i &&
              (reihenfolge ? (
                <p className="mappe-hinweis">Reihenfolgedatei – einzelne Abschnitte lassen sich nur bei einer Notiz wählen.</p>
              ) : (
                <Abschnittswahl eintrag={eintrag} teil={teil} onSetzen={(t) => onSetzen(i, t)} />
              ))}
          </li>
        )
      })}
    </ol>
  )
}

/** Häkchen pro ##-Abschnitt; alle angehakt = ganze Notiz (sections fällt weg). */
function Abschnittswahl({ eintrag, teil, onSetzen }: { eintrag: MappenEintrag; teil?: NotizTeil; onSetzen(t: Partial<MappenEintrag>): void }) {
  if (!teil) return <p className="mappe-hinweis">Abschnitte erscheinen, sobald die Notiz geladen ist.</p>
  const alle = [...(teil.hatEinleitung ? [''] : []), ...teil.abschnitte]
  if (alle.length <= 1) return <p className="mappe-hinweis">Die Notiz hat keine ##-Abschnitte.</p>
  const gewaehlt = new Set(eintrag.sections ?? alle)

  function umschalten(name: string) {
    const neu = new Set(gewaehlt)
    if (neu.has(name)) neu.delete(name)
    else neu.add(name)
    const liste = alle.filter((a) => neu.has(a))
    onSetzen({ sections: liste.length === alle.length ? undefined : liste })
  }

  return (
    <div className="abschnittswahl">
      <label className="alle">
        <input type="checkbox" checked={!eintrag.sections} onChange={() => onSetzen({ sections: eintrag.sections ? undefined : [] })} />
        Ganze Notiz
      </label>
      {alle.map((name) => (
        <label key={name || '(einleitung)'}>
          <input type="checkbox" checked={gewaehlt.has(name)} onChange={() => umschalten(name)} />
          {name || <em>Einleitung</em>}
        </label>
      ))}
    </div>
  )
}
