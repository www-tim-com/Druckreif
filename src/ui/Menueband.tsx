// Menüband wie in Word: Registerkarten Datei, Start, Layout, Ansicht und – nur bei gewähltem Bild – Bildformat.
// Das Band kennt keine Logik: Es zeigt den Zustand an und ruft die Befehle der App auf.

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Ban,
  Eye,
  EyeOff,
  FileText,
  Image,
  ListTree,
  Maximize2,
  Minus,
  PanelRight,
  Pilcrow,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  SeparatorHorizontal,
  Sparkles,
  Undo2,
  WrapText,
} from 'lucide-react'
import type { LayoutEintrag } from '../layout/layoutDatei'
import {
  abstandSetzen,
  ausblendenSetzen,
  bildSetzen,
  eintragZuruecksetzen,
  umbruchSetzen,
} from '../layout/bearbeiten'
import { Gruppe, GrosserKnopf, KleinerKnopf, SymbolKnopf, Zahlfeld } from './Band'

export type Reiter = 'start' | 'layout' | 'ansicht' | 'bild'

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

  notizName: string | null
  schriftPt: number | undefined
  onSchrift(pt: number | undefined): void
  notizHatLayout: boolean
  notizZuruecksetzen(): void

  block: GewaehlterBlock | null
  blockAendern(aendern: (e: LayoutEintrag) => LayoutEintrag): void

  zoom: number
  onZoom(z: number): void
  nav: boolean
  onNav(an: boolean): void
  hinweise: boolean
  onHinweise(an: boolean): void
  zeichen: boolean
  onZeichen(an: boolean): void
}

export function Menueband(p: BandProps) {
  const istBild = p.block?.typ === 'image'
  const reiter: { id: Reiter; text: string }[] = [
    { id: 'start', text: 'Start' },
    { id: 'layout', text: 'Layout' },
    { id: 'ansicht', text: 'Ansicht' },
  ]
  if (istBild) reiter.push({ id: 'bild', text: 'Bildformat' })
  const aktuell = p.reiter === 'bild' && !istBild ? 'start' : p.reiter

  return (
    <div className="menueband">
      <nav className="reiter">
        <button className="reiter-datei" onClick={p.onDatei}>
          Datei
        </button>
        {reiter.map((r) => (
          <button
            key={r.id}
            className={`${r.id === aktuell ? 'gewaehlt' : ''}${r.id === 'bild' ? ' kontext' : ''}`}
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
            wert={p.schriftPt}
            platzhalter="10,5"
            einheit="pt"
            schritt={0.5}
            min={7}
            max={16}
            gesperrt={!p.notizName}
            onWert={(pt) => p.onSchrift(pt === 10.5 ? undefined : pt)}
          />
          <span className="band-info" title="Gilt für die ganze Notiz">
            {p.notizName ? `für „${p.notizName}“` : 'keine Notiz'}
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
      <Gruppe titel="Ausgabe">
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
      <Gruppe titel="Abstand">
        <div className="spalte">
          <Zahlfeld beschriftung="Vor" wert={e?.spaceBeforeMm} platzhalter="auto" einheit="mm" schritt={1} min={-20} max={100} gesperrt={!p.block}
            onWert={(mm) => p.blockAendern(abstandSetzen(mm, e?.spaceAfterMm))} />
          <Zahlfeld beschriftung="Nach" wert={e?.spaceAfterMm} platzhalter="auto" einheit="mm" schritt={1} min={-20} max={100} gesperrt={!p.block}
            onWert={(mm) => p.blockAendern(abstandSetzen(e?.spaceBeforeMm, mm))} />
        </div>
      </Gruppe>
      <BlockGruppe {...p} />
      <Gruppe titel="Notiz">
        <GrosserKnopf symbol={FileText} text="Layout zurücksetzen" gesperrt={!p.notizHatLayout} onClick={p.notizZuruecksetzen} tipp="Alle manuellen Änderungen dieser Notiz verwerfen" />
      </Gruppe>
    </>
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
      <Gruppe titel="Anzeigen">
        <GrosserKnopf symbol={ListTree} text="Navigation" aktiv={p.nav} onClick={() => p.onNav(!p.nav)} />
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
          <Zahlfeld beschriftung="Breite" wert={bild?.widthMm} platzhalter="auto" einheit="mm" schritt={5} min={15} max={167} onWert={(mm) => setzen({ widthMm: mm })} />
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
          <span className="band-info">Ziehen verschiebt, Ecke ändert Größe</span>
        </div>
      </Gruppe>
      <Gruppe titel="Zurücksetzen">
        <GrosserKnopf symbol={RotateCcw} text="Bild zurücksetzen" gesperrt={!bild} onClick={() => setzen({ widthMm: undefined, align: undefined, wrap: undefined, offsetYMm: undefined })} />
      </Gruppe>
    </>
  )
}
