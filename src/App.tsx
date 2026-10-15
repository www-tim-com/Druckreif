// Oberfläche: Vault öffnen, Notiz wählen, Vorschau, Nachjustieren, Drucken.
// Die eigentliche Arbeit steckt in dokument/, layout/, markdown/ und vault/ – hier nur Zustand und Verdrahtung.

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Dokument, dokumentAufbauen } from './dokument/aufbauen'
import type { Hinweis } from './hinweise'
import { eintragLoeschen, layoutZuruecksetzen, schriftgroesseSetzen, umbruchUmschalten } from './layout/bearbeiten'
import { type LayoutDatei, layoutSpeichern } from './layout/layoutDatei'
import { type VaultEinstellungen, vaultEinstellungenLaden } from './stil/stil'
import { Hinweise } from './ui/Hinweise'
import { Seitenleiste } from './ui/Seitenleiste'
import { demoVault } from './vault/demoVault'
import { type Notiz, notizenLaden } from './vault/notizen'
import { gemerktenOrdnerOeffnen, gemerkterOrdnerName, ordnerWaehlen, ordnerZugriffMoeglich } from './vault/ordnerVault'
import type { Vault } from './vault/vault'
import { Vorschau, type VorschauSteuerung } from './vorschau/Vorschau'

interface Geladen {
  vault: Vault
  einstellungen: VaultEinstellungen
  notizen: Notiz[]
  hinweise: Hinweis[]
}

export function App() {
  const [geladen, setGeladen] = useState<Geladen | null>(null)
  const [gemerkt, setGemerkt] = useState<string | null>(null)
  const [liste, setListe] = useState<string[]>([]) // Druckliste: Notizen in Dokument-Reihenfolge
  const [dokument, setDokument] = useState<Dokument | null>(null)
  const [stand, setStand] = useState(0) // hochzählen = Dokument neu aufbauen
  const [umbruchModus, setUmbruchModus] = useState(false)
  const [seiten, setSeiten] = useState(0)
  const [fehler, setFehler] = useState<string | null>(null)
  const vorschau = useRef<VorschauSteuerung>(null)

  async function vaultSetzen(vault: Vault) {
    const [{ einstellungen, hinweise }, notizen] = await Promise.all([vaultEinstellungenLaden(vault), notizenLaden(vault)])
    setGeladen({ vault, einstellungen, notizen, hinweise })
    const zuletzt = listeLesen(speicherLesen(`liste:${vault.name}`)).filter((p) => notizen.some((n) => n.pfad === p))
    setListe(zuletzt.length > 0 ? zuletzt : notizen.slice(0, 1).map((n) => n.pfad))
  }

  async function versuchen(aktion: () => Promise<void>) {
    try {
      setFehler(null)
      await aktion()
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setFehler((e as Error).message)
    }
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
      if (!abgebrochen) setDokument(dok)
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

  /** Layout einer Notiz ändern, sofort speichern und neu aufbauen. */
  const layoutAendern = useCallback(
    async (notizPfad: string, aendern: (layout: LayoutDatei) => LayoutDatei) => {
      const teil = dokument?.notizen.find((n) => n.pfad === notizPfad)
      if (!geladen || !teil) return
      await versuchen(async () => {
        await layoutSpeichern(geladen.vault, aendern(teil.layout))
        setStand((s) => s + 1)
      })
    },
    [geladen, dokument],
  )

  const blockKlick = useCallback(
    (blockId: string) => {
      const teil = dokument?.notizen.find((n) => n.bloecke.some((b) => b.id === blockId))
      const block = teil?.bloecke.find((b) => b.id === blockId)
      if (teil && block) layoutAendern(teil.pfad, (l) => umbruchUmschalten(l, block, teil.bloecke))
    },
    [dokument, layoutAendern],
  )

  if (!geladen) {
    return (
      <Start
        gemerkt={gemerkt}
        fehler={fehler}
        onOrdner={() => versuchen(async () => vaultSetzen(await ordnerWaehlen()))}
        onGemerkt={() =>
          versuchen(async () => {
            const vault = await gemerktenOrdnerOeffnen(true)
            if (vault && vault !== 'keine-freigabe') await vaultSetzen(vault)
          })
        }
        onDemo={() => versuchen(() => vaultSetzen(demoVault()))}
      />
    )
  }

  const einzeln = dokument?.notizen.length === 1 ? dokument.notizen[0] : null
  const hinweise = [...geladen.hinweise, ...(dokument?.hinweise ?? [])]

  return (
    <div className="app">
      <header className="werkzeugleiste">
        <strong className="vault-name" title={geladen.einstellungen.theme ?? 'Standard-Theme'}>
          {geladen.vault.name}
        </strong>
        <button onClick={() => setGeladen(null)}>Vault wechseln</button>
        <span className="trenner" />
        <label className="schalter">
          <input type="checkbox" checked={umbruchModus} onChange={(e) => setUmbruchModus(e.target.checked)} />
          Umbrüche setzen
        </label>
        {einzeln && (
          <>
            <label>
              Schrift
              <input
                type="number"
                min={8}
                max={14}
                step={0.5}
                value={einzeln.layout.settings.fontSizePt ?? 10.5}
                onChange={(e) => {
                  const pt = Number(e.target.value)
                  layoutAendern(einzeln.pfad, (l) => schriftgroesseSetzen(l, pt === 10.5 || !pt ? undefined : pt))
                }}
              />
              pt
            </label>
            <button
              disabled={einzeln.layout.items.length === 0 && !einzeln.layout.settings.fontSizePt}
              onClick={() => confirm('Alle manuellen Änderungen dieser Notiz verwerfen?') && layoutAendern(einzeln.pfad, layoutZuruecksetzen)}
            >
              Layout zurücksetzen
            </button>
          </>
        )}
        <span className="trenner" />
        <span className="seiten">{seiten > 0 && `${seiten} Seite${seiten === 1 ? '' : 'n'}`}</span>
        <button className="primaer" disabled={!dokument} onClick={() => vorschau.current?.drucken()}>
          Drucken / PDF
        </button>
      </header>

      <Seitenleiste notizen={geladen.notizen} liste={liste} onListe={setListe} />

      <main className="hauptbereich">
        {fehler && <div className="fehler">{fehler}</div>}
        {liste.length === 0 && <div className="leer-hinweis">Links eine Notiz wählen – mit „+“ weitere anhängen.</div>}
        {dokument && (
          <Vorschau
            ref={vorschau}
            html={dokument.html}
            vaultCss={geladen.einstellungen.css}
            titel={dokument.titel}
            umbruchModus={umbruchModus}
            onBlockKlick={blockKlick}
            onFertig={setSeiten}
          />
        )}
        <Hinweise
          hinweise={hinweise}
          onLayoutEintragLoeschen={(notiz, i) => layoutAendern(notiz, (l) => eintragLoeschen(l, i))}
        />
      </main>
    </div>
  )
}

function Start(props: { gemerkt: string | null; fehler: string | null; onOrdner(): void; onGemerkt(): void; onDemo(): void }) {
  const moeglich = ordnerZugriffMoeglich()
  return (
    <div className="start">
      <h1>Druckreif</h1>
      <p>Obsidian-Lernzettel als druckfertige A4-Seiten.</p>
      {props.gemerkt && moeglich && (
        <button className="primaer" onClick={props.onGemerkt}>
          „{props.gemerkt}“ wieder öffnen
        </button>
      )}
      <button className={props.gemerkt ? '' : 'primaer'} disabled={!moeglich} onClick={props.onOrdner}>
        Vault-Ordner wählen …
      </button>
      <button onClick={props.onDemo}>Demo-Vault ansehen</button>
      {!moeglich && <p className="hinweis-text">Ordnerzugriff geht nur in Chrome oder Edge über localhost (start.bat).</p>}
      {props.fehler && <p className="fehler">{props.fehler}</p>}
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
