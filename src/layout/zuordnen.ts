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
import type { Anker, LayoutDatei, LayoutEintrag } from './layoutDatei'

const MAX_WOERTER = 64

export function ankerVon(block: Block): Anker {
  return block.typ === 'image'
    ? { path: block.pfad, type: 'image', image: block.bild }
    : { path: block.pfad, type: block.typ, index: block.index, hash: block.hash, words: wortPruefsummen(block.text) }
}

export function wortPruefsummen(text: string): string {
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
    const imPfad = gleicheBilder.find((b) => gleicherPfad(b.pfad, anker.path))
    if (imPfad) return { block: imPfad, sicher: true }
    return gleicheBilder.length === 1 ? { block: gleicheBilder[0], sicher: false } : null
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
export function aehnlichkeit(a: string, b: string): number {
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

/** Wendet das Layout im DOM an und liefert die Hinweise zur Zuordnung. */
export function layoutAnwenden(
  wurzel: HTMLElement,
  layout: LayoutDatei,
  bloecke: Block[],
  notizPfad: string,
): Hinweis[] {
  const hinweise: Hinweis[] = []
  if (layout.settings.fontSizePt) wurzel.style.fontSize = `${layout.settings.fontSizePt}pt`

  layout.items.forEach((eintrag, i) => {
    const treffer = blockFinden(eintrag.anchor, bloecke)
    const beschreibung = `${eintrag.anchor.path.join(' › ')} (${eintrag.anchor.type})`
    if (!treffer) {
      hinweise.push({ stufe: 'rot', notiz: notizPfad, text: `Layout nicht zugeordnet: ${beschreibung}`, layoutEintrag: i })
      return
    }
    if (!treffer.sicher) {
      hinweise.push({ stufe: 'gelb', notiz: notizPfad, text: `Layout unsicher zugeordnet: ${beschreibung}`, layoutEintrag: i })
    }
    const el = wurzel.querySelector<HTMLElement>(`[data-block="${treffer.block.id}"]`)
    if (el) eintragAnwenden(el, eintrag)
  })
  return hinweise
}

function eintragAnwenden(el: HTMLElement, e: LayoutEintrag) {
  // Umbruch vor einer Überschrift gilt für ihren ganzen Abschnitt
  const ziel = /^H[2-4]$/.test(el.tagName) && el.parentElement?.firstElementChild === el ? el.parentElement : el
  if (e.pageBreakBefore === true) ziel.classList.add('umbruch-vor')
  if (e.pageBreakBefore === false) ziel.classList.add('kein-umbruch-vor')
  if (e.spaceBeforeMm !== undefined) el.style.marginTop = `${e.spaceBeforeMm}mm`
  if (e.spaceAfterMm !== undefined) el.style.marginBottom = `${e.spaceAfterMm}mm`

  const bild = e.image
  if (bild) {
    const img = el.querySelector<HTMLImageElement>('img')
    if (bild.widthMm !== undefined && img) {
      img.style.width = `${bild.widthMm}mm`
      img.style.maxHeight = 'none'
    }
    if (bild.align) el.dataset.ausrichtung = bild.align
    if (bild.wrap) el.classList.add('umfliessen')
    if (bild.offsetYMm !== undefined) el.style.marginTop = `${bild.offsetYMm}mm`
  }
}
