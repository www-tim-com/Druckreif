// Menüband wie in Word: Registerkarten Datei, Start, Layout, Ansicht und – nur bei gewähltem Bild – Bildformat.
// Das Band kennt keine Logik: Es zeigt den Zustand an und ruft die Befehle der App auf.

import {
  ALargeSmall,
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
  SeparatorHorizontal,
  Sparkles,
  Table,
  Undo2,
  WandSparkles,
  WrapText,
} from 'lucide-react'
import type { LayoutEintrag } from '../layout/layoutDatei'
import {
  abstandSetzen,
  ausblendenSetzen,
  bildSetzen,
  eintragZuruecksetzen,
  tabelleSetzen,
  teilenSetzen,
  umbruchSetzen,
} from '../layout/bearbeiten'
import { Gruppe, GrosserKnopf, KleinerKnopf, SymbolKnopf, Zahlfeld } from './Band'

export type Reiter = 'start' | 'layout' | 'ansicht' | 'bild' | 'tabelle'

export interface Schrift {
  fontSizePt?: number
  lineHeight?: number
}

export interface GewaehlterBlock {
  typ: string
  beschreibung: string // z. B. "Absatz in „Atemmechanik“"
  eintrag: LayoutEintrag | undefined
}

export interface BandProps {
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
}

export function Menueband(p: BandProps) {
  const kontext = p.block?.typ === 'image' ? 'bild' : p.block?.typ === 'table' ? 'tabelle' : null
  const reiter: { id: Reiter; text: string }[] = [
    { id: 'start', text: 'Start' },
    { id: 'layout', text: 'Layout' },
    { id: 'ansicht', text: 'Ansicht' },
  ]
  if (kontext === 'bild') reiter.push({ id: 'bild', text: 'Bildformat' })
  if (kontext === 'tabelle') reiter.push({ id: 'tabelle', text: 'Tabellenlayout' })
  const istKontext = p.reiter === 'bild' || p.reiter === 'tabelle'
  const aktuell = istKontext && p.reiter !== kontext ? 'start' : p.reiter

  return (
    <div className="menueband">
      <nav className="reiter">
        <button className="reiter-datei" onClick={p.onDatei}>
          Datei
        </button>
        {reiter.map((r) => (
          <button
            key={r.id}
            className={`${r.id === aktuell ? 'gewaehlt' : ''}${r.id === kontext ? ' kontext' : ''}`}
            onClick={() => p.onReiter(r.id)}
          >
            {r.text}
          </button>
        ))}
      </nav>
      <div className="band">
        {aktuell === 'start' && <StartReiter {...p} />}
        {aktuell === 'layout' && <LayoutReiter {...p} />}
        {aktuell === 'ansicht' && <AnsichtReiter {...p} />}
        {aktuell === 'bild' && <BildReiter {...p} />}
        {aktuell === 'tabelle' && <TabellenReiter {...p} />}
      </div>
    </div>
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
            platzhalter={zahl(p.notizSchrift.fontSizePt ?? 10.5)}
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
            platzhalter={zahl(p.notizSchrift.lineHeight ?? 1.35)}
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
          onClick={() => p.blockAendern(umbruchSetzen(e?.pageBreakBefore === true ? undefined : true))}
        />
      </Gruppe>
      <Gruppe titel="Bearbeiten">
        <GrosserKnopf symbol={Search} text="Suchen" tipp="Im Dokument suchen (Strg+F)" onClick={p.onSuche} />
      </Gruppe>
      <Gruppe titel="Ausgabe">
        <GrosserKnopf symbol={RefreshCw} text="Aktualisieren" tipp="Vault neu einlesen: geänderte Notizen, neue oder verschobene Bilder, Theme (F5)" onClick={p.aktualisieren} />
        <GrosserKnopf symbol={Printer} text="Drucken / PDF" tipp="Drucken oder als PDF speichern (Strg+P)" onClick={p.drucken} />
      </Gruppe>
    </>
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
          <Zahlfeld beschriftung="Grundschrift" wert={p.notizSchrift.fontSizePt} platzhalter="10,5" einheit="pt" schritt={0.5} min={7} max={16} gesperrt={!p.notizName}
            onWert={(pt) => p.onNotizSchrift({ fontSizePt: pt === 10.5 ? undefined : pt })} />
          <Zahlfeld beschriftung="Zeilenabstand" wert={p.notizSchrift.lineHeight} platzhalter="1,35" einheit="×" schritt={0.05} min={0.9} max={2.5} gesperrt={!p.notizName}
            onWert={(z) => p.onNotizSchrift({ lineHeight: z === 1.35 ? undefined : z })} />
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

function AnsichtReiter(p: BandProps) {
  return (
    <>
      <Gruppe titel="Zoom">
        <KleinerKnopf symbol={Minus} text="Verkleinern" onClick={() => p.onZoom(p.zoom - 0.1)} gesperrt={p.zoom <= 0.3} />
        <GrosserKnopf symbol={Maximize2} text="100 %" onClick={() => p.onZoom(1)} />
        <KleinerKnopf symbol={Plus} text="Vergrößern" onClick={() => p.onZoom(p.zoom + 0.1)} gesperrt={p.zoom >= 3} />
      </Gruppe>
      <Gruppe titel="Vault">
        <GrosserKnopf symbol={RefreshCw} text="Aktualisieren" tipp="Vault neu einlesen (F5)" onClick={p.aktualisieren} />
      </Gruppe>
      <Gruppe titel="Anzeigen">
        <GrosserKnopf symbol={ListTree} text="Navigation" aktiv={p.nav} onClick={() => p.onNav(!p.nav)} />
        <GrosserKnopf symbol={Search} text="Suchen" tipp="Im Dokument suchen (Strg+F)" onClick={p.onSuche} />
        <GrosserKnopf symbol={PanelRight} text="Hinweise" aktiv={p.hinweise} onClick={() => p.onHinweise(!p.hinweise)} />
        <GrosserKnopf symbol={Pilcrow} text="Umbrüche zeigen" aktiv={p.zeichen} onClick={() => p.onZeichen(!p.zeichen)} tipp="Manuelle Seitenumbrüche auf den Seiten markieren" />
      </Gruppe>
    </>
  )
}

function BildReiter(p: BandProps) {
  const bild = p.block?.eintrag?.image
  const ausrichtung = bild?.align ?? (bild?.wrap ? 'right' : 'left')
  const setzen = (teil: Parameters<typeof bildSetzen>[0]) => p.blockAendern(bildSetzen(teil))
  return (
    <>
      <Gruppe titel="Größe">
        <div className="spalte">
          <Zahlfeld beschriftung="Breite" wert={bild?.widthMm} platzhalter={p.bildIstMm ? String(p.bildIstMm) : 'auto'} start={p.bildIstMm ?? 80} einheit="mm" schritt={5} min={15} max={167} onWert={(mm) => setzen({ widthMm: mm })} />
          <KleinerKnopf symbol={Image} text="Originalgröße" gesperrt={bild?.widthMm === undefined} onClick={() => setzen({ widthMm: undefined })} />
        </div>
      </Gruppe>
      <Gruppe titel="Ausrichtung">
        <div className="zeile">
          <SymbolKnopf symbol={AlignLeft} text="Links" aktiv={ausrichtung === 'left'} onClick={() => setzen({ align: 'left' })} />
          <SymbolKnopf symbol={AlignCenter} text="Zentriert" aktiv={ausrichtung === 'center'} onClick={() => setzen({ align: 'center' })} />
          <SymbolKnopf symbol={AlignRight} text="Rechts" aktiv={ausrichtung === 'right'} onClick={() => setzen({ align: 'right' })} />
        </div>
      </Gruppe>
      <Gruppe titel="Textumbruch">
        <GrosserKnopf symbol={Image} text="Eigene Zeile" aktiv={!bild?.wrap} onClick={() => setzen({ wrap: undefined })} tipp="Bild steht als eigener Block, Text darunter" />
        <GrosserKnopf symbol={WrapText} text="Text daneben" aktiv={!!bild?.wrap} onClick={() => setzen({ wrap: true, align: bild?.align === 'left' ? 'left' : 'right' })} tipp="Der folgende Text des Abschnitts fließt neben dem Bild" />
      </Gruppe>
      <Gruppe titel="Position">
        <div className="spalte">
          <Zahlfeld beschriftung="Abstand oben" wert={bild?.offsetYMm} platzhalter="0" einheit="mm" schritt={1} min={-30} max={150} onWert={(mm) => setzen({ offsetYMm: mm })} />
          <span className="band-info" title="Bild auf der Seite ziehen verschiebt es, die Ecken ändern die Größe">Ziehen: verschieben · Ecke: Größe</span>
        </div>
      </Gruppe>
      <Gruppe titel="Zurücksetzen">
        <GrosserKnopf symbol={RotateCcw} text="Bild zurücksetzen" gesperrt={!bild} onClick={() => setzen({ widthMm: undefined, align: undefined, wrap: undefined, offsetYMm: undefined })} />
      </Gruppe>
    </>
  )
}

function TabellenReiter(p: BandProps) {
  const t = p.block?.eintrag?.table
  const setzen = (teil: Parameters<typeof tabelleSetzen>[0]) => p.blockAendern(tabelleSetzen(teil))
  const ausrichtung = t?.align ?? 'left'
  return (
    <>
      <Gruppe titel="Größe">
        <div className="spalte">
          <Zahlfeld beschriftung="Breite" wert={t?.widthPct} platzhalter="100" einheit="%" schritt={5} min={20} max={100} onWert={(w) => setzen({ widthPct: w === 100 ? undefined : w })} />
          <span className="band-info">Rechten Rand oder Spaltengrenze ziehen</span>
        </div>
      </Gruppe>
      <Gruppe titel="Ausrichtung">
        <div className="zeile">
          <SymbolKnopf symbol={AlignLeft} text="Links" aktiv={ausrichtung === 'left'} onClick={() => setzen({ align: undefined })} />
          <SymbolKnopf symbol={AlignCenter} text="Zentriert" aktiv={ausrichtung === 'center'} onClick={() => setzen({ align: 'center' })} />
          <SymbolKnopf symbol={AlignRight} text="Rechts" aktiv={ausrichtung === 'right'} onClick={() => setzen({ align: 'right' })} />
        </div>
      </Gruppe>
      <Gruppe titel="Spalten">
        <GrosserKnopf symbol={Table} text="Automatisch" aktiv={!t?.columnsPct} gesperrt={!t?.columnsPct} onClick={() => setzen({ columnsPct: undefined })} tipp="Spaltenbreiten nach Inhalt (gezogene Breiten verwerfen)" />
      </Gruppe>
      <Gruppe titel="Schrift und Zeilen">
        <div className="spalte">
          <Zahlfeld beschriftung="Schriftgröße" wert={t?.fontSizePt} platzhalter={zahl(p.notizSchrift.fontSizePt ?? 10.5)} einheit="pt" schritt={0.5} min={6} max={16} onWert={(pt) => setzen({ fontSizePt: pt })} />
          <KleinerKnopf symbol={Rows3} text="Kompakte Zeilen" aktiv={!!t?.compact} onClick={() => setzen({ compact: t?.compact ? undefined : true })} tipp="Weniger Innenabstand in den Zellen" />
        </div>
      </Gruppe>
      <Gruppe titel="Seiten">
        <GrosserKnopf symbol={ALargeSmall} text="Über Seiten teilen" aktiv={!!t?.split} onClick={() => setzen({ split: t?.split ? undefined : true })} tipp="Lange Tabelle darf auf der nächsten Seite weiterlaufen (sonst am Stück)" />
      </Gruppe>
      <Gruppe titel="Zurücksetzen">
        <GrosserKnopf symbol={RotateCcw} text="Tabelle zurücksetzen" gesperrt={!t} onClick={() => setzen({ widthPct: undefined, align: undefined, columnsPct: undefined, fontSizePt: undefined, compact: undefined, split: undefined })} />
      </Gruppe>
    </>
  )
}

function zahl(z: number): string {
  return String(z).replace('.', ',')
}

function kurz(text: string, max = 18): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}
