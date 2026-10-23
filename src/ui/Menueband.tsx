// Menüband wie im modernen Word: Registerkarten Datei, Start, Layout, Überprüfen, Ansicht, Hilfe und – nur bei
// gewähltem Bild bzw. gewählter Tabelle – Bildformat und Tabellenlayout. Rechts Hinweise und Drucken (wie Kommentare
// und Teilen), unten rechts die Menüband-Anzeigeoptionen. Das Band kennt keine Logik: Es zeigt den Zustand an und
// ruft die Befehle der App auf.

import { useEffect, useRef, useState } from 'react'
import {
  ALargeSmall,
  BookOpenText,
  Check,
  ChevronDown,
  ChevronUp,
  Focus,
  Keyboard,
  MessageSquareWarning,
  MoveHorizontal,
  Pin,
  Ruler,
  Settings,
  Square,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Ban,
  Droplet,
  Eye,
  EyeOff,
  FileText,
  FileX2,
  Image,
  ListTree,
  Maximize2,
  Minus,
  PanelRight,
  Pilcrow,
  Plus,
  Printer,
  Redo2,
  RefreshCw,
  RotateCcw,
  Rows3,
  ScissorsLineDashed,
  Search,
  SearchX,
  SeparatorHorizontal,
  Sparkles,
  Table,
  Undo2,
  WandSparkles,
  WrapText,
} from 'lucide-react'
import { type BlockTyp, type LayoutEintrag, STANDARD_SCHRIFT_PT, STANDARD_ZEILENABSTAND } from '../layout/layoutDatei'
import {
  abstandSetzen,
  ausblendenSetzen,
  bildSetzen,
  bildZuruecksetzen,
  eintragZuruecksetzen,
  tabelleSetzen,
  tabelleZuruecksetzen,
  tabellenBreiteSetzen,
  teilenSetzen,
  umbruchSetzen,
  umbruchUmschalten,
  umfliessenSetzen,
  MAX_BILDVERSATZ_MM,
  MIN_BILDVERSATZ_MM,
  TEXTBREITE_MM,
} from '../layout/bearbeiten'
import { Gruppe, GrosserKnopf, KleinerKnopf, SymbolKnopf, Zahlfeld, ZOOM_MAX, ZOOM_MIN, zahlText } from './Band'
import type { BandAnzeige } from './oberflaeche'
import { quickinfo } from './QuickInfo'

export type Reiter = 'start' | 'layout' | 'pruefen' | 'ansicht' | 'hilfe' | 'bild' | 'tabelle'

/** Zugriffstasten (Alt) der Registerkarten wie in der deutschen Word-Oberfläche */
const REITER: { id: Reiter; text: string; taste: string }[] = [
  { id: 'start', text: 'Start', taste: 'R' },
  { id: 'layout', text: 'Layout', taste: 'P' },
  { id: 'pruefen', text: 'Überprüfen', taste: 'Ü' },
  { id: 'ansicht', text: 'Ansicht', taste: 'F' },
  { id: 'hilfe', text: 'Hilfe', taste: 'Y' },
]

interface Schrift {
  fontSizePt?: number
  lineHeight?: number
}

interface GewaehlterBlock {
  typ: BlockTyp
  beschreibung: string // z. B. "Absatz in „Atemmechanik“"
  eintrag: LayoutEintrag | undefined
}

interface BandProps {
  reiter: Reiter
  onReiter(r: Reiter): void
  onDatei(): void

  kannZurueck: boolean
  kannVor: boolean
  zurueck(): void
  vor(): void
  drucken(): void

  aktualisieren(): void

  /** Schrift der Auswahl (gewählter Block, sonst die ganze Notiz) */
  auswahlSchrift: Schrift & { fuer: string } | null
  onAuswahlSchrift(teil: Schrift): void
  notizName: string | null
  notizSchrift: Schrift
  onNotizSchrift(teil: Schrift): void
  notizHatLayout: boolean
  notizZuruecksetzen(): void

  block: GewaehlterBlock | null
  /** gemessene Breite des gewählten Bildes in mm (Startwert für die Pfeile) */
  bildIstMm: number | null
  blockAendern(aendern: (e: LayoutEintrag) => LayoutEintrag): void

  zoom: number
  onZoom(z: number): void
  /** Zoom, bei dem die Seitenbreite bzw. eine ganze Seite ins Fenster passt (null: keine Seiten) */
  zoomFuer(art: 'breite' | 'seite'): number | null
  nav: boolean
  onNav(an: boolean): void
  hinweise: boolean
  onHinweise(an: boolean): void
  zeichen: boolean
  onZeichen(an: boolean): void

  /** Tinte sparen (pro Mappe) */
  tinteSparen: boolean
  onTinteSparen(an: boolean): void
  /** Automatisch formatieren auf eine Seitenzahl */
  seiten: number
  zielSeiten: number | undefined
  onZielSeiten(n: number | undefined): void
  formatieren: (() => void) | null
  formatiertLaeuft: boolean
  onSuche(): void
  /** Manuelle Änderungen der gewählten bzw. sichtbaren Seite verwerfen */
  seiteZuruecksetzen: (() => void) | null
  seiteNummer: number
  /** Komplett neu anfangen: alle Notizen der Mappe und Mappen-Einstellungen */
  allesZuruecksetzen: (() => void) | null

  /** Anzahl offener Hinweise (Knopf rechts wie „Kommentare“) */
  probleme: number
  bandAnzeige: BandAnzeige
  onBandAnzeige(a: BandAnzeige): void
  schnellzugriff: boolean
  onSchnellzugriff(an: boolean): void
  lineal: boolean
  onLineal(an: boolean): void
  onWoerter(): void
  onTastenkuerzel(): void
  onOptionen(): void
  /** Suchen und Ausblenden (null: kein Dokument) */
  onAbschnitteAusblenden: (() => void) | null
  /** Anzahl der Ausblende-Regeln der Mappe */
  ausblendRegeln: number
}

export function Menueband(p: BandProps) {
  const kontext = p.block?.typ === 'image' ? 'bild' : p.block?.typ === 'table' ? 'tabelle' : null
  const reiter = [...REITER]
  if (kontext === 'bild') reiter.push({ id: 'bild', text: 'Bildformat', taste: 'JP' })
  if (kontext === 'tabelle') reiter.push({ id: 'tabelle', text: 'Tabellenlayout', taste: 'JL' })
  const istKontext = p.reiter === 'bild' || p.reiter === 'tabelle'
  const aktuell = istKontext && p.reiter !== kontext ? 'start' : p.reiter

  // „Nur Registerkarten“: ein Klick auf eine Karte klappt das Band kurz über dem Dokument auf
  const [aufgeklappt, setAufgeklappt] = useState(false)
  const [menue, setMenue] = useState<{ art: 'anzeige' | 'rechts'; x: number; y: number } | null>(null)
  const wurzel = useRef<HTMLDivElement>(null)
  const reduziert = p.bandAnzeige === 'register'
  useEffect(() => {
    if (!aufgeklappt && !menue) return
    const zu = (e: PointerEvent) => {
      const ziel = e.target as Element
      if (menue && !ziel.closest('.band-menue')) setMenue(null)
      if (aufgeklappt && !wurzel.current?.contains(ziel)) setAufgeklappt(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenue(null)
      setAufgeklappt(false)
    }
    // Klick in die Seiten (iframe) nimmt dem Fenster den Fokus
    const weg = () => {
      setMenue(null)
      setAufgeklappt(false)
    }
    window.addEventListener('pointerdown', zu)
    window.addEventListener('keydown', esc)
    window.addEventListener('blur', weg)
    return () => {
      window.removeEventListener('pointerdown', zu)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('blur', weg)
    }
  }, [aufgeklappt, menue])
  useEffect(() => {
    if (!reduziert) setAufgeklappt(false)
  }, [reduziert])

  const reiterKlick = (id: Reiter) => {
    p.onReiter(id)
    if (reduziert) setAufgeklappt(id !== aktuell || !aufgeklappt)
  }
  const bandSichtbar = !reduziert || aufgeklappt
  const anzeigeWaehlen = (a: BandAnzeige) => {
    setMenue(null)
    setAufgeklappt(false)
    p.onBandAnzeige(a)
  }

  return (
    <div
      className={`menueband${reduziert ? ' reduziert' : ''}${aufgeklappt ? ' aufgeklappt' : ''}`}
      ref={wurzel}
      onContextMenu={(e) => {
        if ((e.target as Element).closest('input')) return
        e.preventDefault()
        setMenue({ art: 'rechts', x: e.clientX, y: e.clientY })
      }}
    >
      <nav className="reiter" role="tablist">
        <button className="reiter-datei" onClick={p.onDatei} data-keytip="D">
          Datei
        </button>
        {reiter.map((r) => (
          <button
            key={r.id}
            role="tab"
            aria-selected={r.id === aktuell}
            className={`${r.id === aktuell && bandSichtbar ? 'gewaehlt' : ''}${r.id === kontext ? ' kontext' : ''}`}
            data-keytip={r.taste}
            onClick={() => reiterKlick(r.id)}
            onDoubleClick={() => anzeigeWaehlen(reduziert ? 'immer' : 'register')}
          >
            {r.text}
          </button>
        ))}
        <span className="reiter-abstand" />
        <button
          className={`reiter-aktion${p.hinweise ? ' an' : ''}`}
          onClick={() => p.onHinweise(!p.hinweise)}
          data-keytip="C"
          {...quickinfo('Hinweise', 'Was beim Umwandeln auffiel: Fehler, zu prüfende Stellen, ausgeblendete Abschnitte, halb leere Seiten')}
        >
          <MessageSquareWarning size={16} /> Hinweise
          {p.probleme > 0 && <span className="zahl">{p.probleme}</span>}
        </button>
        <button className="reiter-drucken" onClick={p.drucken} data-keytip="Z" {...quickinfo('Drucken', 'Drucken oder als PDF speichern (Strg+P)')}>
          <Printer size={16} /> Drucken
        </button>
      </nav>
      {bandSichtbar && (
        <div
          className="band"
          onClick={(e) => {
            // Aufgeklapptes Band schließt nach einem Befehl wieder (nicht beim Tippen in Zahlenfelder)
            if (aufgeklappt && (e.target as Element).closest('button') && !(e.target as Element).closest('.band-zahl, .band-optionen')) setAufgeklappt(false)
          }}
        >
          {aktuell === 'start' && <StartReiter {...p} />}
          {aktuell === 'layout' && <LayoutReiter {...p} />}
          {aktuell === 'pruefen' && <PruefenReiter {...p} />}
          {aktuell === 'ansicht' && <AnsichtReiter {...p} />}
          {aktuell === 'hilfe' && <HilfeReiter {...p} />}
          {aktuell === 'bild' && <BildReiter {...p} />}
          {aktuell === 'tabelle' && <TabellenReiter {...p} />}
          <span className="band-abstand" />
          {aufgeklappt ? (
            <button className="band-optionen" onClick={() => anzeigeWaehlen('immer')} aria-label="Menüband anheften" {...quickinfo('Menüband anheften', 'Menüband immer anzeigen (Strg+F1)')}>
              <Pin size={14} />
            </button>
          ) : (
            <button
              className="band-optionen"
              aria-label="Menüband-Anzeigeoptionen"
              {...quickinfo('Menüband-Anzeigeoptionen', 'Menüband immer, nur die Registerkarten oder gar nicht anzeigen (Strg+F1)')}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setMenue({ art: 'anzeige', x: r.right - 280, y: r.bottom + 4 })
              }}
            >
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      )}
      {menue && (
        <div className="band-menue kontextmenue" style={{ left: Math.max(4, Math.min(menue.x, innerWidth - 290)), top: menue.y }}>
          {menue.art === 'anzeige' ? (
            <>
              <AnzeigeOption an={p.bandAnzeige === 'vollbild'} symbol={Maximize2} titel="Vollbildmodus" text="Menüband ausblenden, für die beste Sicht auf die Seiten. Oben rechts „…“ zeigt es wieder." onClick={() => anzeigeWaehlen('vollbild')} />
              <AnzeigeOption an={reduziert} symbol={ChevronUp} titel="Nur Registerkarten anzeigen" text="Ein Klick auf eine Registerkarte zeigt die Befehle." onClick={() => anzeigeWaehlen('register')} />
              <AnzeigeOption an={p.bandAnzeige === 'immer'} symbol={Square} titel="Menüband immer anzeigen" text="Registerkarten und Befehle bleiben sichtbar." onClick={() => anzeigeWaehlen('immer')} />
              <hr />
              <button onClick={() => { setMenue(null); p.onSchnellzugriff(!p.schnellzugriff) }}>
                {p.schnellzugriff ? <Check size={15} /> : <span className="leer-symbol" />} Symbolleiste für den Schnellzugriff anzeigen
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setMenue(null); p.onSchnellzugriff(!p.schnellzugriff) }}>
                {p.schnellzugriff ? <Check size={15} /> : <span className="leer-symbol" />} Symbolleiste für den Schnellzugriff anzeigen
              </button>
              <button onClick={() => anzeigeWaehlen(reduziert ? 'immer' : 'register')}>
                {reduziert ? <Check size={15} /> : <span className="leer-symbol" />} Menüband reduzieren
              </button>
              <hr />
              <button onClick={() => { setMenue(null); p.onOptionen() }}>
                <Settings size={15} /> Optionen …
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AnzeigeOption(o: { an: boolean; symbol: typeof Square; titel: string; text: string; onClick(): void }) {
  const Symbol = o.symbol
  return (
    <button className={`anzeige-option${o.an ? ' an' : ''}`} onClick={o.onClick}>
      <Symbol size={18} />
      <span>
        <strong>{o.titel}</strong>
        <small>{o.text}</small>
      </span>
    </button>
  )
}

function StartReiter(p: BandProps) {
  const e = p.block?.eintrag
  return (
    <>
      <Gruppe titel="Rückgängig">
        <div className="spalte">
          <KleinerKnopf symbol={Undo2} text="Rückgängig" tipp="Rückgängig (Strg+Z)" onClick={p.zurueck} gesperrt={!p.kannZurueck} />
          <KleinerKnopf symbol={Redo2} text="Wiederholen" tipp="Wiederholen (Strg+Y)" onClick={p.vor} gesperrt={!p.kannVor} />
        </div>
      </Gruppe>
      <Gruppe titel="Schriftart">
        <div className="spalte">
          <Zahlfeld
            beschriftung="Schriftgröße"
            wert={p.auswahlSchrift?.fontSizePt}
            platzhalter={zahlText(p.notizSchrift.fontSizePt ?? STANDARD_SCHRIFT_PT)}
            einheit="pt"
            schritt={0.5}
            min={6}
            max={24}
            gesperrt={!p.auswahlSchrift}
            onWert={(pt) => p.onAuswahlSchrift({ fontSizePt: pt })}
          />
          <Zahlfeld
            beschriftung="Zeilenabstand"
            wert={p.auswahlSchrift?.lineHeight}
            platzhalter={zahlText(p.notizSchrift.lineHeight ?? STANDARD_ZEILENABSTAND)}
            einheit="×"
            schritt={0.05}
            min={0.9}
            max={2.5}
            gesperrt={!p.auswahlSchrift}
            onWert={(z) => p.onAuswahlSchrift({ lineHeight: z })}
          />
          <span className="band-info" title="Ohne gewählten Block gilt die Einstellung für die ganze Notiz">
            {p.auswahlSchrift ? `für ${p.auswahlSchrift.fuer}` : 'keine Notiz'}
          </span>
        </div>
      </Gruppe>
      <BlockGruppe {...p} />
      <Gruppe titel="Seitenumbruch">
        <GrosserKnopf
          symbol={SeparatorHorizontal}
          text="Umbruch davor"
          tipp="Seitenumbruch vor dem gewählten Block (Strg+Enter)"
          aktiv={e?.pageBreakBefore === true}
          gesperrt={!p.block}
          onClick={() => p.blockAendern(umbruchUmschalten(true))}
        />
      </Gruppe>
      <Gruppe titel="Bearbeiten">
        <GrosserKnopf symbol={Search} text="Suchen" tipp="Im Dokument suchen (Strg+F)" onClick={p.onSuche} />
        <AusblendenKnopf {...p} />
      </Gruppe>
      <Gruppe titel="Ausgabe">
        <GrosserKnopf symbol={RefreshCw} text="Aktualisieren" tipp="Vault neu einlesen: geänderte Notizen, neue oder verschobene Bilder, Theme (F5)" onClick={p.aktualisieren} />
        <GrosserKnopf symbol={Printer} text="Drucken / PDF" tipp="Drucken oder als PDF speichern (Strg+P)" onClick={p.drucken} />
      </Gruppe>
    </>
  )
}

function AusblendenKnopf(p: BandProps) {
  return (
    <GrosserKnopf
      symbol={SearchX}
      text={p.ausblendRegeln > 0 ? `Suchen und Ausblenden (${p.ausblendRegeln})` : 'Suchen und Ausblenden'}
      gesperrt={!p.onAbschnitteAusblenden}
      onClick={() => p.onAbschnitteAusblenden?.()}
      tipp="Abschnitte nach ihrer Überschrift suchen (z. B. „Quellen“) und in allen Notizen der Mappe ausblenden – auch in später hinzugefügten"
    />
  )
}

/** Ausblenden und Zurücksetzen des gewählten Blocks – auf Start und Layout gleich. */
function BlockGruppe(p: BandProps) {
  const e = p.block?.eintrag
  const ausgeblendet = e?.hidden === true
  return (
    <Gruppe titel="Block">
      <GrosserKnopf
        symbol={ausgeblendet ? Eye : EyeOff}
        text={ausgeblendet ? 'Einblenden' : 'Im Druck ausblenden'}
        tipp={
          p.block?.typ === 'heading'
            ? 'Den ganzen Abschnitt nicht drucken, z. B. „Quellen“ (Entf)'
            : 'Diesen Block nicht drucken (Entf)'
        }
        gesperrt={!p.block}
        onClick={() => p.blockAendern(ausblendenSetzen(!ausgeblendet))}
      />
      <div className="spalte">
        <span className="band-info">{p.block ? p.block.beschreibung : 'Block auf der Seite anklicken'}</span>
        <KleinerKnopf
          symbol={RotateCcw}
          text="Block zurücksetzen"
          gesperrt={!e}
          onClick={() => p.blockAendern(eintragZuruecksetzen)}
        />
      </div>
    </Gruppe>
  )
}

function LayoutReiter(p: BandProps) {
  const e = p.block?.eintrag
  const umbruch = e?.pageBreakBefore
  return (
    <>
      <Gruppe titel="Seitenumbruch vor dem Block">
        <GrosserKnopf symbol={SeparatorHorizontal} text="Umbruch" aktiv={umbruch === true} gesperrt={!p.block} onClick={() => p.blockAendern(umbruchSetzen(true))} tipp="Neue Seite vor diesem Block (Strg+Enter)" />
        <GrosserKnopf symbol={Ban} text="Verhindern" aktiv={umbruch === false} gesperrt={!p.block} onClick={() => p.blockAendern(umbruchSetzen(false))} tipp="Möglichst keinen Umbruch vor diesem Block" />
        <GrosserKnopf symbol={Sparkles} text="Automatisch" aktiv={!!p.block && umbruch === undefined} gesperrt={!p.block} onClick={() => p.blockAendern(umbruchSetzen(undefined))} tipp="Umbruch nach den Regeln der Export-Anweisung" />
      </Gruppe>
      <Gruppe titel="Über Seiten">
        <TeilenKnopf {...p} />
      </Gruppe>
      <Gruppe titel="Abstand">
        <div className="spalte">
          <Zahlfeld beschriftung="Vor" wert={e?.spaceBeforeMm} platzhalter="auto" einheit="mm" schritt={1} min={-20} max={100} gesperrt={!p.block}
            onWert={(mm) => p.blockAendern(abstandSetzen(mm, e?.spaceAfterMm))} />
          <Zahlfeld beschriftung="Nach" wert={e?.spaceAfterMm} platzhalter="auto" einheit="mm" schritt={1} min={-20} max={100} gesperrt={!p.block}
            onWert={(mm) => p.blockAendern(abstandSetzen(e?.spaceBeforeMm, mm))} />
        </div>
      </Gruppe>
      <BlockGruppe {...p} />
      <Gruppe titel={p.notizName ? `Notiz „${kurz(p.notizName)}“` : 'Notiz'}>
        <div className="spalte">
          <Zahlfeld beschriftung="Grundschrift" wert={p.notizSchrift.fontSizePt} platzhalter={zahlText(STANDARD_SCHRIFT_PT)} einheit="pt" schritt={0.5} min={7} max={16} gesperrt={!p.notizName}
            onWert={(pt) => p.onNotizSchrift({ fontSizePt: pt })} />
          <Zahlfeld beschriftung="Zeilenabstand" wert={p.notizSchrift.lineHeight} platzhalter={zahlText(STANDARD_ZEILENABSTAND)} einheit="×" schritt={0.05} min={0.9} max={2.5} gesperrt={!p.notizName}
            onWert={(z) => p.onNotizSchrift({ lineHeight: z })} />
        </div>
        <GrosserKnopf symbol={FileText} text="Layout zurücksetzen" gesperrt={!p.notizHatLayout} onClick={p.notizZuruecksetzen} tipp="Alle manuellen Änderungen dieser Notiz verwerfen" />
      </Gruppe>
      <Gruppe titel="Mappe">
        <div className="spalte">
          <Zahlfeld beschriftung="Auf Seiten" wert={p.zielSeiten} platzhalter={String(Math.max(1, p.seiten - 1))} einheit="" schritt={1} min={1} max={99}
            gesperrt={!p.formatieren} onWert={(n) => p.onZielSeiten(n === undefined ? undefined : Math.round(n))} />
          <span className="band-info">{p.seiten > 0 ? `jetzt ${p.seiten} ${p.seiten === 1 ? 'Seite' : 'Seiten'}` : ' '}</span>
        </div>
        <GrosserKnopf symbol={WandSparkles} text="Automatisch formatieren" gesperrt={!p.formatieren || p.formatiertLaeuft} onClick={() => p.formatieren?.()}
          tipp="Grundschrift und Zeilenabstand aller Notizen der Mappe so wählen, dass alles auf die angegebene Seitenzahl passt. Danach weiter frei änderbar (Rückgängig: Strg+Z)." />
        <GrosserKnopf symbol={Droplet} text="Tinte sparen" aktiv={p.tinteSparen} gesperrt={!p.formatieren} onClick={() => p.onTinteSparen(!p.tinteSparen)}
          tipp="Callouts und Tabellenköpfe ohne farbige Flächen, in Graustufen drucken" />
      </Gruppe>
      <ZuruecksetzenGruppe {...p} />
    </>
  )
}

/** Zurücksetzen in drei Stufen: Block (Gruppe „Block“), Seite, alles. Alles bleibt rückgängig zu machen. */
function ZuruecksetzenGruppe(p: BandProps) {
  return (
    <Gruppe titel="Zurücksetzen">
      <div className="spalte">
        <KleinerKnopf symbol={FileX2} text={`Seite ${p.seiteNummer} zurücksetzen`} gesperrt={!p.seiteZuruecksetzen} onClick={() => p.seiteZuruecksetzen?.()}
          tipp="Alle manuellen Änderungen an Blöcken dieser Seite verwerfen (Seite des gewählten Blocks, sonst die sichtbare)" />
        <KleinerKnopf symbol={RotateCcw} text="Alles zurücksetzen" gesperrt={!p.allesZuruecksetzen} onClick={() => p.allesZuruecksetzen?.()}
          tipp="Komplett neu anfangen: Layout aller Notizen der Mappe, „Direkt anschließen“ und „Tinte sparen“ verwerfen" />
      </div>
    </Gruppe>
  )
}

/** Abschnitt, Liste, Callout, Codeblock oder Tabelle darf über Seiten laufen statt am Stück auf die nächste Seite zu rutschen. */
function TeilenKnopf(p: BandProps) {
  const e = p.block?.eintrag
  const typ = p.block?.typ
  const tabelle = typ === 'table'
  const moeglich = typ === 'heading' || typ === 'list' || typ === 'callout' || typ === 'code' || tabelle
  const an = tabelle ? !!e?.table?.split : !!e?.split
  return (
    <GrosserKnopf
      symbol={ScissorsLineDashed}
      text="Teilen erlauben"
      aktiv={moeglich && an}
      gesperrt={!moeglich}
      onClick={() => p.blockAendern(tabelle ? tabelleSetzen({ split: an ? undefined : true }) : teilenSetzen(!an))}
      tipp={typ === 'heading' ? 'Der ganze Abschnitt darf auf der nächsten Seite weiterlaufen (gegen halb leere Seiten)' : 'Darf auf der nächsten Seite weiterlaufen (sonst am Stück)'}
    />
  )
}

function PruefenReiter(p: BandProps) {
  return (
    <>
      <Gruppe titel="Dokumentprüfung">
        <GrosserKnopf symbol={MessageSquareWarning} text={p.probleme > 0 ? `Hinweise (${p.probleme})` : 'Hinweise'} aktiv={p.hinweise} onClick={() => p.onHinweise(!p.hinweise)}
          tipp="Aufgabenbereich mit allem, was beim Umwandeln auffiel: Fehler, zu prüfende Stellen, Ausgeblendetes, halb leere Seiten" />
        <GrosserKnopf symbol={BookOpenText} text="Wörter zählen" onClick={p.onWoerter} tipp="Seiten, Wörter, Zeichen und Absätze der gedruckten Mappe" />
      </Gruppe>
      <Gruppe titel="Suchen">
        <GrosserKnopf symbol={Search} text="Suchen" tipp="Im Dokument suchen (Strg+F)" onClick={p.onSuche} />
        <AusblendenKnopf {...p} />
      </Gruppe>
      <Gruppe titel="Formatierung">
        <GrosserKnopf symbol={Pilcrow} text="Umbrüche zeigen" aktiv={p.zeichen} onClick={() => p.onZeichen(!p.zeichen)} tipp="Manuelle Seitenumbrüche auf den Seiten markieren" />
      </Gruppe>
      <ZuruecksetzenGruppe {...p} />
    </>
  )
}

function AnsichtReiter(p: BandProps) {
  const zoomAuf = (art: 'breite' | 'seite') => {
    const z = p.zoomFuer(art)
    if (z) p.onZoom(z)
  }
  return (
    <>
      <Gruppe titel="Ansichten">
        <GrosserKnopf symbol={FileText} text="Drucklayout" aktiv onClick={() => {}} tipp="Seiten so, wie sie gedruckt werden (die einzige Ansicht: was hier steht, kommt aufs Papier)" />
        <GrosserKnopf symbol={Focus} text="Fokus" aktiv={p.bandAnzeige === 'vollbild'} onClick={() => p.onBandAnzeige(p.bandAnzeige === 'vollbild' ? 'immer' : 'vollbild')} tipp="Menüband und Titelleiste ausblenden – nur die Seiten (oben rechts „…“ holt sie zurück)" />
      </Gruppe>
      <Gruppe titel="Anzeigen">
        <div className="spalte">
          <KleinerKnopf symbol={Ruler} text="Lineal" aktiv={p.lineal} onClick={() => p.onLineal(!p.lineal)} tipp="Lineal über den Seiten: Seitenränder und Textbreite in Zentimetern" />
          <KleinerKnopf symbol={ListTree} text="Navigationsbereich" aktiv={p.nav} onClick={() => p.onNav(!p.nav)} tipp="Mappe, Notizen, Überschriften und Seiten links" />
          <KleinerKnopf symbol={PanelRight} text="Hinweise" aktiv={p.hinweise} onClick={() => p.onHinweise(!p.hinweise)} />
        </div>
        <GrosserKnopf symbol={Pilcrow} text="Umbrüche zeigen" aktiv={p.zeichen} onClick={() => p.onZeichen(!p.zeichen)} tipp="Manuelle Seitenumbrüche auf den Seiten markieren" />
      </Gruppe>
      <Gruppe titel="Zoom">
        <GrosserKnopf symbol={Search} text={`${Math.round(p.zoom * 100)} %`} onClick={() => p.onZoom(1)} tipp="Auf 100 % zurücksetzen" />
        <div className="spalte">
          <KleinerKnopf symbol={Square} text="Eine Seite" onClick={() => zoomAuf('seite')} tipp="So zoomen, dass eine ganze Seite ins Fenster passt" />
          <KleinerKnopf symbol={MoveHorizontal} text="Seitenbreite" onClick={() => zoomAuf('breite')} tipp="So zoomen, dass die Seite das Fenster in der Breite ausfüllt" />
          <div className="zeile">
            <SymbolKnopf symbol={Minus} text="Verkleinern" onClick={() => p.onZoom(p.zoom - 0.1)} gesperrt={p.zoom <= ZOOM_MIN} />
            <SymbolKnopf symbol={Maximize2} text="100 %" onClick={() => p.onZoom(1)} />
            <SymbolKnopf symbol={Plus} text="Vergrößern" onClick={() => p.onZoom(p.zoom + 0.1)} gesperrt={p.zoom >= ZOOM_MAX} />
          </div>
        </div>
      </Gruppe>
      <Gruppe titel="Vault">
        <GrosserKnopf symbol={RefreshCw} text="Aktualisieren" tipp="Vault neu einlesen (F5)" onClick={p.aktualisieren} />
      </Gruppe>
    </>
  )
}

function HilfeReiter(p: BandProps) {
  return (
    <>
      <Gruppe titel="Hilfe">
        <GrosserKnopf symbol={Keyboard} text="Tasten­kombinationen" onClick={p.onTastenkuerzel} tipp="Alle Tastenkürzel auf einen Blick. Alt drückt Zugriffstasten auf das Menüband." />
        <GrosserKnopf symbol={Settings} text="Optionen" onClick={p.onOptionen} tipp="Office-Design (hell, dunkel), Menüband, Schnellzugriff" />
      </Gruppe>
      <Gruppe titel="Bedienung">
        <div className="spalte hilfetext">
          <span>Klick auf einen Block wählt ihn, Rechtsklick zeigt Befehle.</span>
          <span>Bilder ziehen verschiebt sie, die Ecken ändern die Größe.</span>
          <span>Alt+Q: Befehl suchen · Alt: Zugriffstasten</span>
        </div>
      </Gruppe>
    </>
  )
}

function BildReiter(p: BandProps) {
  const bild = p.block?.eintrag?.image
  const umfliessen = !!bild?.wrap
  const ausrichtung = bild?.align ?? (umfliessen ? 'right' : 'left')
  const setzen = (teil: Parameters<typeof bildSetzen>[0]) => p.blockAendern(bildSetzen(teil))
  return (
    <>
      <Gruppe titel="Größe">
        <div className="spalte">
          <Zahlfeld beschriftung="Breite" wert={bild?.widthMm} platzhalter={p.bildIstMm ? String(p.bildIstMm) : 'auto'} start={p.bildIstMm ?? 80} einheit="mm" schritt={5} min={15} max={TEXTBREITE_MM} onWert={(mm) => setzen({ widthMm: mm })} />
          <KleinerKnopf symbol={Image} text="Originalgröße" gesperrt={bild?.widthMm === undefined} onClick={() => setzen({ widthMm: undefined })} />
        </div>
      </Gruppe>
      <Gruppe titel="Ausrichtung">
        <div className="zeile">
          <SymbolKnopf symbol={AlignLeft} text="Links" aktiv={ausrichtung === 'left'} onClick={() => setzen({ align: 'left' })} />
          <SymbolKnopf symbol={AlignCenter} text={umfliessen ? 'Zentriert (nur ohne Textumbruch)' : 'Zentriert'} aktiv={ausrichtung === 'center'} gesperrt={umfliessen} onClick={() => setzen({ align: 'center' })} />
          <SymbolKnopf symbol={AlignRight} text="Rechts" aktiv={ausrichtung === 'right'} onClick={() => setzen({ align: 'right' })} />
        </div>
      </Gruppe>
      <Gruppe titel="Textumbruch">
        <GrosserKnopf symbol={Image} text="Eigene Zeile" aktiv={!umfliessen} onClick={() => p.blockAendern(umfliessenSetzen(false))} tipp="Bild steht als eigener Block an seiner Stelle in der Notiz, Text darunter" />
        <GrosserKnopf symbol={WrapText} text="Text umfließt" aktiv={umfliessen} onClick={() => p.blockAendern(umfliessenSetzen(true))} tipp="Wie in Word: Bild steht links oder rechts, der Text des Abschnitts fließt herum. Bild in den Text ziehen, um es an einen anderen Absatz zu setzen" />
        <div className="spalte">
          <Zahlfeld beschriftung="Abstand zum Text" wert={bild?.wrapGapMm} platzhalter="4" start={4} einheit="mm" schritt={1} min={0} max={20} gesperrt={!umfliessen} onWert={(mm) => setzen({ wrapGapMm: mm })} />
          <KleinerKnopf symbol={Undo2} text="An ursprüngliche Stelle" gesperrt={!bild?.before && !bild?.offsetYMm} onClick={() => setzen({ before: undefined, offsetYMm: undefined })} />
        </div>
      </Gruppe>
      <Gruppe titel="Position">
        <div className="spalte">
          <Zahlfeld beschriftung={umfliessen ? 'Tiefer im Absatz' : 'Abstand oben'} wert={bild?.offsetYMm} platzhalter="0" einheit="mm" schritt={1} min={umfliessen ? 0 : MIN_BILDVERSATZ_MM} max={MAX_BILDVERSATZ_MM} onWert={(mm) => setzen({ offsetYMm: mm })} />
          <span className="band-info" title="Bild auf der Seite ziehen verschiebt es, die Ecken ändern die Größe">Ziehen: verschieben · Ecke: Größe</span>
        </div>
      </Gruppe>
      <Gruppe titel="Zurücksetzen">
        <GrosserKnopf symbol={RotateCcw} text="Bild zurücksetzen" gesperrt={!bild} onClick={() => p.blockAendern(bildZuruecksetzen)} />
      </Gruppe>
    </>
  )
}

/** Tabellen lassen sich wie Bilder anordnen: Größe, Ausrichtung, Textumbruch, Position – dazu Spalten und Schrift. */
function TabellenReiter(p: BandProps) {
  const t = p.block?.eintrag?.table
  const setzen = (teil: Parameters<typeof tabelleSetzen>[0]) => p.blockAendern(tabelleSetzen(teil))
  const umfliessen = !!t?.wrap
  const ausrichtung = t?.align ?? (umfliessen ? 'right' : 'left')
  return (
    <>
      <Gruppe titel="Größe">
        <div className="spalte">
          <Zahlfeld beschriftung="Breite" wert={t?.widthPct} platzhalter="100" einheit="%" schritt={5} min={20} max={100} onWert={(w) => p.blockAendern(tabellenBreiteSetzen(w))} />
          <KleinerKnopf symbol={Table} text="Volle Breite" gesperrt={t?.widthPct === undefined} onClick={() => p.blockAendern(tabellenBreiteSetzen(undefined))} tipp="Tabelle wieder so breit wie der Text" />
          <span className="band-info" title="Ecken oder rechten Rand der gewählten Tabelle ziehen">Ecke ziehen: Größe</span>
        </div>
      </Gruppe>
      <Gruppe titel="Ausrichtung">
        <div className="zeile">
          <SymbolKnopf symbol={AlignLeft} text="Links" aktiv={ausrichtung === 'left'} onClick={() => setzen({ align: umfliessen ? 'left' : undefined })} />
          <SymbolKnopf symbol={AlignCenter} text={umfliessen ? 'Zentriert (nur ohne Textumbruch)' : 'Zentriert'} aktiv={ausrichtung === 'center'} gesperrt={umfliessen} onClick={() => setzen({ align: 'center' })} />
          <SymbolKnopf symbol={AlignRight} text="Rechts" aktiv={ausrichtung === 'right'} onClick={() => setzen({ align: 'right' })} />
        </div>
      </Gruppe>
      <Gruppe titel="Textumbruch">
        <GrosserKnopf symbol={Table} text="Eigene Zeile" aktiv={!umfliessen} onClick={() => p.blockAendern(umfliessenSetzen(false, 'table'))} tipp="Tabelle steht als eigener Block an ihrer Stelle in der Notiz, Text darunter" />
        <GrosserKnopf symbol={WrapText} text="Text umfließt" aktiv={umfliessen} onClick={() => p.blockAendern(umfliessenSetzen(true, 'table'))} tipp="Wie beim Bild: Tabelle steht links oder rechts, der Text des Abschnitts fließt herum. Tabelle ziehen, um sie an einen anderen Absatz zu setzen" />
        <div className="spalte">
          <Zahlfeld beschriftung="Abstand zum Text" wert={t?.wrapGapMm} platzhalter="4" start={4} einheit="mm" schritt={1} min={0} max={20} gesperrt={!umfliessen} onWert={(mm) => setzen({ wrapGapMm: mm })} />
          <KleinerKnopf symbol={Undo2} text="An ursprüngliche Stelle" gesperrt={!t?.before && !t?.offsetYMm} onClick={() => setzen({ before: undefined, offsetYMm: undefined })} />
        </div>
      </Gruppe>
      <Gruppe titel="Position">
        <div className="spalte">
          <Zahlfeld beschriftung={umfliessen ? 'Tiefer im Absatz' : 'Abstand oben'} wert={t?.offsetYMm} platzhalter="0" einheit="mm" schritt={1} min={umfliessen ? 0 : MIN_BILDVERSATZ_MM} max={MAX_BILDVERSATZ_MM} onWert={(mm) => setzen({ offsetYMm: mm })} />
          <span className="band-info" title="Gewählte Tabelle auf der Seite ziehen verschiebt sie">Ziehen: verschieben</span>
        </div>
      </Gruppe>
      <Gruppe titel="Spalten">
        <GrosserKnopf symbol={Table} text="Automatisch" aktiv={!t?.columnsPct} gesperrt={!t?.columnsPct} onClick={() => setzen({ columnsPct: undefined })} tipp="Spaltenbreiten nach Inhalt (gezogene Breiten verwerfen)" />
      </Gruppe>
      <Gruppe titel="Schrift und Zeilen">
        <div className="spalte">
          <Zahlfeld beschriftung="Schriftgröße" wert={t?.fontSizePt} platzhalter={zahlText(p.notizSchrift.fontSizePt ?? STANDARD_SCHRIFT_PT)} einheit="pt" schritt={0.5} min={6} max={16} onWert={(pt) => setzen({ fontSizePt: pt })} />
          <KleinerKnopf symbol={Rows3} text="Kompakte Zeilen" aktiv={!!t?.compact} onClick={() => setzen({ compact: t?.compact ? undefined : true })} tipp="Weniger Innenabstand in den Zellen" />
        </div>
      </Gruppe>
      <Gruppe titel="Seiten">
        <GrosserKnopf symbol={ALargeSmall} text="Über Seiten teilen" aktiv={!!t?.split && !umfliessen} gesperrt={umfliessen} onClick={() => setzen({ split: t?.split ? undefined : true })}
          tipp={umfliessen ? 'Mit Textumbruch bleibt die Tabelle am Stück' : 'Lange Tabelle darf auf der nächsten Seite weiterlaufen (sonst am Stück)'} />
      </Gruppe>
      <Gruppe titel="Zurücksetzen">
        <GrosserKnopf symbol={RotateCcw} text="Tabelle zurücksetzen" gesperrt={!t} onClick={() => p.blockAendern(tabelleZuruecksetzen)} />
      </Gruppe>
    </>
  )
}

function kurz(text: string, max = 18): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}
