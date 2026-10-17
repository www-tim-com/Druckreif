// Liste aller Notizen mit Titel und Frontmatter – für Seitenleiste, Suche und Filter.

import { type Vault, endung, istVersteckt, notizName } from './vault'

export interface Notiz {
  pfad: string
  name: string // Dateiname ohne .md
  frontmatter: Record<string, string | string[]>
  /** true, wenn die Notiz nur aus Überschrift und [[Links]] besteht (Reihenfolgedatei) */
  istReihenfolge: boolean
}

export async function notizenLaden(vault: Vault): Promise<Notiz[]> {
  const pfade = vault.dateien.filter((p) => endung(p) === 'md' && !istVersteckt(p))
  return Promise.all(
    pfade.map(async (pfad) => {
      const text = await vault.lesenText(pfad)
      return {
        pfad,
        name: notizName(pfad),
        frontmatter: frontmatterLesen(text).daten,
        istReihenfolge: reihenfolgeLesen(text) !== null,
      }
    }),
  )
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/

/** Einfacher YAML-Leser für Obsidian-Properties: `key: wert`, `key: [a, b]` und Listen mit `- a`. */
export function frontmatterLesen(text: string): { daten: Record<string, string | string[]>; rest: string } {
  const treffer = FRONTMATTER.exec(text)
  if (!treffer) return { daten: {}, rest: text }
  const daten: Record<string, string | string[]> = {}
  let aktuell: string | null = null
  for (const zeile of treffer[1].split(/\r?\n/)) {
    const listenpunkt = /^\s+-\s+(.*)$/.exec(zeile)
    if (listenpunkt && aktuell) {
      const alt = daten[aktuell]
      daten[aktuell] = [...(Array.isArray(alt) ? alt : alt ? [alt] : []), entquoten(listenpunkt[1])]
      continue
    }
    const paar = /^([^:#\s][^:]*):\s*(.*)$/.exec(zeile)
    if (!paar) continue
    aktuell = paar[1].trim()
    const wert = paar[2].trim()
    daten[aktuell] = wert.startsWith('[') && wert.endsWith(']')
      ? wert.slice(1, -1).split(',').map((w) => entquoten(w.trim())).filter(Boolean)
      : entquoten(wert)
  }
  return { daten, rest: text.slice(treffer[0].length) }
}

function entquoten(wert: string): string {
  return wert.replace(/^(["'])(.*)\1$/, '$2')
}

/**
 * Reihenfolgedatei: eine #-Überschrift (Titel der PDF) und Zeilen mit [[Wikilinks]].
 * Liefert null, wenn die Notiz keine Reihenfolgedatei ist.
 */
export function reihenfolgeLesen(text: string): { titel: string | null; notizen: string[] } | null {
  const { rest } = frontmatterLesen(text)
  let titel: string | null = null
  const notizen: string[] = []
  for (const zeile of rest.split(/\r?\n/)) {
    if (!zeile.trim()) continue
    const ueberschrift = /^#\s+(.+)$/.exec(zeile)
    if (ueberschrift && titel === null) {
      titel = ueberschrift[1].trim()
      continue
    }
    const link = /^\s*(?:[-*+]|\d+\.)?\s*\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]\s*$/.exec(zeile)
    if (!link) return null
    notizen.push(link[1].trim())
  }
  return notizen.length > 0 ? { titel, notizen } : null
}

/** Filter wie "lernfeld: 3" oder freier Text; prüft alle Frontmatter-Werte. */
export function passtZuFilter(notiz: Notiz, filter: string): boolean {
  const f = filter.trim().toLowerCase()
  if (!f) return true
  const [schluessel, ...wertTeile] = f.split(':')
  const wert = wertTeile.join(':').trim()
  const eintraege = Object.entries(notiz.frontmatter)
  const enthaelt = (w: string | string[], s: string) =>
    (Array.isArray(w) ? w : [w]).some((x) => x.toLowerCase().includes(s))
  if (wertTeile.length > 0) {
    return eintraege.some(([k, w]) => k.toLowerCase() === schluessel.trim() && enthaelt(w, wert))
  }
  return eintraege.some(([k, w]) => k.toLowerCase().includes(f) || enthaelt(w, f))
}
