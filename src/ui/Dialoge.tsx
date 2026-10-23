// Kleine Dialogfelder wie in Word: „Wörter zählen“ und die Tastenkombinationen.

import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Statistik } from '../vorschau/Vorschau'

function Dialog({ titel, children, onSchliessen }: { titel: string; children: ReactNode; onSchliessen(): void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return
      e.preventDefault()
      e.stopPropagation()
      onSchliessen()
    }
    // vor dem Tastenkürzel-Handler der App, damit Esc nicht zusätzlich die Auswahl aufhebt
    window.addEventListener('keydown', esc, true)
    return () => window.removeEventListener('keydown', esc, true)
  }, [onSchliessen])
  return (
    <div className="dialog-hintergrund" onPointerDown={(e) => e.target === e.currentTarget && onSchliessen()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={titel}>
        <header>
          <span>{titel}</span>
          <button className="schliessen" onClick={onSchliessen} aria-label="Schließen">
            <X size={14} />
          </button>
        </header>
        <div className="dialog-inhalt">{children}</div>
        <footer>
          <button className="primaer" onClick={onSchliessen} autoFocus>
            Schließen
          </button>
        </footer>
      </div>
    </div>
  )
}

const zahl = (n: number) => n.toLocaleString('de-DE')

export function Wortanzahl({ statistik, seiten, notizen, onSchliessen }: { statistik: Statistik | null; seiten: number; notizen: number; onSchliessen(): void }) {
  return (
    <Dialog titel="Wörter zählen" onSchliessen={onSchliessen}>
      {statistik ? (
        <table className="statistik">
          <tbody>
            <tr><th>Seiten</th><td>{zahl(seiten)}</td></tr>
            <tr><th>Notizen</th><td>{zahl(notizen)}</td></tr>
            <tr><th>Wörter</th><td>{zahl(statistik.woerter)}</td></tr>
            <tr><th>Zeichen (ohne Leerzeichen)</th><td>{zahl(statistik.zeichenOhneLeerzeichen)}</td></tr>
            <tr><th>Zeichen (mit Leerzeichen)</th><td>{zahl(statistik.zeichen)}</td></tr>
            <tr><th>Absätze</th><td>{zahl(statistik.absaetze)}</td></tr>
            <tr><th>Zeilen (ungefähr)</th><td>{zahl(statistik.zeilen)}</td></tr>
          </tbody>
        </table>
      ) : (
        <p>Noch keine Seiten.</p>
      )}
      <p className="leise">Gezählt wird, was gedruckt wird: ohne ausgeblendete Abschnitte, Seitenzahlen und Fußzeilen.</p>
    </Dialog>
  )
}

const KUERZEL: [string, [string, string][]][] = [
  ['Allgemein', [
    ['Strg+P', 'Drucken / als PDF speichern'],
    ['Strg+Z', 'Rückgängig'],
    ['Strg+Y', 'Wiederholen'],
    ['F5', 'Vault neu einlesen'],
    ['Alt+Q', 'Befehl, Notiz oder Text suchen'],
    ['Strg+F', 'Im Dokument suchen'],
    ['F3 / Umschalt+F3', 'Nächster / vorheriger Treffer'],
  ]],
  ['Gewählter Block', [
    ['Strg+Enter', 'Seitenumbruch davor'],
    ['Entf', 'Im Druck ausblenden'],
    ['Esc', 'Auswahl aufheben'],
    ['Rechtsklick', 'Minisymbolleiste und Kontextmenü'],
  ]],
  ['Menüband', [
    ['Alt', 'Zugriffstasten anzeigen (danach Buchstaben tippen)'],
    ['Strg+F1', 'Menüband reduzieren / anzeigen'],
    ['Doppelklick auf Registerkarte', 'Menüband reduzieren / anzeigen'],
  ]],
  ['Ansicht', [
    ['Strg+Mausrad', 'Zoom'],
    ['Strg+0', 'Zoom 100 %'],
  ]],
]

export function Tastenkombinationen({ onSchliessen }: { onSchliessen(): void }) {
  return (
    <Dialog titel="Tastenkombinationen" onSchliessen={onSchliessen}>
      <div className="kuerzel">
        {KUERZEL.map(([gruppe, liste]) => (
          <section key={gruppe}>
            <h3>{gruppe}</h3>
            <dl>
              {liste.map(([taste, text]) => (
                <div key={taste}>
                  <dt><kbd>{taste}</kbd></dt>
                  <dd>{text}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
