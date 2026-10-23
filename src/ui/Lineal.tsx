// Waagerechtes Lineal über den Seiten wie in Word: Seitenränder grau, Textbreite weiß, Zentimeter ab dem linken Rand.
// Nur Anzeige – Ränder kommen aus dem CSS (@page), nicht aus dem Lineal.

import { useEffect, useRef, useState } from 'react'
import type { LinealMass } from '../vorschau/Vorschau'

interface Props {
  messen(): LinealMass | null
  fenster(): Window | null
  /** ändert sich bei jedem neuen Umbruch und Zoom */
  stand: string
}

export function Lineal({ messen, fenster, stand }: Props) {
  const [mass, setMass] = useState<LinealMass | null>(null)
  const leiste = useRef<HTMLDivElement>(null)
  const aktuell = useRef(messen)
  aktuell.current = messen

  useEffect(() => {
    let bild = 0
    const neu = () => {
      cancelAnimationFrame(bild)
      bild = requestAnimationFrame(() => setMass(aktuell.current()))
    }
    neu()
    const f = fenster()
    // Scrollen: andere Seite in der Mitte (Ränder können sich unterscheiden) oder waagerecht verschoben
    f?.addEventListener('scroll', neu)
    const beobachter = new ResizeObserver(neu)
    if (leiste.current) beobachter.observe(leiste.current)
    return () => {
      cancelAnimationFrame(bild)
      f?.removeEventListener('scroll', neu)
      beobachter.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stand])

  const striche: { x: number; art: 'zahl' | 'halb' | 'mm'; zahl?: number }[] = []
  if (mass) {
    const pxProMm = mass.seiteBreite / mass.breiteMm
    const nullpunkt = mass.textLinks
    // in beide Richtungen ab dem linken Textrand, wie Word (links davon negativ)
    const vonMm = Math.ceil((mass.seiteLinks - nullpunkt) / pxProMm)
    const bisMm = Math.floor((mass.seiteLinks + mass.seiteBreite - nullpunkt) / pxProMm)
    const millimeter = pxProMm >= 6 // Millimeterstriche erst bei großem Zoom, sonst nur halbe Zentimeter
    for (let mm = vonMm; mm <= bisMm; mm++) {
      const x = nullpunkt + mm * pxProMm
      if (mm % 10 === 0) striche.push({ x, art: mm === 0 ? 'halb' : 'zahl', zahl: Math.abs(mm / 10) })
      else if (mm % 5 === 0) striche.push({ x, art: 'halb' })
      else if (millimeter) striche.push({ x, art: 'mm' })
    }
  }

  return (
    <div className="lineal" ref={leiste} aria-hidden="true">
      {mass && (
        <>
          <div className="lineal-seite" style={{ left: mass.seiteLinks, width: mass.seiteBreite }} />
          <div
            className="lineal-text"
            style={{ left: mass.textLinks, width: mass.textBreite }}
            title={`Textbreite ${Math.round((mass.textBreite / mass.seiteBreite) * mass.breiteMm)} mm`}
          />
          {striche.map((s, i) =>
            s.art === 'zahl' ? (
              <span key={i} className="lineal-zahl" style={{ left: s.x }}>
                {s.zahl}
              </span>
            ) : (
              <span key={i} className={`lineal-strich ${s.art}`} style={{ left: s.x }} />
            ),
          )}
        </>
      )}
    </div>
  )
}
