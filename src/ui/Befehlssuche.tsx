// Suchfeld in der Titelleiste wie „Microsoft Search“ in Word (Alt+Q): findet Befehle, Notizen und Text im Dokument.

import { type RefObject, useMemo, useState } from 'react'
import { FileText, type LucideIcon, Search, TextSearch } from 'lucide-react'
import type { Notiz } from '../vault/notizen'

export interface Befehl {
  id: string
  text: string
  symbol: LucideIcon
  aktion(): void
  /** Registerkarte oder Bereich, zur Orientierung („Layout“) */
  ort: string
  gesperrt?: boolean
  taste?: string
  /** weitere Suchwörter */
  stichworte?: string
}

interface Props {
  feld: RefObject<HTMLInputElement | null>
  befehle: Befehl[]
  /** bei leerem Feld vorgeschlagen (IDs, zuletzt benutzte zuerst) */
  vorschlaege: string[]
  notizen: Notiz[]
  onNotiz(pfad: string): void
  onImDokument(begriff: string): void
  onBenutzt(id: string): void
}

type Eintrag = { art: 'befehl'; befehl: Befehl } | { art: 'notiz'; notiz: Notiz } | { art: 'dokument'; begriff: string }

const MAX_BEFEHLE = 8
const MAX_NOTIZEN = 5

export function Befehlssuche({ feld, befehle, vorschlaege, notizen, onNotiz, onImDokument, onBenutzt }: Props) {
  const [text, setText] = useState('')
  const [offen, setOffen] = useState(false)
  const [markiert, setMarkiert] = useState(0)

  const eintraege = useMemo<Eintrag[]>(() => {
    const woerter = normal(text).split(/\s+/).filter(Boolean)
    if (woerter.length === 0) {
      return vorschlaege
        .map((id) => befehle.find((b) => b.id === id))
        .filter((b): b is Befehl => !!b && !b.gesperrt)
        .slice(0, 6)
        .map((befehl) => ({ art: 'befehl', befehl }))
    }
    const passt = (heuhaufen: string) => woerter.every((w) => heuhaufen.includes(w))
    const gefunden: Eintrag[] = befehle
      .filter((b) => passt(normal(`${b.text} ${b.ort} ${b.stichworte ?? ''}`)))
      // Treffer am Wortanfang des Namens zuerst, gesperrte nach hinten
      .sort((a, b) => rang(a, woerter[0]) - rang(b, woerter[0]))
      .slice(0, MAX_BEFEHLE)
      .map((befehl) => ({ art: 'befehl', befehl }))
    for (const notiz of notizen.filter((n) => passt(normal(n.pfad))).slice(0, MAX_NOTIZEN)) gefunden.push({ art: 'notiz', notiz })
    if (text.trim().length >= 2) gefunden.push({ art: 'dokument', begriff: text.trim() })
    return gefunden
  }, [text, befehle, vorschlaege, notizen])

  function ausfuehren(e: Eintrag | undefined) {
    if (!e || (e.art === 'befehl' && e.befehl.gesperrt)) return
    setOffen(false)
    setText('')
    feld.current?.blur()
    if (e.art === 'befehl') {
      onBenutzt(e.befehl.id)
      e.befehl.aktion()
    } else if (e.art === 'notiz') onNotiz(e.notiz.pfad)
    else onImDokument(e.begriff)
  }

  const index = Math.min(markiert, eintraege.length - 1)
  let ueberschrift = ''
  return (
    <div className={`befehlssuche${offen ? ' offen' : ''}`}>
      <Search size={14} />
      <input
        ref={feld}
        value={text}
        placeholder="Suchen (Alt+Q)"
        data-keytip="Q"
        aria-label="Befehle, Notizen und Dokument durchsuchen"
        onFocus={() => setOffen(true)}
        onBlur={() => setOffen(false)}
        onChange={(e) => {
          setText(e.target.value)
          setMarkiert(0)
          setOffen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setMarkiert((index + 1) % Math.max(1, eintraege.length))
          else if (e.key === 'ArrowUp') setMarkiert((index - 1 + eintraege.length) % Math.max(1, eintraege.length))
          else if (e.key === 'Enter') ausfuehren(eintraege[index])
          else if (e.key === 'Escape') {
            setText('')
            feld.current?.blur()
          } else return
          e.preventDefault()
          e.stopPropagation()
        }}
      />
      {offen && eintraege.length > 0 && (
        // Mausklick darf das Feld nicht vorher verlassen (sonst schließt die Liste vor dem Klick)
        <ul className="befehlsliste" role="listbox" onPointerDown={(e) => e.preventDefault()}>
          {eintraege.map((e, i) => {
            const gruppe = text.trim() === '' ? 'Vorgeschlagene Aktionen' : e.art === 'befehl' ? 'Aktionen' : e.art === 'notiz' ? 'Notizen' : 'Im Dokument'
            const kopf = gruppe !== ueberschrift ? (ueberschrift = gruppe) : null
            return (
              <li key={i}>
                {kopf && <div className="gruppe">{kopf}</div>}
                <button
                  role="option"
                  aria-selected={i === index}
                  className={i === index ? 'markiert' : ''}
                  disabled={e.art === 'befehl' && e.befehl.gesperrt}
                  onPointerEnter={() => setMarkiert(i)}
                  onClick={() => ausfuehren(e)}
                >
                  {e.art === 'befehl' && (
                    <>
                      <e.befehl.symbol size={16} />
                      <span className="name">{e.befehl.text}</span>
                      <span className="ort">{e.befehl.taste ?? e.befehl.ort}</span>
                    </>
                  )}
                  {e.art === 'notiz' && (
                    <>
                      <FileText size={16} />
                      <span className="name">{e.notiz.pfad.replace(/\.md$/, '')}</span>
                      <span className="ort">Notiz</span>
                    </>
                  )}
                  {e.art === 'dokument' && (
                    <>
                      <TextSearch size={16} />
                      <span className="name">„{e.begriff}“ im Dokument suchen</span>
                      <span className="ort">Strg+F</span>
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function normal(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function rang(b: Befehl, wort: string): number {
  const name = normal(b.text)
  return (b.gesperrt ? 10 : 0) + (name.startsWith(wort) ? 0 : name.includes(` ${wort}`) ? 1 : 2)
}
