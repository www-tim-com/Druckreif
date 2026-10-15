// Nachbearbeitung des HTML einer Notiz im DOM:
// Titel, Bild mit Beschriftung, Abschnitts-Container und Blöcke mit Fingerabdruck.

import type { BlockTyp } from '../layout/layoutDatei'

/** Ein Block der Notiz: daran hängen alle manuellen Layout-Änderungen. */
export interface Block {
  id: string // data-block im HTML, nur für diese Darstellung gültig
  pfad: string[] // Überschriftenpfad, z. B. ["Atmung", "Asthma", "Therapie"]
  typ: BlockTyp
  index: number // der wievielte Block dieses Typs im Abschnitt
  hash: string // Prüfsumme des normalisierten Texts
  bild?: string // Dateiname bei Bildern
  text: string // normalisierter Text, für die Ähnlichkeitsprüfung
}

export interface Gegliedert {
  titel: string
  bloecke: Block[]
  /** weitere #-Überschriften, die als ##-Kapitel behandelt wurden */
  weitereTitel: string[]
}

/**
 * Gliedert den Inhalt von `wurzel` (enthält das HTML einer Notiz) in Kapitel, Abschnitte, Unterabschnitte
 * und markiert jeden Block mit `data-block`. `praefix` macht die Block-IDs pro Notiz eindeutig.
 */
export function gliedern(wurzel: HTMLElement, dateiname: string, praefix: string): Gegliedert {
  const dok = wurzel.ownerDocument
  leereAbsaetzeEntfernen(wurzel)
  bilderMitBeschriftung(wurzel)

  // Titel: erste #-Überschrift, wenn vorher nichts steht; sonst der Dateiname
  let titel = dateiname
  const erstes = wurzel.firstElementChild
  if (erstes?.tagName === 'H1') {
    titel = erstes.textContent ?? dateiname
  } else {
    const h1 = dok.createElement('h1')
    h1.textContent = dateiname
    wurzel.prepend(h1)
  }
  h1Markieren(wurzel.firstElementChild as HTMLElement)

  // Weitere # werden wie ## behandelt (Text bleibt gleich, nur die Ebene ändert sich)
  const weitereTitel: string[] = []
  for (const h1 of [...wurzel.querySelectorAll(':scope > h1')].slice(1)) {
    const h2 = dok.createElement('h2')
    h2.innerHTML = h1.innerHTML
    h1.replaceWith(h2)
    weitereTitel.push(h2.textContent ?? '')
  }

  // Abschnitts-Container: section.kapitel (##) > section.abschnitt (###) > section.unterabschnitt (####)
  const ebenenKlasse: Record<number, string> = { 2: 'kapitel', 3: 'abschnitt', 4: 'unterabschnitt' }
  const stapel: { ebene: number; el: HTMLElement }[] = [{ ebene: 1, el: wurzel }]
  const bloecke: Block[] = []
  const pfad: string[] = [titel]
  const zaehler = new Map<string, number>()

  for (const el of [...wurzel.children] as HTMLElement[]) {
    const ebene = /^H([1-6])$/.exec(el.tagName) ? Number(el.tagName[1]) : 0
    if (ebene >= 2 && ebene <= 4) {
      while (stapel[stapel.length - 1].ebene >= ebene) stapel.pop()
      const section = dok.createElement('section')
      section.className = ebenenKlasse[ebene]
      stapel[stapel.length - 1].el.append(section)
      stapel.push({ ebene, el: section })
    }
    if (ebene >= 2) {
      pfad.length = ebene - 1
      pfad[ebene - 1] = el.textContent?.trim() ?? ''
      // Ebenen ohne Überschrift dazwischen (z. B. ## direkt auf ####) nicht als Lücke speichern
      for (let i = 0; i < pfad.length; i++) pfad[i] ??= ''
    }
    if (ebene !== 1) stapel[stapel.length - 1].el.append(el)

    const typ: BlockTyp = ebene ? 'heading' : blockTyp(el)
    const bildname = typ === 'image' ? el.querySelector('img')?.getAttribute('data-bild') ?? '' : undefined
    const text = normalisieren(el.textContent ?? '')
    const blockPfad = pfad.filter(Boolean)
    const schluessel = blockPfad.join('>') + '|' + typ
    const index = zaehler.get(schluessel) ?? 0
    zaehler.set(schluessel, index + 1)

    const id = `${praefix}-${bloecke.length}`
    el.setAttribute('data-block', id)
    bloecke.push({ id, pfad: blockPfad, typ, index, hash: bildname ?? pruefsumme(text), bild: bildname, text })
  }
  return { titel, bloecke, weitereTitel }
}

function h1Markieren(h1: HTMLElement) {
  h1.classList.add('notiz-titel')
}

function blockTyp(el: HTMLElement): BlockTyp {
  switch (el.tagName) {
    case 'P':
      return 'paragraph'
    case 'UL':
    case 'OL':
      return 'list'
    case 'TABLE':
      return 'table'
    case 'FIGURE':
      return 'image'
    case 'PRE':
      return 'code'
  }
  if (el.classList.contains('callout')) return 'callout'
  if (el.classList.contains('mermaid-diagramm')) return 'diagram'
  if (el.querySelector('.katex-display')) return 'math'
  if (el.classList.contains('footnotes')) return 'footnotes'
  return 'other'
}

function leereAbsaetzeEntfernen(wurzel: HTMLElement) {
  for (const p of wurzel.querySelectorAll('p')) {
    if (!p.textContent?.trim() && !p.querySelector('img, .bild-fehlt, input, .katex')) p.remove()
  }
}

/**
 * Ein Absatz nur mit einem Bild wird zu figure; eine vollständig kursive Zeile direkt darunter
 * (im selben Absatz nach <br> oder als nächster Absatz) wird zur Beschriftung.
 */
function bilderMitBeschriftung(wurzel: HTMLElement) {
  const dok = wurzel.ownerDocument
  for (const p of [...wurzel.querySelectorAll(':scope > p')] as HTMLElement[]) {
    const knoten = [...p.childNodes].filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()))
    if (knoten[0]?.nodeName !== 'IMG') continue

    let beschriftung: Element | null = null
    if (knoten.length === 3 && knoten[1].nodeName === 'BR' && knoten[2].nodeName === 'EM') {
      beschriftung = knoten[2] as Element
    } else if (knoten.length !== 1) {
      continue // Bild mitten im Text bleibt, wo es ist
    } else {
      const naechster = p.nextElementSibling
      const inhalt = naechster ? [...naechster.childNodes].filter((n) => n.textContent?.trim()) : []
      if (naechster?.tagName === 'P' && inhalt.length === 1 && inhalt[0].nodeName === 'EM') {
        beschriftung = inhalt[0] as Element
        naechster.remove()
      }
    }

    const figure = dok.createElement('figure')
    figure.className = 'bild-block'
    figure.append(knoten[0])
    if (beschriftung) {
      const caption = dok.createElement('figcaption')
      caption.append(beschriftung)
      figure.append(caption)
    }
    p.replaceWith(figure)
  }
}

export function normalisieren(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** FNV-1a, 6 Hex-Zeichen – reicht zum Wiedererkennen innerhalb einer Notiz. */
export function pruefsumme(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6)
}
