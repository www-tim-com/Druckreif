// Ein Vault ist eine Liste von Dateipfaden plus Lese-/Schreibzugriff.
// Zwei Umsetzungen: ordnerVault (echter Ordner, File System Access API) und demoVault (eingebaut).
// Pfade sind immer relativ zum Vault-Stamm mit "/" als Trenner, z. B. "Lernfeld 3/Atmung.md".

export interface Vault {
  name: string
  /** alle Dateien im Vault (ohne .trash, .git, node_modules), sortiert */
  dateien: string[]
  lesenText(pfad: string): Promise<string>
  lesenBlob(pfad: string): Promise<Blob>
  schreibenText(pfad: string, text: string): Promise<void>
  /** Zeitstempel der letzten Änderung, für "Neu laden bei Änderung" */
  geaendertAm(pfad: string): Promise<number>
  /** Dateiliste neu einlesen (neue, verschobene, gelöschte Dateien) */
  aktualisieren(): Promise<void>
}

export const BILD_ENDUNGEN = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']

export function dateiname(pfad: string): string {
  return pfad.slice(pfad.lastIndexOf('/') + 1)
}

export function ordner(pfad: string): string {
  const i = pfad.lastIndexOf('/')
  return i < 0 ? '' : pfad.slice(0, i)
}

export function ohneEndung(name: string): string {
  const i = name.lastIndexOf('.')
  return i <= 0 ? name : name.slice(0, i)
}

/** Anzeigename einer Notiz: Dateiname ohne .md */
export function notizName(pfad: string): string {
  return ohneEndung(dateiname(pfad))
}

export function endung(name: string): string {
  const i = name.lastIndexOf('.')
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase()
}

/** Ordner, die Obsidian ausblendet: alles mit Punkt am Anfang (.obsidian, .trash, .lernzettel) */
export function istVersteckt(pfad: string): boolean {
  return pfad.split('/').some((teil) => teil.startsWith('.'))
}

// Sichtbare Dateien nach Dateiname (klein geschrieben). Jede Layout-Änderung baut alles neu auf und sucht dabei jedes
// Bild – ohne Index jedes Mal ein Durchlauf über den ganzen Vault. `dateien` wird bei Änderungen ersetzt, nie verändert.
const namensIndexe = new WeakMap<string[], Map<string, string[]>>()

function namensIndex(dateien: string[]): Map<string, string[]> {
  let index = namensIndexe.get(dateien)
  if (!index) {
    index = new Map()
    for (const p of dateien) {
      if (istVersteckt(p)) continue
      const name = dateiname(p).toLowerCase()
      const liste = index.get(name)
      if (liste) liste.push(p)
      else index.set(name, [p])
    }
    namensIndexe.set(dateien, index)
  }
  return index
}

/**
 * Sucht eine Datei wie Obsidian per Name im ganzen Vault, ohne auf Groß-/Kleinschreibung zu achten
 * (genaue Schreibweise gewinnt). Bei mehreren Treffern: zuerst der Ordner der Notiz, dann der Anhang-Ordner.
 * Liefert null bei keinem Treffer, ein Array bei Mehrdeutigkeit.
 */
export function dateiFinden(
  vault: Vault,
  name: string,
  notizOrdner: string,
  anhangOrdner: string,
): string | string[] | null {
  const gesucht = name.replace(/^\.?\//, '')
  // Pfadangabe mit Ordner ("Bilder/x.png") direkt prüfen
  if (gesucht.includes('/')) {
    const relativ = notizOrdner ? `${notizOrdner}/${gesucht}` : gesucht
    for (const pfad of [relativ, gesucht]) {
      const gefunden = vault.dateien.find((p) => p === pfad) ?? vault.dateien.find((p) => p.toLowerCase() === pfad.toLowerCase())
      if (gefunden) return gefunden
    }
  }
  const gesuchterName = dateiname(gesucht)
  const kandidaten = namensIndex(vault.dateien).get(gesuchterName.toLowerCase()) ?? []
  const genau = kandidaten.filter((p) => dateiname(p) === gesuchterName)
  const treffer = genau.length > 0 ? genau : kandidaten
  if (treffer.length <= 1) return treffer[0] ?? null
  const imOrdner = treffer.filter((p) => ordner(p) === notizOrdner)
  if (imOrdner.length === 1) return imOrdner[0]
  const imAnhang = treffer.filter((p) => ordner(p) === anhangOrdner)
  if (imAnhang.length === 1) return imAnhang[0]
  return treffer
}
