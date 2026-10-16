// Fügt PDFs zu einer Datei zusammen: node werkzeuge/pdfs-zusammenfuegen.mjs <PDFs oder Ordner …>
// Reihenfolge nach Dateiname (natürlich sortiert: 2 vor 10). Ergebnis: zusammengefuegt.pdf neben der ersten Datei.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'

const AUSGABE = 'zusammengefuegt'

async function pdfsSammeln(argumente) {
  const dateien = []
  for (const arg of argumente) {
    const pfad = path.resolve(arg)
    if ((await stat(pfad)).isDirectory()) {
      for (const name of await readdir(pfad)) {
        if (name.toLowerCase().endsWith('.pdf') && !name.startsWith(AUSGABE)) dateien.push(path.join(pfad, name))
      }
    } else if (pfad.toLowerCase().endsWith('.pdf')) {
      dateien.push(pfad)
    } else {
      console.warn(`Übersprungen (kein PDF): ${pfad}`)
    }
  }
  const sortierer = new Intl.Collator('de', { numeric: true, sensitivity: 'base' })
  return dateien.sort((a, b) => sortierer.compare(path.basename(a), path.basename(b)))
}

// Nie eine vorhandene Datei überschreiben: zusammengefuegt.pdf, zusammengefuegt-2.pdf, …
function freierName(ordner) {
  for (let i = 1; ; i++) {
    const ziel = path.join(ordner, i === 1 ? `${AUSGABE}.pdf` : `${AUSGABE}-${i}.pdf`)
    if (!existsSync(ziel)) return ziel
  }
}

const dateien = await pdfsSammeln(process.argv.slice(2))
if (dateien.length < 2) {
  console.error('Bitte mindestens zwei PDFs (oder einen Ordner mit PDFs) angeben bzw. auf die .bat ziehen.')
  process.exit(1)
}

const ergebnis = await PDFDocument.create()
for (const datei of dateien) {
  const quelle = await PDFDocument.load(await readFile(datei), { ignoreEncryption: true })
  const seiten = await ergebnis.copyPages(quelle, quelle.getPageIndices())
  seiten.forEach((seite) => ergebnis.addPage(seite))
  console.log(`${String(seiten.length).padStart(4)} S.  ${path.basename(datei)}`)
}

const ziel = freierName(path.dirname(dateien[0]))
await writeFile(ziel, await ergebnis.save())
console.log(`\n${ergebnis.getPageCount()} Seiten -> ${ziel}`)
