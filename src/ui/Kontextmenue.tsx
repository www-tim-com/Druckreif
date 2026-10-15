// Rechtsklick-Menü auf einem Block.

import { useEffect } from 'react'
import { AlignCenter, AlignLeft, AlignRight, Ban, EyeOff, RotateCcw, SeparatorHorizontal, WrapText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { LayoutEintrag } from '../layout/layoutDatei'
import { ausblendenSetzen, bildSetzen, eintragZuruecksetzen, umbruchSetzen } from '../layout/bearbeiten'

interface Props {
  x: number
  y: number
  typ: string
  eintrag: LayoutEintrag | undefined
  blockAendern(aendern: (e: LayoutEintrag) => LayoutEintrag): void
  onSchliessen(): void
}

export function Kontextmenue({ x, y, typ, eintrag: e, blockAendern, onSchliessen }: Props) {
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

  return (
    <div className="kontextmenue" style={{ left: Math.min(x, innerWidth - 240), top: Math.min(y, innerHeight - 320) }}>
      {punkt(SeparatorHorizontal, 'Seitenumbruch davor', umbruchSetzen(e?.pageBreakBefore === true ? undefined : true), e?.pageBreakBefore === true)}
      {punkt(Ban, 'Umbruch davor verhindern', umbruchSetzen(e?.pageBreakBefore === false ? undefined : false), e?.pageBreakBefore === false)}
      <hr />
      {punkt(EyeOff, typ === 'heading' ? 'Abschnitt im Druck ausblenden' : 'Im Druck ausblenden', ausblendenSetzen(true))}
      {typ === 'image' && (
        <>
          <hr />
          {punkt(AlignLeft, 'Links', bildSetzen({ align: 'left' }), bild?.align === 'left')}
          {punkt(AlignCenter, 'Zentriert', bildSetzen({ align: 'center' }), bild?.align === 'center')}
          {punkt(AlignRight, 'Rechts', bildSetzen({ align: 'right' }), bild?.align === 'right')}
          {punkt(WrapText, 'Text daneben', bildSetzen({ wrap: bild?.wrap ? undefined : true }), !!bild?.wrap)}
        </>
      )}
      <hr />
      {punkt(RotateCcw, 'Layout des Blocks zurücksetzen', eintragZuruecksetzen)}
    </div>
  )
}
