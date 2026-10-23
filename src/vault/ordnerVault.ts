// Echter Vault-Ordner über die File System Access API (nur Chrome/Edge, nur über localhost/https).

import type { Vault } from './vault'
import { holen, merken } from './speicher'

const SCHLUESSEL = 'vault'

// Neuere Chrome/Edge; noch nicht in den TypeScript-Typen
declare global {
  interface Window {
    FileSystemObserver?: new (rueckruf: () => void) => {
      observe(handle: FileSystemHandle, optionen: { recursive: boolean }): Promise<void>
      disconnect(): void
    }
  }
}

export function ordnerZugriffMoeglich(): boolean {
  return 'showDirectoryPicker' in window
}

/** Ordnerdialog öffnen (braucht Klick des Nutzers) und Freigabe merken. */
export async function ordnerWaehlen(): Promise<Vault> {
  const handle = await window.showDirectoryPicker({ id: 'vault', mode: 'readwrite' })
  await merken(SCHLUESSEL, handle)
  return ordnerLaden(handle)
}

/** Gemerkten Ordner holen. `fragen` nur aus einem Klick heraus aufrufen (Browser verlangt das). */
export async function gemerktenOrdnerOeffnen(fragen: boolean): Promise<Vault | 'keine-freigabe' | null> {
  const handle = await holen<FileSystemDirectoryHandle>(SCHLUESSEL)
  if (!handle) return null
  const optionen = { mode: 'readwrite' as const }
  let erlaubnis = await handle.queryPermission(optionen)
  if (erlaubnis !== 'granted' && fragen) erlaubnis = await handle.requestPermission(optionen)
  if (erlaubnis !== 'granted') return 'keine-freigabe'
  return ordnerLaden(handle)
}

export async function gemerkterOrdnerName(): Promise<string | null> {
  const handle = await holen<FileSystemDirectoryHandle>(SCHLUESSEL)
  return handle?.name ?? null
}

async function ordnerLaden(stamm: FileSystemDirectoryHandle): Promise<Vault> {
  async function durchlaufen(dir: FileSystemDirectoryHandle, praefix: string, ziel: Map<string, FileSystemFileHandle>) {
    for await (const [name, eintrag] of dir.entries()) {
      if (name === '.trash' || name === '.git' || name === 'node_modules') continue
      const pfad = praefix + name
      if (eintrag.kind === 'directory') await durchlaufen(eintrag as FileSystemDirectoryHandle, pfad + '/', ziel)
      else ziel.set(pfad, eintrag as FileSystemFileHandle)
    }
  }
  let dateien = new Map<string, FileSystemFileHandle>()
  await durchlaufen(stamm, '', dateien)
  // Schreibvorgänge pro Datei nacheinander: sonst entscheidet das zuletzt fertige close(), was auf der Platte steht
  const schreibKette = new Map<string, Promise<void>>()
  // Während eines Neu-Einlesens angelegte Dateien – die könnte der Durchlauf verpasst haben
  let angelegt = new Set<string>()
  const sortiert = () => [...dateien.keys()].sort((a, b) => a.localeCompare(b, 'de'))

  function datei(pfad: string): FileSystemFileHandle {
    const h = dateien.get(pfad)
    if (!h) throw new Error(`Datei nicht gefunden: ${pfad}`)
    return h
  }

  const vault: Vault = {
    name: stamm.name,
    dateien: sortiert(),
    lesenText: async (pfad) => (await datei(pfad).getFile()).text(),
    lesenBlob: async (pfad) => datei(pfad).getFile(),
    geaendertAm: async (pfad) => (await datei(pfad).getFile()).lastModified,
    async aktualisieren() {
      // Neue Liste erst am Ende einsetzen: während des Einlesens bleibt die alte gültig
      const neu = new Map<string, FileSystemFileHandle>()
      angelegt = new Set()
      await durchlaufen(stamm, '', neu)
      for (const pfad of angelegt) if (!neu.has(pfad)) neu.set(pfad, dateien.get(pfad)!)
      dateien = neu
      vault.dateien = sortiert()
    },
    beobachten(geaendert) {
      if (!window.FileSystemObserver) return () => {}
      const beobachter = new window.FileSystemObserver(() => geaendert())
      // Nicht unterstützt (ältere Fassung, Ordnerart): dann bleibt es bei der regelmäßigen Prüfung
      beobachter.observe(stamm, { recursive: true }).catch(() => beobachter.disconnect())
      return () => beobachter.disconnect()
    },
    schreibenText(pfad, text) {
      const vorher = schreibKette.get(pfad) ?? Promise.resolve()
      const fertig = vorher.catch(() => {}).then(() => schreiben(pfad, text))
      schreibKette.set(pfad, fertig)
      return fertig
    },
  }

  async function schreiben(pfad: string, text: string) {
    let h = dateien.get(pfad)
    if (!h) {
      // Ordner anlegen (z. B. .lernzettel/) und Datei neu erzeugen
      const teile = pfad.split('/')
      let dir = stamm
      for (const teil of teile.slice(0, -1)) dir = await dir.getDirectoryHandle(teil, { create: true })
      h = await dir.getFileHandle(teile[teile.length - 1], { create: true })
      dateien.set(pfad, h)
      angelegt.add(pfad)
      vault.dateien = sortiert()
    }
    const schreiber = await h.createWritable()
    try {
      await schreiber.write(text)
      await schreiber.close()
    } catch (fehler) {
      // Zwischendatei verwerfen; die Datei selbst bleibt unverändert
      await schreiber.abort().catch(() => {})
      throw fehler
    }
  }
  return vault
}
