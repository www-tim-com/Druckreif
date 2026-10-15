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

export interface MappenGeladen {
  datei: MappenDatei
  /** Problem beim Lesen – wird als roter Hinweis angezeigt, der Vault öffnet trotzdem */
  fehler?: string
  /** true = nicht speichern, sonst würde eine nur vorübergehend unlesbare Datei überschrieben */
  gesperrt?: boolean
}

export async function mappenLaden(vault: Vault): Promise<MappenGeladen> {
  const leer: MappenDatei = { version: 1, mappen: [] }
  if (!vault.dateien.includes(MAPPEN_PFAD)) return { datei: leer }
  let text: string
  try {
    text = await vault.lesenText(MAPPEN_PFAD)
  } catch (e) {
    const fehler = `${MAPPEN_PFAD} konnte nicht gelesen werden (${(e as Error).message}) – Mappen werden nicht gespeichert, bitte Aktualisieren (F5)`
    return { datei: leer, fehler, gesperrt: true }
  }
  try {
    const daten = JSON.parse(text) as Partial<MappenDatei>
    const mappen = Array.isArray(daten.mappen)
      ? daten.mappen.filter((m) => m && typeof m.id === 'string' && Array.isArray(m.items))
      : []
    return { datei: { version: 1, mappen } }
  } catch {
    // Kaputte Datei sichern, damit neue Mappen sie nicht ersatzlos überschreiben
    const sicherung = `${LAYOUT_ORDNER}/mappen.defekt.json`
    try {
      await vault.schreibenText(sicherung, text)
    } catch {
      return { datei: leer, fehler: `${MAPPEN_PFAD} ist kein gültiges JSON – bitte von Hand reparieren`, gesperrt: true }
    }
    return { datei: leer, fehler: `${MAPPEN_PFAD} war kein gültiges JSON – gesichert als ${sicherung}, Mappen bitte neu anlegen` }
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
