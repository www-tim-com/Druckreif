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
  /** Layout-Datei ist beschädigt: nicht überschreiben, bis der Nutzer sie repariert hat */
  layoutKaputt?: boolean
}

export interface Dokument {
  titel: string // Name der PDF
  html: string
  notizen: NotizTeil[]
  hinweise: Hinweis[]
  /** Änderungszeit jeder gelesenen Datei (Notizen, Reihenfolgen, Bilder) beim Aufbau – zum Erkennen von Änderungen */
  quellen: Map<string, number>
}

/** Änderungszeit oder -1, wenn es die Datei nicht (mehr) gibt. Vor dem Lesen nehmen: späteres Speichern fällt dann auf. */
export function stempel(vault: Vault, pfad: string): Promise<number> {
  return vault.geaendertAm(pfad).catch(() => -1)
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
  const quellen = new Map<string, number>()
  const teile: { pfad: string; eintrag: MappenEintrag; index: number }[] = []

  for (const [index, eintrag] of eintraege.entries()) {
    if (!vault.dateien.includes(eintrag.note)) {
      hinweise.push({ stufe: 'rot', notiz: eintrag.note, text: 'Notiz nicht gefunden (umbenannt oder verschoben?) – bitte aus der Mappe entfernen' })
      continue
    }
    quellen.set(eintrag.note, await stempel(vault, eintrag.note))
    const reihenfolge = reihenfolgeLesen(await vault.lesenText(eintrag.note))
    if (!reihenfolge) teile.push({ pfad: eintrag.note, eintrag, index })
    else for (const pfad of notizenDerReihenfolge(vault, reihenfolge.notizen, eintrag.note, hinweise)) teile.push({ pfad, eintrag: { note: pfad }, index })
  }

  const pfade = teile.map((t) => t.pfad)
  for (const doppelt of new Set(pfade.filter((p, i) => pfade.indexOf(p) !== i))) {
    hinweise.push({ stufe: 'gelb', notiz: doppelt, text: 'Notiz steht mehrfach im Dokument' })
  }

  const container = document.createElement('div')
  const notizen: NotizTeil[] = []
  for (const [i, t] of teile.entries()) {
    const teil = await notizAufbauen(vault, t.pfad, `n${i}`, t.eintrag, t.index, einstellungen, hinweise, quellen)
    container.append(teil.article)
    notizen.push(teil.notiz)
  }
  await diagrammeZeichnen(container, (text) => hinweise.push({ stufe: 'rot', notiz: '', text }))

  // Zeichen, die in Dateinamen nicht erlaubt sind, durch Bindestrich ersetzen
  return { titel: titel.replace(/[\\/:*?"<>|]/g, '-'), html: container.innerHTML, notizen, hinweise, quellen }
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
  quellen: Map<string, number>,
): Promise<{ article: HTMLElement; notiz: NotizTeil }> {
  const name = ohneEndung(dateiname(pfad))
  if (!quellen.has(pfad)) quellen.set(pfad, await stempel(vault, pfad))
  const text = await vault.lesenText(pfad)
  const hinweis = (stufe: Stufe, t: string) => hinweise.push({ stufe, notiz: pfad, text: t })

  // Bilder vorab laden, weil markdown-it synchron arbeitet
  const notizOrdner = ordner(pfad)
  const anhang = anhangOrdnerFuer(einstellungen.anhangOrdner, notizOrdner)
  const bildUrls = new Map<string, string | null>()
  for (const bild of bilderFinden(text)) {
    const treffer = dateiFinden(vault, bild, notizOrdner, anhang)
    if (typeof treffer !== 'string') {
      bildUrls.set(bild, null)
      continue
    }
    const zeit = await stempel(vault, treffer)
    quellen.set(treffer, zeit)
    bildUrls.set(bild, await bildUrl(vault, treffer, zeit))
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

  let layout: LayoutDatei
  let zuordnung = new Map<string, number>()
  let layoutKaputt = false
  try {
    layout = await layoutLaden(vault, pfad, titel)
    const angewendet = layoutAnwenden(article, layout, bloecke, pfad)
    hinweise.push(...angewendet.hinweise)
    zuordnung = angewendet.zuordnung
  } catch (fehler) {
    hinweis('rot', `${(fehler as Error).message} – Änderungen an dieser Notiz sind gesperrt, bis die Datei repariert ist`)
    layoutKaputt = true
    layout = { version: 1, note: pfad, title: titel, settings: {}, items: [] }
  }
  if (eintrag.newPage === false) article.classList.add('anschliessen')
  if (eintrag.sections) abschnitteAuswaehlen(article, eintrag.sections, hinweis)

  const abschnitte = [...new Set(bloecke.filter((b) => b.typ === 'heading' && b.pfad.length === 2).map((b) => b.pfad[1]))]
  const hatEinleitung = bloecke.some((b) => b.pfad.length === 1 && b.typ !== 'heading' && b.typ !== 'footnotes')
  return { article, notiz: { pfad, titel, bloecke, layout, zuordnung, mappenIndex, abschnitte, hatEinleitung, layoutKaputt } }
}

/**
 * Nur die gewählten ##-Abschnitte behalten ("" = Text vor dem ersten Abschnitt). Titel und Fußnoten bleiben immer.
 * Vom Nutzer gewollt, aber nie stillschweigend: steht als Hinweis in der Liste.
 */
function abschnitteAuswaehlen(article: HTMLElement, auswahl: string[], hinweis: (stufe: Stufe, text: string) => void) {
  const wahl = new Set(auswahl)
  for (const kind of [...article.children]) {
    if (kind.matches('.notiz-titel, .footnotes, .footnotes-sep')) continue
    const titel = kind.matches('section.kapitel') ? (kind.querySelector(':scope > h2')?.textContent?.trim() ?? '') : ''
    if (!wahl.has(titel)) kind.remove()
  }
  const namen = auswahl.map((a) => (a ? `„${a}“` : 'Einleitung'))
  hinweis('info', `Nur ausgewählte Abschnitte im Druck: ${namen.join(', ') || 'keine'}`)
}

// Blob-URLs pro Vault zwischenspeichern, damit Bilder nicht bei jeder Änderung neu geladen werden.
// Mit Änderungszeit: ein unter gleichem Namen ersetztes Bild wird neu geladen.
const bildCache = new WeakMap<Vault, Map<string, { url: string; zeit: number }>>()

/** Erst später freigeben: die gerade sichtbare Fassung zeigt die Bilder noch an. */
function spaeterFreigeben(urls: string[]) {
  setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 30_000)
}

/** Beim Aktualisieren: Bilder neu laden (könnten ersetzt oder verschoben worden sein). */
export function bilderVergessen(vault: Vault): void {
  spaeterFreigeben([...(bildCache.get(vault)?.values() ?? [])].map((e) => e.url))
  bildCache.delete(vault)
}

async function bildUrl(vault: Vault, pfad: string, zeit: number): Promise<string> {
  let cache = bildCache.get(vault)
  if (!cache) bildCache.set(vault, (cache = new Map()))
  const alt = cache.get(pfad)
  if (alt?.zeit === zeit) return alt.url
  const url = URL.createObjectURL(await vault.lesenBlob(pfad))
  cache.set(pfad, { url, zeit })
  if (alt) spaeterFreigeben([alt.url])
  return url
}
