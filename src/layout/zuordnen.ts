// Ordnet Layout-Einträge den Blöcken der aktuellen Notiz zu und wendet sie im HTML an.
//
// Stufen nach Spezifikation:
//   1. alle vier Merkmale gleich              -> still anwenden
//   2. Pfad + Typ gleich, Text ähnlich (≥70 %)
//      oder nur die Position verschoben       -> anwenden, gelb melden
//   3. sonst                                  -> nicht anwenden, rot melden (Eintrag bleibt in der Datei)

import type { Block } from '../dokument/bloecke'
import type { Hinweis } from '../hinweise'
import { pruefsumme } from '../dokument/bloecke'
import type { Anker, BlockTyp, LayoutDatei, LayoutEintrag } from './layoutDatei'

const MAX_WOERTER = 64

export function ankerVon(block: Block): Anker {
  return block.typ === 'image'
    ? { path: block.pfad, type: 'image', image: block.bild, index: block.index }
    : { path: block.pfad, type: block.typ, index: block.index, hash: block.hash, words: wortPruefsummen(block.text) }
}

function wortPruefsummen(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .slice(0, MAX_WOERTER)
    .map((w) => pruefsumme(w).slice(0, 4))
    .join('')
}

/** Sucht den Block zu einem Anker. Liefert Block und ob die Zuordnung sicher ist. */
export function blockFinden(anker: Anker, bloecke: Block[]): { block: Block; sicher: boolean } | null {
  if (anker.type === 'image') {
    const gleicheBilder = bloecke.filter((b) => b.typ === 'image' && b.bild === anker.image)
    const imPfad = gleicheBilder.filter((b) => gleicherPfad(b.pfad, anker.path))
    // Dasselbe Bild mehrmals im Abschnitt: die Position (index) unterscheidet die Kopien. Ältere Anker ohne index
    // meinen die erste Kopie.
    const genau = imPfad.find((b) => b.index === anker.index) ?? (anker.index === undefined || imPfad.length === 1 ? imPfad[0] : undefined)
    if (genau) return { block: genau, sicher: true }
    if (imPfad.length > 0) return { block: imPfad[0], sicher: false }
    return gleicheBilder.length === 1 ? { block: gleicheBilder[0], sicher: false } : null
  }
  // Fußnoten gibt es einmal pro Notiz; ältere Anker tragen noch den Pfad des letzten Abschnitts
  if (anker.type === 'footnotes') {
    const fussnoten = bloecke.find((b) => b.typ === 'footnotes')
    return fussnoten ? { block: fussnoten, sicher: true } : null
  }
  const kandidaten = bloecke.filter((b) => b.typ === anker.type && gleicherPfad(b.pfad, anker.path))
  const exakt = kandidaten.find((b) => b.hash === anker.hash && b.index === anker.index)
  if (exakt) return { block: exakt, sicher: true }
  // Position verschoben, Text gleich
  const verschoben = kandidaten.find((b) => b.hash === anker.hash)
  if (verschoben) return { block: verschoben, sicher: false }
  // Text geändert: ähnlichsten Block mit mindestens 70 % gleichen Wörtern nehmen
  let bester: Block | null = null
  let besteAehnlichkeit = 0.7
  for (const b of kandidaten) {
    const a = aehnlichkeit(anker.words ?? '', wortPruefsummen(b.text))
    if (a > besteAehnlichkeit || (a === besteAehnlichkeit && !bester)) [bester, besteAehnlichkeit] = [b, a]
  }
  return bester ? { block: bester, sicher: false } : null
}

function gleicherPfad(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/** Anteil gemeinsamer Wörter (Dice-Koeffizient) zweier Wort-Prüfsummen-Ketten. */
function aehnlichkeit(a: string, b: string): number {
  const wa = a.match(/.{4}/g) ?? []
  const wb = b.match(/.{4}/g) ?? []
  if (wa.length === 0 || wb.length === 0) return 0
  const rest = new Map<string, number>()
  for (const w of wb) rest.set(w, (rest.get(w) ?? 0) + 1)
  let gemeinsam = 0
  for (const w of wa) {
    const n = rest.get(w) ?? 0
    if (n > 0) {
      gemeinsam++
      rest.set(w, n - 1)
    }
  }
  return (2 * gemeinsam) / (wa.length + wb.length)
}

/** Wendet das Layout im DOM an und liefert die Hinweise dazu. */
export function layoutAnwenden(wurzel: HTMLElement, layout: LayoutDatei, bloecke: Block[], notizPfad: string): Hinweis[] {
  const hinweise: Hinweis[] = []
  // Block-ID -> Index des zugeordneten Eintrags: ein zweiter Eintrag für denselben Block wird rot gemeldet
  const zuordnung = new Map<string, number>()
  const ausblenden: HTMLElement[] = []
  if (layout.settings.fontSizePt) wurzel.style.fontSize = `${layout.settings.fontSizePt}pt`
  if (layout.settings.lineHeight) wurzel.style.lineHeight = String(layout.settings.lineHeight)

  layout.items.forEach((eintrag, i) => {
    const treffer = blockFinden(eintrag.anchor, bloecke)
    const beschreibung = `${eintrag.anchor.path.join(' › ')} (${typName(eintrag.anchor.type)})`
    if (!treffer || zuordnung.has(treffer.block.id)) {
      hinweise.push({ stufe: 'rot', notiz: notizPfad, text: `Layout nicht zugeordnet: ${beschreibung}`, layoutEintrag: i, art: 'zuordnung' })
      return
    }
    const block = treffer.block.id
    zuordnung.set(block, i)
    if (!treffer.sicher) {
      hinweise.push({ stufe: 'gelb', notiz: notizPfad, text: `Layout unsicher zugeordnet: ${beschreibung}`, layoutEintrag: i, art: 'zuordnung', block })
    }
    const el = wurzel.querySelector<HTMLElement>(`[data-block="${block}"]`)
    if (!el) return
    if (eintrag.hidden) {
      // Vom Nutzer gewollt, aber nie stillschweigend: steht in der Hinweisliste mit "Einblenden"
      const titel = treffer.block.typ === 'heading' ? `Abschnitt „${treffer.block.pfad.at(-1)}“` : `${typName(treffer.block.typ)} in „${treffer.block.pfad.at(-1)}“`
      hinweise.push({ stufe: 'info', notiz: notizPfad, text: `Im Druck ausgeblendet: ${titel}`, layoutEintrag: i, art: 'ausgeblendet', block })
      ausblenden.push(abschnittOderBlock(el))
    } else {
      eintragAnwenden(el, eintrag)
      const bild = eintrag.image
      if (bild?.wrap) {
        const melden = (text: string) => hinweise.push({ stufe: 'gelb', notiz: notizPfad, text: `${text}: ${beschreibung}`, layoutEintrag: i, art: 'zuordnung', block })
        if (bild.before) bildVersetzen(wurzel, el, bild.before, bloecke, melden)
        if (bild.offsetYMm && bild.offsetYMm > 0) umflussAbstand(el, bild.offsetYMm)
      }
    }
  })
  // Erst am Ende entfernen, damit verschachtelte Blöcke vorher noch gefunden werden
  for (const el of ausblenden) el.remove()
  return hinweise
}

/**
 * Umfließendes Bild vor seinen Bezugsblock setzen (nur innerhalb desselben Abschnitts, damit Ausblenden und
 * Auszüge weiter für das Bild gelten). Ohne Bezugsblock bleibt das Bild an seiner Stelle in der Notiz.
 */
function bildVersetzen(wurzel: HTMLElement, bild: HTMLElement, anker: Anker, bloecke: Block[], melden: (text: string) => void) {
  const treffer = blockFinden(anker, bloecke)
  const ziel = treffer && wurzel.querySelector<HTMLElement>(`[data-block="${treffer.block.id}"]`)
  if (!ziel || ziel === bild || ziel.parentElement !== bild.parentElement) {
    melden('Bild steht an der ursprünglichen Stelle, Bezugsabsatz nicht gefunden')
    return
  }
  if (!treffer.sicher) melden('Bildposition unsicher zugeordnet')
  ziel.before(bild)
}

/**
 * Umfließendes Bild tiefer im Absatz: ein unsichtbarer Float ohne Breite davor hält die Höhe frei, das Bild steht
 * darunter (clear). Der Text fließt über dem Bild in voller Breite; Kästen daneben weichen nur dem Bild aus.
 */
function umflussAbstand(bild: HTMLElement, mm: number) {
  const platz = bild.ownerDocument.createElement('div')
  platz.className = 'umfluss-abstand'
  platz.dataset.ausrichtung = bild.dataset.ausrichtung === 'left' ? 'left' : 'right'
  platz.style.height = `${mm}mm`
  bild.before(platz)
  bild.classList.add('nach-abstand')
}

/** Bei einer Überschrift am Anfang ihres Abschnitts gilt eine Änderung für den ganzen Abschnitt. */
function abschnittOderBlock(el: HTMLElement): HTMLElement {
  const section = el.parentElement
  return /^H[2-6]$/.test(el.tagName) && section?.tagName === 'SECTION' && section.firstElementChild === el ? section : el
}

const TYP_NAMEN: Record<BlockTyp, string> = {
  heading: 'Überschrift',
  paragraph: 'Absatz',
  list: 'Liste',
  table: 'Tabelle',
  callout: 'Callout',
  image: 'Bild',
  code: 'Codeblock',
  math: 'Formel',
  diagram: 'Diagramm',
  footnotes: 'Fußnoten',
  other: 'Block',
}

export function typName(typ: BlockTyp): string {
  return TYP_NAMEN[typ] ?? typ
}

function eintragAnwenden(el: HTMLElement, e: LayoutEintrag) {
  const ziel = abschnittOderBlock(el)
  if (e.pageBreakBefore === true) ziel.classList.add('umbruch-vor')
  if (e.pageBreakBefore === false) ziel.classList.add('kein-umbruch-vor')
  if (e.spaceBeforeMm !== undefined) el.style.marginTop = `${e.spaceBeforeMm}mm`
  if (e.spaceAfterMm !== undefined) el.style.marginBottom = `${e.spaceAfterMm}mm`
  if (e.fontSizePt !== undefined) el.style.fontSize = `${e.fontSizePt}pt`
  if (e.lineHeight !== undefined) el.style.lineHeight = String(e.lineHeight)
  if (e.split) ziel.classList.add('teilbar')

  const tabelle = e.table
  if (tabelle && el.tagName === 'TABLE') {
    if (tabelle.widthPct !== undefined) el.style.width = `${tabelle.widthPct}%`
    if (tabelle.align) el.dataset.ausrichtung = tabelle.align
    if (tabelle.columnsPct) spaltenSetzen(el as HTMLTableElement, tabelle.columnsPct)
    if (tabelle.fontSizePt !== undefined) el.style.fontSize = `${tabelle.fontSizePt}pt`
    if (tabelle.compact) el.classList.add('kompakt')
    if (tabelle.split) el.classList.add('teilbar')
  }

  const bild = e.image
  if (bild) {
    const img = el.querySelector<HTMLImageElement>('img')
    if (bild.widthMm !== undefined && img) {
      img.style.width = `${bild.widthMm}mm`
      img.style.maxHeight = 'none'
    }
    if (bild.align) el.dataset.ausrichtung = bild.align
    if (bild.wrap) {
      el.classList.add('umfliessen')
      if (bild.wrapGapMm !== undefined) el.style.setProperty('--umfluss-abstand', `${bild.wrapGapMm}mm`)
    } else if (bild.offsetYMm !== undefined) el.style.marginTop = `${bild.offsetYMm}mm`
  }
}

/** Feste Spaltenbreiten (in % der Tabellenbreite) über ein colgroup setzen – auch live beim Ziehen. */
export function spaltenSetzen(tabelle: HTMLTableElement, prozent: number[]): void {
  tabelle.querySelector(':scope > colgroup')?.remove()
  const gruppe = tabelle.ownerDocument.createElement('colgroup')
  for (const p of prozent) {
    const col = tabelle.ownerDocument.createElement('col')
    col.style.width = `${p}%`
    gruppe.append(col)
  }
  tabelle.prepend(gruppe)
  tabelle.style.tableLayout = 'fixed'
}
