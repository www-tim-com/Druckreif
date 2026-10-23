// Zugriffstasten (KeyTips) wie in Word: Alt drücken und loslassen zeigt Buchstaben über den Registerkarten,
// danach über allen Befehlen der gewählten Karte. Esc geht eine Stufe zurück. So ist jeder Befehl ohne Maus erreichbar.
// Feste Tasten tragen Elemente als data-keytip, die Befehle im Band bekommen ihre Tasten automatisch.

import { type Ref, useCallback, useImperativeHandle, useRef, useState } from 'react'

export interface ZugriffstastenSteuerung {
  /** Tastendruck (keydown und keyup, auch aus den Seiten) – true: verbraucht */
  taste(e: KeyboardEvent): boolean
}

interface Marke {
  taste: string
  el: HTMLElement
  x: number
  y: number
}

interface Props {
  ref: Ref<ZugriffstastenSteuerung>
  /** Vollbildmodus: Titelleiste und Menüband einblenden, solange die Tasten angezeigt werden */
  onStart(): void
}

export function Zugriffstasten({ ref, onStart }: Props) {
  const [marken, setMarken] = useState<Marke[] | null>(null)
  const [eingabe, setEingabe] = useState('')
  const stufe = useRef<'aus' | 'reiter' | 'band'>('aus')
  const altAllein = useRef(false)
  const zustand = useRef({ marken, eingabe })
  zustand.current = { marken, eingabe }

  // gleichbleibend, damit removeEventListener dieselbe Funktion findet
  const ende = useCallback(() => {
    stufe.current = 'aus'
    setMarken(null)
    setEingabe('')
    window.removeEventListener('pointerdown', ende, true)
    window.removeEventListener('blur', ende)
  }, [])

  function zeigen(neu: 'reiter' | 'band') {
    stufe.current = neu
    setEingabe('')
    setMarken(neu === 'reiter' ? festeMarken() : bandMarken())
  }

  function aktivieren(el: HTMLElement) {
    const reiter = el.closest('.reiter') && el.getAttribute('role') === 'tab'
    if (el instanceof HTMLInputElement) {
      ende()
      el.focus()
      el.select()
    } else if (reiter) {
      el.click()
      // erst nach dem Neuzeichnen stehen die Befehle der Karte im Band
      requestAnimationFrame(() => stufe.current !== 'aus' && zeigen('band'))
      stufe.current = 'band'
      setMarken([])
    } else {
      ende()
      el.click()
    }
  }

  useImperativeHandle(ref, () => ({
    taste(e) {
      if (e.key === 'Alt') {
        if (e.type === 'keydown') altAllein.current = !e.repeat && !e.ctrlKey && !e.shiftKey && !e.metaKey
        else if (altAllein.current) {
          altAllein.current = false
          if (stufe.current === 'aus') {
            onStart()
            window.addEventListener('pointerdown', ende, true)
            window.addEventListener('blur', ende)
            // nach dem Einblenden des Kopfs (Vollbildmodus) messen
            requestAnimationFrame(() => zeigen('reiter'))
            stufe.current = 'reiter'
          } else ende()
          e.preventDefault()
          return true
        }
        return false
      }
      if (e.type !== 'keydown') return false
      altAllein.current = false
      if (stufe.current === 'aus') return false
      e.preventDefault()
      if (e.key === 'Escape') {
        if (stufe.current === 'band') zeigen('reiter')
        else ende()
        return true
      }
      const zeichen = e.key.length === 1 ? e.key.toUpperCase() : ''
      if (!zeichen) return true
      const { marken, eingabe } = zustand.current
      const neu = eingabe + zeichen
      const treffer = marken?.find((m) => m.taste === neu)
      if (treffer) aktivieren(treffer.el)
      else if (marken?.some((m) => m.taste.startsWith(neu))) setEingabe(neu)
      return true
    },
  }))

  if (!marken) return null
  return (
    <div className="zugriffstasten" aria-hidden="true">
      {marken
        .filter((m) => m.taste.startsWith(eingabe))
        .map((m, i) => (
          <span key={i} style={{ left: m.x, top: m.y }}>
            {m.taste}
          </span>
        ))}
    </div>
  )
}

function marke(el: HTMLElement, taste: string): Marke {
  const r = el.getBoundingClientRect()
  return { taste, el, x: r.left + r.width / 2, y: r.bottom - 6 }
}

function sichtbar(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

/** Registerkarten, Suchfeld und die Knöpfe rechts: feste Tasten */
function festeMarken(): Marke[] {
  return [...document.querySelectorAll<HTMLElement>('[data-keytip]')]
    .filter(sichtbar)
    .map((el) => marke(el, el.dataset.keytip!))
}

/** Befehle des Bands: Anfangsbuchstabe, wenn er eindeutig ist, sonst zwei Buchstaben (nie Anfang einer anderen Taste) */
function bandMarken(): Marke[] {
  const elemente = [...document.querySelectorAll<HTMLElement>('.band button:not(:disabled), .band input:not(:disabled)')].filter(
    (el) => sichtbar(el) && !el.closest('.pfeile'),
  )
  const namen = elemente.map((el) => buchstaben(name(el)))
  const nachAnfang = new Map<string, number[]>()
  namen.forEach((n, i) => nachAnfang.set(n[0] ?? '', [...(nachAnfang.get(n[0] ?? '') ?? []), i]))
  const tasten: string[] = []
  const vergeben = new Set<string>()
  for (const [anfang, liste] of nachAnfang) {
    if (anfang && liste.length === 1) {
      tasten[liste[0]] = anfang
      continue
    }
    const erster = anfang || 'X'
    for (const i of liste) {
      const kandidaten = [...namen[i].slice(1), ...'123456789']
      const zweiter = kandidaten.find((z) => !vergeben.has(erster + z)) ?? String(i)
      tasten[i] = erster + zweiter
      vergeben.add(tasten[i])
    }
  }
  return elemente.map((el, i) => marke(el, tasten[i]))
}

function name(el: HTMLElement): string {
  if (el instanceof HTMLInputElement) return el.closest('label')?.querySelector('.beschriftung')?.textContent ?? 'Z'
  return el.getAttribute('aria-label') ?? el.textContent ?? el.dataset.quickinfoTitel ?? ''
}

/** Nur Buchstaben, groß, ohne Doppelte */
function buchstaben(text: string): string[] {
  return [...new Set(text.toUpperCase().replace(/[^A-ZÄÖÜ]/g, ''))]
}
