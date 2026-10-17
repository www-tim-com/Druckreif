// Eingebauter Demo-Vault aus demo/vault/ – läuft in jedem Browser, ohne Ordnerdialog.
// Geschriebene Dateien (Layout) bleiben nur bis zum Neuladen der Seite im Speicher.

import type { Vault } from './vault'

// Vite liefert für jede Datei eine URL. Der Glob überspringt Ordner mit Punkt (.obsidian),
// deshalb werden diese Dateien einzeln importiert – neue Dateien dort hier ergänzen.
import appJson from '/demo/vault/.obsidian/app.json?url'
import appearanceJson from '/demo/vault/.obsidian/appearance.json?url'
// CSS als Text: über ?url liefert Vites Entwicklungsserver ein JS-Modul statt des Stylesheets
import snippetLernzettel from '/demo/vault/.obsidian/snippets/lernzettel.css?raw'

const urls: Record<string, string> = {
  ...(import.meta.glob('/demo/vault/**/*', { query: '?url', import: 'default', eager: true }) as Record<string, string>),
  '/demo/vault/.obsidian/app.json': appJson,
  '/demo/vault/.obsidian/appearance.json': appearanceJson,
  '/demo/vault/.obsidian/snippets/lernzettel.css': URL.createObjectURL(new Blob([snippetLernzettel], { type: 'text/css' })),
}

const PRAEFIX = '/demo/vault/'

export function demoVault(): Vault {
  const dateiUrls = new Map<string, string>()
  for (const [schluessel, url] of Object.entries(urls)) dateiUrls.set(schluessel.slice(PRAEFIX.length), url)
  const geschrieben = new Map<string, { text: string; zeit: number }>()

  async function laden(pfad: string): Promise<Response> {
    const url = dateiUrls.get(pfad)
    if (!url) throw new Error(`Datei nicht gefunden: ${pfad}`)
    return fetch(url)
  }

  const vault: Vault = {
    name: 'Demo-Vault',
    dateien: sortiert([...dateiUrls.keys()]),
    lesenText: async (pfad) => geschrieben.get(pfad)?.text ?? (await laden(pfad)).text(),
    lesenBlob: async (pfad) => (await laden(pfad)).blob(),
    geaendertAm: async (pfad) => geschrieben.get(pfad)?.zeit ?? 0,
    aktualisieren: async () => {}, // Demo-Dateien ändern sich nicht
    async schreibenText(pfad, text) {
      geschrieben.set(pfad, { text, zeit: Date.now() })
      if (!vault.dateien.includes(pfad)) vault.dateien = sortiert([...vault.dateien, pfad])
    },
  }
  return vault
}

function sortiert(pfade: string[]): string[] {
  return pfade.sort((a, b) => a.localeCompare(b, 'de'))
}
