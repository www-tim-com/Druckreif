// Suchen in der Seitenansicht (Strg+F), wie im Navigationsbereich von Word.
// Markiert wird mit der CSS Custom Highlight API – das DOM bleibt unverändert, der Umbruch also auch.

export interface Treffer {
  seite: number
  vorher: string
  text: string
  nachher: string
}

const MAX_TREFFER = 500
const KONTEXT = 32
const BLOCK = 'p, li, h1, h2, h3, h4, h5, h6, td, th, figcaption, pre, dt, dd, .callout-title, .katex-display'
const bereicheJeDokument = new WeakMap<Document, Range[]>()

/** Alle Fundstellen (ohne Groß-/Kleinschreibung) im Seiteninhalt, markiert; der aktive Treffer zusätzlich. */
export function suchen(dok: Document, begriff: string): Treffer[] {
  const gesucht = begriff.trim().toLowerCase()
  const bereiche: Range[] = []
  const treffer: Treffer[] = []
  if (gesucht.length >= 2) {
    // Alle Textknoten des Seiteninhalts hintereinander, damit auch über Formatierungen hinweg gefunden wird
    const knoten: Text[] = []
    const anfang: number[] = []
    let gesamt = ''
    const gaenger = dok.createTreeWalker(dok.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement?.closest('.pagedjs_page_content') && !n.parentElement.closest('.druckreif-leerraum, style, script')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    })
    let letzterBlock: Element | null = null
    for (let n = gaenger.nextNode(); n; n = gaenger.nextNode()) {
      // Zwischen zwei Blöcken (Absatz, Zelle, Listenpunkt …) ein Zeilenumbruch: kein Treffer über die Grenze hinweg
      const block = n.parentElement!.closest(BLOCK)
      if (letzterBlock && block !== letzterBlock) gesamt += '\n'
      letzterBlock = block
      knoten.push(n as Text)
      anfang.push(gesamt.length)
      gesamt += n.textContent ?? ''
    }
    const klein = gesamt.toLowerCase()
    const stelle = (pos: number) => {
      let i = anfang.length - 1
      while (i > 0 && anfang[i] > pos) i--
      return { knoten: knoten[i], versatz: pos - anfang[i] }
    }
    for (let pos = klein.indexOf(gesucht); pos >= 0 && treffer.length < MAX_TREFFER; pos = klein.indexOf(gesucht, pos + gesucht.length)) {
      const start = stelle(pos)
      const ende = stelle(pos + gesucht.length - 1)
      const bereich = dok.createRange()
      bereich.setStart(start.knoten, start.versatz)
      bereich.setEnd(ende.knoten, ende.versatz + 1)
      bereiche.push(bereich)
      const seite = start.knoten.parentElement?.closest<HTMLElement>('.pagedjs_page')?.dataset.pageNumber
      const eng = (t: string) => t.replace(/\s+/g, ' ')
      treffer.push({
        seite: Number(seite ?? 0),
        vorher: eng(gesamt.slice(Math.max(0, pos - KONTEXT), pos)).trimStart(),
        text: gesamt.slice(pos, pos + gesucht.length),
        nachher: eng(gesamt.slice(pos + gesucht.length, pos + gesucht.length + KONTEXT)).trimEnd(),
      })
    }
  }
  bereicheJeDokument.set(dok, bereiche)
  return treffer
}

/** Markierungen setzen; `scrollen` holt den aktiven Treffer in die Mitte der Ansicht. */
export function trefferZeigen(dok: Document, aktiv: number, scrollen: boolean): void {
  const fenster = dok.defaultView as (Window & typeof globalThis) | null
  if (!fenster?.CSS?.highlights) return
  const bereiche = bereicheJeDokument.get(dok) ?? []
  fenster.CSS.highlights.set('druckreif-suche', new fenster.Highlight(...bereiche))
  const aktuell = bereiche[aktiv]
  fenster.CSS.highlights.set('druckreif-suche-aktiv', new fenster.Highlight(...(aktuell ? [aktuell] : [])))
  if (aktuell && scrollen) {
    const r = aktuell.getBoundingClientRect()
    fenster.scrollBy({ top: r.top - fenster.innerHeight / 2, left: 0, behavior: 'smooth' })
  }
}
