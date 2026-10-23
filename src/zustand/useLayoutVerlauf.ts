// Layout ändern, speichern, Rückgängig/Wiederholen. Jede Änderung ist ein Schritt aus den Layouts einer oder mehrerer
// Notizen und/oder der aktiven Mappe. Beschädigte Layout-Dateien werden nie überschrieben.

import { useRef, useState } from 'react'
import type { Dokument, NotizTeil } from '../dokument/aufbauen'
import type { Block } from '../dokument/bloecke'
import { type LayoutDatei, layoutSpeichern } from '../layout/layoutDatei'
import { blockFinden } from '../layout/zuordnen'
import type { Mappe } from '../mappen/mappen'
import { type Vault, notizName } from '../vault/vault'
import type { MappenZustand } from './useMappen'

/** Ein Schritt für Rückgängig/Wiederholen: Layout einer oder mehrerer Notizen und/oder eine Mappe, vorher und nachher. */
interface Schritt {
  layouts: { pfad: string; vorher: LayoutDatei; nachher: LayoutDatei }[]
  mappe?: { id: string; vorher: Mappe; nachher: Mappe }
}

export type LayoutAenderung = { pfad: string; aendern: (l: LayoutDatei) => LayoutDatei }

const MAX_VERLAUF = 100

interface Optionen {
  vault: Vault | null
  /** zuletzt aufgebautes Dokument */
  dokument: Dokument | null
  mappen: MappenZustand
  fehler(text: string): void
  versuchen(aktion: () => Promise<void>): void
  /** Dokument neu aufbauen */
  neuAufbauen(): void
}

export function useLayoutVerlauf({ vault, dokument, mappen, fehler, versuchen, neuAufbauen }: Optionen) {
  const [verlauf, setVerlauf] = useState<{ zurueck: Schritt[]; vor: Schritt[] }>({ zurueck: [], vor: [] })
  const [speichert, setSpeichert] = useState(0)
  const speichertRef = useRef(0)
  // Neuester Stand jeder Layout-Datei – schneller als das neu aufgebaute Dokument, damit schnelle Folgeänderungen nichts verlieren
  const layouts = useRef(new Map<string, LayoutDatei>())
  const [layoutStand, setLayoutStand] = useState(0)
  /** Notizen mit beschädigter Layout-Datei – auch aus anderen Mappen (Rückgängig kann sie sonst überschreiben) */
  const kaputteLayouts = useRef(new Set<string>())
  /** Layouts, deren Datei gerade geschrieben wird: der Neuaufbau beginnt sofort damit, statt aufs Speichern zu warten */
  const ausstehend = useRef(new Map<string, LayoutDatei>())

  /** Anderer Vault: Verlauf und gesperrte Layouts vergessen */
  function zuruecksetzen() {
    kaputteLayouts.current.clear()
    setVerlauf({ zurueck: [], vor: [] })
  }

  /** Neu aufgebautes Dokument: beschädigte Layouts merken und – wenn gerade nichts gespeichert wird – seine Layouts übernehmen */
  function dokumentUebernehmen(dok: Dokument) {
    for (const n of dok.notizen) {
      if (n.layoutKaputt) kaputteLayouts.current.add(n.pfad)
      else kaputteLayouts.current.delete(n.pfad)
    }
    // Während gespeichert wird, ist layouts.current neuer als das Dokument (layoutSchreiben setzt es vorher)
    if (speichertRef.current === 0) {
      layouts.current = new Map(dok.notizen.map((n) => [n.pfad, n.layout]))
      setLayoutStand((s) => s + 1)
    }
  }

  async function layoutSchreiben(layout: LayoutDatei) {
    if (!vault) return
    layouts.current.set(layout.note, layout)
    setLayoutStand((s) => s + 1)
    speichertRef.current++
    setSpeichert(speichertRef.current)
    ausstehend.current.set(layout.note, layout)
    neuAufbauen()
    let gespeichert = false
    try {
      await layoutSpeichern(vault, layout)
      gespeichert = true
    } finally {
      if (ausstehend.current.get(layout.note) === layout) ausstehend.current.delete(layout.note)
      speichertRef.current--
      setSpeichert(speichertRef.current)
      // Gespeichert: das Dokument zeigt diesen Stand schon (ein zweiter Aufbau aus der Datei ergäbe dasselbe).
      // Fehlgeschlagen: aus der Datei neu aufbauen, damit die Ansicht zeigt, was wirklich gespeichert ist.
      if (!gespeichert) neuAufbauen()
    }
  }

  function layoutVon(teil: NotizTeil): LayoutDatei {
    return layouts.current.get(teil.pfad) ?? teil.layout
  }

  /** Beschädigte Layout-Datei nie überschreiben – sonst wären alle bisherigen Einträge darin verloren. */
  function layoutGesperrt(pfad: string): boolean {
    if (!kaputteLayouts.current.has(pfad)) return false
    const titel = dokument?.notizen.find((n) => n.pfad === pfad)?.titel ?? notizName(pfad)
    fehler(`Die Layout-Datei von „${titel}“ ist beschädigt. Bitte reparieren oder löschen, dann Aktualisieren (F5).`)
    return true
  }

  function layoutAendern(pfad: string, aendern: (l: LayoutDatei) => LayoutDatei) {
    schrittAusfuehren([{ pfad, aendern }])
  }

  /**
   * Eintrag aus einem Hinweis ändern. Der Index im Hinweis stammt aus dem zuletzt aufgebauten Dokument; im neuesten
   * Layout kann er schon verschoben sein (schnelles Klicken) – deshalb über den Anker wiederfinden.
   */
  function hinweisEintragAendern(notiz: string, index: number, aendern: (l: LayoutDatei, index: number) => LayoutDatei) {
    const anker = dokument?.notizen.find((n) => n.pfad === notiz)?.layout.items[index]?.anchor
    if (!anker) return
    const gesucht = JSON.stringify(anker)
    layoutAendern(notiz, (l) => {
      const i = l.items.findIndex((e) => JSON.stringify(e.anchor) === gesucht)
      return i < 0 ? l : aendern(l, i)
    })
  }

  /**
   * Layouts mehrerer Notizen und/oder die aktive Mappe ändern – zusammen ein Schritt für Rückgängig.
   * Liefert false, wenn nichts zu ändern war.
   */
  function schrittAusfuehren(aenderungen: LayoutAenderung[], mappeNeu?: (m: Mappe) => Mappe): boolean {
    const schritt: Schritt = { layouts: [] }
    for (const { pfad, aendern } of aenderungen) {
      const teil = dokument?.notizen.find((n) => n.pfad === pfad)
      if (!teil || layoutGesperrt(pfad)) return false
      const vorher = layoutVon(teil)
      const nachher = aendern(vorher)
      if (JSON.stringify(vorher) !== JSON.stringify(nachher)) schritt.layouts.push({ pfad, vorher, nachher })
    }
    const mappeVorher = mappen.ref.current.mappen.find((m) => m.id === mappen.aktivId)
    if (mappeNeu && mappen.gesperrt.current) {
      fehler(mappen.gesperrt.current)
      return false
    }
    if (mappeNeu && mappeVorher) {
      const nachher = mappeNeu(mappeVorher)
      if (JSON.stringify(mappeVorher) !== JSON.stringify(nachher)) schritt.mappe = { id: mappeVorher.id, vorher: mappeVorher, nachher }
    }
    if (schritt.layouts.length === 0 && !schritt.mappe) return false
    setVerlauf((v) => ({ zurueck: [...v.zurueck.slice(-MAX_VERLAUF + 1), schritt], vor: [] }))
    anwenden(schritt, 'nachher')
    return true
  }

  function anwenden(schritt: Schritt, stand: 'vorher' | 'nachher') {
    if (schritt.mappe) mappen.setzen(schritt.mappe.id, schritt.mappe[stand])
    if (schritt.layouts.length > 0) versuchen(() => Promise.all(schritt.layouts.map((a) => layoutSchreiben(a[stand]))).then(() => {}))
  }

  function zurueck() {
    const schritt = verlauf.zurueck.at(-1)
    if (!schritt || schritt.layouts.some((a) => layoutGesperrt(a.pfad))) return
    setVerlauf((v) => ({ zurueck: v.zurueck.slice(0, -1), vor: [...v.vor, schritt] }))
    anwenden(schritt, 'vorher')
  }

  function vor() {
    const schritt = verlauf.vor.at(-1)
    if (!schritt || schritt.layouts.some((a) => layoutGesperrt(a.pfad))) return
    setVerlauf((v) => ({ zurueck: [...v.zurueck, schritt], vor: v.vor.slice(0, -1) }))
    anwenden(schritt, 'nachher')
  }

  // Block-ID -> Index des ersten passenden Layout-Eintrags, je Notiz und Layout-Stand einmal zugeordnet:
  // blockSuchen läuft bei jedem Zeichnen oft (Gliederung: für jede Überschrift)
  const eintragIndexe = useRef(new WeakMap<NotizTeil, { layout: LayoutDatei; ids: Map<string, number> }>())

  function eintragIndex(teil: NotizTeil): Map<string, number> {
    const layout = layoutVon(teil)
    const alt = eintragIndexe.current.get(teil)
    if (alt?.layout === layout) return alt.ids
    const ids = new Map<string, number>()
    layout.items.forEach((e, i) => {
      const id = blockFinden(e.anchor, teil.bloecke)?.block.id
      if (id !== undefined && !ids.has(id)) ids.set(id, i)
    })
    eintragIndexe.current.set(teil, { layout, ids })
    return ids
  }

  /** Block per ID finden, mit seiner Notiz und dem aktuellen Layout-Eintrag. */
  function blockSuchen(id: string | null): { teil: NotizTeil; block: Block; index: number | undefined } | null {
    if (!id || !dokument) return null
    for (const teil of dokument.notizen) {
      const block = teil.bloecke.find((b) => b.id === id)
      if (!block) continue
      return { teil, block, index: eintragIndex(teil).get(id) }
    }
    return null
  }

  return {
    kannZurueck: verlauf.zurueck.length > 0,
    kannVor: verlauf.vor.length > 0,
    speichert: speichert > 0,
    layoutStand,
    ausstehend,
    zuruecksetzen,
    dokumentUebernehmen,
    layoutVon,
    layoutGesperrt,
    layoutAendern,
    hinweisEintragAendern,
    schrittAusfuehren,
    zurueck,
    vor,
    blockSuchen,
  }
}
