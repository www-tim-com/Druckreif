// markdown-it-Erweiterungen für Obsidian-Syntax. Erzeugt dasselbe HTML-Gerüst wie Obsidians Leseansicht,
// damit Theme und Snippets ohne Anpassung greifen.

import type { MarkdownIt, StateCore, StateInline, Token } from 'markdown-it'
import { BILD_ENDUNGEN, endung } from '../vault/vault'
import type { UmwandelKontext } from './umwandeln'
import { TAG_NAME } from './vorbereiten'

/** Codeblöcke von Plugins, die in der PDF nicht erscheinen */
const PLUGIN_BLOECKE = ['dataview', 'dataviewjs', 'query', 'tasks', 'excalidraw', 'chart', 'kanban']

export function obsidianPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'wikilink', wikilink)
  md.inline.ruler.push('tag', tag)
  md.core.ruler.after('block', 'callout', callouts)
  md.core.ruler.after('inline', 'aufgaben', aufgaben)

  md.renderer.rules.obsidian_bild = (tokens, i, _opt, env) => bildHtml(tokens[i].meta as unknown as BildMeta, kontext(env))
  md.renderer.rules.callout_open = (tokens, i) => {
    const { typ } = tokens[i].meta as { typ: string }
    return `<div class="callout" data-callout="${md.utils.escapeHtml(typ)}"><div class="callout-title"><div class="callout-title-inner">`
  }
  md.renderer.rules.callout_titel_close = () => '</div></div><div class="callout-content">\n'
  md.renderer.rules.callout_close = () => '</div></div>\n'

  // Standard-Markdown-Bilder ![Text](pfad.png) wie ![[…]] behandeln
  const bildStandard = md.renderer.rules.image!
  md.renderer.rules.image = (tokens, i, opt, env, self) => {
    const src = String(tokens[i].attrGet('src') ?? '')
    if (/^[a-z]+:/i.test(src)) return bildStandard(tokens, i, opt, env, self)
    return bildHtml({ name: dekodieren(src), alt: tokens[i].content }, kontext(env))
  }

  const fenceStandard = md.renderer.rules.fence!
  md.renderer.rules.fence = (tokens, i, opt, env, self) => {
    const sprache = tokens[i].info.trim().split(/\s+/)[0].toLowerCase()
    if (sprache === 'mermaid') {
      // kodiert: „-->“ in einem Attribut würde saeubern() sonst samt Quelle entfernen
      return `<div class="mermaid-diagramm" data-quelle="${encodeURIComponent(tokens[i].content)}"></div>\n`
    }
    if (PLUGIN_BLOECKE.includes(sprache)) {
      kontext(env).hinweis('info', `Plugin-Block „${sprache}“ nicht ausgegeben`)
      return ''
    }
    return fenceStandard(tokens, i, opt, env, self)
  }
}

function kontext(env: unknown): UmwandelKontext {
  return env as UmwandelKontext
}

/** %20 usw. auflösen; Dateinamen mit einem echten % (z. B. „50%.png“) bleiben, wie sie sind. */
export function dekodieren(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** Ziel einer eingebetteten Notiz aus dem Inhalt von ![[…]]: ohne |Anzeigetext, mit #Abschnitt. */
export function einbettungsZiel(inhalt: string): string {
  return inhalt.replace(/\\\|/g, '|').split('|')[0].trim()
}

/** Dateiname aus dem Inhalt von ![[…]]: ohne |Größe und ohne #Abschnitt (in Tabellen steht \| statt |). */
export function bildZiel(inhalt: string): string {
  return inhalt.replace(/\\\|/g, '|').split('|')[0].split('#')[0].trim()
}

// ---- [[Wikilinks]] und ![[Einbettungen]] ----

function wikilink(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  const einbettung = state.src.startsWith('![[', start)
  if (!einbettung && !state.src.startsWith('[[', start)) return false
  const anfang = start + (einbettung ? 3 : 2)
  const ende = state.src.indexOf(']]', anfang)
  if (ende < 0) return false
  if (silent) {
    // markdown-it verlangt auch hier, dass die Regel state.pos weiterschiebt (z. B. in [Text [[Link]]](url))
    state.pos = ende + 2
    return true
  }

  // in Tabellen schreibt Obsidian \| statt |
  const inhalt = state.src.slice(anfang, ende).replace(/\\\|/g, '|')
  const [ziel, ...rest] = inhalt.split('|')
  const anzeige = rest.join('|')
  const env = kontext(state.env)

  if (einbettung && BILD_ENDUNGEN.includes(endung(bildZiel(ziel)))) {
    const token = state.push('obsidian_bild', 'img', 0)
    const groesse = /^(\d+)(?:x(\d+))?$/.exec(anzeige.trim())
    token.meta = {
      name: bildZiel(ziel),
      breite: groesse ? Number(groesse[1]) : undefined,
      hoehe: groesse?.[2] ? Number(groesse[2]) : undefined,
      alt: groesse ? '' : anzeige,
    }
  } else if (einbettung) {
    // Platzhalter: aufbauen.ts ersetzt ihn durch den Inhalt oder lässt ihn als Hinweis auf dem Bildschirm stehen
    const zielText = einbettungsZiel(ziel)
    const eingefuegt = env.einbettung?.(zielText) ?? false
    if (!env.einbettung) env.hinweis('info', `Eingebettete Notiz „${zielText}“ in einer eingebetteten Notiz – nicht eingefügt`)
    const token = state.push('html_inline', '', 0)
    token.content = `<span class="einbettung${eingefuegt ? ' eingefuegt' : ''}${env.einbettung ? '' : ' verschachtelt'}" data-ziel="${state.md.utils.escapeHtml(zielText)}"></span>`
  } else {
    // Link wird normaler Text: Anzeigetext, sonst Notizname ohne #Abschnitt
    const text = state.push('text', '', 0)
    text.content = anzeige || ziel.split('#')[0] || ziel.replace(/^#/, '')
  }
  state.pos = ende + 2
  return true
}

// ---- #tags mitten im Satz ----

const TAG_REGEL = new RegExp(`^#(${TAG_NAME})`, 'u')

function tag(state: StateInline, silent: boolean): boolean {
  const start = state.pos
  if (state.src.charCodeAt(start) !== 0x23 /* # */) return false
  if (start > 0 && !/\s/.test(state.src[start - 1])) return false
  const treffer = TAG_REGEL.exec(state.src.slice(start))
  if (!treffer) return false
  if (!silent) {
    const auf = state.push('html_inline', '', 0)
    auf.content = `<a href="#${state.md.utils.escapeHtml(treffer[1])}" class="tag">`
    const text = state.push('text', '', 0)
    text.content = treffer[0]
    state.push('html_inline', '', 0).content = '</a>'
  }
  state.pos += treffer[0].length
  return true
}

// ---- Callouts: > [!typ]± Titel ----

function callouts(state: StateCore): void {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'blockquote_open') continue
    const inline = tokens[i + 2]
    if (tokens[i + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') continue
    const kopf = /^\[!([^\]]+)\][+-]?[ \t]*(.*)$/m.exec(inline.content.split('\n')[0])
    if (!kopf) continue

    const typ = kopf[1].trim().toLowerCase()
    const titel = kopf[2].trim() || typ.charAt(0).toUpperCase() + typ.slice(1)
    tokens[i].type = 'callout_open'
    tokens[i].meta = { typ }
    const schliessen = passendesEnde(tokens, i)
    tokens[schliessen].type = 'callout_close'

    const titelToken = new state.Token('inline', '', 0)
    titelToken.content = titel
    titelToken.children = []
    const titelEnde = new state.Token('callout_titel_close', '', 0)

    const rest = inline.content.split('\n').slice(1).join('\n')
    if (rest.trim()) {
      inline.content = rest
      tokens.splice(i + 1, 0, titelToken, titelEnde)
    } else {
      // Absatz bestand nur aus der Titelzeile
      tokens.splice(i + 1, 3, titelToken, titelEnde)
    }
  }
}

function passendesEnde(tokens: Token[], start: number): number {
  let tiefe = 0
  for (let j = start; j < tokens.length; j++) {
    const t = tokens[j].type
    if (t === 'blockquote_open' || t === 'callout_open') tiefe++
    if (t === 'blockquote_close') tiefe--
    if (tiefe === 0) return j
  }
  return tokens.length - 1
}

// ---- Aufgaben: - [ ], - [x] und eigene Zeichen wie - [>] ----

function aufgaben(state: StateCore): void {
  const tokens = state.tokens
  for (let i = 2; i < tokens.length; i++) {
    const inline = tokens[i]
    if (inline.type !== 'inline' || tokens[i - 2]?.type !== 'list_item_open') continue
    const erstes = inline.children?.[0]
    const kasten = erstes?.type === 'text' ? /^\[([^\]])\]\s/.exec(erstes.content) : null
    if (!erstes || !kasten) continue
    const zeichen = kasten[1] === ' ' ? ' ' : kasten[1].toLowerCase()
    erstes.content = erstes.content.slice(kasten[0].length)
    const html = new state.Token('html_inline', '', 0)
    html.content = `<input type="checkbox" class="task-list-item-checkbox"${zeichen === ' ' ? '' : ' checked'} disabled> `
    inline.children!.unshift(html)
    tokens[i - 2].attrJoin('class', 'task-list-item' + (zeichen === ' ' ? '' : ' is-checked'))
    tokens[i - 2].attrSet('data-task', zeichen)
  }
}

// ---- Bilder ----

interface BildMeta {
  name: string
  breite?: number
  hoehe?: number
  alt?: string
}

function bildHtml(meta: BildMeta, env: UmwandelKontext): string {
  const url = env.bildUrl(meta.name)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  if (!url) {
    // Nie stillschweigend weglassen: sichtbarer Platzhalter + roter Hinweis
    env.hinweis('rot', `Bild „${meta.name}“ nicht gefunden oder nicht eindeutig`)
    return `<span class="bild-fehlt">Bild fehlt: ${esc(meta.name)}</span>`
  }
  const stil: string[] = []
  if (meta.breite) stil.push(`width:${meta.breite}px`)
  if (meta.hoehe) stil.push(`max-height:${meta.hoehe}px`, 'object-fit:contain')
  if (meta.breite || meta.hoehe) stil.push('height:auto')
  return `<img class="bild" src="${esc(url)}" data-bild="${esc(meta.name)}" alt="${esc(meta.alt ?? '')}"${
    stil.length ? ` style="${stil.join(';')}"` : ''
  }>`
}
