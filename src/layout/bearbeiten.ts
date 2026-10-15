// Änderungen an einer Layout-Datei als reine Funktionen: alt rein, neu raus.
// Rückgängig/Wiederholen ist deshalb nur ein Stapel von Layouts (siehe App.tsx).

import type { Block } from '../dokument/bloecke'
import { type BildLayout, type LayoutDatei, type TabellenLayout, type LayoutEintrag, eintragLeer } from './layoutDatei'
import { ankerVon } from './zuordnen'

/**
 * Ändert den Eintrag eines Blocks (legt ihn an, falls es keinen gibt). `index` ist der bereits
 * zugeordnete Eintrag (aus NotizTeil.zuordnung). Leere Einträge fallen weg.
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

export function ausblendenSetzen(wert: boolean) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, hidden: wert || undefined })
}

export function abstandSetzen(vorher: number | undefined, nachher: number | undefined) {
  return (e: LayoutEintrag): LayoutEintrag => ({ ...e, spaceBeforeMm: vorher, spaceAfterMm: nachher })
}

/** Bildwerte überschreiben; undefined in `teil` setzt den Wert auf automatisch zurück. */
export function bildSetzen(teil: Partial<BildLayout>) {
  return (e: LayoutEintrag): LayoutEintrag => {
    const bild = { ...e.image, ...teil }
    for (const k of Object.keys(bild) as (keyof BildLayout)[]) if (bild[k] === undefined) delete bild[k]
    return { ...e, image: Object.keys(bild).length ? bild : undefined }
  }
}

/** Tabellenwerte überschreiben; undefined setzt zurück. */
export function tabelleSetzen(teil: Partial<TabellenLayout>) {
  return (e: LayoutEintrag): LayoutEintrag => {
    const tabelle = { ...e.table, ...teil }
    for (const k of Object.keys(tabelle) as (keyof TabellenLayout)[]) if (tabelle[k] === undefined) delete tabelle[k]
    return { ...e, table: Object.keys(tabelle).length ? tabelle : undefined }
  }
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

/** Grundschrift und Zeilenabstand der ganzen Notiz */
export function notizSchriftSetzen(layout: LayoutDatei, teil: { fontSizePt?: number; lineHeight?: number }): LayoutDatei {
  const settings = { ...layout.settings, ...teil }
  for (const k of Object.keys(settings) as (keyof typeof settings)[]) if (settings[k] === undefined) delete settings[k]
  return { ...layout, settings }
}

export function layoutZuruecksetzen(layout: LayoutDatei): LayoutDatei {
  return { ...layout, settings: {}, items: [] }
}
