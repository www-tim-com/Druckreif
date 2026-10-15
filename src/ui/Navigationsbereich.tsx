// Navigationsbereich links (wie in Word): Notizen wählen oder durch die Überschriften des Dokuments springen.

import { X } from 'lucide-react'
import type { Notiz } from '../vault/notizen'
import type { NotizTeil } from '../dokument/aufbauen'
import type { Mappe, MappenEintrag } from '../mappen/mappen'
import { Gliederung } from './Gliederung'
import { MappeBereich } from './MappeBereich'
import { Seitenleiste } from './Seitenleiste'

export type NavAnsicht = 'mappe' | 'notizen' | 'gliederung'

interface Props {
  ansicht: NavAnsicht
  onAnsicht(a: NavAnsicht): void
  notizen: Notiz[]
  mappe: Mappe | null
  onNotizKlick(pfad: string): void
  onNeueMappe(pfad: string): void
  onVerschieben(von: number, nach: number): void
  onEntfernen(index: number): void
  onSetzen(index: number, teil: Partial<MappenEintrag>): void
  onMappenSprung(index: number): void
  teile: NotizTeil[]
  auswahl: string | null
  onSprung(blockId: string): void
  onAusblenden(blockId: string, ausblenden: boolean): void
  onSchliessen(): void
}

export function Navigationsbereich(p: Props) {
  const { ansicht, onAnsicht: setAnsicht } = p
  const inMappe = new Set(p.mappe?.items.map((e) => e.note) ?? [])
  return (
    <aside className="navigation">
      <header>
        <span>Navigation</span>
        <button className="schliessen" onClick={p.onSchliessen} aria-label="Navigation schließen">
          <X size={14} />
        </button>
      </header>
      <div className="nav-reiter">
        <button className={ansicht === 'mappe' ? 'gewaehlt' : ''} onClick={() => setAnsicht('mappe')}>
          Mappe{p.mappe ? ` (${p.mappe.items.length})` : ''}
        </button>
        <button className={ansicht === 'notizen' ? 'gewaehlt' : ''} onClick={() => setAnsicht('notizen')}>
          Notizen
        </button>
        <button className={ansicht === 'gliederung' ? 'gewaehlt' : ''} onClick={() => setAnsicht('gliederung')}>
          Überschriften
        </button>
      </div>
      {ansicht === 'mappe' &&
        (p.mappe ? (
          <MappeBereich
            mappe={p.mappe}
            teile={p.teile}
            onVerschieben={p.onVerschieben}
            onEntfernen={p.onEntfernen}
            onSetzen={p.onSetzen}
            onSprung={p.onMappenSprung}
          />
        ) : (
          <p className="mappe-leer">Keine Mappe offen. Unter „Notizen“ eine Notiz anklicken oder oben „+“ für eine neue Mappe.</p>
        ))}
      {ansicht === 'notizen' && (
        <Seitenleiste notizen={p.notizen} inMappe={inMappe} onKlick={p.onNotizKlick} onNeueMappe={p.onNeueMappe} />
      )}
      {ansicht === 'gliederung' && (
        <Gliederung teile={p.teile} auswahl={p.auswahl} onSprung={p.onSprung} onAusblenden={p.onAusblenden} />
      )}
    </aside>
  )
}
