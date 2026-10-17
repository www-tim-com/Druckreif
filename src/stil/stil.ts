// Liest Obsidian-Einstellungen aus dem Vault: Theme, Snippets, Akzentfarbe, Anhang-Ordner, Zeilenumbrüche.

import type { Hinweis } from '../hinweise'
import type { Vault } from '../vault/vault'

export interface VaultEinstellungen {
  /** CSS aus dem Vault in Reihenfolge: Theme, Snippets, Akzentfarbe */
  css: string[]
  theme: string | null
  snippets: string[]
  strictLineBreaks: boolean
  /** attachmentFolderPath aus app.json, z. B. "Anhänge", "./" oder "./bilder" */
  anhangOrdner: string
}

/** Obsidian-Einstellungsdatei; unlesbar = Standardwerte, aber nie stillschweigend (gelber Hinweis) */
async function jsonLesen(vault: Vault, pfad: string, hinweise: Hinweis[]): Promise<Record<string, unknown>> {
  if (!vault.dateien.includes(pfad)) return {}
  try {
    const daten: unknown = JSON.parse(await vault.lesenText(pfad))
    if (typeof daten === 'object' && daten !== null && !Array.isArray(daten)) return daten as Record<string, unknown>
  } catch {
    // unten gemeldet
  }
  hinweise.push({ stufe: 'gelb', notiz: '', text: `${pfad} ist nicht lesbar – Obsidians Standardeinstellungen verwendet` })
  return {}
}

export async function vaultEinstellungenLaden(vault: Vault): Promise<{ einstellungen: VaultEinstellungen; hinweise: Hinweis[] }> {
  const hinweise: Hinweis[] = []
  const app = await jsonLesen(vault, '.obsidian/app.json', hinweise)
  const aussehen = await jsonLesen(vault, '.obsidian/appearance.json', hinweise)
  const css: string[] = []

  const theme = typeof aussehen.cssTheme === 'string' && aussehen.cssTheme ? aussehen.cssTheme : null
  if (theme) {
    // neue Ablage: themes/<Name>/theme.css, alte: themes/<Name>.css
    const pfad = [`.obsidian/themes/${theme}/theme.css`, `.obsidian/themes/${theme}.css`].find((p) => vault.dateien.includes(p))
    if (pfad) css.push(await vault.lesenText(pfad))
    else hinweise.push({ stufe: 'gelb', notiz: '', text: `Theme „${theme}“ nicht gefunden, Standard-Theme verwendet` })
  }

  const snippets = Array.isArray(aussehen.enabledCssSnippets) ? (aussehen.enabledCssSnippets as string[]) : []
  for (const name of snippets) {
    const pfad = `.obsidian/snippets/${name}.css`
    if (vault.dateien.includes(pfad)) css.push(await vault.lesenText(pfad))
    else hinweise.push({ stufe: 'gelb', notiz: '', text: `CSS-Snippet „${name}“ nicht gefunden` })
  }

  if (typeof aussehen.accentColor === 'string' && aussehen.accentColor) {
    const hsl = hexZuHsl(aussehen.accentColor)
    if (hsl) css.push(`body { --accent-h: ${hsl[0]}; --accent-s: ${hsl[1]}%; --accent-l: ${hsl[2]}%; }`)
  }

  return {
    einstellungen: {
      css,
      theme,
      snippets,
      strictLineBreaks: app.strictLineBreaks === true,
      anhangOrdner: typeof app.attachmentFolderPath === 'string' ? app.attachmentFolderPath : '/',
    },
    hinweise,
  }
}

/** Anhang-Ordner für eine bestimmte Notiz auflösen ("./" = Ordner der Notiz). */
export function anhangOrdnerFuer(anhangOrdner: string, notizOrdner: string): string {
  if (anhangOrdner === '/' || anhangOrdner === '') return ''
  if (anhangOrdner.startsWith('./')) {
    const rest = anhangOrdner.slice(2).replace(/\/$/, '')
    return [notizOrdner, rest].filter(Boolean).join('/')
  }
  return anhangOrdner.replace(/^\/|\/$/g, '')
}

function hexZuHsl(hex: string): [number, number, number] | null {
  const t = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!t) return null
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(t[1].slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}
