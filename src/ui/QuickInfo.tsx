// QuickInfos wie in Word („Super-Tooltips“): fetter Befehlsname, Erklärung und Tastenkürzel.
// Ein einziges Element für die ganze App; Knöpfe tragen ihre Angaben als data-Attribute (quickinfo()).

import { useEffect, useState } from 'react'

const TASTE = /\s*\(((?:Strg|Alt|Umschalt|F\d+|Entf|Esc)[^)]*)\)\s*$/

/**
 * Attribute für einen Knopf. Ein Tastenkürzel am Ende des Tipps („… (Strg+Z)“) steht in der QuickInfo in einer eigenen Zeile.
 * Ist der Tipp nur der Name, zeigt die QuickInfo nur den Namen.
 */
export function quickinfo(name: string, tipp?: string): Record<string, string> {
  const taste = tipp?.match(TASTE)?.[1]
  const text = tipp?.replace(TASTE, '').trim()
  const attr: Record<string, string> = { 'data-quickinfo-titel': taste ? `${name} (${taste})` : name }
  if (text && text !== name) attr['data-quickinfo'] = text
  return attr
}

interface Anzeige {
  titel: string
  text: string | null
  x: number
  y: number
}

export function QuickInfo() {
  const [anzeige, setAnzeige] = useState<Anzeige | null>(null)
  useEffect(() => {
    let timer = 0
    let ziel: HTMLElement | null = null
    const weg = () => {
      clearTimeout(timer)
      ziel = null
      setAnzeige(null)
    }
    const ueber = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-quickinfo-titel]') ?? null
      if (el === ziel) return
      weg()
      if (!el) return
      ziel = el
      timer = window.setTimeout(() => {
        if (!ziel?.isConnected) return
        const r = ziel.getBoundingClientRect()
        setAnzeige({
          titel: ziel.dataset.quickinfoTitel!,
          text: ziel.dataset.quickinfo ?? null,
          x: Math.max(8, Math.min(r.left, innerWidth - 300)),
          y: r.bottom + 6,
        })
      }, 550)
    }
    document.addEventListener('pointerover', ueber)
    document.addEventListener('pointerdown', weg, true)
    document.addEventListener('keydown', weg, true)
    window.addEventListener('blur', weg)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', ueber)
      document.removeEventListener('pointerdown', weg, true)
      document.removeEventListener('keydown', weg, true)
      window.removeEventListener('blur', weg)
    }
  }, [])
  if (!anzeige) return null
  // Unten am Fenster (Statusleiste): über dem Element statt darunter
  const unten = anzeige.y > innerHeight - 90
  return (
    <div className="quickinfo" role="tooltip" style={unten ? { left: anzeige.x, bottom: 34 } : { left: anzeige.x, top: anzeige.y }}>
      <strong>{anzeige.titel}</strong>
      {anzeige.text && <p>{anzeige.text}</p>}
    </div>
  )
}
