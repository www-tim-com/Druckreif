// Markdown einer Notiz -> HTML im Obsidian-Gerüst.

import DOMPurify from 'dompurify'
import markdownIt, { type MarkdownIt, type Token } from 'markdown-it'
import footnote from 'markdown-it-footnote'
import mark from 'markdown-it-mark'
import katex from '@vscode/markdown-it-katex'
import katexBibliothek from 'katex'
import type { Stufe } from '../hinweise'
import { bildZiel, dekodieren, einbettungsZiel, obsidianPlugin } from './obsidian'
import { BILD_ENDUNGEN, endung } from '../vault/vault'
import { vorbereiten } from './vorbereiten'

/** Wird an markdown-it als `env` durchgereicht. */
export interface UmwandelKontext {
  /** URL eines Bildes per Dateiname, oder null wenn nicht (eindeutig) gefunden */
  bildUrl(name: string): string | null
  hinweis(stufe: Stufe, text: string): void
  /**
   * Eingebettete Notiz ![[Ziel]]: true = wird eingefügt (Inhalt setzt aufbauen.ts an die Stelle des Platzhalters),
   * false = nur Platzhalter; fehlt = verschachtelte Einbettung (wird nie eingefügt).
   */
  einbettung?(ziel: string): boolean
}

// CommonJS-Paket: je nach Bundler steckt das Plugin in .default
const katexPlugin = (katex as unknown as { default?: typeof katex }).default ?? katex

const instanzen = new Map<boolean, MarkdownIt>()
// sieht aus wie KaTeX' Standard-Rot (#cc0000), kommt aber in Notizen praktisch nie vor
const FEHLERFARBE = '#cc0001'

function parser(zeilenumbruch: boolean): MarkdownIt {
  let md = instanzen.get(zeilenumbruch)
  if (!md) {
    md = markdownIt({ html: true, breaks: zeilenumbruch, linkify: false })
      // Nur Zeilen mit # sind Überschriften; Trennlinien entfernt vorbereiten()
      .disable(['lheading', 'hr'])
      .use(footnote)
      .use(mark)
      // ohne MathML: das entfernt saeubern(). KaTeX ausdrücklich übergeben: das Plugin brächte sonst eine ältere
      // Fassung mit, deren HTML nicht zu katex.min.css passt.
      // Fehlerfarbe als Erkennungszeichen: unbekannte Befehle (z. B. \ce) setzt KaTeX sonst als roten Quelltext mitten
      // in die Formel, ohne Fehlerklasse – formelFehlerErsetzen() findet sie über diese Farbe
      .use(katexPlugin, { throwOnError: false, errorColor: FEHLERFARBE, output: 'html', katex: katexBibliothek })
      .use(obsidianPlugin)
    instanzen.set(zeilenumbruch, md)
  }
  return md
}

/**
 * Bildnamen aus ![[…]] und ![…](…), damit die Bilder vor dem Umwandeln geladen werden können.
 * Liest dieselben Tokens wie obsidian.ts beim Umwandeln, damit beide dieselben Namen liefern.
 */
export function bilderFinden(text: string): string[] {
  const namen = new Set<string>()
  const env = { bildUrl: () => null, hinweis: () => {} }
  const besuchen = (tokens: Token[]) => {
    for (const t of tokens) {
      if (t.type === 'obsidian_bild') namen.add((t.meta as { name: string }).name)
      if (t.type === 'image') {
        const src = String(t.attrGet('src') ?? '')
        if (!/^[a-z]+:/i.test(src)) namen.add(dekodieren(src))
      }
      if (t.children) besuchen(t.children)
    }
  }
  besuchen(parser(true).parse(vorbereiten(text), env))
  return [...namen]
}

/** Ziele eingebetteter Notizen (nicht Bilder), wie in der Notiz geschrieben, z. B. „Asthma bronchiale#Therapie“. */
export function einbettungenFinden(text: string): string[] {
  const ziele = new Set<string>()
  for (const t of text.matchAll(/!\[\[(.+?)\]\]/g)) {
    const ziel = einbettungsZiel(t[1])
    if (!BILD_ENDUNGEN.includes(endung(bildZiel(ziel)))) ziele.add(ziel)
  }
  return [...ziele]
}

/**
 * Markdown (ohne Frontmatter) -> HTML. `id` macht die Fußnoten-Anker eindeutig, wenn mehrere Notizen
 * in einem Dokument stehen.
 */
export function markdownUmwandeln(text: string, kontext: UmwandelKontext, strictLineBreaks: boolean, id: string): string {
  const html = saeubern(parser(!strictLineBreaks).render(vorbereiten(text), { ...kontext, docId: id }), kontext)
  return formelFehlerErsetzen(html, kontext)
}

/** Formeln, die KaTeX nicht versteht: nie als roten Rohcode drucken, sondern Platzhalter + roter Hinweis. */
function formelFehlerErsetzen(html: string, kontext: UmwandelKontext): string {
  if (!html.includes('katex-error') && !html.includes(FEHLERFARBE)) return html
  const vorlage = document.createElement('template')
  vorlage.innerHTML = html
  for (const fehler of vorlage.content.querySelectorAll<HTMLElement>(`.katex-error, [style*="${FEHLERFARBE}"]`)) {
    if (!vorlage.content.contains(fehler)) continue // schon mit der ganzen Formel ersetzt
    const formel = fehler.closest<HTMLElement>('.katex-display, .katex') ?? fehler
    // Formelblock (p.katex-block) bleibt ein Absatz, Formel im Satz ein span
    const ersatz = document.createElement(formel.tagName === 'P' ? 'p' : 'span')
    ersatz.className = 'formel-fehlt'
    ersatz.textContent = 'Formel nicht darstellbar'
    // katex-error: title = Quelltext, Inhalt = Fehlermeldung; sonst ist der rote Text der unbekannte Befehl
    const grund = fehler.classList.contains('katex-error')
      ? `„${fehler.title}“ (${fehler.textContent?.replace(/^ParseError: /, '').trim()})`
      : `mit unbekanntem Befehl „${fehler.textContent?.trim()}“`
    kontext.hinweis('rot', `Formel ${grund} nicht darstellbar`)
    formel.replaceWith(ersatz)
  }
  return vorlage.innerHTML
}

/**
 * HTML aus der Notiz (z. B. <img onerror=…>, <script>) darf in der App nichts ausführen – die App hat
 * Schreibzugriff auf den Vault. Entferntes wird gemeldet, nie stillschweigend weggelassen.
 */
function saeubern(html: string, kontext: UmwandelKontext): string {
  const sauber = DOMPurify.sanitize(html, {
    // Bilder kommen als blob:-URLs aus dem Vault
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    // sonst landet <style>/<meta> am Anfang im <head> und verschwindet ohne Eintrag in DOMPurify.removed
    FORCE_BODY: true,
  })
  const entfernt = new Set<string>()
  for (const r of DOMPurify.removed as { element?: Element; attribute?: Attr | null }[]) {
    if (r.attribute) entfernt.add(`${r.attribute.name}=…`)
    // <remove> setzt DOMPurify bei FORCE_BODY selbst an den Anfang und entfernt es wieder
    else if (r.element instanceof Element && r.element.tagName !== 'REMOVE') entfernt.add(`<${r.element.tagName.toLowerCase()}>`)
  }
  if (entfernt.size > 0) {
    kontext.hinweis('gelb', `HTML aus der Notiz nicht übernommen (nicht sicher): ${[...entfernt].join(', ')}`)
  }
  return sauber
}
