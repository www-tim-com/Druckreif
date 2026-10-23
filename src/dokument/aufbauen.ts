// Ablauf für die Vorschau: Notiz(en) lesen -> Markdown umwandeln -> gliedern -> Layout anwenden -> HTML.
// Das Dokument besteht aus den Einträgen einer Mappe: eine Notiz oder mehrere hintereinander.

import type { Hinweis, Stufe } from '../hinweise'
import { layoutAnwenden } from '../layout/zuordnen'
import { type LayoutDatei, layoutLaden, layoutPfad, leeresLayout } from '../layout/layoutDatei'
import { bilderFinden, einbettungenFinden, markdownUmwandeln } from '../markdown/umwandeln'
import { anhangOrdnerFuer, type VaultEinstellungen } from '../stil/stil'
import { frontmatterLesen, reihenfolgeLesen } from '../vault/notizen'
import { type Vault, dateiFinden, notizName, ordner } from '../vault/vault'
import type { MappenEintrag } from '../mappen/mappen'
import { geschuetzteZeilen } from '../markdown/vorbereiten'
import { type Block, gliedern, normalisieren } from './bloecke'
import { diagrammeZeichnen } from './diagramme'

export interface NotizTeil {
  pfad: string
  titel: string
  bloecke: Block[]
  layout: LayoutDatei
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
 * `ausstehend`: Layouts, deren Datei gerade geschrieben wird – die gelten statt der Datei (nicht aufs Speichern warten).
 */
export async function dokumentAufbauen(
  vault: Vault,
  eintraege: MappenEintrag[],
  einstellungen: VaultEinstellungen,
  titel: string,
  ausstehend?: Map<string, LayoutDatei>,
): Promise<Dokument> {
  const hinweise: Hinweis[] = []
  const quellen = new Map<string, number>()
  const teile: { pfad: string; eintrag: MappenEintrag; index: number }[] = []

  // Dateien gleichzeitig lesen (jeder Zugriff auf den Ordner dauert), ausgewertet wird in der Reihenfolge der Mappe
  const texte = await Promise.all(
    eintraege.map(async (eintrag) => {
      if (!vault.dateien.includes(eintrag.note)) return null
      quellen.set(eintrag.note, await stempel(vault, eintrag.note))
      return vault.lesenText(eintrag.note)
    }),
  )
  for (const [index, eintrag] of eintraege.entries()) {
    const text = texte[index]
    if (text === null) {
      hinweise.push({ stufe: 'rot', notiz: eintrag.note, text: 'Notiz nicht gefunden (umbenannt oder verschoben?) – bitte aus der Mappe entfernen' })
      continue
    }
    const reihenfolge = reihenfolgeLesen(text)
    if (!reihenfolge) teile.push({ pfad: eintrag.note, eintrag, index })
    else {
      // „direkt anschließen“ des Eintrags gilt für die erste Notiz der Reihenfolge
      for (const [i, pfad] of notizenDerReihenfolge(vault, reihenfolge.notizen, eintrag.note, hinweise).entries()) {
        teile.push({ pfad, eintrag: { note: pfad, newPage: i === 0 ? eintrag.newPage : undefined }, index })
      }
    }
  }

  const pfade = teile.map((t) => t.pfad)
  for (const doppelt of new Set(pfade.filter((p, i) => pfade.indexOf(p) !== i))) {
    hinweise.push({ stufe: 'gelb', notiz: doppelt, text: 'Notiz steht mehrfach im Dokument' })
  }

  // Notizen gleichzeitig aufbauen; Hinweise je Notiz sammeln, damit ihre Reihenfolge gleich bleibt
  const gebaut = await Promise.all(
    teile.map(async (t, i) => {
      const eigene: Hinweis[] = []
      return { ...(await notizAufbauen(vault, t.pfad, `n${i}`, t.eintrag, t.index, einstellungen, eigene, quellen, ausstehend)), eigene }
    }),
  )
  const container = document.createElement('div')
  const notizen: NotizTeil[] = []
  for (const [i, teil] of gebaut.entries()) {
    if (i > 0) teil.article.classList.add('folgend')
    container.append(teil.article)
    notizen.push(teil.notiz)
    hinweise.push(...teil.eigene)
  }
  await diagrammeZeichnen(container, (text, notiz) => hinweise.push({ stufe: 'rot', notiz, text }))

  // Zeichen, die in Dateinamen nicht erlaubt sind, durch Bindestrich ersetzen
  return { titel: titel.replace(/[\\/:*?"<>|]/g, '-'), html: container.innerHTML, notizen, hinweise, quellen }
}

function notizenDerReihenfolge(vault: Vault, namen: string[], reihenfolgePfad: string, hinweise: Hinweis[]): string[] {
  const pfade: string[] = []
  for (const name of namen) {
    // wie ![[…]]: .md darf fehlen, bei gleichen Namen gewinnt der Ordner der Reihenfolgedatei
    const treffer = dateiFinden(vault, notizDateiname(name), ordner(reihenfolgePfad), '')
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
  ausstehend?: Map<string, LayoutDatei>,
): Promise<{ article: HTMLElement; notiz: NotizTeil }> {
  const name = notizName(pfad)
  if (!quellen.has(pfad)) quellen.set(pfad, await stempel(vault, pfad))
  const { daten, rest: text } = frontmatterLesen(await vault.lesenText(pfad))
  const hinweis = (stufe: Stufe, t: string) => hinweise.push({ stufe, notiz: pfad, text: t })

  // Layout zuerst: es sagt, welche eingebetteten Notizen eingefügt werden
  let layout: LayoutDatei
  let layoutFehler: string | null = null
  try {
    layout = ausstehend?.get(pfad) ?? (await layoutLaden(vault, pfad, name))
  } catch (fehler) {
    layoutFehler = (fehler as Error).message
    layout = leeresLayout(pfad, name)
  }
  const einfuegen = new Set(Array.isArray(layout.settings.embeds) ? layout.settings.embeds : [])

  // Bilder und eingebettete Notizen vorab laden, weil markdown-it synchron arbeitet
  const bildUrls = await bilderLaden(vault, text, pfad, einstellungen, quellen)
  const einbettungen = new Map<string, string | null>()
  for (const [i, ziel] of einbettungenFinden(text).entries()) {
    if (einfuegen.has(ziel)) einbettungen.set(ziel, await einbettungAufbauen(vault, ziel, pfad, `${praefix}-e${i}`, einstellungen, quellen, hinweis))
  }

  const html = markdownUmwandeln(
    text,
    {
      bildUrl: (n) => bildUrls.get(n) ?? null,
      hinweis,
      schluessel: JSON.stringify([[...bildUrls], [...einbettungen], [...einfuegen]]),
      einbettung: (ziel) => {
        const inhalt = einbettungen.get(ziel)
        // Nie stillschweigend weglassen: jede Einbettung steht in den Hinweisen, mit Knopf zum Umschalten
        hinweise.push({
          stufe: 'info',
          notiz: pfad,
          text: inhalt ? `Eingebettete Notiz „${ziel}“ eingefügt` : `Eingebettete Notiz „${ziel}“ nicht eingefügt`,
          art: 'einbettung',
          einbettung: { ziel, eingefuegt: einfuegen.has(ziel) },
        })
        return typeof inhalt === 'string'
      },
    },
    einstellungen.strictLineBreaks,
    praefix,
  )

  // Klassen wie in Obsidians Leseansicht, damit Theme und Snippets greifen – samt cssclasses aus dem Frontmatter
  const article = document.createElement('article')
  article.className = ['notiz', 'markdown-preview-view', 'markdown-rendered', ...cssKlassen(daten)].join(' ')
  article.dataset.notiz = pfad
  article.innerHTML = html
  einbettungenEinsetzen(article, einbettungen)
  const { titel, bloecke, weitereTitel } = gliedern(article, name, praefix)
  for (const t of weitereTitel) hinweis('info', `Weitere #-Überschrift „${t}“ als Kapitel behandelt`)
  if (!vault.dateien.includes(layoutPfad(pfad))) layout = { ...layout, title: titel }

  if (!layoutFehler) {
    try {
      hinweise.push(...layoutAnwenden(article, layout, bloecke, pfad))
    } catch (fehler) {
      layoutFehler = `Layout-Datei ${layoutPfad(pfad)} ist ungültig (${(fehler as Error).message})`
    }
  }
  if (layoutFehler) {
    hinweis('rot', `${layoutFehler} – Änderungen an dieser Notiz sind gesperrt, bis die Datei repariert ist`)
    layout = leeresLayout(pfad, titel)
  }
  if (eintrag.newPage === false) article.classList.add('anschliessen')
  if (eintrag.sections) abschnitteAuswaehlen(article, eintrag.sections, hinweis)

  const abschnitte = [...new Set(bloecke.filter((b) => b.typ === 'heading' && b.pfad.length === 2).map((b) => b.pfad[1]))]
  const hatEinleitung = bloecke.some((b) => b.pfad.length === 1 && b.typ !== 'heading' && b.typ !== 'footnotes')
  const layoutKaputt = layoutFehler !== null
  return { article, notiz: { pfad, titel, bloecke, layout, mappenIndex, abschnitte, hatEinleitung, layoutKaputt } }
}

async function bilderLaden(
  vault: Vault,
  text: string,
  notizPfad: string,
  einstellungen: VaultEinstellungen,
  quellen: Map<string, number>,
): Promise<Map<string, string | null>> {
  const notizOrdner = ordner(notizPfad)
  const anhang = anhangOrdnerFuer(einstellungen.anhangOrdner, notizOrdner)
  const bilder = bilderFinden(text)
  const urls = await Promise.all(
    bilder.map(async (bild) => {
      const treffer = dateiFinden(vault, bild, notizOrdner, anhang)
      if (typeof treffer !== 'string') return null
      const zeit = await stempel(vault, treffer)
      quellen.set(treffer, zeit)
      return bildUrl(vault, treffer, zeit)
    }),
  )
  return new Map(bilder.map((bild, i) => [bild, urls[i]]))
}

/**
 * Inhalt einer eingebetteten Notiz als HTML (ganze Notiz oder ein #Abschnitt), oder null mit rotem Hinweis.
 * Eingebettete Notizen darin werden nicht weiter eingefügt.
 */
async function einbettungAufbauen(
  vault: Vault,
  ziel: string,
  notizPfad: string,
  id: string,
  einstellungen: VaultEinstellungen,
  quellen: Map<string, number>,
  hinweis: (stufe: Stufe, text: string) => void,
): Promise<string | null> {
  const [name, ...anker] = ziel.split('#')
  const abschnitt = anker.at(-1)?.trim()
  if (abschnitt?.startsWith('^')) {
    hinweis('rot', `Eingebettete Notiz „${ziel}“: Verweise auf einzelne Blöcke (^…) werden nicht unterstützt`)
    return null
  }
  const treffer = dateiFinden(vault, notizDateiname(name), ordner(notizPfad), '')
  if (typeof treffer !== 'string') {
    const grund = treffer ? `mehrdeutig (${treffer.join(', ')})` : 'nicht gefunden'
    hinweis('rot', `Eingebettete Notiz „${ziel}“ ${grund} – nicht eingefügt`)
    return null
  }
  if (treffer === notizPfad) {
    hinweis('rot', `Notiz „${ziel}“ bettet sich selbst ein – nicht eingefügt`)
    return null
  }
  quellen.set(treffer, await stempel(vault, treffer))
  let text = frontmatterLesen(await vault.lesenText(treffer)).rest
  if (abschnitt) {
    const teil = abschnittAusschneiden(text, abschnitt)
    if (teil === null) {
      hinweis('rot', `Eingebettete Notiz „${ziel}“: Abschnitt „${abschnitt}“ nicht gefunden – nicht eingefügt`)
      return null
    }
    text = teil
  }
  const bildUrls = await bilderLaden(vault, text, treffer, einstellungen, quellen)
  const schluessel = JSON.stringify([...bildUrls])
  return markdownUmwandeln(text, { bildUrl: (n) => bildUrls.get(n) ?? null, hinweis, schluessel }, einstellungen.strictLineBreaks, id)
}

/** `cssclasses` (bzw. älter `cssclass`) aus dem Frontmatter: Liste oder durch Leerzeichen/Komma getrennt */
function cssKlassen(daten: Record<string, string | string[]>): string[] {
  const werte = [daten.cssclasses, daten.cssclass].flat().filter((w): w is string => typeof w === 'string')
  return werte.flatMap((w) => w.split(/[\s,]+/)).filter((k) => /^-?[_a-zA-Z][\w-]*$/.test(k))
}

/** Dateiname einer Notiz aus einem Wikilink: „.md“ darf fehlen. */
function notizDateiname(name: string): string {
  return /\.md$/i.test(name.trim()) ? name.trim() : `${name.trim()}.md`
}

/** Text ab der Überschrift `titel` bis vor die nächste Überschrift gleicher oder höherer Ebene (Codeblöcke beachtet). */
function abschnittAusschneiden(text: string, titel: string): string | null {
  const zeilen = text.split(/\r?\n/)
  const geschuetzt = geschuetzteZeilen(zeilen)
  let start = -1
  let ebene = 0
  for (let i = 0; i < zeilen.length; i++) {
    if (geschuetzt[i]) continue
    const h = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(zeilen[i])
    if (!h) continue
    if (start < 0 && normalisieren(h[2]) === normalisieren(titel)) {
      start = i
      ebene = h[1].length
    } else if (start >= 0 && h[1].length <= ebene) {
      return zeilen.slice(start, i).join('\n')
    }
  }
  return start < 0 ? null : zeilen.slice(start).join('\n')
}

/**
 * Platzhalter eingefügter Notizen durch ihren Inhalt ersetzen. Steht ein Platzhalter allein im Absatz (der Normalfall),
 * ersetzt der Inhalt den Absatz; sonst kommt er direkt hinter den Absatz. Nicht eingefügte Platzhalter allein im Absatz
 * bekommen einen Absatz ohne Höhe (kein Block, damit sich die Zählung der übrigen Blöcke nicht verschiebt).
 */
function einbettungenEinsetzen(article: HTMLElement, einbettungen: Map<string, string | null>) {
  // zuletzt hinter einem Absatz eingesetzter Inhalt: der nächste kommt dahinter (Reihenfolge wie in der Notiz)
  const zuletzt = new Map<Element, Element>()
  for (const platzhalter of [...article.querySelectorAll<HTMLElement>('span.einbettung')]) {
    const absatz = platzhalter.parentElement
    const allein = absatz?.tagName === 'P' && absatz.parentElement === article && !absatz.textContent?.trim() && absatz.querySelectorAll('img, span.einbettung').length === 1
    const inhalt = einbettungen.get(platzhalter.dataset.ziel ?? '')
    if (!platzhalter.classList.contains('eingefuegt') || typeof inhalt !== 'string') {
      if (allein) absatz.classList.add('nur-einbettung')
      continue
    }
    const div = article.ownerDocument.createElement('div')
    div.className = 'markdown-embed einbettung-inhalt'
    div.dataset.ziel = platzhalter.dataset.ziel
    div.innerHTML = inhalt
    if (allein) absatz.replaceWith(div)
    else {
      const anker = absatz?.parentElement === article ? absatz : platzhalter
      ;(zuletzt.get(anker) ?? anker).after(div)
      zuletzt.set(anker, div)
      platzhalter.remove()
    }
  }
}

/**
 * Nur die gewählten ##-Abschnitte behalten ("" = Text vor dem ersten Abschnitt). Titel und Fußnoten bleiben immer.
 * Vom Nutzer gewollt, aber nie stillschweigend: steht als Hinweis in der Liste.
 */
function abschnitteAuswaehlen(article: HTMLElement, auswahl: string[], hinweis: (stufe: Stufe, text: string) => void) {
  const wahl = new Set(auswahl)
  const vorhanden = new Set<string>()
  for (const kind of [...article.children]) {
    if (kind.matches('.notiz-titel, .footnotes, .footnotes-sep')) continue
    // auch ###-Abschnitte ohne ## darüber stehen als eigener Abschnitt in der Auswahl (siehe NotizTeil.abschnitte)
    const titel = kind.tagName === 'SECTION' ? (kind.firstElementChild?.textContent?.trim() ?? '') : ''
    vorhanden.add(titel)
    if (!wahl.has(titel)) kind.remove()
  }
  const namen = auswahl.map((a) => (a ? `„${a}“` : 'Einleitung'))
  hinweis('info', `Nur ausgewählte Abschnitte im Druck: ${namen.join(', ') || 'keine'}`)
  // Umbenannte oder gelöschte Überschrift: nie stillschweigend weglassen
  for (const a of auswahl.filter((a) => a && !vorhanden.has(a))) {
    hinweis('rot', `Ausgewählter Abschnitt „${a}“ nicht mehr in der Notiz (umbenannt?) – bitte unter Mappe › Abschnitte neu wählen`)
  }
}

// Blob-URLs pro Vault zwischenspeichern, damit Bilder nicht bei jeder Änderung neu geladen werden.
// Mit Änderungszeit: ein unter gleichem Namen ersetztes Bild wird neu geladen. Gespeichert wird das Versprechen,
// damit gleichzeitig aufgebaute Notizen mit demselben Bild es nur einmal lesen.
const bildCache = new WeakMap<Vault, Map<string, { url: Promise<string>; zeit: number }>>()

/** Erst später freigeben: die gerade sichtbare Fassung zeigt die Bilder noch an. */
function spaeterFreigeben(urls: string[]) {
  setTimeout(() => urls.forEach((url) => URL.revokeObjectURL(url)), 30_000)
}

/** Beim Aktualisieren: Bilder neu laden (könnten ersetzt oder verschoben worden sein). */
export function bilderVergessen(vault: Vault): void {
  for (const e of bildCache.get(vault)?.values() ?? []) e.url.then((url) => spaeterFreigeben([url]), () => {})
  bildCache.delete(vault)
}

async function bildUrl(vault: Vault, pfad: string, zeit: number): Promise<string> {
  let cache = bildCache.get(vault)
  if (!cache) bildCache.set(vault, (cache = new Map()))
  const alt = cache.get(pfad)
  if (alt?.zeit === zeit) return alt.url
  const url = vault.lesenBlob(pfad).then((blob) => URL.createObjectURL(blob))
  cache.set(pfad, { url, zeit })
  // Fehler nicht merken: beim nächsten Aufbau erneut versuchen
  url.catch(() => cache.get(pfad)?.url === url && cache.delete(pfad))
  if (alt) alt.url.then((u) => spaeterFreigeben([u]), () => {})
  return url
}
