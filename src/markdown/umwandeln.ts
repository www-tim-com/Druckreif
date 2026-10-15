// Markdown einer Notiz -> HTML im Obsidian-Gerüst.

import markdownIt, { type MarkdownIt } from 'markdown-it'
import footnote from 'markdown-it-footnote'
import mark from 'markdown-it-mark'
import katex from '@vscode/markdown-it-katex'
import type { Stufe } from '../hinweise'
import { obsidianPlugin } from './obsidian'
import { vorbereiten } from './vorbereiten'

/** Wird an markdown-it als `env` durchgereicht. */
export interface UmwandelKontext {
  /** URL eines Bildes per Dateiname, oder null wenn nicht (eindeutig) gefunden */
  bildUrl(name: string): string | null
  hinweis(stufe: Stufe, text: string): void
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
      .use(katexPlugin, { throwOnError: false })
      .use(obsidianPlugin)
    instanzen.set(zeilenumbruch, md)
  }
  return md
}

/** Bildnamen aus ![[…]] und ![…](…), damit die Bilder vor dem Umwandeln geladen werden können. */
export function bilderFinden(text: string): string[] {
  const namen = new Set<string>()
  for (const t of text.matchAll(/!\[\[([^\]|#]+)/g)) namen.add(t[1].trim())
  for (const t of text.matchAll(/!\[[^\]]*\]\(<?([^)>\s]+)>?\)/g)) {
    if (!/^[a-z]+:/i.test(t[1])) namen.add(decodeURIComponent(t[1]))
  }
  return [...namen]
}

export function markdownUmwandeln(text: string, kontext: UmwandelKontext, strictLineBreaks: boolean): string {
  return parser(!strictLineBreaks).render(vorbereiten(text), { ...kontext })
}
