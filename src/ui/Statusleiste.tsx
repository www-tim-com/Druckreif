// Statusleiste unten wie in Word: links Seite x von y (öffnet die Seitenminiaturen), Wortanzahl (öffnet „Wörter
// zählen“), Hinweise; rechts Ansichten (Fokus, Drucklayout) und Zoom-Regler.

import { FileText, Focus, Minus, Plus, TriangleAlert } from 'lucide-react'
import { ZOOM_MAX, ZOOM_MIN } from './Band'
import { quickinfo } from './QuickInfo'

interface Props {
  seite: number
  seiten: number
  notizen: number
  woerter: number | null
  probleme: number
  meldung: string | null
  onSeiten(): void
  onWoerter(): void
  onHinweise(): void
  fokus: boolean
  onFokus(): void
  zoom: number
  onZoom(z: number): void
}

export function Statusleiste(p: Props) {
  const { seite, seiten, zoom, onZoom } = p
  return (
    <footer className="statusleiste">
      <button className="status-knopf" onClick={p.onSeiten} {...quickinfo('Seitenzahl', 'Seitenminiaturen im Navigationsbereich anzeigen')}>
        {seiten > 0 ? `Seite ${Math.min(seite, seiten)} von ${seiten}` : 'Keine Seiten'}
      </button>
      {p.woerter !== null && (
        <button className="status-knopf" onClick={p.onWoerter} {...quickinfo('Wortanzahl', 'Wörter der gedruckten Mappe – Klick zeigt Zeichen, Absätze und Zeilen')}>
          {p.woerter.toLocaleString('de-DE')} {p.woerter === 1 ? 'Wort' : 'Wörter'}
        </button>
      )}
      {p.notizen > 1 && <span>{p.notizen} Notizen</span>}
      <button className="status-knopf" onClick={p.onHinweise} {...quickinfo('Hinweise', 'Aufgabenbereich mit Fehlern, zu prüfenden Stellen und halb leeren Seiten')}>
        <TriangleAlert size={13} /> {p.probleme === 0 ? 'Hinweise: alles in Ordnung' : `${p.probleme} zu prüfen`}
      </button>
      {p.meldung && <span className="meldung">{p.meldung}</span>}
      <span className="abstand" />
      <button className={`status-ansicht${p.fokus ? ' an' : ''}`} onClick={p.onFokus} aria-label="Fokus" {...quickinfo('Fokus', 'Nur die Seiten: Menüband und Titelleiste ausblenden')}>
        <Focus size={14} />
      </button>
      <button className="status-ansicht an" aria-label="Drucklayout" {...quickinfo('Drucklayout', 'Seiten so, wie sie gedruckt werden')}>
        <FileText size={14} />
      </button>
      <span className="status-trenner" />
      <button className="status-knopf" onClick={() => onZoom(zoom - 0.1)} aria-label="Verkleinern" disabled={zoom <= ZOOM_MIN}>
        <Minus size={13} />
      </button>
      <input
        type="range"
        min={ZOOM_MIN * 100}
        max={ZOOM_MAX * 100}
        step={10}
        value={Math.round(zoom * 100)}
        onChange={(e) => onZoom(Number(e.target.value) / 100)}
        aria-label="Zoom"
      />
      <button className="status-knopf" onClick={() => onZoom(zoom + 0.1)} aria-label="Vergrößern" disabled={zoom >= ZOOM_MAX}>
        <Plus size={13} />
      </button>
      <button className="status-knopf zoom-wert" onClick={() => onZoom(1)} {...quickinfo('Zoom', 'Auf 100 % zurücksetzen (Strg+0)')}>
        {Math.round(zoom * 100)} %
      </button>
    </footer>
  )
}
