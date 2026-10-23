// „Suchen und Ausblenden“: Abschnitte nach ihrer Überschrift suchen (z. B. „Quellen“) und als Regel der Mappe
// ausblenden – in allen Notizen, auch in später hinzugefügten. Einzelne Treffer lassen sich wieder einblenden.

import { useMemo, useState } from 'react'
import { Eye, EyeOff, Search, X } from 'lucide-react'
import type { NotizTeil } from '../dokument/aufbauen'
import { ausblendRegel } from '../mappen/mappen'
import { Dialog } from './Dialoge'

interface Props {
  teile: NotizTeil[]
  regeln: string[]
  onRegel(begriff: string, an: boolean): void
  istAusgeblendet(blockId: string): boolean
  onAusblenden(blockId: string, ausblenden: boolean): void
  onSprung(blockId: string): void
  onSchliessen(): void
}

const MAX_TREFFER = 200

export function AbschnitteAusblenden(p: Props) {
  const [begriff, setBegriff] = useState('')
  const suche = begriff.trim()
  const treffer = useMemo(
    () =>
      suche
        ? p.teile.flatMap((teil) =>
            teil.bloecke
              .filter((b) => b.typ === 'heading' && b.pfad.length > 1 && ausblendRegel([suche], b.pfad.at(-1) ?? ''))
              .map((block) => ({ teil, block })),
          )
        : [],
    [suche, p.teile],
  )
  const regelAktiv = !!suche && p.regeln.some((r) => r.toLocaleLowerCase('de') === suche.toLocaleLowerCase('de'))

  return (
    <Dialog titel="Suchen und Ausblenden" onSchliessen={p.onSchliessen} breit>
      <p className="leise">
        Abschnitte nach ihrer Überschrift suchen und im Druck ausblenden – in allen Notizen dieser Mappe, auch in später
        hinzugefügten. Die Notizen selbst bleiben unverändert; jeder ausgeblendete Abschnitt steht in den Hinweisen.
      </p>
      <form
        className="ausblenden-suche"
        onSubmit={(e) => {
          e.preventDefault()
          if (suche && !regelAktiv) p.onRegel(suche, true)
        }}
      >
        <label className="dokumentsuche">
          <Search size={14} />
          <input autoFocus value={begriff} placeholder="Überschrift enthält … z. B. Quellen" onChange={(e) => setBegriff(e.target.value)} aria-label="Überschrift enthält" />
        </label>
        {regelAktiv ? (
          <button type="button" onClick={() => p.onRegel(suche, false)}>
            <Eye size={14} /> Regel entfernen
          </button>
        ) : (
          <button type="submit" className="primaer" disabled={!suche}>
            <EyeOff size={14} /> Alle ausblenden
          </button>
        )}
      </form>

      {suche && (
        <div className="ausblenden-treffer">
          <div className="anzahl">
            {treffer.length === 0
              ? 'Keine passende Überschrift in dieser Mappe (die Regel gilt trotzdem für neue Notizen)'
              : `${treffer.length} ${treffer.length === 1 ? 'Abschnitt' : 'Abschnitte'}${regelAktiv ? ' – Regel aktiv' : ''}`}
          </div>
          <ul>
            {treffer.slice(0, MAX_TREFFER).map(({ teil, block }) => {
              const versteckt = p.istAusgeblendet(block.id)
              return (
                <li key={block.id} className={versteckt ? 'versteckt' : ''}>
                  <button className="sprung" onClick={() => p.onSprung(block.id)} title="Zum Abschnitt springen">
                    <span className="notiz">{teil.titel}</span>
                    <span className="pfad">{block.pfad.slice(1).join(' › ')}</span>
                  </button>
                  <button
                    className="auge"
                    onClick={() => p.onAusblenden(block.id, !versteckt)}
                    title={versteckt ? 'Diesen Abschnitt wieder drucken' : 'Diesen Abschnitt ausblenden'}
                    aria-label={versteckt ? 'Einblenden' : 'Ausblenden'}
                  >
                    {versteckt ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <h3 className="ausblenden-kopf">Regeln dieser Mappe</h3>
      {p.regeln.length === 0 ? (
        <p className="leise">Noch keine. Begriff eingeben und „Alle ausblenden“.</p>
      ) : (
        <div className="regeln">
          {p.regeln.map((r) => (
            <span key={r} className="regel">
              <button className="name" onClick={() => setBegriff(r)} title="Treffer anzeigen">
                {r}
              </button>
              <button className="weg" onClick={() => p.onRegel(r, false)} aria-label={`Regel „${r}“ entfernen`} title="Regel entfernen (Abschnitte wieder drucken)">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </Dialog>
  )
}
