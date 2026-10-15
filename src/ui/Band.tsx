// Bausteine des Menübands (wie in Word): Gruppen mit großen und kleinen Knöpfen, Zahlenfelder mit Pfeilen.

import { type ReactNode, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="band-gruppe">
      <div className="band-inhalt">{children}</div>
      <div className="band-titel">{titel}</div>
    </div>
  )
}

interface KnopfProps {
  symbol: LucideIcon
  text: string
  onClick(): void
  aktiv?: boolean
  gesperrt?: boolean
  tipp?: string
}

export function GrosserKnopf({ symbol: Symbol, text, onClick, aktiv, gesperrt, tipp }: KnopfProps) {
  return (
    <button className={`band-gross${aktiv ? ' an' : ''}`} onClick={onClick} disabled={gesperrt} title={tipp ?? text}>
      <Symbol size={26} strokeWidth={1.4} />
      <span>{text}</span>
    </button>
  )
}

export function KleinerKnopf({ symbol: Symbol, text, onClick, aktiv, gesperrt, tipp }: KnopfProps) {
  return (
    <button className={`band-klein${aktiv ? ' an' : ''}`} onClick={onClick} disabled={gesperrt} title={tipp ?? text}>
      <Symbol size={16} strokeWidth={1.6} />
      <span>{text}</span>
    </button>
  )
}

/** Nur Symbol, z. B. für Ausrichtung links/mittig/rechts */
export function SymbolKnopf({ symbol: Symbol, text, onClick, aktiv, gesperrt }: KnopfProps) {
  return (
    <button className={`band-symbol${aktiv ? ' an' : ''}`} onClick={onClick} disabled={gesperrt} title={text} aria-label={text}>
      <Symbol size={16} strokeWidth={1.6} />
    </button>
  )
}

interface ZahlProps {
  beschriftung: string
  wert: number | undefined
  /** angezeigt, wenn kein eigener Wert gesetzt ist */
  platzhalter?: string
  einheit: string
  schritt: number
  min: number
  max: number
  gesperrt?: boolean
  onWert(wert: number | undefined): void
}

/** Zahlenfeld wie in Word: Pfeile ändern sofort, getippte Werte gelten bei Enter oder beim Verlassen. Leer = automatisch. */
export function Zahlfeld({ beschriftung, wert, platzhalter, einheit, schritt, min, max, gesperrt, onWert }: ZahlProps) {
  const [text, setText] = useState(format(wert))
  useEffect(() => setText(format(wert)), [wert])

  const begrenzen = (z: number) => Math.round(Math.min(max, Math.max(min, z)) * 10) / 10
  function uebernehmen() {
    const t = text.trim().replace(',', '.')
    const z = Number(t)
    if (t === '') onWert(undefined)
    else if (Number.isFinite(z)) onWert(begrenzen(z))
    else setText(format(wert))
  }
  const basis = wert ?? Number(platzhalter?.replace(',', '.')) ?? 0

  return (
    <label className="band-zahl">
      <span className="beschriftung">{beschriftung}</span>
      <span className="feld">
        <input
          value={text}
          placeholder={platzhalter}
          disabled={gesperrt}
          onChange={(e) => setText(e.target.value)}
          onBlur={uebernehmen}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="einheit">{einheit}</span>
        <span className="pfeile">
          <button disabled={gesperrt} onClick={() => onWert(begrenzen((Number.isFinite(basis) ? basis : 0) + schritt))} tabIndex={-1} aria-label="mehr">
            <ChevronUp size={10} />
          </button>
          <button disabled={gesperrt} onClick={() => onWert(begrenzen((Number.isFinite(basis) ? basis : 0) - schritt))} tabIndex={-1} aria-label="weniger">
            <ChevronDown size={10} />
          </button>
        </span>
      </span>
    </label>
  )
}

function format(z: number | undefined): string {
  return z === undefined ? '' : String(z).replace('.', ',')
}
