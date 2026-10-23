// Titelleiste wie im modernen Word: AutoSave-Anzeige, Schnellzugriff (optional), Dokumentname mit Menü,
// Suchfeld in der Mitte (Alt+Q), rechts der Vault wie das Konto.

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronDown, CircleCheck, FolderOpen, Loader, Printer, Redo2, Undo2 } from 'lucide-react'
import { quickinfo } from './QuickInfo'

interface Props {
  titel: string
  /** Mappe umbenennen (null: keine Mappe offen) */
  onUmbenennen: ((name: string) => void) | null
  vaultName: string
  speichert: boolean
  schnellzugriff: boolean
  kannZurueck: boolean
  kannVor: boolean
  zurueck(): void
  vor(): void
  drucken(): void
  onDatei(): void
  suche: ReactNode
}

export function Titelleiste(p: Props) {
  const [menue, setMenue] = useState(false)
  return (
    <header className="titelleiste">
      <span className="app-symbol" aria-hidden="true">D</span>
      <span
        className="autosave"
        {...quickinfo('Automatisch speichern', 'Jede Layout-Änderung wird sofort in .lernzettel/ im Vault gespeichert. Die Notizen selbst werden nie verändert.')}
      >
        Automatisch speichern <span className="schalter an" aria-label="Ein" />
      </span>
      {p.schnellzugriff && (
        <div className="schnellzugriff">
          <button onClick={p.zurueck} disabled={!p.kannZurueck} aria-label="Rückgängig" {...quickinfo('Rückgängig', 'Rückgängig (Strg+Z)')}>
            <Undo2 size={15} />
          </button>
          <button onClick={p.vor} disabled={!p.kannVor} aria-label="Wiederholen" {...quickinfo('Wiederholen', 'Wiederholen (Strg+Y)')}>
            <Redo2 size={15} />
          </button>
          <button onClick={p.drucken} aria-label="Drucken" {...quickinfo('Drucken', 'Drucken oder als PDF speichern (Strg+P)')}>
            <Printer size={15} />
          </button>
        </div>
      )}
      <div className="dokumentname">
        <button className={menue ? 'offen' : ''} onClick={() => setMenue(!menue)} aria-expanded={menue}>
          <span className="name">{p.titel}</span>
          <span className="stand">
            {p.speichert ? <Loader size={12} className="dreht" /> : <CircleCheck size={12} />}
            {p.speichert ? 'Speichert …' : 'Gespeichert'}
          </span>
          <ChevronDown size={13} />
        </button>
        {menue && <NamensMenue {...p} onSchliessen={() => setMenue(false)} />}
      </div>
      <div className="titel-mitte">{p.suche}</div>
      <button className="konto" onClick={p.onDatei} {...quickinfo(p.vaultName, 'Geöffneter Vault – Klick öffnet „Datei“ (anderen Vault öffnen, Mappen, Optionen)')}>
        <span className="vault-name">{p.vaultName}</span>
        <span className="initiale" aria-hidden="true">{p.vaultName.slice(0, 1).toUpperCase()}</span>
      </button>
    </header>
  )
}

/** Wie das Menü am Dateinamen in Word: umbenennen, Speicherort. */
function NamensMenue(p: Props & { onSchliessen(): void }) {
  const [name, setName] = useState(p.titel)
  const kasten = useRef<HTMLDivElement>(null)
  const schliessen = useRef(p.onSchliessen)
  schliessen.current = p.onSchliessen
  useEffect(() => {
    const zu = (e: PointerEvent) => !kasten.current?.contains(e.target as Node) && schliessen.current()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && schliessen.current()
    // erst nach dem öffnenden Klick lauschen
    const t = setTimeout(() => window.addEventListener('pointerdown', zu))
    window.addEventListener('keydown', esc)
    return () => {
      clearTimeout(t)
      window.removeEventListener('pointerdown', zu)
      window.removeEventListener('keydown', esc)
    }
  }, [])
  const fertig = () => {
    const neu = name.trim()
    if (neu && neu !== p.titel) p.onUmbenennen?.(neu)
    p.onSchliessen()
  }
  return (
    <div className="namensmenue" ref={kasten}>
      <label>
        Dateiname
        <input
          value={name}
          disabled={!p.onUmbenennen}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') fertig()
            e.stopPropagation()
          }}
        />
      </label>
      <dl>
        <dt>Ort</dt>
        <dd>
          <FolderOpen size={13} /> {p.vaultName} › .lernzettel
        </dd>
      </dl>
      <p className="leise">Mappe und Layouts werden automatisch gespeichert. Die Notizen bleiben unverändert.</p>
      <div className="knoepfe">
        <button
          onClick={() => {
            p.onSchliessen()
            p.onDatei()
          }}
        >
          Alle Mappen …
        </button>
        <button className="primaer" disabled={!p.onUmbenennen} onClick={fertig}>
          Umbenennen
        </button>
      </div>
    </div>
  )
}
