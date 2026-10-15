// A4-Vorschau: eigenes iframe, damit Theme-CSS die Oberfläche nicht beeinflusst.
// Paged.js (Polyfill) bricht den Inhalt im iframe in echte Seiten mit Rändern und Seitenzahlen um.
// Drucken/PDF läuft über den Druckdialog des iframes.

import { type Ref, useEffect, useImperativeHandle, useRef } from 'react'
// Paged.js gibt die Polyfill-Datei nicht über "exports" frei, deshalb der direkte Pfad
import pagedUrl from '/node_modules/pagedjs/dist/paged.polyfill.js?url'
import notoSans400 from '@fontsource/noto-sans/400.css?inline'
import notoSans400i from '@fontsource/noto-sans/400-italic.css?inline'
import notoSans700 from '@fontsource/noto-sans/700.css?inline'
import notoSans700i from '@fontsource/noto-sans/700-italic.css?inline'
import notoMono from '@fontsource/noto-sans-mono/400.css?inline'
import katexCss from 'katex/dist/katex.min.css?inline'
import obsidianBasis from '../stil/obsidian-basis.css?inline'
import druckCss from '../stil/druck.css?inline'
import vorschauCss from '../stil/vorschau.css?inline'

export interface VorschauSteuerung {
  drucken(): void
}

interface Props {
  html: string
  /** CSS aus dem Vault (Theme, Snippets, Akzentfarbe) */
  vaultCss: string[]
  titel: string
  umbruchModus: boolean
  onBlockKlick(blockId: string): void
  onFertig?(seiten: number): void
  ref?: Ref<VorschauSteuerung>
}

const SCHRIFTEN = [notoSans400, notoSans400i, notoSans700, notoSans700i, notoMono, katexCss].join('\n')

export function Vorschau({ html, vaultCss, titel, umbruchModus, onBlockKlick, onFertig, ref }: Props) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const scrollPos = useRef(0)
  const klick = useRef(onBlockKlick)
  klick.current = onBlockKlick
  const modus = useRef(umbruchModus)
  modus.current = umbruchModus

  useImperativeHandle(ref, () => ({
    drucken() {
      const fenster = iframe.current?.contentWindow
      if (!fenster) return
      // Chrome nimmt den Titel als Dateinamen für "Als PDF speichern"
      const alt = document.title
      document.title = titel
      fenster.print()
      document.title = alt
    },
  }))

  // Neu aufbauen, wenn sich Inhalt oder Stil ändern
  useEffect(() => {
    const el = iframe.current
    if (!el) return
    scrollPos.current = el.contentWindow?.scrollY ?? 0
    el.srcdoc = seiteBauen(html, vaultCss, titel)
  }, [html, vaultCss, titel])

  // Nachrichten aus dem iframe: Paged.js fertig
  useEffect(() => {
    function empfangen(e: MessageEvent) {
      if (e.source !== iframe.current?.contentWindow || e.data?.druckreif !== 'fertig') return
      const dok = iframe.current!.contentDocument!
      // Bildschirm-Stil erst jetzt einfügen: Paged.js verarbeitet vorhandene Stylesheets und verwirft @media screen
      const stil = dok.createElement('style')
      stil.textContent = vorschauCss
      dok.head.append(stil)
      dok.body.classList.toggle('umbruch-modus', modus.current)
      iframe.current!.contentWindow!.scrollTo(0, scrollPos.current)
      onFertig?.(dok.querySelectorAll('.pagedjs_page').length)
    }
    window.addEventListener('message', empfangen)
    return () => window.removeEventListener('message', empfangen)
  }, [onFertig])

  useEffect(() => {
    iframe.current?.contentDocument?.body?.classList.toggle('umbruch-modus', umbruchModus)
  }, [umbruchModus])

  function geladen() {
    const dok = iframe.current?.contentDocument
    dok?.addEventListener('click', (e) => {
      if (!modus.current) return
      const block = (e.target as Element).closest('[data-block]')
      const id = block?.getAttribute('data-block')
      if (id) klick.current(id)
    })
  }

  return <iframe ref={iframe} className="vorschau" title="Seitenvorschau" onLoad={geladen} />
}

function seiteBauen(html: string, vaultCss: string[], titel: string): string {
  const stil = (css: string) => `<style>${urlsAbsolut(css)}</style>`
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${titel.replace(/</g, '&lt;')}</title>
${stil(SCHRIFTEN)}${stil(obsidianBasis)}${vaultCss.map(stil).join('')}${stil(druckCss)}
<script>window.PagedConfig = { auto: true, after: () => parent.postMessage({ druckreif: 'fertig' }, '*') }</script>
<script src="${pagedUrl}"></script>
</head><body class="theme-light"><div class="markdown-preview-view markdown-rendered">${html}</div></body></html>`
}

/**
 * Paged.js löst url() gegen die Adresse des iframes auf ("about:srcdoc") und scheitert an relativen Pfaden
 * (z. B. Schriften im Entwicklungsmodus). Deshalb vorher gegen die Adresse der App auflösen.
 */
function urlsAbsolut(css: string): string {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (alles, _q, url: string) => {
    if (/^(data|blob|https?):/i.test(url)) return alles
    try {
      return `url("${new URL(url, location.href).href}")`
    } catch {
      return alles
    }
  })
}
