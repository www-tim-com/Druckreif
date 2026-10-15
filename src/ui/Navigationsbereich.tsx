// Navigationsbereich links (wie in Word): Notizen wählen oder durch die Überschriften des Dokuments springen.

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Notiz } from '../vault/notizen'
import type { NotizTeil } from '../dokument/aufbauen'
import { Gliederung } from './Gliederung'
import { Seitenleiste } from './Seitenleiste'

interface Props {
  notizen: Notiz[]
  liste: string[]
  onListe(liste: string[]): void
  teile: NotizTeil[]
  auswahl: string | null
  onSprung(blockId: string): void
  onAusblenden(blockId: string, ausblenden: boolean): void
  onSchliessen(): void
}

export function Navigationsbereich(p: Props) {
  const [ansicht, setAnsicht] = useState<'notizen' | 'gliederung'>('notizen')
  return (
    <aside className="navigation">
      <header>
        <span>Navigation</span>
        <button className="schliessen" onClick={p.onSchliessen} aria-label="Navigation schließen">
          <X size={14} />
        </button>
      </header>
      <div className="nav-reiter">
        <button className={ansicht === 'notizen' ? 'gewaehlt' : ''} onClick={() => setAnsicht('notizen')}>
          Notizen
        </button>
        <button className={ansicht === 'gliederung' ? 'gewaehlt' : ''} onClick={() => setAnsicht('gliederung')}>
          Überschriften
        </button>
      </div>
      {ansicht === 'notizen' ? (
        <Seitenleiste notizen={p.notizen} liste={p.liste} onListe={p.onListe} />
      ) : (
        <Gliederung teile={p.teile} auswahl={p.auswahl} onSprung={p.onSprung} onAusblenden={p.onAusblenden} />
      )}
    </aside>
  )
}
