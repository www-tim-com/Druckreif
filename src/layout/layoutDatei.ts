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
  /** Textumbruch wie in Word („Quadrat“): Bild schwebt links oder rechts, der Text des Abschnitts fließt herum */
  wrap?: boolean
  /** bei wrap: Abstand des Bildes unter dem Anfang seines Bezugsblocks (Text fließt darüber), sonst Abstand oben */
  offsetYMm?: number
  /** Erweiterung, nur bei wrap: Abstand zwischen Bild und umfließendem Text (sonst 4 mm) */
  wrapGapMm?: number
  /** Erweiterung, nur bei wrap: Bild steht vor diesem Block desselben Abschnitts (wie in Word an einem Absatz verankert) */
  before?: Anker
}

/** Erweiterung: Tabellen anpassen */
export interface TabellenLayout {
  widthPct?: number // Breite in % der Textbreite
  align?: 'left' | 'center' | 'right'
  columnsPct?: number[] // Spaltenbreiten in % der Tabellenbreite
  fontSizePt?: number
  compact?: boolean // engere Zeilen
  split?: boolean // darf über Seiten laufen (sonst am Stück)
  /** Erweiterung: Textumbruch und Position wie bei Bildern (siehe BildLayout) */
  wrap?: boolean
  offsetYMm?: number
  wrapGapMm?: number
  before?: Anker
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
  /** Erweiterung: darf über Seiten geteilt werden (bei Überschriften der ganze Abschnitt) – gegen halb leere Seiten */
  split?: boolean
}

export interface LayoutDatei {
  version: 1
  note: string
  title: string
  settings: {
    fontSizePt?: number
    lineHeight?: number
    /** Erweiterung: eingebettete Notizen (![[Ziel]], Ziel wie in der Notiz geschrieben), die eingefügt werden */
    embeds?: string[]
  }
  items: LayoutEintrag[]
}

export const LAYOUT_ORDNER = '.lernzettel'

/** Grundschrift und Zeilenabstand ohne Layout-Datei – gleiche Werte wie --druck-groesse/--druck-zeilenabstand in druck.css */
export const STANDARD_SCHRIFT_PT = 10.5
export const STANDARD_ZEILENABSTAND = 1.35

export function layoutPfad(notizPfad: string): string {
  return `${LAYOUT_ORDNER}/${notizPfad.replace(/\.md$/i, '').replace(/\//g, '__')}.layout.json`
}

export function leeresLayout(notizPfad: string, titel: string): LayoutDatei {
  return { version: 1, note: notizPfad, title: titel, settings: {}, items: [] }
}

export async function layoutLaden(vault: Vault, notizPfad: string, titel: string): Promise<LayoutDatei> {
  const pfad = layoutPfad(notizPfad)
  if (!vault.dateien.includes(pfad)) return leeresLayout(notizPfad, titel)
  // Kaputte Datei nicht überschreiben – Nutzer soll sie sich ansehen können (aufbauen.ts sperrt die Notiz)
  let daten: unknown
  try {
    daten = JSON.parse(await vault.lesenText(pfad))
  } catch {
    throw new Error(`Layout-Datei ${pfad} ist kein gültiges JSON`)
  }
  const fehler = strukturFehler(daten)
  if (fehler) throw new Error(`Layout-Datei ${pfad} ist ungültig (${fehler})`)
  // Gespeichert wird immer unter der geladenen Notiz: ein kopiertes oder veraltetes „note“ darf nicht
  // in die Layout-Datei einer anderen Notiz schreiben
  return { ...leeresLayout(notizPfad, titel), ...(daten as LayoutDatei), note: notizPfad }
}

function strukturFehler(daten: unknown): string | null {
  const objekt = (w: unknown) => typeof w === 'object' && w !== null && !Array.isArray(w)
  if (!objekt(daten)) return 'kein Objekt'
  const d = daten as Record<string, unknown>
  if (d.settings !== undefined && !objekt(d.settings)) return '„settings“ ist kein Objekt'
  if (d.items === undefined) return null
  if (!Array.isArray(d.items)) return '„items“ ist keine Liste'
  for (const [i, e] of d.items.entries()) {
    const anker = objekt(e) ? (e as { anchor?: unknown }).anchor : undefined
    if (!objekt(anker) || !Array.isArray((anker as Anker).path) || typeof (anker as Anker).type !== 'string') {
      return `Eintrag ${i + 1} ohne gültigen „anchor“`
    }
  }
  return null
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
