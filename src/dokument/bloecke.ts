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
  /** Bild oder Tabelle innerhalb eines anderen Blocks (Liste, Callout, Zitat) */
  eingerueckt?: boolean
}

interface Gegliedert {
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
  wurzel.firstElementChild!.classList.add('notiz-titel')

  // Weitere # werden wie ## behandelt (Text bleibt gleich, nur die Ebene ändert sich)
  const weitereTitel: string[] = []
  for (const h1 of [...wurzel.querySelectorAll(':scope > h1')].slice(1)) {
    const h2 = dok.createElement('h2')
    h2.innerHTML = h1.innerHTML
    h1.replaceWith(h2)
    weitereTitel.push(h2.textContent ?? '')
  }

  // Abschnitts-Container: section.kapitel (##) > section.abschnitt (###) > section.unterabschnitt (####)
  // > section.ebene5 / ebene6 (nur damit Ausblenden auch dort den ganzen Abschnitt trifft)
  const ebenenKlasse: Record<number, string> = { 2: 'kapitel', 3: 'abschnitt', 4: 'unterabschnitt', 5: 'ebene5', 6: 'ebene6' }
  const stapel: { ebene: number; el: HTMLElement }[] = [{ ebene: 1, el: wurzel }]
  const bloecke: Block[] = []
  const pfad: string[] = [titel]
  const zaehler = new Map<string, number>()

  for (const el of [...wurzel.children] as HTMLElement[]) {
    const ebene = /^H([1-6])$/.exec(el.tagName) ? Number(el.tagName[1]) : 0
    if (ebene >= 2) {
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
    // Fußnoten gehören zur ganzen Notiz, nicht zum letzten Abschnitt (sonst verschwinden sie mit „Quellen“)
    const zurNotiz = el.classList.contains('footnotes') || el.classList.contains('footnotes-sep')
    if (zurNotiz) wurzel.append(el)
    else if (ebene !== 1) stapel[stapel.length - 1].el.append(el)
    // Platzhalter einer nicht eingefügten Notiz ist kein Block (sonst verschöbe er die Zählung der Absätze)
    if (el.classList.contains('nur-einbettung')) continue

    const typ: BlockTyp = ebene ? 'heading' : blockTyp(el)
    const bildname = typ === 'image' ? el.querySelector('img')?.getAttribute('data-bild') ?? '' : undefined
    const text = normalisieren(el.textContent ?? '')
    const blockPfad = zurNotiz ? [titel] : pfad.filter(Boolean)
    const schluessel = blockPfad.join('>') + '|' + typ
    const index = zaehler.get(schluessel) ?? 0
    zaehler.set(schluessel, index + 1)

    const id = `${praefix}-${bloecke.length}`
    el.setAttribute('data-block', id)
    bloecke.push({ id, pfad: blockPfad, typ, index, hash: bildname ?? pruefsumme(text), bild: bildname, text })
  }
  // Eingerückte Bilder und Tabellen (in Listen, Callouts, Zitaten) sind eigene Blöcke im Block darum: Größe,
  // Ausrichtung, Textumbruch wie oben. Erst nach allen anderen gezählt und angehängt, damit die Anker der
  // bisherigen Blöcke (index) gleich bleiben und blockFinden bei gleichem Index die nicht eingerückten zuerst findet.
  for (const aussen of bloecke.slice()) {
    if (aussen.typ === 'image' || aussen.typ === 'table' || aussen.typ === 'heading') continue
    const el = wurzel.querySelector<HTMLElement>(`[data-block="${aussen.id}"]`)
    // Eingefügte Notizen bleiben ein Block am Stück
    if (!el || el.classList.contains('einbettung-inhalt')) continue
    for (const innen of el.querySelectorAll<HTMLElement>('figure.bild-block, table')) {
      // Bilder in Tabellenzellen bleiben Teil der Tabelle
      if (innen.parentElement?.closest('td, th')) continue
      const typ: BlockTyp = innen.tagName === 'TABLE' ? 'table' : 'image'
      const bildname = typ === 'image' ? innen.querySelector('img')?.getAttribute('data-bild') ?? '' : undefined
      const text = normalisieren(innen.textContent ?? '')
      const schluessel = aussen.pfad.join('>') + '|' + typ
      const index = zaehler.get(schluessel) ?? 0
      zaehler.set(schluessel, index + 1)
      const id = `${praefix}-${bloecke.length}`
      innen.setAttribute('data-block', id)
      bloecke.push({ id, pfad: aussen.pfad, typ, index, hash: bildname ?? pruefsumme(text), bild: bildname, text, eingerueckt: true })
    }
  }
  // Export-Anweisung: „Ein Kapitel ohne ###-Abschnitte behandelst du als Ganzes wie einen Abschnitt.“
  for (const kapitel of wurzel.querySelectorAll('section.kapitel')) {
    if (!kapitel.querySelector(':scope > section.abschnitt')) kapitel.classList.add('am-stueck')
  }
  return { titel, bloecke, weitereTitel }
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
    if (!p.textContent?.trim() && !p.querySelector('img, .bild-fehlt, input, .katex, .einbettung')) p.remove()
  }
}

/**
 * Jede Zeile eines Absatzes, die nur aus Bildern besteht, wird zu einer eigenen figure (eigener Block: Größe,
 * Ausrichtung, Ziehen). Eine vollständig kursive Zeile direkt darunter (im selben Absatz nach <br> oder als
 * nächster Absatz) wird zur Beschriftung. Übrige Zeilen bleiben als Absatz stehen, Bilder mitten im Satz auch.
 * Gilt auch eingerückt: Absätze in Listen, Callouts und Zitaten sowie der Text direkt in einem Listenpunkt
 * (enge Liste ohne <p>) – Bilder in Tabellenzellen bleiben, wo sie sind.
 */
function bilderMitBeschriftung(wurzel: HTMLElement) {
  const dok = wurzel.ownerDocument
  const sichtbar = (zeile: Node[]) => zeile.filter((n) => !(n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()))
  const nurBilder = (zeile: Node[]) => sichtbar(zeile).length > 0 && sichtbar(zeile).every((n) => n.nodeName === 'IMG')
  const nurKursiv = (zeile: Node[]) => sichtbar(zeile).length === 1 && sichtbar(zeile)[0].nodeName === 'EM'

  function beschriften(figure: HTMLElement, em: Node) {
    const caption = dok.createElement('figcaption')
    caption.append(em)
    figure.append(caption)
  }

  /**
   * Inhalt in Zeilen (getrennt durch <br>) zerlegen und Bildzeilen zu figures machen. `absatz`: Textzeilen kommen
   * in neue <p> (Absatz), sonst bleiben sie lose stehen (Text direkt im Listenpunkt). null: keine Bildzeile.
   */
  function zerlegen(knoten: Node[], absatz: boolean): HTMLElement[] | Node[] | null {
    const zeilen: Node[][] = [[]]
    for (const n of knoten) {
      if (n.nodeName === 'BR') zeilen.push([])
      else zeilen[zeilen.length - 1].push(n)
    }
    if (!zeilen.some(nurBilder)) return null

    const neu: Node[] = []
    let text: Node[][] = []
    const textAbschliessen = () => {
      if (text.some((z) => sichtbar(z).length > 0)) {
        const teile: Node[] = []
        text.forEach((z, i) => {
          if (i > 0) teile.push(dok.createElement('br'))
          teile.push(...z)
        })
        if (absatz) {
          const p = dok.createElement('p')
          p.append(...teile)
          neu.push(p)
        } else neu.push(...teile)
      }
      text = []
    }
    for (const zeile of zeilen) {
      const vorher = neu[neu.length - 1] as HTMLElement | undefined
      if (nurBilder(zeile)) {
        textAbschliessen()
        for (const img of sichtbar(zeile)) {
          const figure = dok.createElement('figure')
          figure.className = 'bild-block'
          figure.append(img)
          neu.push(figure)
        }
      } else if (nurKursiv(zeile) && text.length === 0 && vorher?.nodeName === 'FIGURE' && !vorher.querySelector('figcaption')) {
        beschriften(vorher, sichtbar(zeile)[0])
      } else {
        text.push(zeile)
      }
    }
    textAbschliessen()
    return neu
  }

  const absaetze = wurzel.querySelectorAll<HTMLElement>(':scope > p, li > p, blockquote > p, .callout-content > p')
  for (const p of [...absaetze]) {
    // schon Beschriftung des vorigen Bildes; Tabellenzellen und eingefügte Notizen bleiben unverändert
    if (!p.parentElement || p.closest('td, th, .einbettung-inhalt')) continue
    const neu = zerlegen([...p.childNodes], true) as HTMLElement[] | null
    if (!neu) continue
    const letzte = neu[neu.length - 1]
    const naechster = p.nextElementSibling
    if (letzte.tagName === 'FIGURE' && !letzte.querySelector('figcaption') && naechster?.tagName === 'P') {
      // Nur wenn der Absatz aus nichts als der kursiven Zeile besteht – sonst gingen Bilder darin verloren
      const inhalt = [...naechster.childNodes]
      if (nurKursiv(inhalt)) {
        beschriften(letzte, sichtbar(inhalt)[0])
        naechster.remove()
      }
    }
    p.replaceWith(...neu)
  }

  // Enge Listen: der Text steht ohne <p> im Listenpunkt, bis zur ersten Unterliste o. Ä.
  for (const li of [...wurzel.querySelectorAll<HTMLElement>('li')]) {
    if (li.closest('td, th, .einbettung-inhalt')) continue
    const lose: Node[] = []
    for (const n of li.childNodes) {
      if (n.nodeType === Node.ELEMENT_NODE && /^(P|UL|OL|TABLE|BLOCKQUOTE|DIV|PRE|FIGURE|SECTION)$/.test(n.nodeName)) break
      lose.push(n)
    }
    const neu = zerlegen(lose, false)
    if (!neu) continue
    const danach = lose[lose.length - 1].nextSibling
    for (const n of lose) if (n.parentNode === li) li.removeChild(n)
    for (const n of neu) li.insertBefore(n, danach)
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
