// Einstellungen der Oberfläche wie in Word unter Datei → Optionen: Office-Design, Menüband-Anzeige,
// Schnellzugriff, Lineal, Touchmodus. Gilt für diesen Browser (localStorage), nicht für den Vault.

import { useEffect, useState } from 'react'

/** Office-Design: „system“ folgt dem Hell/Dunkel-Modus von Windows */
export type Design = 'system' | 'weiss' | 'farbig' | 'dunkelgrau' | 'schwarz'
/** Menüband immer anzeigen, nur Registerkarten (Klick klappt kurz auf) oder Vollbildmodus (ganz weg) */
export type BandAnzeige = 'immer' | 'register' | 'vollbild'

export interface Oberflaeche {
  design: Design
  band: BandAnzeige
  schnellzugriff: boolean
  lineal: boolean
  touch: boolean
}

const STANDARD: Oberflaeche = { design: 'system', band: 'immer', schnellzugriff: false, lineal: false, touch: false }
const SCHLUESSEL = 'druckreif:oberflaeche'

function lesen(): Oberflaeche {
  try {
    const wert: unknown = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}')
    return { ...STANDARD, ...(wert && typeof wert === 'object' ? (wert as Partial<Oberflaeche>) : {}) }
  } catch {
    return STANDARD
  }
}

export function useOberflaeche(): [Oberflaeche, (teil: Partial<Oberflaeche>) => void, boolean] {
  const [o, setO] = useState(lesen)
  const dunkel = useDunkel(o.design)
  useEffect(() => {
    try {
      localStorage.setItem(SCHLUESSEL, JSON.stringify(o))
    } catch {
      // private Fenster: dann eben ohne Merken
    }
    const wurzel = document.documentElement
    wurzel.dataset.design = o.design === 'system' ? (dunkel ? 'dunkelgrau' : 'weiss') : o.design
    wurzel.classList.toggle('touch', o.touch)
  }, [o, dunkel])
  return [o, (teil) => setO((alt) => ({ ...alt, ...teil })), dunkel]
}

/** Dunkles Design aktiv? (Die Druckseiten bleiben immer weiß – angezeigt wird, was gedruckt wird.) */
function useDunkel(design: Design): boolean {
  const abfrage = matchMedia('(prefers-color-scheme: dark)')
  const [system, setSystem] = useState(abfrage.matches)
  useEffect(() => {
    const neu = (e: MediaQueryListEvent) => setSystem(e.matches)
    abfrage.addEventListener('change', neu)
    return () => abfrage.removeEventListener('change', neu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return design === 'dunkelgrau' || design === 'schwarz' || (design === 'system' && system)
}
