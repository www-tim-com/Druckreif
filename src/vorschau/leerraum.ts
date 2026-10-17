// Leerraum-Warnung: Seiten, die zu einem großen Teil leer bleiben, weil die nächste Seite mit einem Umbruch beginnt
// (manueller Umbruch, neue Notiz oder eine Einheit, die am Stück bleiben soll und nicht mehr passte).
// Gemessen wird im fertig umbrochenen iframe; die Markierung liegt über der Seite und wird nicht gedruckt.

/** Ab diesem Anteil leerer Satzspiegelhöhe wird gewarnt */
const SCHWELLE = 0.4

/**
 * Was „Beheben“ tut:
 * umbruch = manuellen Umbruch entfernen, notiz = Notiz direkt anschließen lassen,
 * teilen = Abschnitt/Block darf über Seiten laufen, tabelle = Tabelle über Seiten teilen,
 * bild = Bild auswählen (verkleinern kann nur der Nutzer), null = nichts Passendes
 */
type LeerraumArt = 'umbruch' | 'notiz' | 'teilen' | 'tabelle' | 'bild' | null

export interface Leerraum {
  seite: number
  /** leerer Anteil des Satzspiegels, 0–1 */
  anteil: number
  /** Pfad der Notiz, in der der Umbruch liegt */
  notiz: string
  /** Block, an dem die Änderung hängt (bei Abschnitten die Überschrift) */
  block: string | null
  art: LeerraumArt
  /** z. B. „Abschnitt „Therapie““ */
  was: string
}

const LEERRAUM_KNOPF: Record<Exclude<LeerraumArt, null>, string> = {
  umbruch: 'Umbruch entfernen',
  notiz: 'Notiz direkt anschließen',
  teilen: 'Teilen erlauben',
  tabelle: 'Tabelle teilen',
  bild: 'Bild auswählen',
}

export function leerraumText(l: Leerraum, mitSeite = true): string {
  const leer = `${Math.round(l.anteil * 100)} % leer – ${l.was} beginnt auf der nächsten Seite`
  return mitSeite ? `Seite ${l.seite} zu ${leer}` : leer
}

/** Beschriftung des Knopfs zum Beheben, oder null, wenn es nichts Passendes gibt */
export function leerraumKnopf(l: Leerraum): string | null {
  return l.art && l.block ? LEERRAUM_KNOPF[l.art] : null
}

/** Sucht halb leere Seiten und markiert sie auf dem Bildschirm. */
export function leerraumFinden(dok: Document): Leerraum[] {
  for (const alt of dok.querySelectorAll('.druckreif-leerraum')) alt.remove()
  const seiten = [...dok.querySelectorAll<HTMLElement>('.pagedjs_page')]
  const liste: Leerraum[] = []
  // Die letzte Seite darf leer auslaufen
  for (let i = 0; i < seiten.length - 1; i++) {
    const inhalt = seiten[i].querySelector<HTMLElement>('.pagedjs_page_content')
    if (!inhalt) continue
    const flaeche = inhalt.getBoundingClientRect()
    if (flaeche.height <= 0) continue
    let unten = flaeche.top
    for (const el of inhalt.querySelectorAll<HTMLElement>('[data-block]')) {
      const r = el.getBoundingClientRect()
      if (r.height > 0) unten = Math.max(unten, r.bottom)
    }
    const anteil = (flaeche.bottom - unten) / flaeche.height
    if (anteil < SCHWELLE) continue

    const erster = seiten[i + 1].querySelector<HTMLElement>('.pagedjs_page_content [data-block]')
    // Läuft ein geteilter Block weiter, liegt der Leerraum nicht an einem Umbruch
    if (!erster || erster.hasAttribute('data-split-from')) continue
    const ursache = ursacheFinden(erster)
    const eintrag: Leerraum = { seite: i + 1, anteil, ...ursache }
    liste.push(eintrag)
    markieren(seiten[i], flaeche, unten, eintrag, liste.length - 1)
  }
  return liste
}

/** Warum beginnt die nächste Seite mit diesem Block? Von innen nach außen alle Einheiten, die hier anfangen. */
function ursacheFinden(erster: HTMLElement): Omit<Leerraum, 'seite' | 'anteil'> {
  const kette: HTMLElement[] = []
  for (let el: HTMLElement | null = erster; el && !el.classList.contains('pagedjs_page_content'); el = el.parentElement) {
    if (el.hasAttribute('data-split-from')) break
    if (el !== erster && el.querySelector('[data-block]') !== erster) break
    kette.push(el)
    if (el.tagName === 'ARTICLE') break
  }
  const notiz = erster.closest<HTMLElement>('article.notiz')?.dataset.notiz ?? ''
  const fenster = erster.ownerDocument.defaultView!

  const manuell = kette.find((el) => el.classList.contains('umbruch-vor'))
  if (manuell) return { notiz, block: blockVon(manuell), art: 'umbruch', was: beschreiben(manuell) }

  const artikel = kette.find((el) => el.tagName === 'ARTICLE')
  if (artikel && !artikel.classList.contains('anschliessen')) {
    return { notiz, block: blockVon(artikel), art: 'notiz', was: `Notiz „${erster.textContent?.trim() ?? ''}“` }
  }

  // Äußerste Einheit, die am Stück bleiben soll
  const amStueck = [...kette].reverse().find((el) => el.tagName !== 'ARTICLE' && fenster.getComputedStyle(el).breakInside.startsWith('avoid'))
  if (!amStueck) return { notiz, block: null, art: null, was: beschreiben(erster) }
  // „Teilen erlauben“ nur, wo druck.css eine .teilbar-Regel hat (Abschnitte, Listen, Callouts, Code)
  const teilbar = amStueck.matches('section, ul, ol, .callout, pre')
  const art = amStueck.tagName === 'TABLE' ? 'tabelle' : amStueck.tagName === 'FIGURE' ? 'bild' : teilbar ? 'teilen' : null
  return { notiz, block: blockVon(amStueck), art, was: beschreiben(amStueck) }
}

/** Block-ID einer Einheit: bei Abschnitten und Notizen die Überschrift am Anfang. */
function blockVon(el: HTMLElement): string | null {
  return el.dataset.block ?? el.querySelector<HTMLElement>('[data-block]')?.dataset.block ?? null
}

function beschreiben(el: HTMLElement): string {
  const ueberschrift = el.tagName === 'SECTION' && /^H[2-6]$/.test(el.firstElementChild?.tagName ?? '') ? el.firstElementChild : /^H[1-6]$/.test(el.tagName) ? el : null
  if (ueberschrift) return `Abschnitt „${ueberschrift.textContent?.trim()}“`
  const namen: Record<string, string> = { TABLE: 'Tabelle', FIGURE: 'Bild', UL: 'Liste', OL: 'Liste', PRE: 'Codeblock', P: 'Absatz' }
  if (el.classList.contains('callout')) return 'Callout'
  if (el.classList.contains('mermaid-diagramm')) return 'Diagramm'
  if (el.classList.contains('katex-display') || el.querySelector('.katex-display')) return 'Formel'
  return namen[el.tagName] ?? 'Block'
}

/** Schraffierte Fläche über dem leeren Teil der Seite, mit Knopf. Nur Bildschirm (vorschau.css). */
function markieren(seite: HTMLElement, flaeche: DOMRect, unten: number, l: Leerraum, index: number) {
  const dok = seite.ownerDocument
  const rand = seite.getBoundingClientRect()
  const prozent = (wert: number, gesamt: number) => `${(wert / gesamt) * 100}%`
  const marke = dok.createElement('div')
  marke.className = 'druckreif-leerraum'
  Object.assign(marke.style, {
    top: prozent(unten - rand.top, rand.height),
    height: prozent(flaeche.bottom - unten, rand.height),
    left: prozent(flaeche.left - rand.left, rand.width),
    width: prozent(flaeche.width, rand.width),
  })
  const text = dok.createElement('span')
  text.textContent = leerraumText(l, false)
  marke.append(text)
  const beschriftung = leerraumKnopf(l)
  if (beschriftung) {
    const knopf = dok.createElement('button')
    knopf.type = 'button'
    knopf.dataset.leerraum = String(index)
    knopf.textContent = beschriftung
    marke.append(knopf)
  }
  seite.append(marke)
}
