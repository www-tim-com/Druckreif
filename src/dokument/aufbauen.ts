// Ablauf für die Vorschau: Notiz(en) lesen -> Markdown umwandeln -> gliedern -> Layout anwenden -> HTML.
// Das Dokument besteht aus der Druckliste: eine Notiz oder mehrere hintereinander.

import type { Hinweis, Stufe } from '../hinweise'
import { layoutAnwenden } from '../layout/zuordnen'
import { type LayoutDatei, layoutLaden } from '../layout/layoutDatei'
import { bilderFinden, markdownUmwandeln } from '../markdown/umwandeln'
import { anhangOrdnerFuer, type VaultEinstellungen } from '../stil/stil'
import { reihenfolgeLesen } from '../vault/notizen'
import { type Vault, dateiFinden, dateiname, ohneEndung, ordner } from '../vault/vault'
import { type Block, gliedern } from './bloecke'
import { diagrammeZeichnen } from './diagramme'

export interface NotizTeil {
  pfad: string
  titel: string
  bloecke: Block[]
  layout: LayoutDatei
}

export interface Dokument {
  titel: string // Name der PDF
  html: string
  notizen: NotizTeil[]
  hinweise: Hinweis[]
}

/**
 * Baut ein Dokument aus einer oder mehreren Notizen (Druckliste), jede auf neuer Seite.
 * Eine Reihenfolgedatei in der Liste wird durch die Notizen ersetzt, die sie aufzählt.
 */
export async function dokumentAufbauen(vault: Vault, auswahl: string[], einstellungen: VaultEinstellungen): Promise<Dokument> {
  const hinweise: Hinweis[] = []
  const pfade: string[] = []
  let titel = auswahl.map((p) => ohneEndung(dateiname(p))).join(' + ')

  for (const pfad of auswahl) {
    const reihenfolge = reihenfolgeLesen(await vault.lesenText(pfad))
    if (!reihenfolge) {
      pfade.push(pfad)
      continue
    }
    if (auswahl.length === 1 && reihenfolge.titel) titel = reihenfolge.titel
    pfade.push(...notizenDerReihenfolge(vault, reihenfolge.notizen, pfad, hinweise))
  }

  for (const doppelt of new Set(pfade.filter((p, i) => pfade.indexOf(p) !== i))) {
    hinweise.push({ stufe: 'gelb', notiz: doppelt, text: 'Notiz steht mehrfach im Dokument' })
  }

  const container = document.createElement('div')
  const notizen: NotizTeil[] = []
  for (const [i, notizPfad] of pfade.entries()) {
    const teil = await notizAufbauen(vault, notizPfad, `n${i}`, einstellungen, hinweise)
    container.append(teil.article)
    notizen.push(teil.notiz)
  }
  await diagrammeZeichnen(container, (text) => hinweise.push({ stufe: 'rot', notiz: '', text }))

  // Zeichen, die in Dateinamen nicht erlaubt sind, durch Bindestrich ersetzen
  return { titel: titel.replace(/[\\/:*?"<>|]/g, '-'), html: container.innerHTML, notizen, hinweise }
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

  let layout: LayoutDatei
  try {
    layout = await layoutLaden(vault, pfad, titel)
    hinweise.push(...layoutAnwenden(article, layout, bloecke, pfad))
  } catch (fehler) {
    hinweis('rot', String((fehler as Error).message))
    layout = { version: 1, note: pfad, title: titel, settings: {}, items: [] }
  }
  return { article, notiz: { pfad, titel, bloecke, layout } }
}

// Blob-URLs pro Vault zwischenspeichern, damit Bilder nicht bei jeder Änderung neu geladen werden
const bildCache = new WeakMap<Vault, Map<string, string>>()

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
