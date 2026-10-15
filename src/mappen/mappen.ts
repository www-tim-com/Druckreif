// Mappen: benannte Zusammenstellungen von Notizen (wie eine Word-Datei aus mehreren Kapiteln).
// Alle Mappen eines Vaults stehen in .lernzettel/mappen.json. Änderungen als reine Funktionen.

import { LAYOUT_ORDNER } from '../layout/layoutDatei'
import type { Vault } from '../vault/vault'
import { dateiname, ohneEndung } from '../vault/vault'

export interface MappenEintrag {
  note: string // Pfad der Notiz (oder einer Reihenfolgedatei)
  /** false = schließt direkt an die vorige Notiz an, statt auf einer neuen Seite zu beginnen */
  newPage?: boolean
  /** nur diese ##-Abschnitte übernehmen ("" = Text vor dem ersten Abschnitt); fehlt = ganze Notiz */
  sections?: string[]
}

export interface Mappe {
  id: string
  name: string
  items: MappenEintrag[]
}

export interface MappenDatei {
  version: 1
  mappen: Mappe[]
}

export const MAPPEN_PFAD = `${LAYOUT_ORDNER}/mappen.json`

export async function mappenLaden(vault: Vault): Promise<MappenDatei> {
  if (!vault.dateien.includes(MAPPEN_PFAD)) return { version: 1, mappen: [] }
  try {
    const daten = JSON.parse(await vault.lesenText(MAPPEN_PFAD)) as MappenDatei
    return { version: 1, mappen: Array.isArray(daten.mappen) ? daten.mappen : [] }
  } catch {
    throw new Error(`${MAPPEN_PFAD} ist kein gültiges JSON`)
  }
}

export async function mappenSpeichern(vault: Vault, datei: MappenDatei): Promise<void> {
  await vault.schreibenText(MAPPEN_PFAD, JSON.stringify(datei, null, 2) + '\n')
}

export function notizName(pfad: string): string {
  return ohneEndung(dateiname(pfad))
}

export function neueMappe(datei: MappenDatei, name: string, notizen: string[] = []): { datei: MappenDatei; id: string } {
  const id = `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const mappe: Mappe = { id, name: eindeutigerName(datei, name), items: notizen.map((note) => ({ note })) }
  return { datei: { ...datei, mappen: [...datei.mappen, mappe] }, id }
}

function eindeutigerName(datei: MappenDatei, name: string): string {
  const namen = new Set(datei.mappen.map((m) => m.name))
  if (!namen.has(name)) return name
  for (let i = 2; ; i++) if (!namen.has(`${name} (${i})`)) return `${name} (${i})`
}

/** Eine Mappe ändern (alle anderen bleiben gleich). */
export function mappeAendern(datei: MappenDatei, id: string, aendern: (m: Mappe) => Mappe): MappenDatei {
  return { ...datei, mappen: datei.mappen.map((m) => (m.id === id ? aendern(m) : m)) }
}

export function mappeLoeschen(datei: MappenDatei, id: string): MappenDatei {
  return { ...datei, mappen: datei.mappen.filter((m) => m.id !== id) }
}

export const umbenennen = (name: string) => (m: Mappe): Mappe => ({ ...m, name: name.trim() || m.name })

export const notizAnhaengen = (note: string) => (m: Mappe): Mappe => ({ ...m, items: [...m.items, { note }] })

export const eintragEntfernen = (index: number) => (m: Mappe): Mappe => ({
  ...m,
  items: m.items.filter((_, i) => i !== index),
})

export const eintragVerschieben = (von: number, nach: number) => (m: Mappe): Mappe => {
  const items = [...m.items]
  const [eintrag] = items.splice(von, 1)
  items.splice(Math.max(0, Math.min(items.length, nach)), 0, eintrag)
  return { ...m, items }
}

export const eintragSetzen = (index: number, teil: Partial<MappenEintrag>) => (m: Mappe): Mappe => ({
  ...m,
  items: m.items.map((e, i) => {
    if (i !== index) return e
    const neu = { ...e, ...teil }
    if (neu.newPage !== false) delete neu.newPage // Standard: neue Seite
    if (!neu.sections) delete neu.sections
    return neu
  }),
})
