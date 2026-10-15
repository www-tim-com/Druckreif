// Textebene vor markdown-it: entfernt nur, was laut Export-Anweisung nicht in die PDF gehört.
// Alles andere bleibt wortgleich (oberste Regel: Inhalt unverändert).
// Codeblöcke (``` / ~~~) werden nie angefasst.

import { frontmatterLesen } from '../vault/notizen'

const LINIE = /^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,}|={3,})\s*$/ // ---, ***, ___, ===
const BLOCK_ID = /\s\^[A-Za-z0-9-]+\s*$/ // ^abc123 am Zeilenende
const NUR_BLOCK_ID = /^\s*\^[A-Za-z0-9-]+\s*$/
const NUR_TAGS = /^\s*(?:#[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*\s*)+$/u // Zeile nur aus #tags
const FENCE = /^\s{0,3}(`{3,}|~{3,})/

export function vorbereiten(text: string): string {
  const { rest } = frontmatterLesen(text)
  const zeilen = rest.split(/\r?\n/)
  const teile: { code: boolean; zeilen: string[] }[] = []
  let fence: string | null = null

  for (const zeile of zeilen) {
    const f = FENCE.exec(zeile)
    if (fence === null && f) {
      fence = f[1]
      teile.push({ code: true, zeilen: [zeile] })
      continue
    }
    if (fence !== null) {
      teile[teile.length - 1].zeilen.push(zeile)
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && zeile.trim() === f[1]) fence = null
      continue
    }
    const letztes = teile[teile.length - 1]
    if (letztes && !letztes.code) letztes.zeilen.push(zeile)
    else teile.push({ code: false, zeilen: [zeile] })
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
      // Trennlinien und Setext-Unterstreichungen: Linie weg, Textzeile bleibt normaler Absatz
      if (LINIE.test(zeile) || NUR_BLOCK_ID.test(zeile) || NUR_TAGS.test(zeile)) return ''
      return zeile.replace(BLOCK_ID, '')
    })
    .join('\n')
}
