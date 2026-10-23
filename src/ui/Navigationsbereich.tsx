// Navigationsbereich links (wie in Word): Dokument durchsuchen, Notizen wählen, durch Überschriften oder Seiten springen.

import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { type RefObject, useCallback, useMemo, useRef } from 'react'
import { MAX_TREFFER, type Treffer } from '../vorschau/suche'
import type { Notiz } from '../vault/notizen'
import type { NotizTeil } from '../dokument/aufbauen'
import type { Mappe, MappenEintrag } from '../mappen/mappen'
import { Gliederung } from './Gliederung'
import { MappeBereich } from './MappeBereich'
import { Seitenleiste } from './Seitenleiste'
import { Seitenminiaturen } from './Seitenminiaturen'

export type NavAnsicht = 'mappe' | 'notizen' | 'gliederung' | 'seiten'

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
  /** nach dem neuesten Layout, nicht nach dem zuletzt aufgebauten Dokument */
  istAusgeblendet(blockId: string): boolean
  onSchliessen(): void

  suchfeld: RefObject<HTMLInputElement | null>
  suche: string
  onSuche(begriff: string): void
  treffer: Treffer[]
  trefferAktiv: number
  onTreffer(index: number): void
  onTrefferWechseln(schritt: number): void

  seite: number
  seiten: number
  leerraumSeiten: number[]
  fassung: number
  miniaturHtml(): string | null
  onSeite(nummer: number): void
}

export function Navigationsbereich(p: Props) {
  const { ansicht, onAnsicht: setAnsicht } = p
  // gleichbleibende Props für die Seitenleiste (memo): sonst zeichnet jede Änderung den ganzen Notizbaum neu
  const inMappe = useMemo(() => new Set(p.mappe?.items.map((e) => e.note) ?? []), [p.mappe])
  const aktuell = useRef(p)
  aktuell.current = p
  const notizKlick = useCallback((pfad: string) => aktuell.current.onNotizKlick(pfad), [])
  const neueMappe = useCallback((pfad: string) => aktuell.current.onNeueMappe(pfad), [])
  return (
    <aside className="navigation">
      <header>
        <span>Navigation</span>
        <button className="schliessen" onClick={p.onSchliessen} aria-label="Navigation schließen">
          <X size={14} />
        </button>
      </header>
      <div className="dokumentsuche">
        <Search size={14} />
        <input
          ref={p.suchfeld}
          type="search"
          placeholder="Dokument durchsuchen"
          title="Im Dokument suchen (Strg+F) – Enter: nächster, Umschalt+Enter: vorheriger Treffer"
          value={p.suche}
          onChange={(e) => p.onSuche(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') p.onTrefferWechseln(e.shiftKey ? -1 : 1)
            else if (e.key === 'Escape') p.onSuche('')
            else return
            e.preventDefault()
            e.stopPropagation()
          }}
        />
        {p.suche.trim().length >= 2 && (
          <>
            <button onClick={() => p.onTrefferWechseln(-1)} disabled={p.treffer.length === 0} aria-label="Vorheriger Treffer">
              <ChevronUp size={14} />
            </button>
            <button onClick={() => p.onTrefferWechseln(1)} disabled={p.treffer.length === 0} aria-label="Nächster Treffer">
              <ChevronDown size={14} />
            </button>
          </>
        )}
      </div>
      {p.suche.trim().length >= 2 ? (
        <Suchergebnisse {...p} />
      ) : (
        <>
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
        <button className={ansicht === 'seiten' ? 'gewaehlt' : ''} onClick={() => setAnsicht('seiten')}>
          Seiten
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
        <Seitenleiste notizen={p.notizen} inMappe={inMappe} onKlick={notizKlick} onNeueMappe={neueMappe} />
      )}
      {ansicht === 'gliederung' && (
        <Gliederung teile={p.teile} auswahl={p.auswahl} onSprung={p.onSprung} onAusblenden={p.onAusblenden} istAusgeblendet={p.istAusgeblendet} />
      )}
      {ansicht === 'seiten' && (
        <Seitenminiaturen fassung={p.fassung} miniaturHtml={p.miniaturHtml} seite={p.seite} leerraumSeiten={p.leerraumSeiten} onSeite={p.onSeite} />
      )}
        </>
      )}
    </aside>
  )
}

function Suchergebnisse({ treffer, trefferAktiv, onTreffer }: Props) {
  return (
    <div className="suchergebnisse">
      <div className="anzahl">
        {treffer.length === 0 ? 'Keine Treffer' : `${trefferAktiv + 1} von ${treffer.length}${treffer.length >= MAX_TREFFER ? '+' : ''} Treffern`}
      </div>
      <ul>
        {treffer.map((t, i) => (
          <li key={i}>
            <button className={i === trefferAktiv ? 'gewaehlt' : ''} onClick={() => onTreffer(i)}>
              <span className="fundstelle">
                {t.vorher && '…'}
                {t.vorher}
                <mark>{t.text}</mark>
                {t.nachher}
                {t.nachher && '…'}
              </span>
              <span className="seite">Seite {t.seite}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
