// Zustand der Mappen: alle Zusammenstellungen des Vaults (.lernzettel/mappen.json), die offenen Reiter und der aktive.
// Eine beschädigte mappen.json wird nie überschrieben (wie Layout-Dateien): Änderungen sind dann gesperrt.

import { useRef, useState } from 'react'
import { type Mappe, type MappenDatei, mappeAendern, mappenSpeichern } from '../mappen/mappen'
import type { Vault } from '../vault/vault'

export type MappenZustand = ReturnType<typeof useMappen>

export function useMappen(vault: Vault | null, versuchen: (aktion: () => Promise<void>) => void, fehler: (text: string) => void) {
  const [mappen, setMappen] = useState<MappenDatei>({ version: 1, mappen: [] })
  const [offen, setOffen] = useState<string[]>([])
  const [aktivId, setAktivId] = useState<string | null>(null)
  // Neuester Stand – schneller als der nächste Render, damit schnelle Folgeänderungen nichts verlieren
  const ref = useRef(mappen)
  /** Fehlertext, solange .lernzettel/mappen.json beschädigt ist (dann wird sie nie geschrieben) */
  const gesperrt = useRef<string | null>(null)
  const aktive = mappen.mappen.find((m) => m.id === aktivId) ?? null

  /**
   * Gelesene mappen.json übernehmen. Beschädigt (Error): bisherige Mappen weiter zeigen (`behalten`, gleicher Vault)
   * und Änderungen sperren; liefert dann den Fehlertext für die Hinweise.
   */
  function uebernehmen(gelesen: MappenDatei | Error, behalten: boolean): { datei: MappenDatei; fehler: string | null } {
    let datei: MappenDatei
    if (gelesen instanceof Error) {
      gesperrt.current = `${gelesen.message} – Mappen lassen sich nicht ändern, bis die Datei repariert ist (dann Aktualisieren, F5).`
      datei = behalten ? ref.current : { version: 1, mappen: [] }
    } else {
      gesperrt.current = null
      datei = gelesen
    }
    ref.current = datei
    setMappen(datei)
    return { datei, fehler: gesperrt.current }
  }

  async function schreiben(ziel: Vault, datei: MappenDatei) {
    if (gesperrt.current) {
      fehler(gesperrt.current)
      return
    }
    ref.current = datei
    setMappen(datei)
    await mappenSpeichern(ziel, datei)
  }

  function aendern(neu: (d: MappenDatei) => MappenDatei) {
    if (!vault) return
    const datei = neu(ref.current)
    versuchen(() => schreiben(vault, datei))
  }

  /** Mappe ohne neuen Rückgängig-Schritt setzen (für Rückgängig/Wiederholen selbst). Umbenennen ist kein Schritt – der Name bleibt. */
  function setzen(id: string, mappe: Mappe) {
    aendern((d) => mappeAendern(d, id, (aktuell) => ({ ...mappe, name: aktuell.name })))
  }

  function reiterSchliessen(id: string) {
    const rest = offen.filter((o) => o !== id)
    setOffen(rest)
    if (aktivId === id) setAktivId(rest[Math.max(0, offen.indexOf(id) - 1)] ?? null)
  }

  return { mappen, offen, setOffen, aktivId, setAktivId, aktive, ref, gesperrt, uebernehmen, schreiben, aendern, setzen, reiterSchliessen }
}
