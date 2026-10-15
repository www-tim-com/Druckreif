// Titelleiste wie in Word: Symbolleiste für den Schnellzugriff, Dokumenttitel, Speicherstatus.

import { CircleCheck, Loader, Printer, Redo2, Undo2 } from 'lucide-react'

interface Props {
  titel: string
  speichert: boolean
  kannZurueck: boolean
  kannVor: boolean
  zurueck(): void
  vor(): void
  drucken(): void
}

export function Titelleiste({ titel, speichert, kannZurueck, kannVor, zurueck, vor, drucken }: Props) {
  return (
    <header className="titelleiste">
      <span className="app-symbol">D</span>
      <div className="schnellzugriff">
        <button onClick={zurueck} disabled={!kannZurueck} title="Rückgängig (Strg+Z)">
          <Undo2 size={15} />
        </button>
        <button onClick={vor} disabled={!kannVor} title="Wiederholen (Strg+Y)">
          <Redo2 size={15} />
        </button>
        <button onClick={drucken} title="Drucken (Strg+P)">
          <Printer size={15} />
        </button>
      </div>
      <div className="titel">{titel} – Druckreif</div>
      <div className="speicherstatus" title="Layout-Änderungen werden automatisch in .lernzettel/ gespeichert">
        {speichert ? <Loader size={13} className="dreht" /> : <CircleCheck size={13} />}
        {speichert ? 'Speichert …' : 'Automatisch gespeichert'}
      </div>
    </header>
  )
}
