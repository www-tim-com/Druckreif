// Oberfläche wie in Word: Titelleiste, Menüband, Navigationsbereich, Seiten, Hinweise, Statusleiste.
// Die eigentliche Arbeit steckt in dokument/, layout/, markdown/ und vault/ – hier nur Zustand und Verdrahtung.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Dokument, type NotizTeil, bilderVergessen, dokumentAufbauen, stempel } from './dokument/aufbauen'
import type { Block } from './dokument/bloecke'
import type { Hinweis } from './hinweise'
import {
  ausblendenSetzen,
  bildSetzen,
  eintragAendern,
  eintragAnIndex,
  eintragLoeschen,
  eintragZuweisen,
  layoutZuruecksetzen,
  notizSchriftSetzen,
  schriftSetzen,
  tabelleSetzen,
  umbruchSetzen,
} from './layout/bearbeiten'
import { type LayoutDatei, type LayoutEintrag, layoutSpeichern } from './layout/layoutDatei'
import { blockFinden, typName } from './layout/zuordnen'
import {
  type MappenDatei,
  type MappenEintrag,
  eintragEntfernen,
  eintragSetzen,
  eintragVerschieben,
  mappeAendern,
  mappeLoeschen,
  mappenLaden,
  mappenSpeichern,
  neueMappe,
  notizAnhaengen,
  notizName,
  umbenennen,
} from './mappen/mappen'
import { type VaultEinstellungen, vaultEinstellungenLaden } from './stil/stil'
import { Datei } from './ui/Datei'
import { Hinweise } from './ui/Hinweise'
import { Kontextmenue } from './ui/Kontextmenue'
import { Menueband, type Reiter } from './ui/Menueband'
import { Mappenreiter } from './ui/Mappenreiter'
import { type NavAnsicht, Navigationsbereich } from './ui/Navigationsbereich'
import { Statusleiste } from './ui/Statusleiste'
import { Titelleiste } from './ui/Titelleiste'
import { demoVault } from './vault/demoVault'
import { type Notiz, notizenLaden } from './vault/notizen'
import { gemerktenOrdnerOeffnen, gemerkterOrdnerName, ordnerWaehlen, ordnerZugriffMoeglich } from './vault/ordnerVault'
import type { Vault } from './vault/vault'
import type { Rueckrufe } from './vorschau/interaktion'
import { Vorschau, type VorschauSteuerung } from './vorschau/Vorschau'

interface Geladen {
  vault: Vault
  einstellungen: VaultEinstellungen
  notizen: Notiz[]
  hinweise: Hinweis[]
}

/** Ein Schritt für Rückgängig/Wiederholen: Layout einer Notiz vorher und nachher. */
interface Schritt {
  pfad: string
  vorher: LayoutDatei
  nachher: LayoutDatei
}

type Aendern = (e: LayoutEintrag) => LayoutEintrag

const MAX_VERLAUF = 100

export function App() {
  const [geladen, setGeladen] = useState<Geladen | null>(null)
  const [gemerkt, setGemerkt] = useState<string | null>(null)
  const [dateiOffen, setDateiOffen] = useState(false)
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
  const [zuweisen, setZuweisen] = useState<{ notiz: string; index: number } | null>(null)
  const [verlauf, setVerlauf] = useState<{ zurueck: Schritt[]; vor: Schritt[] }>({ zurueck: [], vor: [] })
  const [speichert, setSpeichert] = useState(0)
  const [fehler, setFehler] = useState<string | null>(null)
  const [bildIstMm, setBildIstMm] = useState<number | null>(null)
  const vorschau = useRef<VorschauSteuerung>(null)

  // Neuester Stand jeder Layout-Datei – schneller als das neu aufgebaute Dokument, damit schnelle Folgeänderungen nichts verlieren
  const layouts = useRef(new Map<string, LayoutDatei>())
  const [layoutStand, setLayoutStand] = useState(0)

  const setZoom = (z: number) => setZoomRoh(Math.min(3, Math.max(0.3, Math.round(z * 10) / 10)))

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
    const [{ einstellungen, hinweise }, notizen, mappenDatei] = await Promise.all([
      vaultEinstellungenLaden(vault),
      notizenLaden(vault),
      mappenLaden(vault),
    ])
    mappenRef.current = mappenDatei
    setMappen(mappenDatei)
    setGeladen({ vault, einstellungen, notizen, hinweise })
    return { notizen, mappenDatei }
  }

  async function vaultSetzen(vault: Vault) {
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
  const aktiveMappe = mappen.mappen.find((m) => m.id === aktivId) ?? null

  async function mappenSchreiben(vault: Vault, datei: MappenDatei) {
    mappenRef.current = datei
    setMappen(datei)
    await mappenSpeichern(vault, datei)
  }

  function mappenAendern(aendern: (d: MappenDatei) => MappenDatei) {
    if (!geladen) return
    const neu = aendern(mappenRef.current)
    versuchen(() => mappenSchreiben(geladen.vault, neu))
  }

  function aktiveMappeAendern(aendern: Parameters<typeof mappeAendern>[2]) {
    if (aktivId) mappenAendern((d) => mappeAendern(d, aktivId, aendern))
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

  // Dokument aufbauen bei Änderung der Mappe oder der Dateien. Kurz warten, damit schnelle Folgeänderungen
  // (z. B. mehrmals auf einen Pfeil klicken) nur einen Neuaufbau auslösen.
  const mappenSchluessel = aktiveMappe ? JSON.stringify([aktiveMappe.name, aktiveMappe.items]) : ''
  useEffect(() => {
    if (!geladen || !aktiveMappe || aktiveMappe.items.length === 0) {
      setDokument(null)
      setBaut(false)
      return
    }
    let abgebrochen = false
    setBaut(true)
    const timer = setTimeout(() => {
      versuchen(async () => {
        const dok = await dokumentAufbauen(geladen.vault, aktiveMappe.items, geladen.einstellungen, aktiveMappe.name)
        if (abgebrochen) return
        setDokument(dok)
        setBaut(false)
        if (speichertRef.current === 0) {
          layouts.current = new Map(dok.notizen.map((n) => [n.pfad, n.layout]))
          setLayoutStand((s) => s + 1)
        }
      })
    }, 120)
    return () => {
      abgebrochen = true
      clearTimeout(timer)
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

  async function layoutSchreiben(layout: LayoutDatei) {
    if (!geladen) return
    layouts.current.set(layout.note, layout)
    setLayoutStand((s) => s + 1)
    speichertRef.current++
    setSpeichert(speichertRef.current)
    try {
      await layoutSpeichern(geladen.vault, layout)
    } finally {
      speichertRef.current--
      setSpeichert(speichertRef.current)
      setStand((s) => s + 1)
    }
  }

  function layoutVon(teil: NotizTeil): LayoutDatei {
    return layouts.current.get(teil.pfad) ?? teil.layout
  }

  /** Beschädigte Layout-Datei nie überschreiben – sonst wären alle bisherigen Einträge darin verloren. */
  function layoutGesperrt(pfad: string): boolean {
    const teil = dokument?.notizen.find((n) => n.pfad === pfad)
    if (!teil?.layoutKaputt) return false
    setFehler(`Die Layout-Datei von „${teil.titel}“ ist beschädigt. Bitte reparieren oder löschen, dann Aktualisieren (F5).`)
    return true
  }

  function layoutAendern(pfad: string, aendern: (l: LayoutDatei) => LayoutDatei) {
    const teil = dokument?.notizen.find((n) => n.pfad === pfad)
    if (!teil || layoutGesperrt(pfad)) return
    const vorher = layoutVon(teil)
    const nachher = aendern(vorher)
    if (JSON.stringify(vorher) === JSON.stringify(nachher)) return
    setVerlauf((v) => ({ zurueck: [...v.zurueck.slice(-MAX_VERLAUF + 1), { pfad, vorher, nachher }], vor: [] }))
    versuchen(() => layoutSchreiben(nachher))
  }

  function zurueck() {
    const schritt = verlauf.zurueck.at(-1)
    if (!schritt || layoutGesperrt(schritt.pfad)) return
    setVerlauf((v) => ({ zurueck: v.zurueck.slice(0, -1), vor: [...v.vor, schritt] }))
    versuchen(() => layoutSchreiben(schritt.vorher))
  }

  function vor() {
    const schritt = verlauf.vor.at(-1)
    if (!schritt || layoutGesperrt(schritt.pfad)) return
    setVerlauf((v) => ({ zurueck: [...v.zurueck, schritt], vor: v.vor.slice(0, -1) }))
    versuchen(() => layoutSchreiben(schritt.nachher))
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

  // ---- Eingaben aus der Seitenansicht ----

  function blockGewaehlt(id: string | null) {
    setKontext(null)
    if (zuweisen && id) {
      const ziel = blockSuchen(id)
      if (ziel && ziel.teil.pfad === zuweisen.notiz) {
        const { index } = zuweisen
        layoutAendern(zuweisen.notiz, (l) => eintragZuweisen(l, index, ziel.block, ziel.index))
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
    const imFeld = (e.target as HTMLElement | null)?.closest?.('input, textarea')
    const strg = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    let erledigt = true
    if (k === 'f5') aktualisieren()
    else if (strg && k === 'p') drucken()
    else if (imFeld) erledigt = false
    else if (strg && k === 'z' && !e.shiftKey) zurueck()
    else if (strg && (k === 'y' || (k === 'z' && e.shiftKey))) vor()
    else if (strg && k === 'enter' && gewaehlt) blockAendern(auswahl, umbruchSetzen(gewaehlt.eintrag?.pageBreakBefore === true ? undefined : true))
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
    return () => window.removeEventListener('keydown', weiter)
  }, [])

  const rueckrufe: Rueckrufe = {
    auswahl: blockGewaehlt,
    kontext: (id, x, y) => setKontext({ id, x, y }),
    bildGroesse: (id, mm) => blockAendern(id, bildSetzen({ widthMm: mm })),
    bildVerschieben: (id, align, dy) =>
      blockAendern(id, (e) => {
        const versatz = Math.min(150, Math.max(-30, (e.image?.offsetYMm ?? 0) + dy))
        return bildSetzen({ align, offsetYMm: versatz || undefined })(e)
      }),
    tabelleSpalten: (id, prozent) => blockAendern(id, tabelleSetzen({ columnsPct: prozent })),
    tabelleBreite: (id, prozent) => blockAendern(id, tabelleSetzen({ widthPct: prozent >= 100 ? undefined : prozent })),
    taste: (e) => taste.current(e),
    seite: setSeite,
  }

  const springen = useCallback((id: string) => {
    setAuswahl(id)
    vorschau.current?.zuBlock(id)
  }, [])

  // ---- Ansicht ----

  if (!geladen || dateiOffen) {
    return (
      <Datei
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
        onDrucken={geladen && dokument ? () => (setDateiOffen(false), setTimeout(drucken, 50)) : null}
        mappen={mappen.mappen}
        onMappeOeffnen={mappeOeffnen}
        onMappeLoeschen={(id) => {
          reiterSchliessen(id)
          mappenAendern((d) => mappeLoeschen(d, id))
        }}
      />
    )
  }

  const hinweise = [...geladen.hinweise, ...(dokument?.hinweise ?? [])]
  const probleme = hinweise.filter((h) => h.stufe !== 'info').length
  const notizLayout = aktuelleNotiz ? layoutVon(aktuelleNotiz) : null
  const notizSchrift = { fontSizePt: notizLayout?.settings.fontSizePt, lineHeight: notizLayout?.settings.lineHeight }
  const notizSchriftAendern = (teil: { fontSizePt?: number; lineHeight?: number }) =>
    aktuelleNotiz && layoutAendern(aktuelleNotiz.pfad, (l) => notizSchriftSetzen(l, teil))
  const offeneMappen = offen.map((id) => mappen.mappen.find((m) => m.id === id)).filter((m) => m !== undefined)
  const kontextBlock = kontext ? blockSuchen(kontext.id) : null

  return (
    <div className={`app${nav ? ' mit-nav' : ''}${hinweiseOffen ? ' mit-hinweisen' : ''}`}>
      <Titelleiste
        titel={aktiveMappe?.name ?? geladen.vault.name}
        speichert={speichert > 0}
        kannZurueck={verlauf.zurueck.length > 0}
        kannVor={verlauf.vor.length > 0}
        zurueck={zurueck}
        vor={vor}
        drucken={drucken}
      />
      <Menueband
        reiter={reiter}
        onReiter={setReiter}
        onDatei={() => setDateiOffen(true)}
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
        notizHatLayout={!!notizLayout && (notizLayout.items.length > 0 || !!notizLayout.settings.fontSizePt)}
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
      />

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
          onSchliessen={() => setNav(false)}
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
        {fehler && <div className="fehlerleiste">{fehler}</div>}
        {dokument ? (
          <Vorschau
            ref={vorschau}
            html={dokument.html}
            vaultCss={geladen.einstellungen.css}
            titel={dokument.titel}
            zoom={zoom}
            auswahl={auswahl}
            zeichen={zeichen}
            baut={baut}
            rueckrufe={rueckrufe}
            onFertig={setSeiten}
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
          onEinblenden={(notiz, i) => layoutAendern(notiz, (l) => eintragAnIndex(l, i, ausblendenSetzen(false)))}
          onZuweisen={(notiz, index) => setZuweisen({ notiz, index })}
          onLoeschen={(notiz, i) => layoutAendern(notiz, (l) => eintragLoeschen(l, i))}
          onSchliessen={() => setHinweiseOffen(false)}
        />
      )}

      <Statusleiste
        seite={seite}
        seiten={seiten}
        notizen={dokument?.notizen.length ?? 0}
        probleme={probleme}
        meldung={zuweisen ? 'Block anklicken, dem der Layout-Eintrag zugewiesen wird – Esc bricht ab' : null}
        onHinweise={() => setHinweiseOffen(!hinweiseOffen)}
        zoom={zoom}
        onZoom={setZoom}
      />

      {kontext && kontextBlock && (
        <Kontextmenue
          x={kontext.x}
          y={kontext.y}
          typ={kontextBlock.block.typ}
          eintrag={kontextBlock.index !== undefined ? layoutVon(kontextBlock.teil).items[kontextBlock.index] : undefined}
          blockAendern={(aendern) => blockAendern(kontext.id, aendern)}
          onSchliessen={() => setKontext(null)}
        />
      )}
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
