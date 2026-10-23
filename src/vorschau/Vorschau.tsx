// A4-Ansicht wie in Word: Seiten auf grauer Fläche, Zoom, Auswahl, Bilder ziehen.
// Jede Fassung wird in einem eigenen iframe umbrochen (Theme-CSS bleibt von der Oberfläche getrennt).
// Zwei iframes wechseln sich ab: die neue Fassung wird unsichtbar umbrochen und erst dann eingeblendet,
// damit die Ansicht bei Änderungen nicht flackert.
// Schneller Neuumbruch: Jede Notiz, die auf einer neuen Seite beginnt, wird für sich umbrochen (samt direkt
// anschließender Notizen = eine Gruppe). Unveränderte Gruppen übernehmen ihre Seiten aus der sichtbaren Fassung;
// Paged.js bricht nur die geänderten Gruppen neu um.

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
import type { VaultCss } from '../stil/aufteilen'
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
  /** Seite, auf der ein Block beginnt */
  seiteVonBlock(id: string): number | null
  /** IDs der Blöcke, die auf dieser Seite beginnen (Fortsetzungen geteilter Blöcke zählen nicht) */
  bloeckeAufSeite(nummer: number): string[]
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
  vaultCss: VaultCss[]
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

/** Notizgruppe einer Fassung: Schlüssel = ihr HTML, Seiten = unberührte Kopie der umbrochenen Seiten */
interface Gruppe {
  schluessel: string
  seiten: HTMLElement[]
}

/** Umbruch, der gerade läuft: pro Gruppe die übernommenen Seiten oder null (wird von Paged.js umbrochen) */
interface Plan {
  css: string
  gruppen: { schluessel: string; alt: HTMLElement[] | null }[]
}

/**
 * Paged.js 0.4 hält jedes Element mit style-Attribut für unsichtbar (UndisplayedFilter) und überspringt es bei der
 * Suche nach dem Element vor einem Umbruch: Seitenumbrüche hinter Blöcken mit eigener Schrift oder eigenem Abstand
 * fielen weg (z. B. jede Notiz nach „Automatisch formatieren“). Nur wirklich ausgeblendete bleiben markiert.
 */
const PAGED_KORREKTUR = `class InlineStil extends Paged.Handler {
  filter(inhalt) {
    for (const el of inhalt.querySelectorAll('[style][data-undisplayed]')) if (el.style.display !== 'none') delete el.dataset.undisplayed
  }
}
Paged.registerHandlers(InlineStil)`

/**
 * Paged.js-Angaben, die von der Lage im ganzen Dokument abhängen (Zähler, linke/rechte Seiten, „+“-Selektoren
 * mit Zufallsnamen): dann immer alles neu umbrechen.
 */
const NICHT_TEILBAR = /\+|nth-|counter|string-set|:first|:left|:right|:blank|:\s*(left|right|recto|verso)\b/

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
    seiteVonBlock(id) {
      const el = aktivesFenster()?.contentDocument?.querySelector(`[data-block="${id}"]:not([data-split-from])`)
      const nummer = el?.closest<HTMLElement>('.pagedjs_page')?.dataset.pageNumber
      return nummer ? Number(nummer) : null
    },
    bloeckeAufSeite(nummer) {
      const seiten = aktivesFenster()?.contentDocument?.querySelectorAll('.pagedjs_page')
      const bloecke = [...(seiten?.[nummer - 1]?.querySelectorAll<HTMLElement>('[data-block]:not([data-split-from])') ?? [])]
      // Ein manueller Umbruch vor dem ersten Block der nächsten Seite beendet diese Seite – gehört also auch zu ihr
      const naechster = seiten?.[nummer]?.querySelector<HTMLElement>('[data-block]:not([data-split-from])')
      const umbruch = naechster?.closest<HTMLElement>('.umbruch-vor')
      if (naechster && umbruch && (umbruch === naechster || umbruch.querySelector('[data-block]') === naechster)) bloecke.push(naechster)
      return bloecke.map((el) => el.dataset.block!)
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

  // Seiten der sichtbaren Fassung je Gruppe (unberührt, vor Auswahl, Markierungen und Suche kopiert)
  const vorrat = useRef<{ css: string; gruppen: Gruppe[] } | null>(null)
  const plaene = useRef<(Plan | null)[]>([null, null])

  // Neue Fassung immer im unsichtbaren iframe umbrechen – auch beim ersten Mal, sonst sieht man kurz
  // den rohen, seitenbreiten Text, bevor Paged.js die Seiten gebaut hat
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => umbrechen(true), [html, vaultCss, titel, tinteSparen])

  function umbrechen(teilen: boolean) {
    const a = aktuell.current
    setUmbricht(true)
    const ziel = 1 - aktivRef.current
    erwartet.current[ziel] = ++fassung.current
    const inhalt = document.createElement('template')
    inhalt.innerHTML = a.html
    const css = cssSchluessel(a.vaultCss, a.tinteSparen)
    const verfuegbar = teilen && vorrat.current?.css === css && !NICHT_TEILBAR.test(a.vaultCss.map((c) => c.umbruch).join('\n'))
      ? [...vorrat.current.gruppen]
      : []
    const plan: Plan['gruppen'] = []
    for (const artikel of [...inhalt.content.children] as HTMLElement[]) {
      // eine Notiz, die nicht direkt anschließt, beginnt eine neue Gruppe
      if (plan.length === 0 || !artikel.classList.contains('anschliessen')) plan.push({ schluessel: '', alt: null })
      const gruppe = plan.at(-1)!
      gruppe.schluessel += artikel.outerHTML
      artikel.dataset.gruppe = String(plan.length - 1)
    }
    for (const gruppe of plan) {
      const i = verfuegbar.findIndex((v) => v.schluessel === gruppe.schluessel)
      if (i >= 0) gruppe.alt = verfuegbar.splice(i, 1)[0].seiten
    }
    // Nichts zu übernehmen oder nichts neu zu umbrechen: alles umbrechen (der Plan ordnet die Seiten trotzdem zu)
    if (plan.every((g) => g.alt) || plan.every((g) => !g.alt)) plan.forEach((g) => (g.alt = null))
    else {
      for (const artikel of [...inhalt.content.children] as HTMLElement[]) {
        if (plan[Number(artikel.dataset.gruppe)].alt) artikel.remove()
      }
      // erste umbrochene Notiz steht am Anfang: kein Umbruch davor (sonst leere erste Seite)
      inhalt.content.firstElementChild?.classList.remove('folgend')
    }
    plaene.current[ziel] = { css, gruppen: plan }
    rahmen[ziel].current!.srcdoc = seiteBauen(inhalt.innerHTML, a.vaultCss, a.titel, fassung.current, a.tinteSparen)
  }

  useEffect(() => {
    async function empfangen(e: MessageEvent) {
      if (e.data?.druckreif !== 'fertig') return
      const nr = rahmen.findIndex((r) => r.current?.contentWindow === e.source)
      if (nr < 0 || e.data.fassung !== erwartet.current[nr]) return
      const neu = rahmen[nr].current!
      const dok = neu.contentDocument!
      const gruppen = seitenZusammensetzen(dok, plaene.current[nr]!)
      if (!gruppen) return umbrechen(false) // Seiten passen nicht zum Plan: sicherheitshalber alles umbrechen
      await bilderGeladen(dok)
      if (e.data.fassung !== erwartet.current[nr]) return
      vorrat.current = { css: plaene.current[nr]!.css, gruppen }
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

/**
 * Seiten der umbrochenen Gruppen und übernommene Seiten in der Reihenfolge des Plans zusammensetzen, neu nummerieren
 * und je Gruppe eine unberührte Kopie liefern. Passen die Seiten nicht zum Plan: beim Teil-Umbruch null (dann alles
 * neu umbrechen, nie Inhalt verlieren), beim vollständigen Umbruch keine Kopien (der nächste Umbruch ist wieder vollständig).
 */
function seitenZusammensetzen(dok: Document, plan: Plan): Gruppe[] | null {
  const teil = plan.gruppen.some((g) => g.alt)
  const flaeche = dok.querySelector('.pagedjs_pages')
  if (!flaeche) return teil ? null : []
  const umbrochen = new Map<number, HTMLElement[]>()
  let gruppe = -1
  for (const seite of flaeche.querySelectorAll<HTMLElement>(':scope > .pagedjs_page')) {
    const nummern = new Set([...seite.querySelectorAll<HTMLElement>('article[data-gruppe]')].map((a) => Number(a.dataset.gruppe)))
    // Gruppen beginnen immer auf einer neuen Seite – sonst sind sie nicht unabhängig umbrochen
    if (nummern.size > 1) return teil ? null : []
    if (nummern.size === 1) gruppe = [...nummern][0]
    umbrochen.set(gruppe, [...(umbrochen.get(gruppe) ?? []), seite])
  }
  const gruppen: Gruppe[] = []
  const alle: HTMLElement[] = []
  for (const [i, g] of plan.gruppen.entries()) {
    const seiten = g.alt ? g.alt.map((s) => dok.importNode(s, true)) : umbrochen.get(i)
    if (!seiten?.length || umbrochen.has(-1)) return teil ? null : []
    alle.push(...seiten)
    gruppen.push({ schluessel: g.schluessel, seiten: [] })
  }
  if (teil) {
    flaeche.replaceChildren(...alle)
    // wie Paged.js: erste Seite rechts, dann abwechselnd
    alle.forEach((seite, i) => {
      seite.id = `page-${i + 1}`
      seite.dataset.pageNumber = String(i + 1)
      seite.classList.toggle('pagedjs_first_page', i === 0)
      seite.classList.toggle('pagedjs_right_page', i % 2 === 0)
      seite.classList.toggle('pagedjs_left_page', i % 2 === 1)
    })
    ;(flaeche as HTMLElement).style.setProperty('--pagedjs-page-count', String(alle.length))
  }
  // unberührte Kopien für den nächsten Umbruch; übernommene Gruppen behalten ihre (nie eingefügten) Kopien
  let n = 0
  for (const [i, g] of plan.gruppen.entries()) {
    const anzahl = g.alt ? g.alt.length : umbrochen.get(i)!.length
    gruppen[i].seiten = g.alt ?? alle.slice(n, n + anzahl).map((s) => s.cloneNode(true) as HTMLElement)
    n += anzahl
  }
  return gruppen
}

/** Übernommene Seiten enthalten Bilder, die im neuen iframe erst geladen werden – vorher stimmen die Höhen nicht */
async function bilderGeladen(dok: Document) {
  await Promise.all([...dok.images].map((img) => (img.complete ? null : img.decode().catch(() => {}))))
}

function cssSchluessel(vaultCss: VaultCss[], tinteSparen: boolean): string {
  return JSON.stringify([vaultCss, tinteSparen])
}

function seiteBauen(html: string, vaultCss: VaultCss[], titel: string, fassung: number, tinteSparen: boolean): string {
  // „<“ als CSS-Escape: ein „</style>“ in Theme oder Snippet aus dem Vault darf das style-Element nicht beenden
  // (sonst liefe dahinter stehendes HTML samt <script> mit Zugriff auf den Vault). In CSS bedeutet \3c dasselbe.
  // nativ = an Paged.js vorbei, der Browser wendet das CSS direkt an (siehe stil/aufteilen.ts)
  const stil = (css: string, nativ = false) =>
    `<style${nativ ? ' data-pagedjs-ignore' : ''}>${urlsAbsolut(css).replace(/</g, '\\3c ')}</style>`
  // Reihenfolge wie in Obsidian: Grundstil, dann Theme und Snippets; das Druck-Stylesheet hat Vorrang
  // (Paged.js hängt die verarbeiteten Stylesheets hinter die nativen)
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${titel.replace(/</g, '&lt;')}</title>
${stil(SCHRIFTEN, true)}${stil(obsidianBasis, true)}${vaultCss.map((c) => stil(c.nativ, true)).join('')}
${vaultCss.map((c) => stil(c.umbruch)).join('')}${stil(druckCss)}
<script>window.PagedConfig = { auto: true, after: () => parent.postMessage({ druckreif: 'fertig', fassung: ${fassung} }, '*') }</script>
<script src="${pagedUrl}"></script>
<script>${PAGED_KORREKTUR}</script>
</head><body class="theme-light${tinteSparen ? ' tinte-sparen' : ''}"><div class="print markdown-reading-view">${html}</div></body></html>`
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
