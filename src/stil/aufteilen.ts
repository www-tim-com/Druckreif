// CSS aus dem Vault (Theme, Snippets) für die Vorschau aufbereiten.
// Paged.js verarbeitet jedes Stylesheet selbst und verliert dabei vieles, was in Obsidian geht: @media-Regeln
// (außer print), :is()/:where()/:has(), verschachtelte Regeln, Selektoren mit „+“ (geringere Spezifität).
// Deshalb wendet der Browser das Vault-CSS direkt an („nativ“, an Paged.js vorbei). Nur was Paged.js für den
// Seitenumbruch selbst braucht – @page, Umbrüche, Zähler –, bekommt es als eigenes kleines Stylesheet („umbruch“).

import type { Hinweis } from '../hinweise'

export interface VaultCss {
  /** wendet der Browser direkt an (data-pagedjs-ignore) */
  nativ: string
  /** @page-Regeln und Umbruch-/Zähler-Angaben für Paged.js */
  umbruch: string
}

/** Eigenschaften, die Paged.js selbst auswerten muss (im Druck sonst zusätzliche Umbrüche innerhalb einer Seite) */
const UMBRUCH = [
  'break-before',
  'break-after',
  'break-inside',
  'page-break-before',
  'page-break-after',
  'page-break-inside',
  'page',
  'counter-increment',
  'counter-reset',
  'counter-set',
  'string-set',
]

/** Selektoren, an denen Paged.js scheitert (siehe CLAUDE.md) */
const ZU_NEU = /:is\(|:where\(|:has\(|&|\([^)]*,/

/** Klassen der Bearbeitungsansicht (Live Preview) – die gibt es in der Leseansicht und im Druck nicht */
const EDITOR = /markdown-source-view|\.cm-|HyperMD|is-live-preview/

export function cssAufteilen(css: string, quelle: string, hinweise: Hinweis[]): VaultCss {
  const blatt = new CSSStyleSheet()
  // replaceSync lässt @import weg (z. B. Schriften von Google Fonts) – die bleiben vorn im nativen Teil
  const nativ: string[] = css.match(/@import\s[^;]+;/g) ?? []
  const umbruch: string[] = []
  const verloren: string[] = []
  let regeln = 0
  let nurEditor = true

  try {
    blatt.replaceSync(css)
  } catch {
    hinweise.push({ stufe: 'gelb', notiz: '', text: `${quelle}: CSS nicht lesbar – nicht angewendet` })
    return { nativ: '', umbruch: '' }
  }

  function stilregel(regel: CSSStyleRule, oben: boolean) {
    regeln++
    if (!EDITOR.test(regel.selectorText)) nurEditor = false
    const angaben = UMBRUCH.filter((n) => regel.style.getPropertyValue(n))
      .map((n) => `${n}: ${regel.style.getPropertyValue(n)}${regel.style.getPropertyPriority(n) ? ' !important' : ''};`)
    if (angaben.length > 0) {
      if (oben && !ZU_NEU.test(regel.selectorText)) umbruch.push(`${regel.selectorText} { ${angaben.join(' ')} }`)
      else verloren.push(regel.selectorText)
      for (const n of UMBRUCH) regel.style.removeProperty(n)
    }
    // verschachtelte Regeln (CSS Nesting)
    for (const kind of regel.cssRules) if (kind instanceof CSSStyleRule) stilregel(kind, false)
  }

  function aufteilen(liste: CSSRuleList, ziel: string[]) {
    for (const regel of liste) {
      if (regel instanceof CSSPageRule) umbruch.push(regel.cssText)
      else if (regel instanceof CSSMediaRule) {
        const abfragen = [...regel.media].map((m) => m.trim().toLowerCase())
        // Obsidians PDF-Export druckt: print gilt immer, reine Bildschirm-Regeln nie, alles andere bleibt bedingt
        if (abfragen.some((m) => /^(only\s+)?print\b/.test(m))) aufteilen(regel.cssRules, ziel)
        else if (abfragen.every((m) => /^(only\s+)?screen\b/.test(m))) continue
        else {
          const innen: string[] = []
          for (const kind of regel.cssRules) if (kind instanceof CSSStyleRule) stilregel(kind, false)
          for (const kind of regel.cssRules) innen.push(kind.cssText)
          ziel.push(`@media ${regel.media.mediaText} { ${innen.join('\n')} }`)
        }
      } else {
        if (regel instanceof CSSStyleRule) stilregel(regel, true)
        ziel.push(regel.cssText)
      }
    }
  }
  aufteilen(blatt.cssRules, nativ)

  if (verloren.length > 0) {
    hinweise.push({
      stufe: 'gelb',
      notiz: '',
      text: `${quelle}: Seitenumbruch-Angaben für „${verloren.slice(0, 3).join('“, „')}“${verloren.length > 3 ? ' …' : ''} nicht übernommen (Selektor oder @media-Bedingung für den Seitenumbruch nicht auswertbar)`,
    })
  }
  if (regeln > 0 && nurEditor) {
    hinweise.push({
      stufe: 'gelb',
      notiz: '',
      text: `${quelle} gestaltet nur die Bearbeitungsansicht (Live Preview) – im Druck ohne Wirkung. Für die Leseansicht .markdown-rendered statt .markdown-source-view/.cm-… verwenden.`,
    })
  }
  return { nativ: nativ.join('\n'), umbruch: umbruch.join('\n') }
}
