// Überschriften des Dokuments. Klick springt hin, das Auge blendet den ganzen Abschnitt im Druck aus (z. B. „Quellen“).

import { Eye, EyeOff } from 'lucide-react'
import type { NotizTeil } from '../dokument/aufbauen'

interface Props {
  teile: NotizTeil[]
  auswahl: string | null
  onSprung(blockId: string): void
  onAusblenden(blockId: string, ausblenden: boolean): void
}

export function Gliederung({ teile, auswahl, onSprung, onAusblenden }: Props) {
  return (
    <ul className="gliederung">
      {teile.flatMap((teil) =>
        teil.bloecke
          .filter((b) => b.typ === 'heading')
          .map((b) => {
            const index = teil.zuordnung.get(b.id)
            const versteckt = index !== undefined && teil.layout.items[index]?.hidden === true
            const ebene = b.pfad.length
            return (
              <li key={b.id} className={`ebene-${Math.min(ebene, 4)}${versteckt ? ' versteckt' : ''}${auswahl === b.id ? ' gewaehlt' : ''}`}>
                <button className="sprung" onClick={() => onSprung(b.id)} title={versteckt ? 'Im Druck ausgeblendet' : b.text}>
                  {b.text || b.pfad.at(-1)}
                </button>
                {ebene > 1 && (
                  <button
                    className="auge"
                    onClick={() => onAusblenden(b.id, !versteckt)}
                    title={versteckt ? 'Abschnitt wieder drucken' : 'Abschnitt im Druck ausblenden'}
                  >
                    {versteckt ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </li>
            )
          }),
      )}
    </ul>
  )
}
