// „Datei“-Ansicht wie im modernen Word (Backstage): links die Seitenleiste mit Start, Öffnen, Informationen,
// Drucken und Optionen, rechts die gewählte Seite. Ohne geöffneten Vault ist sie die Startseite. Esc: zurück.

import { useEffect } from 'react'
import { ArrowLeft, BookOpen, FolderOpen, House, Info, Printer, Settings, Sparkles, Trash2 } from 'lucide-react'
import type { Mappe } from '../mappen/mappen'
import { ordnerZugriffMoeglich } from '../vault/ordnerVault'
import type { BandAnzeige, Design, Oberflaeche } from './oberflaeche'

export type DateiSeite = 'start' | 'oeffnen' | 'info' | 'drucken' | 'optionen'

interface Props {
  seite: DateiSeite
  onSeite(s: DateiSeite): void
  vaultName: string | null
  gemerkt: string | null
  theme: string | null
  snippets: string[]
  fehler: string | null
  onZurueck: (() => void) | null
  onOrdner(): void
  onGemerkt(): void
  onDemo(): void
  onDrucken: (() => void) | null
  /** aktive Mappe und ihre Seitenzahl (für „Drucken“ und „Informationen“) */
  mappe: Mappe | null
  seiten: number
  mappen: Mappe[]
  onMappeOeffnen(id: string): void
  onMappeLoeschen(id: string): void
  oberflaeche: Oberflaeche
  onOberflaeche(teil: Partial<Oberflaeche>): void
}

export function Datei(p: Props) {
  const { onZurueck } = p
  useEffect(() => {
    if (!onZurueck) return
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target as Element | null)?.closest?.('input')) return
      e.preventDefault()
      onZurueck()
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onZurueck])

  const mitVault = !!p.vaultName
  const punkte: { id: DateiSeite; text: string; symbol: typeof House; da: boolean }[] = [
    { id: 'start', text: 'Start', symbol: House, da: true },
    { id: 'oeffnen', text: 'Öffnen', symbol: FolderOpen, da: true },
    { id: 'info', text: 'Informationen', symbol: Info, da: mitVault },
    { id: 'drucken', text: 'Drucken', symbol: Printer, da: !!p.onDrucken },
  ]
  const seite = punkte.some((x) => x.id === p.seite && x.da) || p.seite === 'optionen' ? p.seite : 'start'

  return (
    <div className="datei">
      <nav>
        {p.onZurueck && (
          <button className="zurueck" onClick={p.onZurueck} aria-label="Zurück zum Dokument (Esc)" title="Zurück zum Dokument (Esc)">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="marke">Druckreif</div>
        {punkte
          .filter((x) => x.da)
          .map((x) => (
            <button key={x.id} className={x.id === seite ? 'gewaehlt' : ''} onClick={() => p.onSeite(x.id)}>
              <x.symbol size={16} /> {x.text}
            </button>
          ))}
        <span className="abstand" />
        <button className={seite === 'optionen' ? 'gewaehlt' : ''} onClick={() => p.onSeite('optionen')}>
          <Settings size={16} /> Optionen
        </button>
      </nav>
      <main>
        {seite === 'start' && <Start {...p} />}
        {seite === 'oeffnen' && <Oeffnen {...p} />}
        {seite === 'info' && <Informationen {...p} />}
        {seite === 'drucken' && <Drucken {...p} />}
        {seite === 'optionen' && <Optionen {...p} />}
      </main>
    </div>
  )
}

function gruss(): string {
  const stunde = new Date().getHours()
  return stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend'
}

function Start(p: Props) {
  return (
    <>
      <h1>{gruss()}</h1>
      <p className="leise">Obsidian-Lernzettel als druckfertige A4-Seiten. Der Vault wird nur gelesen; Layout-Änderungen landen in <code>.lernzettel/</code>.</p>
      <Kacheln {...p} />
      {p.vaultName && <Mappenliste {...p} />}
    </>
  )
}

function Oeffnen(p: Props) {
  return (
    <>
      <h1>Öffnen</h1>
      <p className="leise">Einen Obsidian-Vault wählen. Gelesen werden Notizen, Bilder, Theme und CSS-Snippets.</p>
      <Kacheln {...p} />
      {p.vaultName && <Mappenliste {...p} />}
    </>
  )
}

function Kacheln(p: Props) {
  const moeglich = ordnerZugriffMoeglich()
  return (
    <>
      <div className="kacheln">
        {p.gemerkt && moeglich && (
          <button className="kachel" onClick={p.onGemerkt}>
            <FolderOpen size={28} strokeWidth={1.4} />
            <strong>{p.gemerkt}</strong>
            <span>Zuletzt geöffnet</span>
          </button>
        )}
        <button className="kachel" disabled={!moeglich} onClick={p.onOrdner}>
          <FolderOpen size={28} strokeWidth={1.4} />
          <strong>Vault-Ordner wählen …</strong>
          <span>Obsidian-Vault auf diesem PC</span>
        </button>
        <button className="kachel" onClick={p.onDemo}>
          <Sparkles size={28} strokeWidth={1.4} />
          <strong>Demo-Vault</strong>
          <span>Beispielnotizen ansehen</span>
        </button>
      </div>
      {!moeglich && <p className="leise">Ordnerzugriff geht nur in Chrome oder Edge über localhost (start.bat).</p>}
      {p.fehler && <p className="fehler">{p.fehler}</p>}
    </>
  )
}

function Mappenliste(p: Props) {
  return (
    <>
      <h2>
        <BookOpen size={18} /> Mappen in „{p.vaultName}“
      </h2>
      {p.mappen.length === 0 && <p className="leise">Noch keine Mappen. Eine Notiz anklicken legt automatisch eine an.</p>}
      <ul className="mappenliste">
        {p.mappen.map((m) => (
          <li key={m.id}>
            <button className="oeffnen" onClick={() => p.onMappeOeffnen(m.id)}>
              <BookOpen size={16} />
              <strong>{m.name}</strong>
              <span>{m.items.length} {m.items.length === 1 ? 'Notiz' : 'Notizen'}</span>
            </button>
            <button
              className="loeschen"
              title="Mappe löschen (Notizen und Layouts bleiben erhalten)"
              onClick={() => confirm(`Mappe „${m.name}“ löschen? Die Notizen selbst bleiben unverändert.`) && p.onMappeLoeschen(m.id)}
            >
              <Trash2 size={15} />
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

function Informationen(p: Props) {
  return (
    <>
      <h1>Informationen</h1>
      {p.mappe && (
        <>
          <h2>
            <BookOpen size={18} /> {p.mappe.name}
          </h2>
          <dl>
            <dt>Notizen</dt>
            <dd>{p.mappe.items.length}</dd>
            <dt>Seiten</dt>
            <dd>{p.seiten || '–'}</dd>
            <dt>Tinte sparen</dt>
            <dd>{p.mappe.inkSaving ? 'ein' : 'aus'}</dd>
            <dt>Gespeichert in</dt>
            <dd><code>.lernzettel/mappen.json</code></dd>
          </dl>
        </>
      )}
      <h2>
        <Info size={18} /> Vault
      </h2>
      <dl>
        <dt>Vault</dt>
        <dd>{p.vaultName}</dd>
        <dt>Theme</dt>
        <dd>{p.theme ?? 'Obsidian-Standard (hell)'}</dd>
        <dt>Snippets</dt>
        <dd>{p.snippets.length ? p.snippets.join(', ') : 'keine'}</dd>
        <dt>Layouts</dt>
        <dd><code>.lernzettel/</code> – eine Datei pro Notiz, die Notizen bleiben unverändert</dd>
      </dl>
    </>
  )
}

function Drucken(p: Props) {
  return (
    <>
      <h1>Drucken</h1>
      <div className="druckbereich">
        <button className="druckknopf" onClick={() => p.onDrucken?.()} disabled={!p.onDrucken}>
          <Printer size={36} strokeWidth={1.3} />
          <span>Drucken</span>
        </button>
        <dl>
          <dt>Mappe</dt>
          <dd>{p.mappe?.name ?? '–'}</dd>
          <dt>Umfang</dt>
          <dd>{p.seiten > 0 ? `${p.seiten} ${p.seiten === 1 ? 'Seite' : 'Seiten'} A4` : '–'}</dd>
        </dl>
      </div>
      <p className="leise">Im Druckdialog von Chrome oder Edge „Als PDF speichern“ wählen, um eine PDF-Datei zu erhalten. Ränder: „Standard“, Hintergrundgrafiken: an (für Callouts und Tabellenköpfe).</p>
    </>
  )
}

const DESIGNS: { id: Design; text: string; muster: [string, string, string] }[] = [
  { id: 'system', text: 'Systemeinstellung verwenden', muster: ['linear-gradient(135deg, #f3f3f3 50%, #2b2b2b 50%)', '#ffffff', '#185abd'] },
  { id: 'weiss', text: 'Weiß', muster: ['#f3f3f3', '#ffffff', '#185abd'] },
  { id: 'farbig', text: 'Farbig', muster: ['#185abd', '#ffffff', '#185abd'] },
  { id: 'dunkelgrau', text: 'Dunkelgrau', muster: ['#2b2b2b', '#3a3a3a', '#4f8fe8'] },
  { id: 'schwarz', text: 'Schwarz', muster: ['#0a0a0a', '#1f1f1f', '#4f8fe8'] },
]

const ANZEIGEN: { id: BandAnzeige; text: string }[] = [
  { id: 'immer', text: 'Menüband immer anzeigen' },
  { id: 'register', text: 'Nur Registerkarten anzeigen' },
  { id: 'vollbild', text: 'Vollbildmodus (Menüband ausblenden)' },
]

function Optionen({ oberflaeche: o, onOberflaeche: setzen }: Props) {
  return (
    <>
      <h1>Optionen</h1>
      <p className="leise">Gelten für diesen Browser, nicht für den Vault. Die Druckseiten bleiben in jedem Design weiß.</p>
      <h2>Office-Design</h2>
      <div className="designs" role="radiogroup" aria-label="Office-Design">
        {DESIGNS.map((d) => (
          <button key={d.id} role="radio" aria-checked={o.design === d.id} className={`design${o.design === d.id ? ' gewaehlt' : ''}`} onClick={() => setzen({ design: d.id })}>
            <span className="muster" style={{ background: d.muster[0] }}>
              <span style={{ background: d.muster[1] }} />
              <span className="akzent" style={{ background: d.muster[2] }} />
            </span>
            {d.text}
          </button>
        ))}
      </div>
      <h2>Menüband</h2>
      <div className="optionen">
        {ANZEIGEN.map((a) => (
          <label key={a.id}>
            <input type="radio" name="band" checked={o.band === a.id} onChange={() => setzen({ band: a.id })} /> {a.text}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={o.schnellzugriff} onChange={(e) => setzen({ schnellzugriff: e.target.checked })} /> Symbolleiste für den Schnellzugriff anzeigen
        </label>
        <label>
          <input type="checkbox" checked={o.touch} onChange={(e) => setzen({ touch: e.target.checked })} /> Fingereingabemodus (mehr Platz zwischen den Befehlen)
        </label>
      </div>
      <h2>Ansicht</h2>
      <div className="optionen">
        <label>
          <input type="checkbox" checked={o.lineal} onChange={(e) => setzen({ lineal: e.target.checked })} /> Lineal anzeigen
        </label>
      </div>
    </>
  )
}
