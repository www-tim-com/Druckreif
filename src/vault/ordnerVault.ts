// Echter Vault-Ordner über die File System Access API (nur Chrome/Edge, nur über localhost/https).

import type { Vault } from './vault'
import { holen, merken } from './speicher'

const SCHLUESSEL = 'vault'

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
  const dateien = new Map<string, FileSystemFileHandle>()

  async function durchlaufen(dir: FileSystemDirectoryHandle, praefix: string) {
    for await (const [name, eintrag] of dir.entries()) {
      if (name === '.trash' || name === '.git' || name === 'node_modules') continue
      const pfad = praefix + name
      if (eintrag.kind === 'directory') await durchlaufen(eintrag as FileSystemDirectoryHandle, pfad + '/')
      else dateien.set(pfad, eintrag as FileSystemFileHandle)
    }
  }
  await durchlaufen(stamm, '')

  function datei(pfad: string): FileSystemFileHandle {
    const h = dateien.get(pfad)
    if (!h) throw new Error(`Datei nicht gefunden: ${pfad}`)
    return h
  }

  const vault: Vault = {
    name: stamm.name,
    dateien: [...dateien.keys()].sort((a, b) => a.localeCompare(b, 'de')),
    lesenText: async (pfad) => (await datei(pfad).getFile()).text(),
    lesenBlob: async (pfad) => datei(pfad).getFile(),
    geaendertAm: async (pfad) => (await datei(pfad).getFile()).lastModified,
    async schreibenText(pfad, text) {
      let h = dateien.get(pfad)
      if (!h) {
        // Ordner anlegen (z. B. .lernzettel/) und Datei neu erzeugen
        const teile = pfad.split('/')
        let dir = stamm
        for (const teil of teile.slice(0, -1)) dir = await dir.getDirectoryHandle(teil, { create: true })
        h = await dir.getFileHandle(teile[teile.length - 1], { create: true })
        dateien.set(pfad, h)
        vault.dateien = [...dateien.keys()].sort((a, b) => a.localeCompare(b, 'de'))
      }
      const schreiber = await h.createWritable()
      await schreiber.write(text)
      await schreiber.close()
    },
  }
  return vault
}
