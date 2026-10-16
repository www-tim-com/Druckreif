// Seitenminiaturen im Navigationsbereich (wie „Seiten“ in Word): verkleinerte Momentaufnahme der umbrochenen Seiten.
// Klick springt zur Seite; die aktuelle Seite ist blau umrandet, halb leere Seiten tragen ein Warnzeichen.

import { useEffect, useRef, useState } from 'react'

interface Props {
  /** zählt fertige Umbrüche – dann neue Momentaufnahme */
  fassung: number
  miniaturHtml(): string | null
  seite: number
  leerraumSeiten: number[]
  onSeite(nummer: number): void
}

const STIL = `<style>
  html, body { background: #fff !important; margin: 0; overflow-x: hidden; }
  .pagedjs_pages { zoom: 0.24; gap: 70px !important; padding: 40px 0 120px !important; }
  .pagedjs_page { cursor: pointer; outline: 3px solid #d6d6d6; }
  .pagedjs_page:hover { outline: 8px solid #a9bfe2; }
  .pagedjs_page.aktuell { outline: 12px solid #2b579a; }
  .pagedjs_page::after {
    content: attr(data-page-number);
    position: absolute; left: 0; right: 0; bottom: -62px;
    text-align: center; font: 44px 'Segoe UI', system-ui, sans-serif; color: #605e5c;
  }
  .pagedjs_page.leer::after { content: '⚠ ' attr(data-page-number); color: #c19c00; }
  .druckreif-leerraum button, .druckreif-leerraum span { display: none; }
  span.einbettung::after { display: none; }
</style>`

export function Seitenminiaturen({ fassung, miniaturHtml, seite, leerraumSeiten, onSeite }: Props) {
  const rahmen = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState<string | null>(null)
  const aufSeite = useRef(onSeite)
  aufSeite.current = onSeite

  useEffect(() => {
    const neu = miniaturHtml()
    setHtml(neu ? neu.replace('</head>', `${STIL}</head>`) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fassung])

  // Aktuelle Seite und Warnzeichen nach jedem Laden und bei jedem Seitenwechsel markieren
  function markieren() {
    const dok = rahmen.current?.contentDocument
    if (!dok) return
    dok.querySelectorAll<HTMLElement>('.pagedjs_page').forEach((el, i) => {
      el.classList.toggle('aktuell', i + 1 === seite)
      el.classList.toggle('leer', leerraumSeiten.includes(i + 1))
      if (i + 1 === seite) el.scrollIntoView({ block: 'nearest' })
    })
  }
  useEffect(markieren)

  function geladen() {
    const dok = rahmen.current?.contentDocument
    if (!dok) return
    dok.addEventListener('click', (e) => {
      e.preventDefault()
      const nummer = (e.target as Element).closest<HTMLElement>('.pagedjs_page')?.dataset.pageNumber
      if (nummer) aufSeite.current(Number(nummer))
    })
    markieren()
  }

  if (!html) return <p className="mappe-leer">Noch keine Seiten.</p>
  return <iframe ref={rahmen} className="miniaturen" title="Seitenminiaturen" srcDoc={html} onLoad={geladen} />
}
