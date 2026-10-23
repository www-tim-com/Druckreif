// A4-Ansicht wie in Word: Seiten auf grauer Fläche, Zoom, Auswahl, Bilder ziehen.
// Jede Fassung wird in einem eigenen iframe umbrochen (Theme-CSS bleibt von der Oberfläche getrennt).
// Zwei iframes wechseln sich ab: die neue Fassung wird unsichtbar umbrochen und erst dann eingeblendet,
// damit die Ansicht bei Änderungen nicht flackert.
// Schneller Neuumbruch: Jede Notiz, die auf einer neuen Seite beginnt, wird für sich umbrochen (samt direkt
// anschließender Notizen = eine Gruppe). Unveränderte Gruppen übernehmen ihre Seiten aus der sichtbaren Fassung;
// Paged.js bricht nur die geänderten Gruppen neu um – und zwar im „Setzer“, einem dauerhaft geladenen unsichtbaren
// iframe (Paged.js, Schriften und CSS sind dort schon bereit). Danach werden nur die Seiten der geänderten Gruppen
// in der sichtbaren Fassung ausgetauscht: kein neues Dokument, keine neu geladenen Bilder, Lesestelle bleibt.
// Ändert sich nur eine Notiz, setzt der Setzer erst ab der Seite vor der Änderung neu und hört auf, sobald die
// Seiten wieder mit den alten übereinstimmen (neustart.ts).

import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
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
import { type Neustart, neustartFinden } from './neustart'
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
  /** Zoom, bei dem die Seitenbreite bzw. eine ganze Seite in den sichtbaren Bereich passt */
  zoomFuer(art: 'breite' | 'seite'): number | null
  /** Zahlen für „Wörter zählen“ (nur was gedruckt wird); `genau`: auch Absätze und Zeilen (misst jedes Element) */
  statistik(genau: boolean): Statistik | null
  /** Lage der Seite in der Mitte des Sichtbereichs, für das Lineal (px relativ zur Seitenansicht) */
  linealMass(): LinealMass | null
  /** Fenster der sichtbaren Fassung (Scrollen für das Lineal) */
  fenster(): Window | null
}

export interface Statistik {
  woerter: number
  zeichen: number
  zeichenOhneLeerzeichen: number
  absaetze: number
  zeilen: number
}

export interface LinealMass {
  seiteLinks: number
  seiteBreite: number
  textLinks: number
  textBreite: number
  breiteMm: number
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
  /** dunkles Office-Design: Arbeitsfläche um die (weiß bleibenden) Seiten dunkel */
  dunkel: boolean
  /** Suchbegriff (Strg+F) und gewählter Treffer */
  suche: string
  trefferAktiv: number
  onTreffer(treffer: Treffer[]): void
  rueckrufe: Rueckrufe
  onFertig(fertig: Fertig): void
  ref?: Ref<VorschauSteuerung>
}

// Leere Seite in der Farbe der Arbeitsfläche, solange noch nichts umbrochen ist
const LEER = '<!doctype html><body style="margin:0;background:transparent"></body>'

const SCHRIFTEN = [notoSans400, notoSans400i, notoSans700, notoSans700i, notoMono, katexCss].join('\n')

/**
 * Notizgruppe der sichtbaren Fassung: Schlüssel = ihr HTML, Seiten = unberührte Kopie der umbrochenen Seiten,
 * sichtbar = die Seiten im sichtbaren iframe (mit Auswahl, Markierungen)
 */
interface Gruppe {
  schluessel: string
  seiten: HTMLElement[]
  sichtbar: HTMLElement[]
  /** geparstes HTML, für den Vergleich beim nächsten Neustart (neustart.ts) */
  dom?: HTMLElement
}

/** Umbruch, der gerade läuft: pro Gruppe die übernommene Gruppe oder null (wird von Paged.js umbrochen) */
interface Plan {
  css: string
  /** neustart: geänderte Gruppe, deren Seiten bis `seite` aus der sichtbaren Fassung bleiben (neustart.ts) */
  gruppen: { schluessel: string; alt: Gruppe | null; neustart?: { basis: Gruppe } & Neustart; dom?: HTMLElement }[]
}

/** Paged.js-Objekte im iframe (nur was hier gebraucht wird) */
interface PagedPolisher {
  inserted: HTMLStyleElement[]
  styleEl: HTMLStyleElement
  destroy(): void
}
interface PagedFenster extends Window {
  Paged: {
    Previewer: new () => {
      polisher: PagedPolisher
      chunker: {
        q: { tick: (weiter: () => void) => void }
        hooks: { afterPageLayout: { register(f: (seite: HTMLElement) => void): void } }
      }
      preview(inhalt: Node, stile: Record<string, string>[], ziel: Element): Promise<unknown>
    }
  }
  druckreifTakt: (weiter: () => void) => void
  PagedPolyfill?: { polisher: PagedPolisher }
}

/**
 * Paged.js wartet nach jeder Seite auf den nächsten Bildschirm-Frame (requestAnimationFrame) – mindestens 17 ms pro
 * Seite, ohne Nutzen: gemessen wird am Layout, nicht am gemalten Bild. Stattdessen sofort weiter, aber als eigene
 * Aufgabe (MessageChannel), damit Klicks und Tasten zwischen zwei Seiten drankommen.
 */
const PAGED_TAKT = `const druckreifKanal = new MessageChannel()
const druckreifWartend = []
druckreifKanal.port1.onmessage = () => druckreifWartend.shift()?.()
window.druckreifTakt = (weiter) => {
  druckreifWartend.push(weiter)
  druckreifKanal.port2.postMessage(0)
}`

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
Paged.registerHandlers(InlineStil)
${PAGED_TAKT}
PagedPolyfill.chunker.q.tick = druckreifTakt`

/**
 * Paged.js-Angaben, die von der Lage im ganzen Dokument abhängen (Zähler, linke/rechte Seiten, „+“-Selektoren
 * mit Zufallsnamen): dann immer alles neu umbrechen.
 */
const NICHT_TEILBAR = /\+|nth-|counter|string-set|:first|:left|:right|:blank|:\s*(left|right|recto|verso)\b/

export function Vorschau(p: Props) {
  const { html, vaultCss, titel, zoom, auswahl, zeichen, baut, tinteSparen, dunkel, suche, trefferAktiv, ref } = p
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
    zoomFuer(art) {
      const dok = aktivesFenster()?.contentDocument
      const sicht = flaeche.current
      if (!dok?.querySelector('.pagedjs_page') || !sicht) return null
      const mass = getComputedStyle(dok.documentElement)
      const breite = laengePx(mass.getPropertyValue('--pagedjs-width')) ?? 794
      const hoehe = laengePx(mass.getPropertyValue('--pagedjs-height')) ?? 1123
      // Rand links/rechts und Bildlaufleiste, oben/unten der Abstand der Seiten (6 mm, vorschau.css)
      const z = (sicht.clientWidth - 40) / breite
      const ganz = art === 'seite' ? Math.min(z, (sicht.clientHeight - 2 * 23) / hoehe) : z
      return Math.floor(ganz * 10) / 10
    },
    statistik(genau) {
      const seiten = aktivesFenster()?.contentDocument?.querySelector('.pagedjs_pages')
      if (!seiten) return null
      // Nur der Textbereich der Seiten: ohne Kopf-/Fußzeilen (Seitenzahlen), Markierungen und Griffe
      // Textknoten einzeln: textContent klebt Wörter benachbarter Absätze aneinander
      const teile: string[] = []
      for (const bereich of seiten.querySelectorAll('.pagedjs_area')) {
        const gang = bereich.ownerDocument.createTreeWalker(bereich, NodeFilter.SHOW_TEXT)
        for (let n = gang.nextNode(); n; n = gang.nextNode()) teile.push(n.nodeValue ?? '')
      }
      const text = teile.join(' ')
      const woerter = text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
      if (!genau) return { woerter, zeichen: 0, zeichenOhneLeerzeichen: 0, absaetze: 0, zeilen: 0 }
      const absaetze = [...seiten.querySelectorAll<HTMLElement>('.pagedjs_area :is(p, li, h1, h2, h3, h4, h5, h6, th, td, pre, figcaption)')].filter(
        (el) => (el.textContent ?? '').trim() && !el.querySelector('p, li'),
      )
      return {
        woerter,
        zeichen: text.replace(/\s+/g, ' ').trim().length,
        zeichenOhneLeerzeichen: text.replace(/\s+/g, '').length,
        // Fortsetzungen geteilter Absätze zählen nicht doppelt
        absaetze: absaetze.filter((el) => !el.hasAttribute('data-split-from')).length,
        zeilen: absaetze.reduce((summe, el) => {
          const zeile = parseFloat(getComputedStyle(el).lineHeight)
          return summe + (zeile > 0 ? Math.max(1, Math.round(el.getBoundingClientRect().height / zeile / aktuell.current.zoom)) : 1)
        }, 0),
      }
    },
    linealMass() {
      const fenster = aktivesFenster()?.contentWindow
      const dok = fenster?.document
      const seiten = [...(dok?.querySelectorAll<HTMLElement>('.pagedjs_page') ?? [])]
      if (!fenster || !dok || seiten.length === 0) return null
      const mitte = fenster.innerHeight / 2
      const seite = seiten.find((s) => s.getBoundingClientRect().bottom > mitte) ?? seiten.at(-1)!
      const inhalt = seite.querySelector<HTMLElement>('.pagedjs_area') ?? seite
      const r = seite.getBoundingClientRect()
      const t = inhalt.getBoundingClientRect()
      const breiteMm = ((laengePx(getComputedStyle(dok.documentElement).getPropertyValue('--pagedjs-width')) ?? 794) * 25.4) / 96
      return { seiteLinks: r.left, seiteBreite: r.width, textLinks: t.left, textBreite: t.width, breiteMm }
    },
    fenster() {
      return aktivesFenster()?.contentWindow ?? null
    },
  }))

  // Seiten der sichtbaren Fassung je Gruppe (unberührt, vor Auswahl, Markierungen und Suche kopiert)
  const vorrat = useRef<{ css: string; gruppen: Gruppe[] } | null>(null)
  const plaene = useRef<(Plan | null)[]>([null, null])
  // Setzer: unsichtbares iframe mit fertig geladenem Paged.js für geänderte Gruppen (pro CSS-Stand)
  const setzer = useRef<{ css: string; rahmen: HTMLIFrameElement; fenster: PagedFenster | null } | null>(null)
  // Setzläufe nacheinander: zwei Läufe gleichzeitig im selben Dokument kämen sich in die Quere
  const setzKette = useRef(Promise.resolve())
  const letzterLeerraum = useRef<Leerraum[]>([])

  useEffect(() => {
    const a = aktuell.current
    const css = cssSchluessel(a.vaultCss, a.tinteSparen)
    if (setzer.current?.css === css) return
    setzerEntfernen()
    const rahmen = document.createElement('iframe')
    rahmen.className = 'messung'
    rahmen.setAttribute('aria-hidden', 'true')
    const eintrag: NonNullable<typeof setzer.current> = { css, rahmen, fenster: null }
    // bereit, sobald Paged.js dort einmal durchgelaufen ist; ein ersetzter Setzer meldet sich nie mehr
    const bereit = (e: MessageEvent) => {
      if (e.data?.druckreif !== 'fertig' || e.source !== rahmen.contentWindow) return
      window.removeEventListener('message', bereit)
      eintrag.fenster = rahmen.contentWindow as PagedFenster
    }
    window.addEventListener('message', bereit)
    rahmen.addEventListener('druckreif-weg', () => window.removeEventListener('message', bereit))
    rahmen.srcdoc = seiteBauen('', a.vaultCss, '', -1, a.tinteSparen)
    flaeche.current!.append(rahmen)
    setzer.current = eintrag
  }, [vaultCss, tinteSparen])
  function setzerEntfernen() {
    setzer.current?.rahmen.dispatchEvent(new Event('druckreif-weg'))
    setzer.current?.rahmen.remove()
    setzer.current = null
  }

  // Neue Fassung immer im unsichtbaren iframe umbrechen – auch beim ersten Mal, sonst sieht man kurz
  // den rohen, seitenbreiten Text, bevor Paged.js die Seiten gebaut hat. useLayoutEffect: sofort, nicht erst nach
  // dem nächsten Bildschirm-Frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => umbrechen(true), [html, vaultCss, titel, tinteSparen])

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
      if (i >= 0) gruppe.alt = verfuegbar.splice(i, 1)[0]
    }
    // Eine Notiz geändert (der Normalfall): erst ab der Seite vor der Änderung neu setzen
    const neue = plan.filter((g) => !g.alt)
    let neustart: ReturnType<typeof neustartFinden> = null
    if (neue.length === 1 && verfuegbar.length === 1) {
      // Kopie der Notizen der Gruppe (mit data-gruppe), gemerkt für den nächsten Vergleich
      const nummer = String(plan.indexOf(neue[0]))
      const dom = document.createElement('div')
      for (const artikel of inhalt.content.children) if ((artikel as HTMLElement).dataset.gruppe === nummer) dom.append(artikel.cloneNode(true))
      neue[0].dom = dom
      neustart = neustartFinden(verfuegbar[0], dom)
    }
    if (neustart) neue[0].neustart = { basis: verfuegbar[0], ...neustart }
    const fertigerSetzer = setzer.current?.css === css ? setzer.current.fenster : null

    if (fertigerSetzer && (neue.length < plan.length || neustart) && neue.length > 0) {
      // Nur geänderte Gruppen (bzw. den geänderten Rest) im Setzer umbrechen und in der sichtbaren Fassung austauschen
      erwartet.current[ziel] = 0 // ein noch laufender vollständiger Umbruch ist überholt
      // Klassen wie „folgend“ bleiben: am Anfang des Inhalts bricht Paged.js nicht um
      const html = neustart ? neustart.html : nurGeaenderte(inhalt.content, plan, false)
      const meine = fassung.current
      const stile = pagedStile(a.vaultCss)
      setzKette.current = setzKette.current.then(async () => {
        if (meine !== fassung.current) return
        const geklappt = await nachsetzen(fertigerSetzer, html, stile, { css, gruppen: plan }, meine).catch(() => false)
        if (!geklappt && meine === fassung.current) umbrechen(false)
      })
      return
    }
    // Nichts zu übernehmen oder nichts neu zu umbrechen: alles umbrechen (der Plan ordnet die Seiten trotzdem zu)
    if (neue.length === 0 || neue.length === plan.length) plan.forEach((g) => ((g.alt = null), delete g.neustart))
    else {
      plan.forEach((g) => delete g.neustart)
      nurGeaenderte(inhalt.content, plan, true)
    }
    plaene.current[ziel] = { css, gruppen: plan }
    rahmen[ziel].current!.srcdoc = seiteBauen(inhalt.innerHTML, a.vaultCss, a.titel, fassung.current, a.tinteSparen)
  }

  /**
   * Geänderte Gruppen im Setzer umbrechen und ihre Seiten in der sichtbaren Fassung austauschen. Liefert false, wenn
   * das nicht sicher geht (dann wird alles umbrochen): Paged.js erzeugt für diesen Inhalt anderes CSS als für die
   * sichtbare Fassung (inhaltsabhängige Regeln), oder die Seiten passen nicht zum Plan.
   */
  async function nachsetzen(fenster: PagedFenster, html: string, stile: string[], plan: Plan, meine: number): Promise<boolean> {
    const rahmenSichtbar = aktivesFenster()
    const sichtbar = rahmenSichtbar?.contentDocument
    const sichtbarPolyfill = (rahmenSichtbar?.contentWindow as PagedFenster | null)?.PagedPolyfill
    const flaecheSichtbar = sichtbar?.querySelector('.pagedjs_pages')
    if (!sichtbar || !sichtbarPolyfill || !flaecheSichtbar) return false
    const dok = fenster.document
    const ziel = dok.createElement('div')
    dok.body.append(ziel)
    // wie seiteBauen: die Hülle gehört zum Inhalt (Paged.js übernimmt nur, was unterhalb der Wurzel steht)
    const huelle = dok.createElement('div')
    huelle.className = 'print markdown-reading-view'
    huelle.innerHTML = html
    // beginnt der Inhalt nicht am Anfang des Dokuments, ist die Hülle eine Fortsetzung (wie bei Paged.js)
    const neustart = plan.gruppen.find((g) => g.neustart)?.neustart
    if (neustart || plan.gruppen[0].alt) huelle.setAttribute('data-split-from', '')
    const inhalt = dok.createDocumentFragment()
    inhalt.append(huelle)
    const vorschau = new fenster.Paged.Previewer()
    vorschau.chunker.q.tick = fenster.druckreifTakt
    // Neustart: sobald eine neue Seite wieder wie eine alte beginnt (und danach alles gleich ist), aufhören –
    // Paged.js kennt kein Anhalten, ein Fehler aus dem Seiten-Hook beendet den Lauf
    const lauf = { gesetzt: 0, wieder: null as { neu: number; alt: number } | null }
    const GLEICH = new Error('wieder gleich')
    vorschau.chunker.hooks.afterPageLayout.register((seite) => {
      const neu = lauf.gesetzt++
      const alt = neu > 0 && neustart ? neustart.wiederGleich(seite) : null
      if (alt === null) return
      lauf.wieder = { neu, alt }
      throw GLEICH
    })
    let neu: HTMLElement[]
    try {
      await vorschau.preview(inhalt, stile.map((css) => ({ [fenster.location.href]: css })), ziel).catch((e) => {
        if (e !== GLEICH) throw e
      })
      if (meine !== fassung.current) return true
      if (pagedCss(vorschau.polisher) !== pagedCss(sichtbarPolyfill.polisher)) return false
      let gesetzteSeiten = [...ziel.querySelectorAll<HTMLElement>('.pagedjs_pages > .pagedjs_page')]
      // die Seite, die schon wieder wie eine alte beginnt, kommt aus der alten Fassung
      if (lauf.wieder) gesetzteSeiten = gesetzteSeiten.slice(0, lauf.wieder.neu)
      neu = gesetzteSeiten.map((s) => sichtbar.importNode(s, true))
      // Beginnt der Inhalt mit einem Umbruch, setzt Paged.js eine leere Seite davor
      while (neu.length > 0 && !neu[0].querySelector('[data-block]')) neu.shift()
    } finally {
      vorschau.polisher.destroy()
      ziel.remove()
    }
    const umbrochen = seitenNachGruppe(neu)
    if (!umbrochen) return false
    // Bilder der neuen Seiten vorher laden, sonst springt die Seite beim Einsetzen
    await Promise.all(neu.flatMap((s) => [...s.querySelectorAll('img')]).map((img) => img.decode().catch(() => {})))
    if (meine !== fassung.current) return true
    const gruppen: Gruppe[] = []
    for (const [i, g] of plan.gruppen.entries()) {
      if (g.alt) {
        gruppen.push(g.alt)
        continue
      }
      const seiten = umbrochen.get(i)
      if (!seiten?.length) return false
      const kopien = seiten.map((s) => s.cloneNode(true) as HTMLElement)
      // Neustart: Seiten vor der Änderung bleiben (sichtbar und als unberührte Kopie), ab dem Wiedereinrasten auch die danach
      const n = g.neustart
      const danach = lauf.wieder?.alt ?? Infinity
      gruppen.push({
        schluessel: g.schluessel,
        dom: g.dom,
        seiten: n ? [...n.basis.seiten.slice(0, n.seite), ...kopien, ...n.basis.seiten.slice(danach)] : kopien,
        sichtbar: n ? [...n.basis.sichtbar.slice(0, n.seite), ...seiten, ...n.basis.sichtbar.slice(danach)] : seiten,
      })
    }
    // Austausch in einem Schritt: kein Zwischenzustand sichtbar
    const gleich = seitenEinsetzen(flaecheSichtbar as HTMLElement, gruppen.flatMap((g) => g.sichtbar))
    vorrat.current = { css: plan.css, gruppen }
    nachUmbruch(sichtbar, gleich)
    return true
  }

  /** Nach jedem Umbruch: Auswahl, Zoom, Leerraum, Suche – und melden, dass die Fassung fertig ist */
  function nachUmbruch(dok: Document, gleich = 0) {
    ansichtAnwenden(dok, aktuell.current)
    // unveränderte Seiten am Anfang (samt Markierungen) behalten ihren Leerraum
    const leerraum = leerraumFinden(dok, gleich, letzterLeerraum.current)
    letzterLeerraum.current = leerraum
    aktuell.current.onTreffer(suchen(dok, aktuell.current.suche))
    trefferZeigen(dok, aktuell.current.trefferAktiv, false)
    setUmbricht(false)
    aktuell.current.onFertig({ seiten: dok.querySelectorAll('.pagedjs_page').length, leerraum })
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
      // Lesestelle vom bisherigen iframe übernehmen, dann umschalten
      const alt = rahmen[aktivRef.current].current
      if (alt && alt !== neu) neu.contentWindow!.scrollTo(0, alt.contentWindow?.scrollY ?? 0)
      aktivRef.current = nr
      setAktiv(nr)
      nachUmbruch(dok)
    }
    window.addEventListener('message', empfangen)
    return () => window.removeEventListener('message', empfangen)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auswahl, Zoom und Formatierungszeichen ohne neuen Umbruch anwenden
  useEffect(() => {
    const dok = aktivesFenster()?.contentDocument
    if (dok?.querySelector('.pagedjs_pages')) ansichtAnwenden(dok, { auswahl, zeichen, zoom, dunkel })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auswahl, zeichen, zoom, aktiv, dunkel])

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

/** CSS-Länge wie „210mm“ oder „8.5in“ in Pixel (96 dpi) */
function laengePx(wert: string): number | null {
  const m = wert.trim().match(/^([\d.]+)(mm|cm|in|px|pt)$/)
  if (!m) return null
  const faktor = { mm: 96 / 25.4, cm: 96 / 2.54, in: 96, px: 1, pt: 96 / 72 }[m[2] as 'mm']
  return Number(m[1]) * faktor
}

function ansichtAnwenden(dok: Document, a: { auswahl: string | null; zeichen: boolean; zoom: number; dunkel: boolean }) {
  const seiten = dok.querySelector<HTMLElement>('.pagedjs_pages')
  if (seiten) seiten.style.zoom = String(a.zoom)
  dok.documentElement.classList.toggle('dunkel', a.dunkel)
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
  const flaeche = dok.querySelector<HTMLElement>('.pagedjs_pages')
  if (!flaeche) return teil ? null : []
  const umbrochen = seitenNachGruppe([...flaeche.querySelectorAll<HTMLElement>(':scope > .pagedjs_page')])
  if (!umbrochen) return teil ? null : []
  const gruppen: Gruppe[] = []
  for (const [i, g] of plan.gruppen.entries()) {
    const sichtbar = g.alt ? g.alt.seiten.map((s) => dok.importNode(s, true)) : umbrochen.get(i)
    if (!sichtbar?.length) return teil ? null : []
    // übernommene Gruppen behalten ihre (nie eingefügten) unberührten Kopien
    const seiten = g.alt?.seiten ?? sichtbar.map((s) => s.cloneNode(true) as HTMLElement)
    gruppen.push({ schluessel: g.schluessel, seiten, sichtbar })
  }
  if (teil) seitenEinsetzen(flaeche, gruppen.flatMap((g) => g.sichtbar))
  return gruppen
}

/** Notizen übernommener Gruppen entfernen; `ohneUmbruch`: die erste umbrochene ohne Umbruch davor (sonst leere Seite) */
function nurGeaenderte(inhalt: DocumentFragment, plan: Plan['gruppen'], ohneUmbruch: boolean): string {
  for (const artikel of [...inhalt.children] as HTMLElement[]) {
    if (plan[Number(artikel.dataset.gruppe)].alt) artikel.remove()
  }
  if (ohneUmbruch) inhalt.firstElementChild?.classList.remove('folgend')
  const huelle = document.createElement('div')
  huelle.append(inhalt.cloneNode(true))
  return huelle.innerHTML
}

/** Umbrochene Seiten nach Gruppe (data-gruppe der Notizen). null: eine Seite enthält zwei Gruppen oder keine vor der ersten. */
function seitenNachGruppe(seiten: HTMLElement[]): Map<number, HTMLElement[]> | null {
  const umbrochen = new Map<number, HTMLElement[]>()
  let gruppe = -1
  for (const seite of seiten) {
    const nummern = new Set([...seite.querySelectorAll<HTMLElement>('article[data-gruppe]')].map((a) => Number(a.dataset.gruppe)))
    // Gruppen beginnen immer auf einer neuen Seite – sonst sind sie nicht unabhängig umbrochen
    if (nummern.size > 1) return null
    if (nummern.size === 1) gruppe = [...nummern][0]
    if (gruppe < 0) return null
    umbrochen.set(gruppe, [...(umbrochen.get(gruppe) ?? []), seite])
  }
  return umbrochen
}

/**
 * Seiten in dieser Reihenfolge einsetzen und wie Paged.js nummerieren: erste Seite rechts, dann abwechselnd.
 * Nur anfassen, was sich ändert – jede berührte Seite muss der Browser neu gestalten und layouten.
 * Liefert die Zahl der Seiten am Anfang, die unverändert geblieben sind.
 */
function seitenEinsetzen(flaeche: HTMLElement, alle: HTMLElement[]): number {
  let gleich = 0
  while (gleich < alle.length && flaeche.children[gleich] === alle[gleich]) gleich++
  const bleiben = new Set(alle)
  for (const alt of [...flaeche.children]) if (!bleiben.has(alt as HTMLElement)) alt.remove()
  alle.forEach((seite, i) => {
    if (flaeche.children[i] !== seite) flaeche.insertBefore(seite, flaeche.children[i] ?? null)
    const nummer = String(i + 1)
    if (seite.dataset.pageNumber !== nummer) {
      seite.id = `page-${nummer}`
      seite.dataset.pageNumber = nummer
    }
    seite.classList.toggle('pagedjs_first_page', i === 0)
    seite.classList.toggle('pagedjs_right_page', i % 2 === 0)
    seite.classList.toggle('pagedjs_left_page', i % 2 === 1)
  })
  if (flaeche.style.getPropertyValue('--pagedjs-page-count') !== String(alle.length)) {
    flaeche.style.setProperty('--pagedjs-page-count', String(alle.length))
  }
  return gleich
}

/** CSS, das Paged.js aus den Stylesheets erzeugt hat – gleich, wenn nichts davon vom Inhalt abhängt */
function pagedCss(polisher: PagedPolisher): string {
  const regeln = (el: HTMLStyleElement) => [...(el.sheet?.cssRules ?? [])].map((r) => r.cssText).join('\n')
  return [...polisher.inserted, polisher.styleEl].map(regeln).join('\n§\n')
}

/** Übernommene Seiten enthalten Bilder, die im neuen iframe erst geladen werden – vorher stimmen die Höhen nicht */
async function bilderGeladen(dok: Document) {
  await Promise.all([...dok.images].map((img) => (img.complete ? null : img.decode().catch(() => {}))))
}

function cssSchluessel(vaultCss: VaultCss[], tinteSparen: boolean): string {
  return JSON.stringify([vaultCss, tinteSparen])
}

/** CSS, das Paged.js verarbeitet (Umbruchangaben aus dem Vault, druck.css), so wie es in den style-Elementen steht */
function pagedStile(vaultCss: VaultCss[]): string[] {
  return [...vaultCss.map((c) => c.umbruch), druckCss].map(cssSicher)
}

/**
 * „<“ als CSS-Escape: ein „</style>“ in Theme oder Snippet aus dem Vault darf das style-Element nicht beenden
 * (sonst liefe dahinter stehendes HTML samt <script> mit Zugriff auf den Vault). In CSS bedeutet \3c dasselbe.
 */
function cssSicher(css: string): string {
  return urlsAbsolut(css).replace(/</g, '\\3c ')
}

function seiteBauen(html: string, vaultCss: VaultCss[], titel: string, fassung: number, tinteSparen: boolean): string {
  // nativ = an Paged.js vorbei, der Browser wendet das CSS direkt an (siehe stil/aufteilen.ts)
  const nativ = (css: string) => `<style data-pagedjs-ignore>${cssSicher(css)}</style>`
  // Reihenfolge wie in Obsidian: Grundstil, dann Theme und Snippets; das Druck-Stylesheet hat Vorrang
  // (Paged.js hängt die verarbeiteten Stylesheets hinter die nativen)
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${titel.replace(/</g, '&lt;')}</title>
${nativ(SCHRIFTEN)}${nativ(obsidianBasis)}${vaultCss.map((c) => nativ(c.nativ)).join('')}
${pagedStile(vaultCss).map((css) => `<style>${css}</style>`).join('')}
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
