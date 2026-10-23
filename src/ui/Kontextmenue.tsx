// Rechtsklick auf einem Block wie in Word: Minisymbolleiste (Schrift, Umbruch, Ausblenden) über dem Kontextmenü.

import { useEffect } from 'react'
import { AArrowDown, AArrowUp, AlignCenter, AlignLeft, AlignRight, Ban, EyeOff, RotateCcw, SeparatorHorizontal, WrapText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { BlockTyp, LayoutEintrag } from '../layout/layoutDatei'
import { ausblendenSetzen, bildSetzen, eintragZuruecksetzen, schriftSetzen, umbruchUmschalten, umfliessenSetzen } from '../layout/bearbeiten'
import { zahlText } from './Band'
import { quickinfo } from './QuickInfo'

interface Props {
  x: number
  y: number
  typ: BlockTyp
  eintrag: LayoutEintrag | undefined
  /** Schriftgröße, die der Block ohne eigene Angabe hat (Grundschrift der Notiz) */
  grundschriftPt: number
  blockAendern(aendern: (e: LayoutEintrag) => LayoutEintrag): void
  onSchliessen(): void
}

const SCHRIFT_MIN = 6
const SCHRIFT_MAX = 24

export function Kontextmenue({ x, y, typ, eintrag: e, grundschriftPt, blockAendern, onSchliessen }: Props) {
  useEffect(() => {
    const zu = () => onSchliessen()
    window.addEventListener('pointerdown', zu)
    window.addEventListener('blur', zu)
    return () => {
      window.removeEventListener('pointerdown', zu)
      window.removeEventListener('blur', zu)
    }
  }, [onSchliessen])

  const punkt = (symbol: LucideIcon, text: string, aendern: (e: LayoutEintrag) => LayoutEintrag, an = false) => {
    const Symbol = symbol
    return (
      <button
        className={an ? 'an' : ''}
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={() => {
          blockAendern(aendern)
          onSchliessen()
        }}
      >
        <Symbol size={15} /> {text}
      </button>
    )
  }
  const bild = e?.image
  const pt = e?.fontSizePt ?? grundschriftPt
  const schrift = (schritt: number) => {
    const neu = Math.min(SCHRIFT_MAX, Math.max(SCHRIFT_MIN, pt + schritt))
    // zurück auf die Grundschrift = keine eigene Angabe
    blockAendern(schriftSetzen({ fontSizePt: neu === grundschriftPt ? undefined : neu }))
  }
  const mini = (symbol: LucideIcon, text: string, tipp: string, aktion: () => void, an = false, schliessen = true) => {
    const Symbol = symbol
    return (
      <button
        className={an ? 'an' : ''}
        aria-label={text}
        {...quickinfo(text, tipp)}
        onPointerDown={(ev) => ev.stopPropagation()}
        onClick={() => {
          aktion()
          if (schliessen) onSchliessen()
        }}
      >
        <Symbol size={16} />
      </button>
    )
  }
  const links = Math.min(x, innerWidth - 240)
  const oben = Math.max(48, Math.min(y, innerHeight - 320))

  return (
    <>
      <div className="minisymbolleiste" style={{ left: links, top: oben - 44 }} onPointerDown={(ev) => ev.stopPropagation()}>
        {typ !== 'image' && (
          <>
            {mini(AArrowDown, 'Schrift verkleinern', 'Schriftgröße dieses Blocks um 0,5 pt verkleinern', () => schrift(-0.5), false, false)}
            <span className="groesse" {...quickinfo('Schriftgröße', 'Schriftgröße dieses Blocks')}>{zahlText(pt)} pt</span>
            {mini(AArrowUp, 'Schrift vergrößern', 'Schriftgröße dieses Blocks um 0,5 pt vergrößern', () => schrift(0.5), false, false)}
            <span className="trenner" />
          </>
        )}
        {mini(SeparatorHorizontal, 'Seitenumbruch davor', 'Neue Seite vor diesem Block (Strg+Enter)', () => blockAendern(umbruchUmschalten(true)), e?.pageBreakBefore === true)}
        {mini(EyeOff, 'Im Druck ausblenden', 'Diesen Block nicht drucken (Entf)', () => blockAendern(ausblendenSetzen(true)))}
        {mini(RotateCcw, 'Zurücksetzen', 'Layout des Blocks zurücksetzen', () => blockAendern(eintragZuruecksetzen))}
      </div>
      <div className="kontextmenue" style={{ left: links, top: oben }}>
        {punkt(SeparatorHorizontal, 'Seitenumbruch davor', umbruchUmschalten(true), e?.pageBreakBefore === true)}
        {punkt(Ban, 'Umbruch davor verhindern', umbruchUmschalten(false), e?.pageBreakBefore === false)}
        <hr />
        {punkt(EyeOff, typ === 'heading' ? 'Abschnitt im Druck ausblenden' : 'Im Druck ausblenden', ausblendenSetzen(true))}
        {typ === 'image' && (
          <>
            <hr />
            {punkt(AlignLeft, 'Links', bildSetzen({ align: 'left' }), bild?.align === 'left')}
            {!bild?.wrap && punkt(AlignCenter, 'Zentriert', bildSetzen({ align: 'center' }), bild?.align === 'center')}
            {punkt(AlignRight, 'Rechts', bildSetzen({ align: 'right' }), bild?.align === 'right' || (!!bild?.wrap && bild.align !== 'left'))}
            {punkt(WrapText, 'Text umfließt Bild', umfliessenSetzen(!bild?.wrap), !!bild?.wrap)}
          </>
        )}
        <hr />
        {punkt(RotateCcw, 'Layout des Blocks zurücksetzen', eintragZuruecksetzen)}
      </div>
    </>
  )
}
