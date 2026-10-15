// Druckliste: die Notizen, die zusammen in ein Dokument kommen – in dieser Reihenfolge.

import { dateiname, ohneEndung } from '../vault/vault'

interface Props {
  liste: string[]
  onAendern(liste: string[]): void
}

export function Druckliste({ liste, onAendern }: Props) {
  if (liste.length < 2) return null

  function verschieben(i: number, richtung: -1 | 1) {
    const neu = [...liste]
    ;[neu[i], neu[i + richtung]] = [neu[i + richtung], neu[i]]
    onAendern(neu)
  }

  return (
    <section className="druckliste">
      <h2>Im Dokument ({liste.length})</h2>
      <ol>
        {liste.map((pfad, i) => (
          <li key={`${pfad}-${i}`} title={pfad}>
            <span className="nummer">{i + 1}.</span>
            <span className="name">{ohneEndung(dateiname(pfad))}</span>
            <button disabled={i === 0} onClick={() => verschieben(i, -1)} title="nach oben">↑</button>
            <button disabled={i === liste.length - 1} onClick={() => verschieben(i, 1)} title="nach unten">↓</button>
            <button onClick={() => onAendern(liste.filter((_, j) => j !== i))} title="entfernen">×</button>
          </li>
        ))}
      </ol>
    </section>
  )
}
