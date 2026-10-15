// Ablauf für die Vorschau: Notiz(en) lesen -> Markdown umwandeln -> gliedern -> Layout anwenden -> HTML.
// Das Dokument besteht aus den Einträgen einer Mappe: eine Notiz oder mehrere hintereinander.

import type { Hinweis, Stufe } from '../hinweise'
import { layoutAnwenden } from '../layout/zuordnen'
import { type LayoutDatei, layoutLaden } from '../layout/layoutDatei'
import { bilderFinden, markdownUmwandeln } from '../markdown/umwandeln'
import { anhangOrdnerFuer, type VaultEinstellungen } from '../stil/stil'
import { reihenfolgeLesen } from '../vault/notizen'
import { type Vault, dateiFinden, dateiname, ohneEndung, ordner } from '../vault/vault'
import type { MappenEintrag } from '../mappen/mappen'
import { type Block, gliedern } from './bloecke'
import { diagrammeZeichnen } from './diagramme'

export interface NotizTeil {
  pfad: string
  titel: string
  bloecke: Block[]
  layout: LayoutDatei
  /** Block-ID -> Index des Layout-Eintrags, der an diesem Block hängt */
  zuordnung: Map<string, number>
  /** Index des Mappen-Eintrags, aus dem diese Notiz stammt (bei Reihenfolgedateien mehrere Notizen je Eintrag) */
  mappenIndex: number
  /** ##-Abschnitte der Notiz, zur Auswahl „nur einzelne Abschnitte“ */
  abschnitte: string[]
  hatEinleitung: boolean
}

export interface Dokument {
  titel: string // Name der PDF
  html: string
  notizen: NotizTeil[]
  hinweise: Hinweis[]
  /** alle gelesenen Dateien (Notizen und Reihenfolgedateien), um Änderungen in Obsidian zu bemerken */
  quellen: string[]
}

/**
 * Baut ein Dokument aus den Einträgen einer Mappe. Jede Notiz beginnt auf einer neuen Seite, außer der
 * Eintrag sagt newPage: false. Eine Reihenfolgedatei wird durch die Notizen ersetzt, die sie aufzählt.
 */
export async function dokumentAufbauen(
  vault: Vault,
  eintraege: MappenEintrag[],
  einstellungen: VaultEinstellungen,
  titel: string,
): Promise<Dokument> {
  const hinweise: Hinweis[] = []
  const teile: { pfad: string; eintrag: MappenEintrag; index: number }[] = []
  const quellen: string[] = []

  for (const [index, eintrag] of eintraege.entries()) {
    if (!vault.dateien.includes(eintrag.note)) {
      hinweise.push({ stufe: 'rot', notiz: eintrag.note, text: 'Notiz nicht gefunden (umbenannt oder verschoben?) – bitte aus der Mappe entfernen' })
      continue
    }
    quellen.push(eintrag.note)
    const reihenfolge = reihenfolgeLesen(await vault.lesenText(eintrag.note))
    if (!reihenfolge) {
      teile.push({ pfad: eintrag.note, eintrag, index })
      continue
    }
    if (eintrag.sections) {
      hinweise.push({ stufe: 'gelb', notiz: eintrag.note, text: 'Abschnittsauswahl gilt nicht für Reihenfolgedateien – alle Notizen vollständig im Druck' })
    }
    // „Direkt anschließen“ gilt für die erste Notiz der Reihenfolge, die übrigen beginnen wie gewohnt neu
    notizenDerReihenfolge(vault, reihenfolge.notizen, eintrag.note, hinweise).forEach((pfad, i) =>
      teile.push({ pfad, eintrag: i === 0 && eintrag.newPage === false ? { note: pfad, newPage: false } : { note: pfad }, index }),
    )
  }

  const pfade = teile.map((t) => t.pfad)
  for (const doppelt of new Set(pfade.filter((p, i) => pfade.indexOf(p) !== i))) {
    hinweise.push({ stufe: 'gelb', notiz: doppelt, text: 'Notiz steht mehrfach im Dokument' })
  }

  const container = document.createElement('div')
  const notizen: NotizTeil[] = []
  for (const [i, t] of teile.entries()) {
    const teil = await notizAufbauen(vault, t.pfad, `n${i}`, t.eintrag, t.index, einstellungen, hinweise)
    container.append(teil.article)
    notizen.push(teil.notiz)
  }
  await diagrammeZeichnen(container, (text) => hinweise.push({ stufe: 'rot', notiz: '', text }))

  // Zeichen, die in Dateinamen nicht erlaubt sind, durch Bindestrich ersetzen
  return {
    titel: titel.replace(/[\\/:*?"<>|]/g, '-'),
    html: container.innerHTML,
    notizen,
    hinweise,
    quellen: [...new Set([...quellen, ...pfade])],
  }
}

function notizenDerReihenfolge(vault: Vault, namen: string[], reihenfolgePfad: string, hinweise: Hinweis[]): string[] {
  const pfade: string[] = []
  for (const name of namen) {
    const treffer = dateiFinden(vault, `${name}.md`, '', '')
    if (typeof treffer === 'string') pfade.push(treffer)
    else {
      const grund = treffer ? `mehrdeutig (${treffer.join(', ')})` : 'nicht gefunden'
      hinweise.push({ stufe: 'rot', notiz: reihenfolgePfad, text: `Notiz „${name}“ ${grund} – nicht im Dokument` })
    }
  }
  return pfade
}

async function notizAufbauen(
  vault: Vault,
  pfad: string,
  praefix: string,
  eintrag: MappenEintrag,
  mappenIndex: number,
  einstellungen: VaultEinstellungen,
  hinweise: Hinweis[],
): Promise<{ article: HTMLElement; notiz: NotizTeil }> {
  const name = ohneEndung(dateiname(pfad))
  const text = await vault.lesenText(pfad)
  const hinweis = (stufe: Stufe, t: string) => hinweise.push({ stufe, notiz: pfad, text: t })

  // Bilder vorab laden, weil markdown-it synchron arbeitet
  const notizOrdner = ordner(pfad)
  const anhang = anhangOrdnerFuer(einstellungen.anhangOrdner, notizOrdner)
  const bildUrls = new Map<string, string | null>()
  for (const bild of bilderFinden(text)) {
    const treffer = dateiFinden(vault, bild, notizOrdner, anhang)
    bildUrls.set(bild, typeof treffer === 'string' ? await bildUrl(vault, treffer) : null)
  }

  const html = markdownUmwandeln(
    text,
    { bildUrl: (n) => bildUrls.get(n) ?? null, hinweis },
    einstellungen.strictLineBreaks,
  )

  const article = document.createElement('article')
  article.className = 'notiz'
  article.dataset.notiz = pfad
  article.innerHTML = html
  const { titel, bloecke, weitereTitel } = gliedern(article, name, praefix)
  for (const t of weitereTitel) hinweis('info', `Weitere #-Überschrift „${t}“ als Kapitel behandelt`)

  // Auswahl „nur einzelne Abschnitte“: wie abschnitteAuswaehlen gliedern (direkte Kinder des article)
  const kapitel = [...article.querySelectorAll(':scope > section.kapitel > h2')]
  const abschnitte = [...new Set(kapitel.map((h2) => h2.textContent?.trim() ?? ''))]
  const hatEinleitung = [...article.children].some((k) => abschnittVon(k) === '')
  // Erst nach dem Layout entfernen; die Blöcke darin vorher merken, damit sie nirgends mehr auftauchen
  const weg = eintrag.sections ? abschnitteAuswaehlen(article, eintrag.sections, abschnitte, hatEinleitung, hinweis) : []
  const wegIds = new Set(weg.flatMap((el) => [el, ...el.querySelectorAll('[data-block]')].map((b) => b.getAttribute('data-block'))))

  let layout: LayoutDatei
  let zuordnung = new Map<string, number>()
  try {
    layout = await layoutLaden(vault, pfad, titel)
    const angewendet = layoutAnwenden(article, layout, bloecke, pfad)
    hinweise.push(...angewendet.hinweise.filter((h) => !h.block || !wegIds.has(h.block)))
    zuordnung = new Map([...angewendet.zuordnung].filter(([id]) => !wegIds.has(id)))
  } catch (fehler) {
    hinweis('rot', String((fehler as Error).message))
    layout = { version: 1, note: pfad, title: titel, settings: {}, items: [] }
  }
  for (const el of weg) el.remove()
  if (eintrag.newPage === false) article.classList.add('anschliessen')

  return {
    article,
    notiz: { pfad, titel, bloecke: bloecke.filter((b) => !wegIds.has(b.id)), layout, zuordnung, mappenIndex, abschnitte, hatEinleitung },
  }
}

/** Name des ##-Abschnitts eines direkten Kinds des article ("" = Einleitung), null = gehört zur ganzen Notiz. */
function abschnittVon(kind: Element): string | null {
  if (kind.matches('.notiz-titel, .footnotes, .footnotes-sep')) return null
  return kind.matches('section.kapitel') ? (kind.querySelector(':scope > h2')?.textContent?.trim() ?? '') : ''
}

/**
 * Nur die gewählten ##-Abschnitte behalten ("" = Text vor dem ersten Abschnitt). Titel und Fußnoten bleiben immer.
 * Liefert die zu entfernenden Elemente. Vom Nutzer gewollt, aber nie stillschweigend: steht als Hinweis in der Liste;
 * ein gewählter Abschnitt, den es nicht mehr gibt (umbenannt?), wird rot gemeldet.
 */
function abschnitteAuswaehlen(
  article: HTMLElement,
  auswahl: string[],
  abschnitte: string[],
  hatEinleitung: boolean,
  hinweis: (stufe: Stufe, text: string) => void,
): Element[] {
  const wahl = new Set(auswahl)
  const weg = [...article.children].filter((kind) => {
    const name = abschnittVon(kind)
    return name !== null && !wahl.has(name)
  })
  const vorhanden = new Set([...(hatEinleitung ? [''] : []), ...abschnitte])
  const fehlend = auswahl.filter((a) => !vorhanden.has(a))
  const name = (a: string) => (a ? `„${a}“` : 'Einleitung')
  if (fehlend.length > 0) {
    const weggelassen = [...vorhanden].filter((a) => !wahl.has(a))
    hinweis(
      'rot',
      `Gewählter Abschnitt nicht mehr in der Notiz (umbenannt?): ${fehlend.map(name).join(', ')}. ` +
        `Nicht im Druck: ${weggelassen.map(name).join(', ') || 'nichts'} – Auswahl in der Mappe prüfen`,
    )
  }
  hinweis('info', `Nur ausgewählte Abschnitte im Druck: ${auswahl.map(name).join(', ') || 'keine'}`)
  return weg
}

// Blob-URLs pro Vault zwischenspeichern, damit Bilder nicht bei jeder Änderung neu geladen werden
const bildCache = new WeakMap<Vault, Map<string, string>>()

/** Beim Aktualisieren: Bilder neu laden (könnten ersetzt oder verschoben worden sein). */
export function bilderVergessen(vault: Vault): void {
  const alt = [...(bildCache.get(vault)?.values() ?? [])]
  bildCache.delete(vault)
  // Erst später freigeben: die gerade sichtbare Fassung zeigt die Bilder noch an
  setTimeout(() => alt.forEach((url) => URL.revokeObjectURL(url)), 30_000)
}

async function bildUrl(vault: Vault, pfad: string): Promise<string> {
  let cache = bildCache.get(vault)
  if (!cache) bildCache.set(vault, (cache = new Map()))
  let url = cache.get(pfad)
  if (!url) {
    url = URL.createObjectURL(await vault.lesenBlob(pfad))
    cache.set(pfad, url)
  }
  return url
}
