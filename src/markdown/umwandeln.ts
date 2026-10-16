// Markdown einer Notiz -> HTML im Obsidian-Gerüst.

import DOMPurify from 'dompurify'
import markdownIt, { type MarkdownIt } from 'markdown-it'
import footnote from 'markdown-it-footnote'
import mark from 'markdown-it-mark'
import katex from '@vscode/markdown-it-katex'
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

function parser(zeilenumbruch: boolean): MarkdownIt {
  let md = instanzen.get(zeilenumbruch)
  if (!md) {
    md = markdownIt({ html: true, breaks: zeilenumbruch, linkify: false })
      // Nur Zeilen mit # sind Überschriften; Trennlinien entfernt vorbereiten()
      .disable(['lheading', 'hr'])
      .use(footnote)
      .use(mark)
      .use(katexPlugin, { throwOnError: false, output: 'html' }) // ohne MathML: das entfernt saeubern()
      .use(obsidianPlugin)
    instanzen.set(zeilenumbruch, md)
  }
  return md
}

/**
 * Bildnamen aus ![[…]] und ![…](…), damit die Bilder vor dem Umwandeln geladen werden können.
 * Muss dieselben Namen liefern, unter denen obsidian.ts später nachschlägt (bildZiel, dekodieren).
 */
export function bilderFinden(text: string): string[] {
  const namen = new Set<string>()
  for (const t of text.matchAll(/!\[\[(.+?)\]\]/g)) namen.add(bildZiel(t[1]))
  for (const t of text.matchAll(/!\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))/g)) {
    const ziel = t[1] ?? t[2]
    if (!/^[a-z]+:/i.test(ziel)) namen.add(dekodieren(ziel))
  }
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

export function markdownUmwandeln(text: string, kontext: UmwandelKontext, strictLineBreaks: boolean): string {
  return saeubern(parser(!strictLineBreaks).render(vorbereiten(text), { ...kontext }), kontext)
}

/**
 * HTML aus der Notiz (z. B. <img onerror=…>, <script>) darf in der App nichts ausführen – die App hat
 * Schreibzugriff auf den Vault. Entferntes wird gemeldet, nie stillschweigend weggelassen.
 */
function saeubern(html: string, kontext: UmwandelKontext): string {
  const sauber = DOMPurify.sanitize(html, {
    // Bilder kommen als blob:-URLs aus dem Vault
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  })
  const entfernt = new Set<string>()
  for (const r of DOMPurify.removed as { element?: Element; attribute?: Attr | null }[]) {
    if (r.attribute) entfernt.add(`${r.attribute.name}=…`)
    else if (r.element instanceof Element) entfernt.add(`<${r.element.tagName.toLowerCase()}>`)
  }
  if (entfernt.size > 0) {
    kontext.hinweis('gelb', `HTML aus der Notiz nicht übernommen (nicht sicher): ${[...entfernt].join(', ')}`)
  }
  return sauber
}
