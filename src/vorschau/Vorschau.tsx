// A4-Ansicht wie in Word: Seiten auf grauer Fläche, Zoom, Auswahl, Bilder ziehen.
// Jede Fassung wird in einem eigenen iframe umbrochen (Theme-CSS bleibt von der Oberfläche getrennt).
// Zwei iframes wechseln sich ab: die neue Fassung wird unsichtbar umbrochen und erst dann eingeblendet,
// damit die Ansicht bei Änderungen nicht flackert.

import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react'
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
import { auswahlZeigen, einrichten, type Rueckrufe } from './interaktion'
import { type Leerraum, leerraumFinden } from './leerraum'
import { type Treffer, suchen, trefferZeigen } from './suche'

export interface VorschauSteuerung {
  drucken(): void
  zuBlock(id: string): void
  /** tatsächliche Breite eines Bildes in mm (für die Pfeile im Menüband) */
  bildBreiteMm(id: string): number | null
  zuSeite(nummer: number): void
  /** Momentaufnahme der umbrochenen Seiten als HTML (für die Seitenminiaturen) */
  miniaturHtml(): string | null
  /** Unsichtbar umbrechen und die Seiten zählen; `anpassen` ändert vorher eine Kopie des Inhalts (automatisch formatieren) */
  seitenMessen(anpassen: (inhalt: DocumentFragment) => void): Promise<number>
}

export interface Fertig {
  seiten: number
  leerraum: Leerraum[]
}

interface Props {
  html: string
  /** CSS aus dem Vault (Theme, Snippets, Akzentfarbe) */
  vaultCss: string[]
  titel: string
  zoom: number // 1 = 100 %
  auswahl: string | null
  /** Seitenumbrüche und Ausgeblendetes sichtbar machen (wie ¶ in Word) */
  zeichen: boolean
  /** Dokument wird gerade neu aufgebaut (Ladebalken) */
  baut: boolean
  /** Callouts und Tabellenköpfe ohne farbige Flächen (druck.css) */
  tinteSparen: boolean
  /** Suchbegriff (Strg+F) und gewählter Treffer */
  suche: string
  trefferAktiv: number
  onTreffer(treffer: Treffer[]): void
  rueckrufe: Rueckrufe
  onFertig(fertig: Fertig): void
  ref?: Ref<VorschauSteuerung>
}

// Leere Seite in der Farbe der Arbeitsfläche, solange noch nichts umbrochen ist
const LEER = '<!doctype html><body style="margin:0;background:#e6e6e6"></body>'

const SCHRIFTEN = [notoSans400, notoSans400i, notoSans700, notoSans700i, notoMono, katexCss].join('\n')

export function Vorschau(p: Props) {
  const { html, vaultCss, titel, zoom, auswahl, zeichen, baut, tinteSparen, suche, trefferAktiv, ref } = p
  const flaeche = useRef<HTMLDivElement>(null)
  const rahmen = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)]
  const [aktiv, setAktiv] = useState(0)
  const [umbricht, setUmbricht] = useState(false)
  const aktivRef = useRef(0)
  // Nummer der Fassung, die jedes iframe gerade umbricht: eine späte „fertig“-Meldung einer älteren Fassung zählt nicht
  const fassung = useRef(0)
  const erwartet = useRef([0, 0])
  const aktuell = useRef(p)
  aktuell.current = p

  const aktivesFenster = () => rahmen[aktivRef.current].current

  useImperativeHandle(ref, () => ({
    drucken() {
      const fenster = aktivesFenster()?.contentWindow
      if (!fenster) return
      auswahlZeigen(fenster.document, null) // Auswahlrahmen nicht mitdrucken
      // Chrome nimmt den Titel als Dateinamen für "Als PDF speichern"
      const alt = document.title
      document.title = titel
      fenster.print()
      document.title = alt
      auswahlZeigen(fenster.document, aktuell.current.auswahl)
    },
    bildBreiteMm(id) {
      const img = aktivesFenster()?.contentDocument?.querySelector<HTMLImageElement>(`[data-block="${id}"] img`)
      return img ? Math.round((img.offsetWidth * 25.4) / 96) : null
    },
    zuBlock(id) {
      const el = aktivesFenster()?.contentDocument?.querySelector(`[data-block="${id}"]`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    },
    zuSeite(nummer) {
      const seite = aktivesFenster()?.contentDocument?.querySelectorAll('.pagedjs_page')[nummer - 1]
      seite?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    },
    miniaturHtml() {
      const dok = aktivesFenster()?.contentDocument
      if (!dok?.querySelector('.pagedjs_pages')) return null
      const kopie = dok.documentElement.cloneNode(true) as HTMLElement
      // Ohne Skripte (Paged.js würde sonst noch einmal umbrechen), ohne Auswahl und Griffe
      for (const el of kopie.querySelectorAll('script, .druckreif-rahmen, .druckreif-ueberlagerung')) el.remove()
      for (const el of kopie.querySelectorAll('.druckreif-auswahl')) el.classList.remove('druckreif-auswahl')
      kopie.querySelector<HTMLElement>('.pagedjs_pages')?.style.removeProperty('zoom')
      return '<!doctype html>' + kopie.outerHTML
    },
    seitenMessen(anpassen) {
      return new Promise((fertig, fehler) => {
        const messung = document.createElement('iframe')
        messung.className = 'messung'
        messung.setAttribute('aria-hidden', 'true')
        const ende = (ergebnis: () => void) => {
          window.removeEventListener('message', empfangen)
          clearTimeout(zeit)
          messung.remove()
          ergebnis()
        }
        const empfangen = (e: MessageEvent) => {
          if (e.data?.druckreif !== 'fertig' || e.source !== messung.contentWindow) return
          const seiten = messung.contentDocument?.querySelectorAll('.pagedjs_page').length ?? 0
          ende(() => fertig(seiten))
        }
        const zeit = setTimeout(() => ende(() => fehler(new Error('Messen dauert zu lange'))), 60_000)
        window.addEventListener('message', empfangen)
        const a = aktuell.current
        const kopie = document.createElement('template')
        kopie.innerHTML = a.html
        anpassen(kopie.content)
        messung.srcdoc = seiteBauen(kopie.innerHTML, a.vaultCss, a.titel, -1, a.tinteSparen)
        flaeche.current!.append(messung)
      })
    },
  }))

  // Neue Fassung immer im unsichtbaren iframe umbrechen – auch beim ersten Mal, sonst sieht man kurz
  // den rohen, seitenbreiten Text, bevor Paged.js die Seiten gebaut hat
  useEffect(() => {
    setUmbricht(true)
    const ziel = 1 - aktivRef.current
    erwartet.current[ziel] = ++fassung.current
    rahmen[ziel].current!.srcdoc = seiteBauen(html, vaultCss, titel, fassung.current, tinteSparen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, vaultCss, titel, tinteSparen])

  useEffect(() => {
    function empfangen(e: MessageEvent) {
      if (e.data?.druckreif !== 'fertig') return
      const nr = rahmen.findIndex((r) => r.current?.contentWindow === e.source)
      if (nr < 0 || e.data.fassung !== erwartet.current[nr]) return
      const neu = rahmen[nr].current!
      const dok = neu.contentDocument!
      // Bildschirm-Stil erst jetzt einfügen: Paged.js verarbeitet vorhandene Stylesheets und verwirft @media screen
      const stil = dok.createElement('style')
      stil.textContent = vorschauCss
      dok.head.append(stil)
      einrichten(neu, () => aktuell.current.rueckrufe)
      ansichtAnwenden(dok, aktuell.current)
      const leerraum = leerraumFinden(dok)
      aktuell.current.onTreffer(suchen(dok, aktuell.current.suche))
      trefferZeigen(dok, aktuell.current.trefferAktiv, false)
      // Lesestelle vom bisherigen iframe übernehmen, dann umschalten
      const alt = rahmen[aktivRef.current].current
      if (alt && alt !== neu) neu.contentWindow!.scrollTo(0, alt.contentWindow?.scrollY ?? 0)
      aktivRef.current = nr
      setAktiv(nr)
      setUmbricht(false)
      aktuell.current.onFertig({ seiten: dok.querySelectorAll('.pagedjs_page').length, leerraum })
    }
    window.addEventListener('message', empfangen)
    return () => window.removeEventListener('message', empfangen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auswahl, Zoom und Formatierungszeichen ohne neuen Umbruch anwenden
  useEffect(() => {
    const dok = aktivesFenster()?.contentDocument
    if (dok?.querySelector('.pagedjs_pages')) ansichtAnwenden(dok, { auswahl, zeichen, zoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auswahl, zeichen, zoom, aktiv])

  // Suchen ohne neuen Umbruch; neuer Begriff = Treffer neu sammeln, neuer aktiver Treffer = hinscrollen
  useEffect(() => {
    const dok = aktivesFenster()?.contentDocument
    if (!dok?.querySelector('.pagedjs_pages')) return
    aktuell.current.onTreffer(suchen(dok, suche))
    trefferZeigen(dok, aktuell.current.trefferAktiv, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suche])
  useEffect(() => {
    const dok = aktivesFenster()?.contentDocument
    if (dok?.querySelector('.pagedjs_pages')) trefferZeigen(dok, trefferAktiv, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trefferAktiv])

  return (
    <div className="vorschau" ref={flaeche}>
      {(baut || umbricht) && <div className="ladebalken" role="progressbar" aria-label="Seiten werden aufgebaut" />}
      {rahmen.map((r, i) => (
        <iframe key={i} ref={r} title="Seitenansicht" className={i === aktiv ? 'aktiv' : 'wartet'} srcDoc={LEER} />
      ))}
    </div>
  )
}

function ansichtAnwenden(dok: Document, a: { auswahl: string | null; zeichen: boolean; zoom: number }) {
  const seiten = dok.querySelector<HTMLElement>('.pagedjs_pages')
  if (seiten) seiten.style.zoom = String(a.zoom)
  dok.body.classList.toggle('zeichen', a.zeichen)
  auswahlZeigen(dok, a.auswahl)
}

function seiteBauen(html: string, vaultCss: string[], titel: string, fassung: number, tinteSparen: boolean): string {
  const stil = (css: string) => `<style>${urlsAbsolut(css)}</style>`
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${titel.replace(/</g, '&lt;')}</title>
${stil(SCHRIFTEN)}${stil(obsidianBasis)}${vaultCss.map(stil).join('')}${stil(druckCss)}
<script>window.PagedConfig = { auto: true, after: () => parent.postMessage({ druckreif: 'fertig', fassung: ${fassung} }, '*') }</script>
<script src="${pagedUrl}"></script>
</head><body class="theme-light${tinteSparen ? ' tinte-sparen' : ''}"><div class="markdown-preview-view markdown-rendered">${html}</div></body></html>`
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
