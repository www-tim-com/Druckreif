// Änderungen an einer Layout-Datei als reine Funktionen: alt rein, neu raus.
// So lassen sich Rückgängig/Wiederholen später als einfacher Stapel von Layouts umsetzen.

import type { Block } from '../dokument/bloecke'
import { type LayoutDatei, type LayoutEintrag, eintragLeer } from './layoutDatei'
import { ankerVon, blockFinden } from './zuordnen'

function eintragAendern(
  layout: LayoutDatei,
  block: Block,
  bloecke: Block[],
  aendern: (e: LayoutEintrag) => LayoutEintrag,
): LayoutDatei {
  const index = layout.items.findIndex((e) => blockFinden(e.anchor, bloecke)?.block.id === block.id)
  const alt: LayoutEintrag = index >= 0 ? layout.items[index] : { anchor: ankerVon(block) }
  // Anker auffrischen, damit er zum aktuellen Text passt (aus gelb wird wieder sicher)
  const neu = aendern({ ...alt, anchor: ankerVon(block) })
  const items = [...layout.items]
  if (index >= 0) items.splice(index, 1)
  if (!eintragLeer(neu)) items.splice(index >= 0 ? index : items.length, 0, neu)
  return { ...layout, items }
}

/** Erzwungenen Seitenumbruch vor einem Block setzen oder entfernen. */
export function umbruchUmschalten(layout: LayoutDatei, block: Block, bloecke: Block[]): LayoutDatei {
  return eintragAendern(layout, block, bloecke, (e) => ({
    ...e,
    pageBreakBefore: e.pageBreakBefore === true ? undefined : true,
  }))
}

export function eintragLoeschen(layout: LayoutDatei, index: number): LayoutDatei {
  return { ...layout, items: layout.items.filter((_, i) => i !== index) }
}

export function schriftgroesseSetzen(layout: LayoutDatei, pt: number | undefined): LayoutDatei {
  return { ...layout, settings: { ...layout.settings, fontSizePt: pt } }
}

export function layoutZuruecksetzen(layout: LayoutDatei): LayoutDatei {
  return { ...layout, settings: {}, items: [] }
}
