// Layout-Datei: speichert nur die manuellen Abweichungen vom automatischen Layout.
// Ablage: .lernzettel/<Pfad mit __ statt />.layout.json im Vault-Stamm.
// Das Format (englische Schlüssel) entspricht der Spezifikation und ist bewusst stabil.

import type { Vault } from '../vault/vault'

export type BlockTyp =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'callout'
  | 'image'
  | 'code'
  | 'math'
  | 'diagram'
  | 'footnotes'
  | 'other'

export interface Anker {
  path: string[]
  type: BlockTyp
  index?: number
  hash?: string
  image?: string // bei Bildern statt hash
  /** Prüfsummen der ersten Wörter (je 4 Hex-Zeichen) – erlaubt die 70-%-Ähnlichkeit, ohne Text zu speichern */
  words?: string
}

export interface BildLayout {
  widthMm?: number
  align?: 'left' | 'center' | 'right'
  wrap?: boolean
  offsetYMm?: number
}

/** Erweiterung: Tabellen anpassen */
export interface TabellenLayout {
  widthPct?: number // Breite in % der Textbreite
  align?: 'left' | 'center' | 'right'
  columnsPct?: number[] // Spaltenbreiten in % der Tabellenbreite
  fontSizePt?: number
  compact?: boolean // engere Zeilen
  split?: boolean // darf über Seiten laufen (sonst am Stück)
}

export interface LayoutEintrag {
  anchor: Anker
  /** true = Umbruch erzwungen, false = Umbruch unterdrückt */
  pageBreakBefore?: boolean
  image?: BildLayout
  spaceBeforeMm?: number
  spaceAfterMm?: number
  /** Erweiterung: Block bzw. bei Überschriften der ganze Abschnitt erscheint nicht im Druck (z. B. „Quellen“) */
  hidden?: boolean
  /** Erweiterung: Schriftgröße und Zeilenabstand nur für diesen Block */
  fontSizePt?: number
  lineHeight?: number
  table?: TabellenLayout
}

export interface LayoutDatei {
  version: 1
  note: string
  title: string
  settings: { fontSizePt?: number; lineHeight?: number }
  items: LayoutEintrag[]
}

export const LAYOUT_ORDNER = '.lernzettel'

export function layoutPfad(notizPfad: string): string {
  return `${LAYOUT_ORDNER}/${notizPfad.replace(/\.md$/i, '').replace(/\//g, '__')}.layout.json`
}

export function leeresLayout(notizPfad: string, titel: string): LayoutDatei {
  return { version: 1, note: notizPfad, title: titel, settings: {}, items: [] }
}

export async function layoutLaden(vault: Vault, notizPfad: string, titel: string): Promise<LayoutDatei> {
  const pfad = layoutPfad(notizPfad)
  if (!vault.dateien.includes(pfad)) return leeresLayout(notizPfad, titel)
  try {
    const daten = JSON.parse(await vault.lesenText(pfad)) as LayoutDatei
    return { ...leeresLayout(notizPfad, titel), ...daten }
  } catch {
    // Kaputte Datei nicht überschreiben – Nutzer soll sie sich ansehen können
    throw new Error(`Layout-Datei ${pfad} ist kein gültiges JSON`)
  }
}

export async function layoutSpeichern(vault: Vault, layout: LayoutDatei): Promise<void> {
  await vault.schreibenText(layoutPfad(layout.note), JSON.stringify(layout, null, 2) + '\n')
}

/** Leere Einträge (nichts mehr abweichend) fallen beim Speichern weg. */
export function eintragLeer(e: LayoutEintrag): boolean {
  const { anchor: _anker, ...rest } = e
  return Object.values(rest).every(leer)
}

function leer(wert: unknown): boolean {
  // false zählt nicht als leer: pageBreakBefore: false heißt „Umbruch verhindern“
  if (wert === undefined) return true
  if (typeof wert === 'object' && wert !== null && !Array.isArray(wert)) return Object.values(wert).every(leer)
  return false
}
