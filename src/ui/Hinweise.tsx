// Aufgabenbereich „Hinweise“ rechts (ersetzt den Bericht der Export-Anweisung).
// Rote Layout-Einträge lassen sich einem Block zuweisen oder löschen, ausgeblendete Abschnitte wieder einblenden.

import { Eye, Link2, Trash2, X } from 'lucide-react'
import type { Hinweis } from '../hinweise'
import { dateiname, ohneEndung } from '../vault/vault'

interface Props {
  hinweise: Hinweis[]
  onSprung(blockId: string): void
  onEinblenden(notiz: string, index: number): void
  onZuweisen(notiz: string, index: number): void
  onLoeschen(notiz: string, index: number): void
  onSchliessen(): void
}

const REIHENFOLGE = { rot: 0, gelb: 1, info: 2 }
const TITEL = { rot: 'Fehler', gelb: 'Prüfen', info: 'Information' }

export function Hinweise({ hinweise, onSprung, onEinblenden, onZuweisen, onLoeschen, onSchliessen }: Props) {
  const sortiert = [...hinweise].sort((a, b) => REIHENFOLGE[a.stufe] - REIHENFOLGE[b.stufe])
  return (
    <aside className="aufgabenbereich">
      <header>
        <span>Hinweise</span>
        <button className="schliessen" onClick={onSchliessen} aria-label="Hinweise schließen">
          <X size={14} />
        </button>
      </header>
      {sortiert.length === 0 && <p className="leer">Alles in Ordnung – keine Hinweise.</p>}
      <ul>
        {sortiert.map((h, i) => {
          const eintrag = h.layoutEintrag
          return (
            <li key={i} className={`hinweis ${h.stufe}`}>
              <div className="kopf">{TITEL[h.stufe]}</div>
              <button className="text" disabled={!h.block} onClick={() => h.block && onSprung(h.block)}>
                {h.text}
              </button>
              {h.notiz && <div className="notiz">{ohneEndung(dateiname(h.notiz))}</div>}
              {eintrag !== undefined && (
                <div className="aktionen">
                  {h.art === 'ausgeblendet' && (
                    <button onClick={() => onEinblenden(h.notiz, eintrag)}>
                      <Eye size={13} /> Einblenden
                    </button>
                  )}
                  {h.art === 'zuordnung' && h.stufe === 'rot' && (
                    <>
                      <button onClick={() => onZuweisen(h.notiz, eintrag)}>
                        <Link2 size={13} /> Zuweisen …
                      </button>
                      <button onClick={() => onLoeschen(h.notiz, eintrag)}>
                        <Trash2 size={13} /> Löschen
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
