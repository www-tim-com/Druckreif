// Statusleiste unten wie in Word: Seite x von y, Hinweise, Zoom-Regler.

import { Minus, Plus, TriangleAlert } from 'lucide-react'
import { ZOOM_MAX, ZOOM_MIN } from './Band'

interface Props {
  seite: number
  seiten: number
  notizen: number
  probleme: number
  meldung: string | null
  onHinweise(): void
  zoom: number
  onZoom(z: number): void
}

export function Statusleiste({ seite, seiten, notizen, probleme, meldung, onHinweise, zoom, onZoom }: Props) {
  return (
    <footer className="statusleiste">
      <span>{seiten > 0 ? `Seite ${Math.min(seite, seiten)} von ${seiten}` : 'Keine Seiten'}</span>
      {notizen > 1 && <span>{notizen} Notizen</span>}
      <button className="status-knopf" onClick={onHinweise} title="Hinweise anzeigen">
        <TriangleAlert size={13} /> {probleme === 0 ? 'Keine Probleme' : `${probleme} zu prüfen`}
      </button>
      {meldung && <span className="meldung">{meldung}</span>}
      <span className="abstand" />
      <button className="status-knopf" onClick={() => onZoom(zoom - 0.1)} aria-label="Verkleinern">
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
      <button className="status-knopf" onClick={() => onZoom(zoom + 0.1)} aria-label="Vergrößern">
        <Plus size={13} />
      </button>
      <button className="status-knopf zoom-wert" onClick={() => onZoom(1)} title="Auf 100 % zurücksetzen">
        {Math.round(zoom * 100)} %
      </button>
    </footer>
  )
}
