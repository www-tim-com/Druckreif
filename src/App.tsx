// Oberfläche wie in Word: Titelleiste, Menüband, Navigationsbereich, Seiten, Hinweise, Statusleiste.
// Die eigentliche Arbeit steckt in dokument/, layout/, markdown/ und vault/ – hier nur Zustand und Verdrahtung.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Dokument, type NotizTeil, dokumentAufbauen } from './dokument/aufbauen'
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
  schriftgroesseSetzen,
  umbruchSetzen,
} from './layout/bearbeiten'
import { type LayoutDatei, type LayoutEintrag, layoutSpeichern } from './layout/layoutDatei'
import { blockFinden, typName } from './layout/zuordnen'
import { type VaultEinstellungen, vaultEinstellungenLaden } from './stil/stil'
import { Datei } from './ui/Datei'
import { Hinweise } from './ui/Hinweise'
import { Kontextmenue } from './ui/Kontextmenue'
import { Menueband, type Reiter } from './ui/Menueband'
import { Navigationsbereich } from './ui/Navigationsbereich'
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
  const [liste, setListe] = useState<string[]>([]) // Druckliste: Notizen in Dokument-Reihenfolge
  const [dokument, setDokument] = useState<Dokument | null>(null)
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

  async function vaultSetzen(vault: Vault) {
    const [{ einstellungen, hinweise }, notizen] = await Promise.all([vaultEinstellungenLaden(vault), notizenLaden(vault)])
    setGeladen({ vault, einstellungen, notizen, hinweise })
    setVerlauf({ zurueck: [], vor: [] })
    setAuswahl(null)
    setDateiOffen(false)
    const zuletzt = listeLesen(speicherLesen(`liste:${vault.name}`)).filter((p) => notizen.some((n) => n.pfad === p))
    setListe(zuletzt.length > 0 ? zuletzt : notizen.slice(0, 1).map((n) => n.pfad))
  }

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

  // Dokument aufbauen bei Änderung der Druckliste oder der Dateien
  useEffect(() => {
    if (!geladen || liste.length === 0) {
      setDokument(null)
      return
    }
    let abgebrochen = false
    speicherSchreiben(`liste:${geladen.vault.name}`, JSON.stringify(liste))
    versuchen(async () => {
      const dok = await dokumentAufbauen(geladen.vault, liste, geladen.einstellungen)
      if (abgebrochen) return
      setDokument(dok)
      if (speichertRef.current === 0) {
        layouts.current = new Map(dok.notizen.map((n) => [n.pfad, n.layout]))
        setLayoutStand((s) => s + 1)
      }
    })
    return () => {
      abgebrochen = true
    }
  }, [geladen, liste, stand])

  // Neu laden, wenn eine Notiz in Obsidian gespeichert wurde
  useEffect(() => {
    if (!geladen || !dokument) return
    const pfade = [...liste, ...dokument.notizen.map((n) => n.pfad)]
    let letzter: number | null = null
    const timer = setInterval(async () => {
      const zeit = Math.max(...(await Promise.all(pfade.map((p) => geladen.vault.geaendertAm(p).catch(() => 0)))))
      if (letzter !== null && zeit !== letzter) setStand((s) => s + 1)
      letzter = zeit
    }, 2000)
    return () => clearInterval(timer)
  }, [geladen, dokument, liste])

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

  function layoutAendern(pfad: string, aendern: (l: LayoutDatei) => LayoutDatei) {
    const teil = dokument?.notizen.find((n) => n.pfad === pfad)
    if (!teil) return
    const vorher = layoutVon(teil)
    const nachher = aendern(vorher)
    if (JSON.stringify(vorher) === JSON.stringify(nachher)) return
    setVerlauf((v) => ({ zurueck: [...v.zurueck.slice(-MAX_VERLAUF + 1), { pfad, vorher, nachher }], vor: [] }))
    versuchen(() => layoutSchreiben(nachher))
  }

  function zurueck() {
    const schritt = verlauf.zurueck.at(-1)
    if (!schritt) return
    setVerlauf((v) => ({ zurueck: v.zurueck.slice(0, -1), vor: [...v.vor, schritt] }))
    versuchen(() => layoutSchreiben(schritt.vorher))
  }

  function vor() {
    const schritt = verlauf.vor.at(-1)
    if (!schritt) return
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
    if (id && blockSuchen(id)?.block.typ === 'image') setReiter('bild')
  }

  const taste = useRef<(e: KeyboardEvent) => void>(() => {})
  taste.current = (e: KeyboardEvent) => {
    const imFeld = (e.target as HTMLElement | null)?.closest?.('input, textarea')
    const strg = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    let erledigt = true
    if (strg && k === 'p') drucken()
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
      />
    )
  }

  const hinweise = [...geladen.hinweise, ...(dokument?.hinweise ?? [])]
  const probleme = hinweise.filter((h) => h.stufe !== 'info').length
  const notizLayout = aktuelleNotiz ? layoutVon(aktuelleNotiz) : null
  const kontextBlock = kontext ? blockSuchen(kontext.id) : null

  return (
    <div className={`app${nav ? ' mit-nav' : ''}${hinweiseOffen ? ' mit-hinweisen' : ''}`}>
      <Titelleiste
        titel={dokument?.titel ?? geladen.vault.name}
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
        notizName={aktuelleNotiz?.titel ?? null}
        schriftPt={notizLayout?.settings.fontSizePt}
        onSchrift={(pt) => aktuelleNotiz && layoutAendern(aktuelleNotiz.pfad, (l) => schriftgroesseSetzen(l, pt))}
        notizHatLayout={!!notizLayout && (notizLayout.items.length > 0 || !!notizLayout.settings.fontSizePt)}
        notizZuruecksetzen={() =>
          aktuelleNotiz &&
          confirm(`Alle manuellen Änderungen in „${aktuelleNotiz.titel}“ verwerfen? (Rückgängig ist möglich)`) &&
          layoutAendern(aktuelleNotiz.pfad, layoutZuruecksetzen)
        }
        block={gewaehlt ? { typ: gewaehlt.block.typ, beschreibung: gewaehlt.beschreibung, eintrag: gewaehlt.eintrag } : null}
        blockAendern={(aendern) => blockAendern(auswahl, aendern)}
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
          notizen={geladen.notizen}
          liste={liste}
          onListe={setListe}
          teile={dokument?.notizen ?? []}
          auswahl={auswahl}
          onSprung={springen}
          onAusblenden={(id, wert) => blockAendern(id, ausblendenSetzen(wert))}
          onSchliessen={() => setNav(false)}
        />
      )}

      <main className="dokumentbereich">
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
            rueckrufe={rueckrufe}
            onFertig={setSeiten}
          />
        ) : (
          <div className="leer-hinweis">Links eine Notiz wählen – mit „+“ weitere anhängen.</div>
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
