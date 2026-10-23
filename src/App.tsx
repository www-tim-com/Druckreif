// Oberfläche wie im modernen Word: Titelleiste mit Suche, Menüband, Navigationsbereich, Seiten, Hinweise, Statusleiste.
// Die eigentliche Arbeit steckt in dokument/, layout/, markdown/ und vault/ – hier nur Zustand und Verdrahtung.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type Dokument, type NotizTeil, bilderVergessen, dokumentAufbauen, stempel } from './dokument/aufbauen'
import type { Block } from './dokument/bloecke'
import type { Hinweis } from './hinweise'
import {
  ausblendenSetzen,
  bildSetzen,
  einbettungSetzen,
  eintragAendern,
  eintragAnIndex,
  eintragLoeschen,
  eintragZuruecksetzen,
  eintragZuweisen,
  layoutZuruecksetzen,
  notizSchriftSetzen,
  schriftSetzen,
  bildVerschieben,
  tabelleSetzen,
  tabellenBreiteSetzen,
  teilenSetzen,
  umbruchSetzen,
  umbruchUmschalten,
  umflussPosition,
} from './layout/bearbeiten'
import { type LayoutDatei, type LayoutEintrag, STANDARD_SCHRIFT_PT, layoutSpeichern } from './layout/layoutDatei'
import { blockFinden, typName } from './layout/zuordnen'
import {
  type Mappe,
  type MappenDatei,
  type MappenEintrag,
  eintragEntfernen,
  eintragSetzen,
  eintragVerschieben,
  mappeAendern,
  mappeLoeschen,
  mappeZuruecksetzen,
  mappenLaden,
  mappenSpeichern,
  neueMappe,
  notizAnhaengen,
  tinteSparenSetzen,
  umbenennen,
} from './mappen/mappen'
import { type VaultEinstellungen, vaultEinstellungenLaden } from './stil/stil'
import { ZOOM_MAX, ZOOM_MIN, zahlText } from './ui/Band'
import {
  BookOpenText,
  Droplet,
  EyeOff,
  FilePlus2,
  FileX2,
  FolderOpen,
  Focus,
  Keyboard,
  ListTree,
  Maximize2,
  MessageSquareWarning,
  Moon,
  MoveHorizontal,
  PanelTop,
  Pilcrow,
  Printer,
  Redo2,
  RefreshCw,
  RotateCcw,
  Ruler,
  Search,
  SeparatorHorizontal,
  Settings,
  Square,
  Sun,
  Undo2,
  WandSparkles,
} from 'lucide-react'
import { type Befehl, Befehlssuche } from './ui/Befehlssuche'
import { type DateiSeite, Datei } from './ui/Datei'
import { Tastenkombinationen, Wortanzahl } from './ui/Dialoge'
import { Hinweise } from './ui/Hinweise'
import { Kontextmenue } from './ui/Kontextmenue'
import { Lineal } from './ui/Lineal'
import { Menueband, type Reiter } from './ui/Menueband'
import { Mappenreiter } from './ui/Mappenreiter'
import { type NavAnsicht, Navigationsbereich } from './ui/Navigationsbereich'
import { useOberflaeche } from './ui/oberflaeche'
import { QuickInfo } from './ui/QuickInfo'
import { Statusleiste } from './ui/Statusleiste'
import { Titelleiste } from './ui/Titelleiste'
import { type ZugriffstastenSteuerung, Zugriffstasten } from './ui/Zugriffstasten'
import { demoVault } from './vault/demoVault'
import { type Notiz, notizenLaden } from './vault/notizen'
import { gemerktenOrdnerOeffnen, gemerkterOrdnerName, ordnerWaehlen, ordnerZugriffMoeglich } from './vault/ordnerVault'
import { type Vault, notizName } from './vault/vault'
import type { Rueckrufe } from './vorschau/interaktion'
import { type Fertig, type Statistik, Vorschau, type VorschauSteuerung } from './vorschau/Vorschau'
import { type Leerraum, leerraumText } from './vorschau/leerraum'
import type { Treffer } from './vorschau/suche'

interface Geladen {
  vault: Vault
  einstellungen: VaultEinstellungen
  notizen: Notiz[]
  hinweise: Hinweis[]
}

/** Ein Schritt für Rückgängig/Wiederholen: Layout einer oder mehrerer Notizen und/oder eine Mappe, vorher und nachher. */
interface Schritt {
  layouts: { pfad: string; vorher: LayoutDatei; nachher: LayoutDatei }[]
  mappe?: { id: string; vorher: Mappe; nachher: Mappe }
}

type LayoutAenderung = { pfad: string; aendern: (l: LayoutDatei) => LayoutDatei }

/** Stufen für „Automatisch formatieren“: Grundschrift (pt) und Zeilenabstand, von groß nach klein */
const STUFEN: [number, number][] = [
  [12, 1.4],
  [11.5, 1.4],
  [11, 1.35],
  [10.5, 1.35],
  [10, 1.3],
  [9.5, 1.3],
  [9, 1.25],
  [8.5, 1.2],
  [8, 1.2],
]

type Aendern = (e: LayoutEintrag) => LayoutEintrag

const MAX_VERLAUF = 100

/** Vorschläge der Befehlssuche bei leerem Feld (nach den zuletzt benutzten) */
const VORSCHLAEGE = ['drucken', 'formatieren', 'umbruch', 'ausblenden', 'woerter', 'tasten']

export function App() {
  const [geladen, setGeladen] = useState<Geladen | null>(null)
  const [gemerkt, setGemerkt] = useState<string | null>(null)
  const [dateiOffen, setDateiOffen] = useState(false)
  const [dateiSeite, setDateiSeite] = useState<DateiSeite>('start')
  const [oberflaeche, setOberflaeche, dunkel] = useOberflaeche()
  // Vollbildmodus: Titelleiste und Menüband kurz eingeblendet („…“ oder Alt)
  const [kopfOffen, setKopfOffen] = useState(false)
  const [dialog, setDialog] = useState<'woerter' | 'tasten' | null>(null)
  const [statistik, setStatistik] = useState<Statistik | null>(null)
  const [woerter, setWoerter] = useState<number | null>(null)
  const [zuletzt, setZuletzt] = useState<string[]>(() => listeLesen(speicherLesen('befehle')))
  // Mappen: alle Zusammenstellungen des Vaults, die offenen Reiter und der aktive
  const [mappen, setMappen] = useState<MappenDatei>({ version: 1, mappen: [] })
  const [offen, setOffen] = useState<string[]>([])
  const [aktivId, setAktivId] = useState<string | null>(null)
  const [navAnsicht, setNavAnsicht] = useState<NavAnsicht>('notizen')
  const [dokument, setDokument] = useState<Dokument | null>(null)
  const [baut, setBaut] = useState(false)
  const [stand, setStand] = useState(0) // hochzählen = Dokument neu aufbauen
  const [auswahl, setAuswahl] = useState<string | null>(null) // gewählter Block
  const [reiter, setReiter] = useState<Reiter>('start')
  const [zoom, setZoomRoh] = useState(1)
  const [nav, setNav] = useState(true)
  const [hinweiseOffen, setHinweiseOffen] = useState(false)
  const [zeichen, setZeichen] = useState(false)
  const [seite, setSeite] = useState(1)
  const [seiten, setSeiten] = useState(0)
  const [kontext, setKontext] = useState<{ id: string; x: number; y: number } | null>(null)
  // Roter Eintrag, der gerade einem Block zugewiesen wird – per Anker (JSON), weil sich Indizes verschieben können
  const [zuweisen, setZuweisen] = useState<{ notiz: string; anker: string } | null>(null)
  const [verlauf, setVerlauf] = useState<{ zurueck: Schritt[]; vor: Schritt[] }>({ zurueck: [], vor: [] })
  const [speichert, setSpeichert] = useState(0)
  const [fehler, setFehler] = useState<string | null>(null)
  const [bildIstMm, setBildIstMm] = useState<number | null>(null)
  const [leerraum, setLeerraum] = useState<Leerraum[]>([])
  const [fassung, setFassung] = useState(0) // zählt fertige Umbrüche (Seitenminiaturen auffrischen)
  const [suche, setSuche] = useState('')
  const [treffer, setTreffer] = useState<Treffer[]>([])
  const [trefferAktiv, setTrefferAktiv] = useState(0)
  const [zielSeiten, setZielSeiten] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState<{ laeuft: boolean; text: string | null }>({ laeuft: false, text: null })
  const suchfeld = useRef<HTMLInputElement>(null)
  const befehlsfeld = useRef<HTMLInputElement>(null)
  const vorschau = useRef<VorschauSteuerung>(null)
  const zugriffstasten = useRef<ZugriffstastenSteuerung>(null)

  // Neuester Stand jeder Layout-Datei – schneller als das neu aufgebaute Dokument, damit schnelle Folgeänderungen nichts verlieren
  const layouts = useRef(new Map<string, LayoutDatei>())
  const [layoutStand, setLayoutStand] = useState(0)

  const setZoom = (z: number) => setZoomRoh(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 10) / 10)))
  const zoomAendern = (schritt: number) => setZoomRoh((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + schritt) * 10) / 10)))

  function dateiOeffnen(seite: DateiSeite = 'start') {
    setDateiSeite(seite)
    setDateiOffen(true)
  }

  const vollbild = oberflaeche.band === 'vollbild'
  // Eingeblendeter Kopf im Vollbildmodus verschwindet beim Klick in die Seiten oder daneben
  useEffect(() => {
    if (!kopfOffen) return
    const zu = (e: Event) => {
      const ziel = e.target as Element | null
      if (e.type === 'blur' || !ziel?.closest?.('.kopf, .band-menue, .befehlsliste, .namensmenue')) setKopfOffen(false)
    }
    window.addEventListener('pointerdown', zu)
    window.addEventListener('blur', zu)
    return () => {
      window.removeEventListener('pointerdown', zu)
      window.removeEventListener('blur', zu)
    }
  }, [kopfOffen])
  useEffect(() => {
    if (!vollbild) setKopfOffen(false)
  }, [vollbild])

  function befehlssucheOeffnen() {
    if (vollbild) setKopfOffen(true)
    setTimeout(() => {
      befehlsfeld.current?.focus()
      befehlsfeld.current?.select()
    }, 0)
  }

  function befehlBenutzt(id: string) {
    const neu = [id, ...zuletzt.filter((z) => z !== id)].slice(0, 5)
    setZuletzt(neu)
    speicherSchreiben('befehle', JSON.stringify(neu))
  }

  async function versuchen(aktion: () => Promise<void>) {
    try {
      setFehler(null)
      await aktion()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setFehler((e as Error).message)
    }
  }

  /** Vault (neu) einlesen: Einstellungen, Notizliste, Mappen. */
  async function vaultLesen(vault: Vault) {
    const [{ einstellungen, hinweise }, notizen, mappenGelesen] = await Promise.all([
      vaultEinstellungenLaden(vault),
      notizenLaden(vault),
      mappenLaden(vault).catch((e: Error) => e),
    ])
    let mappenDatei: MappenDatei
    if (mappenGelesen instanceof Error) {
      // Beschädigte mappen.json nie überschreiben (wie Layout-Dateien): bisherige Mappen weiter zeigen, Änderungen sperren
      mappenGesperrt.current = `${mappenGelesen.message} – Mappen lassen sich nicht ändern, bis die Datei repariert ist (dann Aktualisieren, F5).`
      hinweise.push({ stufe: 'rot', notiz: '', text: mappenGesperrt.current })
      mappenDatei = geladen?.vault === vault ? mappenRef.current : { version: 1, mappen: [] }
    } else {
      mappenGesperrt.current = null
      mappenDatei = mappenGelesen
    }
    mappenRef.current = mappenDatei
    setMappen(mappenDatei)
    setGeladen({ vault, einstellungen, notizen, hinweise })
    return { notizen, mappenDatei }
  }

  async function vaultSetzen(vault: Vault) {
    // Blob-URLs der Bilder des bisherigen Vaults freigeben
    if (geladen && geladen.vault !== vault) bilderVergessen(geladen.vault)
    kaputteLayouts.current.clear()
    let { mappenDatei } = await vaultLesen(vault)
    setVerlauf({ zurueck: [], vor: [] })
    setAuswahl(null)
    setDateiOffen(false)
    // Übernahme der früheren Druckliste als erste Mappe
    const alteListe = listeLesen(speicherLesen(`liste:${vault.name}`))
    if (mappenDatei.mappen.length === 0 && alteListe.length > 0) {
      const neu = neueMappe(mappenDatei, 'Dokument', alteListe)
      mappenDatei = neu.datei
      await mappenSchreiben(vault, mappenDatei)
    }
    const ids = mappenDatei.mappen.map((m) => m.id)
    const warOffen = listeLesen(speicherLesen(`offen:${vault.name}`)).filter((id) => ids.includes(id))
    const reiter = warOffen.length > 0 ? warOffen : ids.slice(-1)
    const aktiv = speicherLesen(`aktiv:${vault.name}`)
    setOffen(reiter)
    setAktivId(aktiv && reiter.includes(aktiv) ? aktiv : (reiter[0] ?? null))
    setNavAnsicht(reiter.length > 0 ? 'mappe' : 'notizen')
  }

  /** Aktualisieren (F5): Dateiliste, Notizen, Bilder, Theme und Mappen neu einlesen. */
  function aktualisieren() {
    if (!geladen) return
    versuchen(async () => {
      setBaut(true)
      await geladen.vault.aktualisieren()
      bilderVergessen(geladen.vault)
      await vaultLesen(geladen.vault)
      setStand((s) => s + 1)
    })
  }

  // ---- Mappen ----

  const mappenRef = useRef(mappen)
  /** Fehlertext, solange .lernzettel/mappen.json beschädigt ist (dann wird sie nie geschrieben) */
  const mappenGesperrt = useRef<string | null>(null)
  const aktiveMappe = mappen.mappen.find((m) => m.id === aktivId) ?? null

  async function mappenSchreiben(vault: Vault, datei: MappenDatei) {
    if (mappenGesperrt.current) {
      setFehler(mappenGesperrt.current)
      return
    }
    mappenRef.current = datei
    setMappen(datei)
    await mappenSpeichern(vault, datei)
  }

  function mappenAendern(aendern: (d: MappenDatei) => MappenDatei) {
    if (!geladen) return
    const neu = aendern(mappenRef.current)
    versuchen(() => mappenSchreiben(geladen.vault, neu))
  }

  /** Inhalt der aktiven Mappe ändern (Notizen, Reihenfolge, Anschließen, Tinte sparen …) – mit Rückgängig. */
  function aktiveMappeAendern(aendern: (m: Mappe) => Mappe) {
    schrittAusfuehren([], aendern)
  }

  /** Mappe ohne neuen Rückgängig-Schritt setzen (für Rückgängig/Wiederholen selbst). Umbenennen ist kein Schritt – der Name bleibt. */
  function mappeSetzen(id: string, mappe: Mappe) {
    mappenAendern((d) => mappeAendern(d, id, (aktuell) => ({ ...mappe, name: aktuell.name })))
  }

  function mappeOeffnen(id: string) {
    setOffen((o) => (o.includes(id) ? o : [...o, id]))
    setAktivId(id)
    setAuswahl(null)
    setDateiOffen(false)
  }

  function neueMappeAnlegen(notizen: string[] = []) {
    const name = notizen.length === 1 ? notizName(notizen[0]) : 'Neue Mappe'
    const neu = neueMappe(mappenRef.current, name, notizen)
    mappenAendern(() => neu.datei)
    mappeOeffnen(neu.id)
    // Leere Mappe: gleich die Notizliste zeigen, damit man etwas hinzufügen kann; sonst Ansicht lassen
    if (notizen.length === 0) setNavAnsicht('notizen')
  }

  function reiterSchliessen(id: string) {
    const rest = offen.filter((o) => o !== id)
    setOffen(rest)
    if (aktivId === id) setAktivId(rest[Math.max(0, offen.indexOf(id) - 1)] ?? null)
  }

  /** Klick auf eine Notiz im Baum: an die aktive Mappe hängen (oder hinspringen, wenn sie schon drinsteht). */
  function notizKlick(pfad: string) {
    if (!aktiveMappe) return neueMappeAnlegen([pfad])
    const index = aktiveMappe.items.findIndex((e) => e.note === pfad)
    if (index >= 0) return mappenSprung(index)
    aktiveMappeAendern(notizAnhaengen(pfad))
  }

  function mappenSprung(index: number) {
    const teil = dokument?.notizen.find((n) => n.mappenIndex === index)
    if (teil?.bloecke[0]) springen(teil.bloecke[0].id)
  }

  // Offene Reiter und aktive Mappe pro Vault merken
  useEffect(() => {
    if (!geladen) return
    speicherSchreiben(`offen:${geladen.vault.name}`, JSON.stringify(offen))
    speicherSchreiben(`aktiv:${geladen.vault.name}`, aktivId ?? '')
  }, [geladen, offen, aktivId])

  // Start: ?demo öffnet den Demo-Vault, sonst den gemerkten Ordner (falls der Browser es ohne Klick erlaubt)
  useEffect(() => {
    if (new URLSearchParams(location.search).has('demo')) {
      versuchen(() => vaultSetzen(demoVault()))
      return
    }
    if (!ordnerZugriffMoeglich()) return
    versuchen(async () => {
      setGemerkt(await gemerkterOrdnerName())
      const vault = await gemerktenOrdnerOeffnen(false)
      if (vault && vault !== 'keine-freigabe') await vaultSetzen(vault)
    })
  }, [])

  // Dokument aufbauen bei Änderung der Mappe oder der Dateien. useLayoutEffect: sofort nach der Änderung starten,
  // nicht erst nach dem nächsten Bildschirm-Frame. Ein überholter Aufbau wird verworfen (abgebrochen).
  const mappenSchluessel = aktiveMappe ? JSON.stringify([aktiveMappe.name, aktiveMappe.items]) : ''
  useLayoutEffect(() => {
    if (!geladen || !aktiveMappe || aktiveMappe.items.length === 0) {
      setDokument(null)
      setBaut(false)
      return
    }
    let abgebrochen = false
    setBaut(true)
    versuchen(async () => {
      const dok = await dokumentAufbauen(geladen.vault, aktiveMappe.items, geladen.einstellungen, aktiveMappe.name, ausstehend.current)
      if (abgebrochen) return
      for (const n of dok.notizen) {
        if (n.layoutKaputt) kaputteLayouts.current.add(n.pfad)
        else kaputteLayouts.current.delete(n.pfad)
      }
      setDokument(dok)
      setBaut(false)
      // Während gespeichert wird, ist layouts.current neuer als das Dokument (layoutSchreiben setzt es vorher)
      if (speichertRef.current === 0) {
        layouts.current = new Map(dok.notizen.map((n) => [n.pfad, n.layout]))
        setLayoutStand((s) => s + 1)
      }
    })
    return () => {
      abgebrochen = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geladen, mappenSchluessel, stand])

  // Neu laden, wenn eine Notiz oder ein Bild in Obsidian geändert wurde. Verglichen wird mit dem Stand beim
  // Aufbau, damit auch ein Speichern während des Aufbaus auffällt. Die Dateiliste wird mit eingelesen:
  // ein neu eingefügtes Bild („Pasted image …“) gibt es sonst noch nicht.
  useEffect(() => {
    if (!geladen || !dokument) return
    const bekannt = new Map(dokument.quellen)
    let laeuft = false
    const timer = setInterval(async () => {
      if (laeuft) return
      laeuft = true
      try {
        const pfade = [...bekannt.keys()]
        const zeiten = await Promise.all(pfade.map((p) => stempel(geladen.vault, p)))
        const geaendert = pfade.filter((p, i) => zeiten[i] !== bekannt.get(p))
        if (geaendert.length === 0) return
        geaendert.forEach((p) => bekannt.set(p, zeiten[pfade.indexOf(p)]))
        await geladen.vault.aktualisieren()
        setStand((s) => s + 1)
      } catch (e) {
        setFehler((e as Error).message)
      } finally {
        laeuft = false
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [geladen, dokument])

  // Ergebnis des automatischen Formatierens eine Weile in der Statusleiste zeigen
  useEffect(() => {
    if (status.laeuft || !status.text) return
    const t = setTimeout(() => setStatus({ laeuft: false, text: null }), 12_000)
    return () => clearTimeout(t)
  }, [status])

  // Breite des gewählten Bildes messen (nach jedem Umbruch neu)
  useEffect(() => {
    setBildIstMm(null)
    if (!auswahl) return
    const t = setTimeout(() => setBildIstMm(vorschau.current?.bildBreiteMm(auswahl) ?? null), 60)
    return () => clearTimeout(t)
  }, [auswahl, seiten, dokument])

  // Auswahl aufheben, wenn es den Block nach dem Neuaufbau nicht mehr gibt
  useEffect(() => {
    if (auswahl && dokument && !dokument.notizen.some((n) => n.bloecke.some((b) => b.id === auswahl))) setAuswahl(null)
  }, [dokument, auswahl])

  // ---- Layout ändern, speichern, Rückgängig ----

  const speichertRef = useRef(0)
  /** Notizen mit beschädigter Layout-Datei – auch aus anderen Mappen (Rückgängig kann sie sonst überschreiben) */
  const kaputteLayouts = useRef(new Set<string>())

  /** Layouts, deren Datei gerade geschrieben wird: der Neuaufbau beginnt sofort damit, statt aufs Speichern zu warten */
  const ausstehend = useRef(new Map<string, LayoutDatei>())

  async function layoutSchreiben(layout: LayoutDatei) {
    if (!geladen) return
    layouts.current.set(layout.note, layout)
    setLayoutStand((s) => s + 1)
    speichertRef.current++
    setSpeichert(speichertRef.current)
    ausstehend.current.set(layout.note, layout)
    setStand((s) => s + 1)
    let gespeichert = false
    try {
      await layoutSpeichern(geladen.vault, layout)
      gespeichert = true
    } finally {
      if (ausstehend.current.get(layout.note) === layout) ausstehend.current.delete(layout.note)
      speichertRef.current--
      setSpeichert(speichertRef.current)
      // Gespeichert: das Dokument zeigt diesen Stand schon (ein zweiter Aufbau aus der Datei ergäbe dasselbe).
      // Fehlgeschlagen: aus der Datei neu aufbauen, damit die Ansicht zeigt, was wirklich gespeichert ist.
      if (!gespeichert) setStand((s) => s + 1)
    }
  }

  function layoutVon(teil: NotizTeil): LayoutDatei {
    return layouts.current.get(teil.pfad) ?? teil.layout
  }

  /** Beschädigte Layout-Datei nie überschreiben – sonst wären alle bisherigen Einträge darin verloren. */
  function layoutGesperrt(pfad: string): boolean {
    if (!kaputteLayouts.current.has(pfad)) return false
    const titel = dokument?.notizen.find((n) => n.pfad === pfad)?.titel ?? notizName(pfad)
    setFehler(`Die Layout-Datei von „${titel}“ ist beschädigt. Bitte reparieren oder löschen, dann Aktualisieren (F5).`)
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
    const mappeVorher = mappenRef.current.mappen.find((m) => m.id === aktivId)
    if (mappeNeu && mappenGesperrt.current) {
      setFehler(mappenGesperrt.current)
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
    if (schritt.mappe) mappeSetzen(schritt.mappe.id, schritt.mappe[stand])
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

  /** Seite des gewählten Blocks, sonst die gerade sichtbare */
  function aktuelleSeite(): number {
    return (auswahl ? vorschau.current?.seiteVonBlock(auswahl) : null) ?? seite
  }

  /** Alle manuellen Änderungen an Blöcken, die auf der aktuellen Seite beginnen, verwerfen (Seite wie automatisch). */
  function seiteZuruecksetzen() {
    if (!dokument) return
    const nummer = aktuelleSeite()
    const ids = new Set(vorschau.current?.bloeckeAufSeite(nummer) ?? [])
    const aenderungen: LayoutAenderung[] = dokument.notizen
      .filter((t) => t.bloecke.some((b) => ids.has(b.id)))
      .map((t) => ({
        pfad: t.pfad,
        aendern: (l) => ({ ...l, items: l.items.filter((e) => !ids.has(blockFinden(e.anchor, t.bloecke)?.block.id ?? '')) }),
      }))
    const geaendert = schrittAusfuehren(aenderungen)
    setStatus({
      laeuft: false,
      text: geaendert ? `Seite ${nummer} zurückgesetzt (Rückgängig: Strg+Z)` : `Auf Seite ${nummer} gibt es keine manuellen Änderungen`,
    })
  }

  /** Komplett neu anfangen: Layout aller Notizen der Mappe, „Direkt anschließen“ und „Tinte sparen“ zurück auf automatisch. */
  function allesZuruecksetzen() {
    if (!dokument || !aktiveMappe) return
    if (!confirm(`Alle manuellen Änderungen in der Mappe „${aktiveMappe.name}“ verwerfen?\n\nUmbrüche, Bildgrößen, Schrift, Ausgeblendetes, „Direkt anschließen“ und „Tinte sparen“ werden zurückgesetzt. Notizen, Reihenfolge, Auszüge und eingefügte Notizen bleiben. Rückgängig ist möglich.`)) return
    const geaendert = schrittAusfuehren(
      dokument.notizen.map((t) => ({ pfad: t.pfad, aendern: layoutZuruecksetzen })),
      mappeZuruecksetzen,
    )
    setStatus({ laeuft: false, text: geaendert ? 'Alles zurückgesetzt (Rückgängig: Strg+Z)' : 'Es gibt keine manuellen Änderungen' })
  }

  /**
   * Größte Grundschrift (mit passendem Zeilenabstand), bei der die Mappe auf `ziel` Seiten passt. Gemessen wird
   * unsichtbar mit Paged.js; das Ergebnis landet als normale Notiz-Einstellung in den Layout-Dateien – also danach
   * frei änderbar und mit einem Schritt rückgängig zu machen.
   */
  function automatischFormatieren(ziel: number) {
    const steuerung = vorschau.current
    if (!dokument || !steuerung || status.laeuft) return
    if (dokument.notizen.some((n) => layoutGesperrt(n.pfad))) return
    setStatus({ laeuft: true, text: `Formatiere auf ${ziel} ${ziel === 1 ? 'Seite' : 'Seiten'} …` })
    versuchen(async () => {
      try {
        const gemessen = new Map<number, number>()
        const messen = async (i: number) => {
          const [pt, lh] = STUFEN[i]
          const schrift = (inhalt: DocumentFragment) =>
            inhalt.querySelectorAll<HTMLElement>('article.notiz').forEach((a) => {
              a.style.fontSize = `${pt}pt`
              a.style.lineHeight = String(lh)
            })
          if (!gemessen.has(i)) gemessen.set(i, await steuerung.seitenMessen(schrift))
          return gemessen.get(i)!
        }
        // Binäre Suche: Seitenzahl sinkt mit kleinerer Schrift
        let unten = 0
        let oben = STUFEN.length - 1
        let bester = -1
        while (unten <= oben) {
          const mitte = (unten + oben) >> 1
          if ((await messen(mitte)) <= ziel) {
            bester = mitte
            oben = mitte - 1
          } else unten = mitte + 1
        }
        const wahl = bester >= 0 ? bester : STUFEN.length - 1
        const [pt, lh] = STUFEN[wahl]
        const seitenZahl = await messen(wahl)
        // Standardwerte speichert notizSchriftSetzen nicht (bleiben automatisch)
        schrittAusfuehren(dokument.notizen.map((n) => ({ pfad: n.pfad, aendern: (l: LayoutDatei) => notizSchriftSetzen(l, { fontSizePt: pt, lineHeight: lh }) })))
        const werte = `${zahlText(pt)} pt, Zeilenabstand ${zahlText(lh)}`
        setStatus({
          laeuft: false,
          text:
            bester >= 0
              ? `Automatisch formatiert: ${werte} → ${seitenZahl} ${seitenZahl === 1 ? 'Seite' : 'Seiten'}`
              : `Passt nicht auf ${ziel} ${ziel === 1 ? 'Seite' : 'Seiten'}: kleinste Stufe (${werte}) ergibt ${seitenZahl} Seiten – Umbrüche und Leerraum prüfen`,
        })
      } catch (e) {
        setStatus({ laeuft: false, text: null })
        throw e
      }
    })
  }

  /** Knopf an einer Leerraum-Markierung bzw. in den Hinweisen */
  function leerraumBeheben(l: Leerraum) {
    if (!l.block) return
    const teil = dokument?.notizen.find((n) => n.pfad === l.notiz)
    if (l.art === 'umbruch') blockAendern(l.block, umbruchSetzen(undefined))
    else if (l.art === 'teilen') blockAendern(l.block, teilenSetzen(true))
    else if (l.art === 'tabelle') blockAendern(l.block, tabelleSetzen({ split: true }))
    else if (l.art === 'bild') {
      blockGewaehlt(l.block)
      springen(l.block)
    } else if (l.art === 'notiz' && teil && aktiveMappe) {
      const eintrag = aktiveMappe.items[teil.mappenIndex]
      // Notizen aus einer Reihenfolgedatei haben keinen eigenen Mappen-Eintrag
      if (eintrag?.note === teil.pfad) aktiveMappeAendern(eintragSetzen(teil.mappenIndex, { newPage: false }))
      else setFehler(`„${teil.titel}“ stammt aus einer Reihenfolgedatei und kann nicht einzeln anschließen.`)
    }
  }

  function einbettungUmschalten(notiz: string, ziel: string, an: boolean) {
    layoutAendern(notiz, (l) => einbettungSetzen(l, ziel, an))
  }

  function suchen(begriff: string) {
    setSuche(begriff)
    setTrefferAktiv(0)
  }

  function trefferWechseln(schritt: number) {
    if (treffer.length > 0) setTrefferAktiv((i) => (i + schritt + treffer.length) % treffer.length)
  }

  function sucheOeffnen() {
    setNav(true)
    setTimeout(() => {
      suchfeld.current?.focus()
      suchfeld.current?.select()
    }, 0)
  }

  function fertig(f: Fertig) {
    setSeiten(f.seiten)
    // erst nach dem Umschalten auf die neue Fassung zählen
    setTimeout(() => setWoerter(vorschau.current?.statistik(false)?.woerter ?? null), 0)
    setLeerraum(f.leerraum)
    setFassung((n) => n + 1)
    if (druckenWennFertig.current) {
      druckenWennFertig.current = false
      setTimeout(drucken, 0)
    }
  }

  /** Block per ID finden, mit seiner Notiz und dem aktuellen Layout-Eintrag. */
  function blockSuchen(id: string | null): { teil: NotizTeil; block: Block; index: number | undefined } | null {
    if (!id || !dokument) return null
    for (const teil of dokument.notizen) {
      const block = teil.bloecke.find((b) => b.id === id)
      if (!block) continue
      const index = layoutVon(teil).items.findIndex((e) => blockFinden(e.anchor, teil.bloecke)?.block.id === id)
      return { teil, block, index: index < 0 ? undefined : index }
    }
    return null
  }

  function blockAendern(id: string | null, aendern: Aendern) {
    const b = blockSuchen(id)
    if (b) layoutAendern(b.teil.pfad, (l) => eintragAendern(l, b.block, b.index, aendern))
  }

  const gewaehlt = useMemo(() => {
    const b = blockSuchen(auswahl)
    if (!b) return null
    const eintrag = b.index !== undefined ? layoutVon(b.teil).items[b.index] : undefined
    const ort = b.block.pfad.at(-1) ?? ''
    const beschreibung = b.block.typ === 'heading' ? `Überschrift „${ort}“` : `${typName(b.block.typ)} in „${ort}“`
    return { ...b, eintrag, beschreibung }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auswahl, dokument, layoutStand])

  const aktuelleNotiz = gewaehlt?.teil ?? dokument?.notizen[0] ?? null

  function drucken() {
    vorschau.current?.drucken()
  }
  // „Drucken“ in der Datei-Ansicht: dort ist die Seitenansicht nicht eingeblendet; sie wird beim Zurückschalten
  // neu umbrochen, gedruckt wird nach diesem Umbruch (fertig)
  const druckenWennFertig = useRef(false)

  function ausgeblendet(id: string): boolean {
    const b = blockSuchen(id)
    return b?.index !== undefined && layoutVon(b.teil).items[b.index]?.hidden === true
  }

  // ---- Eingaben aus der Seitenansicht ----

  function blockGewaehlt(id: string | null) {
    setKontext(null)
    if (zuweisen && id) {
      const ziel = blockSuchen(id)
      if (ziel && ziel.teil.pfad === zuweisen.notiz) {
        const { anker } = zuweisen
        layoutAendern(zuweisen.notiz, (l) => {
          const index = l.items.findIndex((e) => JSON.stringify(e.anchor) === anker)
          return index < 0 ? l : eintragZuweisen(l, index, ziel.block, ziel.index)
        })
        setZuweisen(null)
      }
      return
    }
    setAuswahl(id)
    const typ = id ? blockSuchen(id)?.block.typ : null
    if (typ === 'image') setReiter('bild')
    if (typ === 'table') setReiter('tabelle')
  }

  const taste = useRef<(e: KeyboardEvent) => void>(() => {})
  taste.current = (e: KeyboardEvent) => {
    // Zugriffstasten (Alt) zuerst: solange sie angezeigt werden, gehören ihnen alle Tasten
    if (zugriffstasten.current?.taste(e) || e.type !== 'keydown') return
    const imFeld = (e.target as HTMLElement | null)?.closest?.('input, textarea')
    const strg = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    let erledigt = true
    if (k === 'f5') aktualisieren()
    else if (e.altKey && !strg && k === 'q') befehlssucheOeffnen()
    else if (strg && k === 'f1') setOberflaeche({ band: oberflaeche.band === 'immer' ? 'register' : 'immer' })
    else if (strg && k === '0') setZoom(1)
    else if (strg && (k === '+' || k === '=')) zoomAendern(0.1)
    else if (strg && k === '-') zoomAendern(-0.1)
    else if (strg && k === 'p') drucken()
    else if (strg && k === 'f') sucheOeffnen()
    else if (k === 'f3') trefferWechseln(e.shiftKey ? -1 : 1)
    else if (imFeld) erledigt = false
    else if (strg && k === 'z' && !e.shiftKey) zurueck()
    else if (strg && (k === 'y' || (k === 'z' && e.shiftKey))) vor()
    else if (strg && k === 'enter' && gewaehlt) blockAendern(auswahl, umbruchUmschalten(true))
    else if ((k === 'delete' || k === 'backspace') && gewaehlt) blockAendern(auswahl, ausblendenSetzen(true))
    else if (k === 'escape') {
      setAuswahl(null)
      setZuweisen(null)
      setKontext(null)
    } else erledigt = false
    if (erledigt) e.preventDefault()
  }
  useEffect(() => {
    const weiter = (e: KeyboardEvent) => taste.current(e)
    window.addEventListener('keydown', weiter)
    window.addEventListener('keyup', weiter)
    return () => {
      window.removeEventListener('keydown', weiter)
      window.removeEventListener('keyup', weiter)
    }
  }, [])

  const rueckrufe: Rueckrufe = {
    auswahl: blockGewaehlt,
    kontext: (id, x, y) => setKontext({ id, x, y }),
    bildGroesse: (id, mm) => blockAendern(id, bildSetzen({ widthMm: mm })),
    bildVerschieben: (id, align, dy, bezug) => {
      // Umfließendes Bild: an den Block unter der neuen Oberkante hängen (nur im eigenen Abschnitt)
      const bloecke = blockSuchen(id)?.teil.bloecke ?? []
      const position = bezug ? umflussPosition(bloecke, id, bezug.block, bezug.versatzMm) : null
      blockAendern(id, (e) => {
        if (position) return bildSetzen({ align, ...position })(e)
        return bildVerschieben(align, dy)(e)
      })
    },
    tabelleSpalten: (id, prozent) => blockAendern(id, tabelleSetzen({ columnsPct: prozent })),
    tabelleBreite: (id, prozent) => blockAendern(id, tabellenBreiteSetzen(prozent)),
    taste: (e) => taste.current(e),
    zoomRad: (deltaY) => zoomAendern(deltaY < 0 ? 0.1 : -0.1),
    seite: setSeite,
    leerraum: (i) => leerraum[i] && leerraumBeheben(leerraum[i]),
    einbettung: (notiz, ziel) => einbettungUmschalten(notiz, ziel, true),
  }

  const springen = useCallback((id: string) => {
    setAuswahl(id)
    vorschau.current?.zuBlock(id)
  }, [])

  // ---- Ansicht ----

  if (!geladen || dateiOffen) {
    return (
      <Datei
        seite={dateiSeite}
        onSeite={setDateiSeite}
        oberflaeche={oberflaeche}
        onOberflaeche={setOberflaeche}
        mappe={aktiveMappe}
        seiten={dokument ? seiten : 0}
        vaultName={geladen?.vault.name ?? null}
        gemerkt={gemerkt}
        theme={geladen?.einstellungen.theme ?? null}
        snippets={geladen?.einstellungen.snippets ?? []}
        fehler={fehler}
        onZurueck={geladen ? () => setDateiOffen(false) : null}
        onOrdner={() => versuchen(async () => vaultSetzen(await ordnerWaehlen()))}
        onGemerkt={() =>
          versuchen(async () => {
            const vault = await gemerktenOrdnerOeffnen(true)
            if (vault && vault !== 'keine-freigabe') await vaultSetzen(vault)
          })
        }
        onDemo={() => versuchen(() => vaultSetzen(demoVault()))}
        onDrucken={
          geladen && dokument
            ? () => {
                druckenWennFertig.current = true
                setDateiOffen(false)
              }
            : null
        }
        mappen={mappen.mappen}
        onMappeOeffnen={mappeOeffnen}
        onMappeLoeschen={(id) => {
          reiterSchliessen(id)
          mappenAendern((d) => mappeLoeschen(d, id))
        }}
      />
    )
  }

  const leerraumHinweise: Hinweis[] = leerraum.map((l) => ({
    stufe: 'gelb',
    notiz: l.notiz,
    text: leerraumText(l),
    art: 'leerraum',
    leerraum: l,
    block: l.block ?? undefined,
  }))
  const hinweise = [...geladen.hinweise, ...(dokument?.hinweise ?? []), ...leerraumHinweise]
  const probleme = hinweise.filter((h) => h.stufe !== 'info').length
  const notizLayout = aktuelleNotiz ? layoutVon(aktuelleNotiz) : null
  const notizSchrift = { fontSizePt: notizLayout?.settings.fontSizePt, lineHeight: notizLayout?.settings.lineHeight }
  const notizSchriftAendern = (teil: { fontSizePt?: number; lineHeight?: number }) =>
    aktuelleNotiz && layoutAendern(aktuelleNotiz.pfad, (l) => notizSchriftSetzen(l, teil))
  const offeneMappen = offen.map((id) => mappen.mappen.find((m) => m.id === id)).filter((m) => m !== undefined)
  const kontextBlock = kontext ? blockSuchen(kontext.id) : null
  const zoomAuf = (art: 'breite' | 'seite') => {
    const z = vorschau.current?.zoomFuer(art)
    if (z) setZoom(z)
  }
  const woerterZaehlen = () => {
    setStatistik(vorschau.current?.statistik(true) ?? null)
    setDialog('woerter')
  }

  // Alles, was die Suche in der Titelleiste (Alt+Q) findet – wie „Microsoft Search“ in Word
  const ohneDok = !dokument
  const befehle: Befehl[] = [
    { id: 'drucken', text: 'Drucken / als PDF speichern', symbol: Printer, ort: 'Datei', taste: 'Strg+P', aktion: drucken, gesperrt: ohneDok, stichworte: 'pdf export' },
    { id: 'zurueck', text: 'Rückgängig', symbol: Undo2, ort: 'Start', taste: 'Strg+Z', aktion: zurueck, gesperrt: verlauf.zurueck.length === 0 },
    { id: 'vor', text: 'Wiederholen', symbol: Redo2, ort: 'Start', taste: 'Strg+Y', aktion: vor, gesperrt: verlauf.vor.length === 0 },
    { id: 'umbruch', text: 'Seitenumbruch vor dem Block', symbol: SeparatorHorizontal, ort: 'Layout', taste: 'Strg+Enter', aktion: () => blockAendern(auswahl, umbruchUmschalten(true)), gesperrt: !gewaehlt, stichworte: 'neue seite' },
    { id: 'ausblenden', text: 'Block im Druck ausblenden', symbol: EyeOff, ort: 'Start', taste: 'Entf', aktion: () => blockAendern(auswahl, ausblendenSetzen(true)), gesperrt: !gewaehlt, stichworte: 'verstecken entfernen weglassen' },
    { id: 'block-zuruecksetzen', text: 'Block zurücksetzen', symbol: RotateCcw, ort: 'Start', aktion: () => blockAendern(auswahl, eintragZuruecksetzen), gesperrt: !gewaehlt?.eintrag },
    { id: 'teilen', text: 'Teilen über Seiten erlauben', symbol: SeparatorHorizontal, ort: 'Layout', aktion: () => blockAendern(auswahl, teilenSetzen(true)), gesperrt: !gewaehlt || !['heading', 'list', 'callout', 'code'].includes(gewaehlt.block.typ), stichworte: 'umbruch abschnitt' },
    { id: 'formatieren', text: 'Automatisch formatieren', symbol: WandSparkles, ort: 'Layout', aktion: () => automatischFormatieren(zielSeiten ?? Math.max(1, seiten - 1)), gesperrt: ohneDok || status.laeuft, stichworte: 'seiten passen schrift kleiner' },
    { id: 'tinte', text: aktiveMappe?.inkSaving ? 'Tinte sparen ausschalten' : 'Tinte sparen', symbol: Droplet, ort: 'Layout', aktion: () => aktiveMappeAendern(tinteSparenSetzen(!aktiveMappe?.inkSaving)), gesperrt: ohneDok, stichworte: 'graustufen farbe' },
    { id: 'seite-zuruecksetzen', text: `Seite ${aktuelleSeite()} zurücksetzen`, symbol: FileX2, ort: 'Layout', aktion: seiteZuruecksetzen, gesperrt: ohneDok },
    { id: 'alles-zuruecksetzen', text: 'Alles zurücksetzen', symbol: RotateCcw, ort: 'Layout', aktion: allesZuruecksetzen, gesperrt: ohneDok },
    { id: 'suchen', text: 'Im Dokument suchen', symbol: Search, ort: 'Start', taste: 'Strg+F', aktion: sucheOeffnen, stichworte: 'finden' },
    { id: 'aktualisieren', text: 'Vault aktualisieren', symbol: RefreshCw, ort: 'Ansicht', taste: 'F5', aktion: aktualisieren, stichworte: 'neu laden einlesen' },
    { id: 'hinweise', text: hinweiseOffen ? 'Hinweise ausblenden' : 'Hinweise anzeigen', symbol: MessageSquareWarning, ort: 'Überprüfen', aktion: () => setHinweiseOffen(!hinweiseOffen), stichworte: 'fehler probleme prüfen' },
    { id: 'woerter', text: 'Wörter zählen', symbol: BookOpenText, ort: 'Überprüfen', aktion: woerterZaehlen, gesperrt: ohneDok, stichworte: 'wortanzahl zeichen statistik' },
    { id: 'zeichen', text: zeichen ? 'Umbrüche ausblenden' : 'Umbrüche zeigen', symbol: Pilcrow, ort: 'Ansicht', aktion: () => setZeichen(!zeichen), stichworte: 'formatierungszeichen' },
    { id: 'navigation', text: nav ? 'Navigationsbereich ausblenden' : 'Navigationsbereich anzeigen', symbol: ListTree, ort: 'Ansicht', aktion: () => setNav(!nav), stichworte: 'seitenleiste gliederung überschriften' },
    { id: 'lineal', text: oberflaeche.lineal ? 'Lineal ausblenden' : 'Lineal anzeigen', symbol: Ruler, ort: 'Ansicht', aktion: () => setOberflaeche({ lineal: !oberflaeche.lineal }), stichworte: 'ränder' },
    { id: 'fokus', text: vollbild ? 'Fokus beenden' : 'Fokus (Vollbildmodus)', symbol: Focus, ort: 'Ansicht', aktion: () => setOberflaeche({ band: vollbild ? 'immer' : 'vollbild' }), stichworte: 'menüband ausblenden' },
    { id: 'band', text: oberflaeche.band === 'register' ? 'Menüband immer anzeigen' : 'Nur Registerkarten anzeigen', symbol: PanelTop, ort: 'Ansicht', taste: 'Strg+F1', aktion: () => setOberflaeche({ band: oberflaeche.band === 'register' ? 'immer' : 'register' }), stichworte: 'menüband reduzieren' },
    { id: 'zoom-100', text: 'Zoom 100 %', symbol: Maximize2, ort: 'Ansicht', taste: 'Strg+0', aktion: () => setZoom(1) },
    { id: 'zoom-seite', text: 'Zoom: eine Seite', symbol: Square, ort: 'Ansicht', aktion: () => zoomAuf('seite'), gesperrt: ohneDok },
    { id: 'zoom-breite', text: 'Zoom: Seitenbreite', symbol: MoveHorizontal, ort: 'Ansicht', aktion: () => zoomAuf('breite'), gesperrt: ohneDok },
    { id: 'design-dunkel', text: 'Dunkles Design', symbol: Moon, ort: 'Optionen', aktion: () => setOberflaeche({ design: 'dunkelgrau' }), stichworte: 'dunkel dark mode office-design schwarz' },
    { id: 'design-hell', text: 'Helles Design', symbol: Sun, ort: 'Optionen', aktion: () => setOberflaeche({ design: 'weiss' }), stichworte: 'hell light mode office-design weiß' },
    { id: 'optionen', text: 'Optionen', symbol: Settings, ort: 'Datei', aktion: () => dateiOeffnen('optionen'), stichworte: 'einstellungen design schnellzugriff' },
    { id: 'tasten', text: 'Tastenkombinationen', symbol: Keyboard, ort: 'Hilfe', aktion: () => setDialog('tasten'), stichworte: 'tastenkürzel hilfe shortcuts' },
    { id: 'neue-mappe', text: 'Neue Mappe', symbol: FilePlus2, ort: 'Datei', aktion: () => neueMappeAnlegen(), stichworte: 'neu dokument' },
    { id: 'oeffnen', text: 'Vault öffnen', symbol: FolderOpen, ort: 'Datei', aktion: () => dateiOeffnen('oeffnen'), stichworte: 'ordner' },
  ]

  return (
    <div className={`app${nav ? ' mit-nav' : ''}${hinweiseOffen ? ' mit-hinweisen' : ''}${vollbild ? ' vollbild' : ''}${kopfOffen ? ' kopf-offen' : ''}`}>
      <div className="kopf">
        <Titelleiste
          titel={aktiveMappe?.name ?? geladen.vault.name}
          onUmbenennen={aktiveMappe ? (name) => mappenAendern((d) => mappeAendern(d, aktiveMappe.id, umbenennen(name))) : null}
          vaultName={geladen.vault.name}
          speichert={speichert > 0}
          schnellzugriff={oberflaeche.schnellzugriff}
          kannZurueck={verlauf.zurueck.length > 0}
          kannVor={verlauf.vor.length > 0}
          zurueck={zurueck}
          vor={vor}
          drucken={drucken}
          onDatei={() => dateiOeffnen()}
          suche={
            <Befehlssuche
              feld={befehlsfeld}
              befehle={befehle}
              vorschlaege={[...zuletzt, ...VORSCHLAEGE]}
              notizen={geladen.notizen}
              onNotiz={notizKlick}
              onImDokument={(begriff) => {
                suchen(begriff)
                sucheOeffnen()
              }}
              onBenutzt={befehlBenutzt}
            />
          }
        />
        <Menueband
          reiter={reiter}
          onReiter={setReiter}
          onDatei={() => dateiOeffnen()}
          kannZurueck={verlauf.zurueck.length > 0}
          kannVor={verlauf.vor.length > 0}
          zurueck={zurueck}
          vor={vor}
          drucken={drucken}
          aktualisieren={aktualisieren}
          auswahlSchrift={
            gewaehlt
              ? { fuer: gewaehlt.beschreibung, fontSizePt: gewaehlt.eintrag?.fontSizePt, lineHeight: gewaehlt.eintrag?.lineHeight }
              : aktuelleNotiz
                ? { fuer: `Notiz „${aktuelleNotiz.titel}“`, ...notizSchrift }
                : null
          }
          onAuswahlSchrift={(teil) => (gewaehlt ? blockAendern(auswahl, schriftSetzen(teil)) : notizSchriftAendern(teil))}
          notizName={aktuelleNotiz?.titel ?? null}
          notizSchrift={notizSchrift}
          onNotizSchrift={notizSchriftAendern}
          notizHatLayout={!!notizLayout && JSON.stringify(layoutZuruecksetzen(notizLayout)) !== JSON.stringify(notizLayout)}
          notizZuruecksetzen={() =>
            aktuelleNotiz &&
            confirm(`Alle manuellen Änderungen in „${aktuelleNotiz.titel}“ verwerfen? (Rückgängig ist möglich)`) &&
            layoutAendern(aktuelleNotiz.pfad, layoutZuruecksetzen)
          }
          block={gewaehlt ? { typ: gewaehlt.block.typ, beschreibung: gewaehlt.beschreibung, eintrag: gewaehlt.eintrag } : null}
          blockAendern={(aendern) => blockAendern(auswahl, aendern)}
          bildIstMm={bildIstMm}
          zoom={zoom}
          onZoom={setZoom}
          nav={nav}
          onNav={setNav}
          hinweise={hinweiseOffen}
          onHinweise={setHinweiseOffen}
          zeichen={zeichen}
          onZeichen={setZeichen}
          tinteSparen={!!aktiveMappe?.inkSaving}
          onTinteSparen={(an) => aktiveMappeAendern(tinteSparenSetzen(an))}
          seiten={seiten}
          zielSeiten={zielSeiten}
          onZielSeiten={setZielSeiten}
          formatieren={dokument ? () => automatischFormatieren(zielSeiten ?? Math.max(1, seiten - 1)) : null}
          formatiertLaeuft={status.laeuft}
          onSuche={sucheOeffnen}
          seiteZuruecksetzen={dokument ? seiteZuruecksetzen : null}
          seiteNummer={aktuelleSeite()}
          allesZuruecksetzen={dokument ? allesZuruecksetzen : null}
          zoomFuer={(art) => vorschau.current?.zoomFuer(art) ?? null}
          probleme={probleme}
          bandAnzeige={oberflaeche.band}
          onBandAnzeige={(band) => setOberflaeche({ band })}
          schnellzugriff={oberflaeche.schnellzugriff}
          onSchnellzugriff={(schnellzugriff) => setOberflaeche({ schnellzugriff })}
          lineal={oberflaeche.lineal}
          onLineal={(lineal) => setOberflaeche({ lineal })}
          onWoerter={woerterZaehlen}
          onTastenkuerzel={() => setDialog('tasten')}
          onOptionen={() => dateiOeffnen('optionen')}
        />
      </div>

      {nav && (
        <Navigationsbereich
          ansicht={navAnsicht}
          onAnsicht={setNavAnsicht}
          notizen={geladen.notizen}
          mappe={aktiveMappe}
          onNotizKlick={notizKlick}
          onNeueMappe={(pfad) => neueMappeAnlegen([pfad])}
          onVerschieben={(von, nach) => aktiveMappeAendern(eintragVerschieben(von, nach))}
          onEntfernen={(i) => aktiveMappeAendern(eintragEntfernen(i))}
          onSetzen={(i, teil: Partial<MappenEintrag>) => aktiveMappeAendern(eintragSetzen(i, teil))}
          onMappenSprung={mappenSprung}
          teile={dokument?.notizen ?? []}
          auswahl={auswahl}
          onSprung={springen}
          onAusblenden={(id, wert) => blockAendern(id, ausblendenSetzen(wert))}
          istAusgeblendet={ausgeblendet}
          onSchliessen={() => setNav(false)}
          suchfeld={suchfeld}
          suche={suche}
          onSuche={suchen}
          treffer={treffer}
          trefferAktiv={trefferAktiv}
          onTreffer={setTrefferAktiv}
          onTrefferWechseln={trefferWechseln}
          seite={seite}
          seiten={seiten}
          leerraumSeiten={leerraum.map((l) => l.seite)}
          fassung={fassung}
          miniaturHtml={() => vorschau.current?.miniaturHtml() ?? null}
          onSeite={(n) => vorschau.current?.zuSeite(n)}
        />
      )}

      <main className="dokumentbereich">
        <Mappenreiter
          mappen={offeneMappen}
          aktiv={aktivId}
          onWaehlen={mappeOeffnen}
          onSchliessen={reiterSchliessen}
          onNeu={() => neueMappeAnlegen()}
          onUmbenennen={(id, name) => mappenAendern((d) => mappeAendern(d, id, umbenennen(name)))}
        />
        {vollbild && !kopfOffen && (
          <button className="kopf-zeigen" onClick={() => setKopfOffen(true)} aria-label="Menüband anzeigen" title="Menüband anzeigen">
            …
          </button>
        )}
        {fehler && <div className="fehlerleiste">{fehler}</div>}
        {dokument && oberflaeche.lineal && (
          <Lineal
            messen={() => vorschau.current?.linealMass() ?? null}
            fenster={() => vorschau.current?.fenster() ?? null}
            stand={`${fassung}|${zoom}|${nav}|${hinweiseOffen}`}
          />
        )}
        {dokument ? (
          <Vorschau
            ref={vorschau}
            html={dokument.html}
            vaultCss={geladen.einstellungen.css}
            titel={dokument.titel}
            zoom={zoom}
            auswahl={auswahl}
            zeichen={zeichen}
            baut={baut || status.laeuft}
            tinteSparen={!!aktiveMappe?.inkSaving}
            dunkel={dunkel}
            suche={suche}
            trefferAktiv={trefferAktiv}
            onTreffer={(t) => {
              setTreffer(t)
              setTrefferAktiv((i) => Math.min(i, Math.max(0, t.length - 1)))
            }}
            rueckrufe={rueckrufe}
            onFertig={fertig}
          />
        ) : (
          <div className="leer-hinweis">
            {aktiveMappe
              ? 'Die Mappe ist leer – links unter „Notizen“ eine Notiz anklicken.'
              : 'Links unter „Notizen“ eine Notiz anklicken – sie kommt in eine neue Mappe.'}
          </div>
        )}
      </main>

      {hinweiseOffen && (
        <Hinweise
          hinweise={hinweise}
          onSprung={springen}
          onEinblenden={(notiz, i) => hinweisEintragAendern(notiz, i, (l, j) => eintragAnIndex(l, j, ausblendenSetzen(false)))}
          onZuweisen={(notiz, index) => {
            const anker = dokument?.notizen.find((n) => n.pfad === notiz)?.layout.items[index]?.anchor
            if (anker) setZuweisen({ notiz, anker: JSON.stringify(anker) })
          }}
          onLoeschen={(notiz, i) => hinweisEintragAendern(notiz, i, eintragLoeschen)}
          onEinbettung={einbettungUmschalten}
          onLeerraum={leerraumBeheben}
          onSchliessen={() => setHinweiseOffen(false)}
        />
      )}

      <Statusleiste
        seite={seite}
        seiten={seiten}
        notizen={dokument?.notizen.length ?? 0}
        woerter={dokument ? woerter : null}
        probleme={probleme}
        meldung={zuweisen ? 'Block anklicken, dem der Layout-Eintrag zugewiesen wird – Esc bricht ab' : status.text}
        onSeiten={() => {
          setNav(true)
          setNavAnsicht('seiten')
        }}
        onWoerter={woerterZaehlen}
        onHinweise={() => setHinweiseOffen(!hinweiseOffen)}
        fokus={vollbild}
        onFokus={() => setOberflaeche({ band: vollbild ? 'immer' : 'vollbild' })}
        zoom={zoom}
        onZoom={setZoom}
      />

      {kontext && kontextBlock && (
        <Kontextmenue
          x={kontext.x}
          y={kontext.y}
          typ={kontextBlock.block.typ}
          eintrag={kontextBlock.index !== undefined ? layoutVon(kontextBlock.teil).items[kontextBlock.index] : undefined}
          grundschriftPt={layoutVon(kontextBlock.teil).settings.fontSizePt ?? STANDARD_SCHRIFT_PT}
          blockAendern={(aendern) => blockAendern(kontext.id, aendern)}
          onSchliessen={() => setKontext(null)}
        />
      )}

      {dialog === 'woerter' && (
        <Wortanzahl statistik={statistik} seiten={seiten} notizen={dokument?.notizen.length ?? 0} onSchliessen={() => setDialog(null)} />
      )}
      {dialog === 'tasten' && <Tastenkombinationen onSchliessen={() => setDialog(null)} />}
      <Zugriffstasten ref={zugriffstasten} onStart={() => vollbild && setKopfOffen(true)} />
      <QuickInfo />
    </div>
  )
}

function listeLesen(json: string | null): string[] {
  try {
    const wert: unknown = JSON.parse(json ?? '[]')
    return Array.isArray(wert) ? wert.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

// localStorage kann gesperrt sein (private Fenster) – dann eben ohne Merken
function speicherLesen(schluessel: string): string | null {
  try {
    return localStorage.getItem(`druckreif:${schluessel}`)
  } catch {
    return null
  }
}

function speicherSchreiben(schluessel: string, wert: string) {
  try {
    localStorage.setItem(`druckreif:${schluessel}`, wert)
  } catch {
    // egal
  }
}
