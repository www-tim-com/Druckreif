// Änderungen an einer Layout-Datei als reine Funktionen: alt rein, neu raus.
// Rückgängig/Wiederholen ist deshalb nur ein Stapel von Layouts (siehe App.tsx).

import type { Block } from '../dokument/bloecke'
import {
  type BildLayout,
  type LayoutDatei,
  type TabellenLayout,
  type LayoutEintrag,
  STANDARD_SCHRIFT_PT,
  STANDARD_ZEILENABSTAND,
  eintragLeer,
} from './layoutDatei'
import { ankerVon } from './zuordnen'

/**
 * Ändert den Eintrag eines Blocks (legt ihn an, falls es keinen gibt). `index` ist der bereits
 * zugeordnete Eintrag im aktuellen Layout (siehe blockSuchen in App.tsx). Leere Einträge fallen weg.
 */
export function eintragAendern(
  layout: LayoutDatei,
  block: Block,
  index: number | undefined,
  aendern: (e: LayoutEintrag) => LayoutEintrag,
): LayoutDatei {
  const alt: LayoutEintrag = index !== undefined ? layout.items[index] : { anchor: ankerVon(block) }
  // Anker auffrischen, damit er zum aktuellen Text passt (aus gelb wird wieder sicher)
  const neu = aendern({ ...alt, anchor: ankerVon(block) })
  const items = [...layout.items]
  if (index !== undefined) items.splice(index, 1)
  if (!eintragLeer(neu)) items.splice(index ?? items.length, 0, neu)
  return { ...layout, items }
}

/** Eintrag über seinen Index ändern, Anker bleibt (z. B. „Einblenden“ in der Hinweisliste). */
export function eintragAnIndex(layout: LayoutDatei, index: number, aendern: (e: LayoutEintrag) => LayoutEintrag): LayoutDatei {
  const neu = aendern(layout.items[index])
  const items = [...layout.items]
  if (eintragLeer(neu)) items.splice(index, 1)
  else items[index] = neu
  return { ...layout, items }
}

/** Seitenumbruch davor: true = erzwingen, false = verhindern, undefined = automatisch */
export function umbruchSetzen(wert: boolean | undefined) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, pageBreakBefore: wert })
}

/** Umbruch erzwingen (true) bzw. verhindern (false) – oder zurück auf automatisch, wenn er das schon ist */
export function umbruchUmschalten(wert: boolean) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, pageBreakBefore: e.pageBreakBefore === wert ? undefined : wert })
}

/** Objekt ohne Schlüssel mit undefined; ganz leer = undefined (Layout-Datei bleibt aufgeräumt) */
function ohneLeere<T extends object>(objekt: T): T | undefined {
  const kopie = { ...objekt }
  for (const k of Object.keys(kopie) as (keyof T)[]) if (kopie[k] === undefined) delete kopie[k]
  return Object.keys(kopie).length ? kopie : undefined
}

/** Darf über Seiten geteilt werden (true) oder bleibt am Stück (automatisch) */
export function teilenSetzen(wert: boolean) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, split: wert || undefined })
}

export function ausblendenSetzen(wert: boolean) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, hidden: wert || undefined })
}

export function abstandSetzen(vorher: number | undefined, nachher: number | undefined) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, spaceBeforeMm: vorher, spaceAfterMm: nachher })
}

/** Bildwerte überschreiben; undefined in `teil` setzt den Wert auf automatisch zurück. */
export function bildSetzen(teil: Partial<BildLayout>) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, image: ohneLeere({ ...e.image, ...teil }) })
}

export function bildZuruecksetzen(e: LayoutEintrag): LayoutEintrag {
  return { ...e, image: undefined }
}

/**
 * Textumbruch an (Bild schwebt links oder rechts, Text fließt herum) oder aus (Bild wieder als eigene Zeile an
 * seiner Stelle in der Notiz; Bezugsabsatz und Abstände des Umbruchs fallen weg).
 */
export function umfliessenSetzen(an: boolean) {
  return (e: LayoutEintrag): LayoutEintrag =>
    an
      ? bildSetzen({ wrap: true, align: e.image?.align === 'left' ? 'left' : 'right' })(e)
      : bildSetzen({ wrap: undefined, before: undefined, wrapGapMm: undefined, offsetYMm: undefined })(e)
}

export const MAX_BILDVERSATZ_MM = 150
/** Bild ohne Textumbruch darf etwas nach oben rücken (negativer Abstand oben) */
export const MIN_BILDVERSATZ_MM = -30
/** Textbreite: A4 (210 mm) minus Seitenränder 25 + 18 mm aus @page in druck.css */
export const TEXTBREITE_MM = 167

/** Bild um `dy` mm nach unten/oben schieben (Ziehen), in den erlaubten Grenzen */
export function bildVerschieben(align: BildLayout['align'], dy: number) {
  return (e: LayoutEintrag): LayoutEintrag => {
    const min = e.image?.wrap ? 0 : MIN_BILDVERSATZ_MM
    const versatz = Math.min(MAX_BILDVERSATZ_MM, Math.max(min, (e.image?.offsetYMm ?? 0) + dy))
    return bildSetzen({ align, offsetYMm: versatz || undefined })(e)
  }
}

/**
 * Wohin ein umfließendes Bild nach dem Ziehen gehört: vor den Block `zielId`, `versatzMm` unter dessen Anfang.
 * Nur innerhalb des Abschnitts des Bildes; sonst null. Eine Überschrift zählt als Anfang ihres Abschnitts.
 */
export function umflussPosition(bloecke: Block[], bildId: string, zielId: string, versatzMm: number): Partial<BildLayout> | null {
  const bild = bloecke.findIndex((b) => b.id === bildId)
  let ziel = bloecke.findIndex((b) => b.id === zielId)
  if (bild < 0 || ziel < 0) return null
  const gleich = (i: number) => bloecke[i]?.pfad.join('>') === bloecke[bild].pfad.join('>')
  if (!gleich(ziel)) return null
  if (bloecke[ziel].typ === 'heading') {
    ziel++
    versatzMm = 0
    if (!gleich(ziel)) return null
  }
  if (ziel === bild) return null
  const versatz = Math.round(Math.min(MAX_BILDVERSATZ_MM, Math.max(0, versatzMm)))
  // Direkt vor dem Block, der in der Notiz ohnehin auf das Bild folgt: ursprüngliche Stelle, kein Bezug nötig
  return { before: ziel === bild + 1 ? undefined : ankerVon(bloecke[ziel]), offsetYMm: versatz || undefined }
}

/** Tabellenwerte überschreiben; undefined setzt zurück. */
export function tabelleSetzen(teil: Partial<TabellenLayout>) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, table: ohneLeere({ ...e.table, ...teil }) })
}

/** Breite in % der Textbreite; 100 % und mehr = automatisch */
export function tabellenBreiteSetzen(prozent: number | undefined) {
  return tabelleSetzen({ widthPct: prozent === undefined || prozent >= 100 ? undefined : prozent })
}

export function tabelleZuruecksetzen(e: LayoutEintrag): LayoutEintrag {
  return { ...e, table: undefined }
}

/** Schriftgröße und Zeilenabstand eines Blocks */
export function schriftSetzen(teil: { fontSizePt?: number; lineHeight?: number }) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, ...teil })
}

export function eintragZuruecksetzen(e: LayoutEintrag): LayoutEintrag {
  return { anchor: e.anchor }
}

export function eintragLoeschen(layout: LayoutDatei, index: number): LayoutDatei {
  return { ...layout, items: layout.items.filter((_, i) => i !== index) }
}

/**
 * Nicht zugeordneten (roten) Eintrag einem Block zuweisen: Anker neu setzen, Werte behalten.
 * Hat der Block schon einen Eintrag (`zielIndex`), wird dieser ersetzt.
 */
export function eintragZuweisen(layout: LayoutDatei, index: number, block: Block, zielIndex?: number): LayoutDatei {
  const items = layout.items
    .map((e, i) => (i === index ? { ...e, anchor: ankerVon(block) } : e))
    .filter((_, i) => i !== zielIndex || zielIndex === index)
  return { ...layout, items }
}

/** Grundschrift und Zeilenabstand der ganzen Notiz; der Standardwert wird nicht gespeichert (bleibt automatisch) */
export function notizSchriftSetzen(layout: LayoutDatei, teil: Partial<LayoutDatei['settings']>): LayoutDatei {
  const settings = { ...layout.settings, ...teil }
  if (settings.fontSizePt === STANDARD_SCHRIFT_PT) settings.fontSizePt = undefined
  if (settings.lineHeight === STANDARD_ZEILENABSTAND) settings.lineHeight = undefined
  return { ...layout, settings: ohneLeere(settings) ?? {} }
}

/** Eingebettete Notiz einfügen (an) oder wieder nur als Hinweis führen (aus). */
export function einbettungSetzen(layout: LayoutDatei, ziel: string, an: boolean): LayoutDatei {
  const alt = (layout.settings.embeds ?? []).filter((z) => z !== ziel)
  const embeds = an ? [...alt, ziel] : alt
  return notizSchriftSetzen(layout, { embeds: embeds.length ? embeds : undefined })
}

export function layoutZuruecksetzen(layout: LayoutDatei): LayoutDatei {
  // Eingefügte Notizen sind Inhalt, kein Layout – bleiben beim Zurücksetzen erhalten
  const { embeds } = layout.settings
  return { ...layout, settings: embeds ? { embeds } : {}, items: [] }
}
