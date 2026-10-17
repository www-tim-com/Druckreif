// Textebene vor markdown-it: entfernt nur, was laut Export-Anweisung nicht in die PDF gehört.
// Alles andere bleibt wortgleich (oberste Regel: Inhalt unverändert).
// Codeblöcke (``` / ~~~, auch in Callouts und Listen) und Formelblöcke ($$) werden nie angefasst.

const LINIE = /^(?:-\s*){3,}$|^(?:\*\s*){3,}$|^(?:_\s*){3,}$|^={3,}$/ // ---, ***, ___, ===
const BLOCK_ID = /\s\^[A-Za-z0-9-]+\s*$/ // ^abc123 am Zeilenende
const NUR_BLOCK_ID = /^\^[A-Za-z0-9-]+$/
/** Name eines #tags wie in Obsidian (nicht nur Ziffern); gemeinsam mit der Tag-Regel in obsidian.ts */
export const TAG_NAME = String.raw`[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*`
const NUR_TAGS = new RegExp(String.raw`^(?:#${TAG_NAME}\s*)+$`, 'u') // Zeile nur aus #tags
/** Einrückung und Zitat-/Callout-Zeichen vor dem eigentlichen Zeileninhalt */
const PRAEFIX = /^[ \t]*(?:>[ \t]?)*[ \t]*/
const FENCE = /^(`{3,}|~{3,})/

function teilen(zeile: string): { praefix: string; inhalt: string } {
  const praefix = PRAEFIX.exec(zeile)![0]
  return { praefix, inhalt: zeile.slice(praefix.length) }
}

/**
 * Welche Zeilen zu einem Codeblock oder $$-Formelblock gehören (samt Begrenzungszeilen).
 * Auch genutzt, um Überschriften beim Ausschneiden von Abschnitten zu finden.
 */
export function geschuetzteZeilen(zeilen: string[]): boolean[] {
  const ergebnis: boolean[] = []
  let fence: string | null = null
  let formel = false
  for (const zeile of zeilen) {
    const { inhalt } = teilen(zeile)
    if (fence !== null) {
      ergebnis.push(true)
      const f = FENCE.exec(inhalt)
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && inhalt.trim() === f[1]) fence = null
      continue
    }
    if (formel) {
      ergebnis.push(true)
      if (inhalt.includes('$$')) formel = false
      continue
    }
    const f = FENCE.exec(inhalt)
    if (f) {
      fence = f[1]
      ergebnis.push(true)
      continue
    }
    // $$ öffnet einen Formelblock, wenn es in derselben Zeile nicht wieder geschlossen wird
    if (inhalt.startsWith('$$') && !inhalt.slice(2).includes('$$')) {
      formel = true
      ergebnis.push(true)
      continue
    }
    ergebnis.push(false)
  }
  return ergebnis
}

/** Markdown ohne Frontmatter (das entfernt der Aufrufer mit frontmatterLesen). */
export function vorbereiten(text: string): string {
  const zeilen = text.split(/\r?\n/)
  const geschuetzt = geschuetzteZeilen(zeilen)
  const teile: { code: boolean; zeilen: string[] }[] = []
  for (const [i, zeile] of zeilen.entries()) {
    const letztes = teile[teile.length - 1]
    if (letztes && letztes.code === geschuetzt[i]) letztes.zeilen.push(zeile)
    else teile.push({ code: geschuetzt[i], zeilen: [zeile] })
  }
  return teile
    .map((teil) => (teil.code ? teil.zeilen.join('\n') : textBereinigen(teil.zeilen.join('\n'))))
    .join('\n')
}

function textBereinigen(text: string): string {
  // %%Kommentar%%, auch mehrzeilig
  const ohneKommentare = text.replace(/%%[\s\S]*?%%/g, '')
  return ohneKommentare
    .split('\n')
    .map((zeile) => {
      const { praefix, inhalt } = teilen(zeile)
      const rest = inhalt.trim()
      // Trennlinien und Setext-Unterstreichungen: Linie weg, Textzeile bleibt normaler Absatz.
      // Das Zitat-/Callout-Zeichen bleibt stehen, sonst zerfiele der Callout in zwei.
      if (rest && (LINIE.test(rest) || NUR_BLOCK_ID.test(rest) || NUR_TAGS.test(rest))) return praefix.trimEnd()
      return zeile.replace(BLOCK_ID, '')
    })
    .join('\n')
}
