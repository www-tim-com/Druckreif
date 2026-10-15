// „Datei“-Ansicht wie in Word (Backstage): Vault öffnen, Demo, Drucken, Infos zum Vault.
// Ohne geöffneten Vault ist sie die Startseite.

import { ArrowLeft, BookOpen, FolderOpen, Info, Printer, Sparkles, Trash2 } from 'lucide-react'
import type { Mappe } from '../mappen/mappen'
import { ordnerZugriffMoeglich } from '../vault/ordnerVault'

interface Props {
  vaultName: string | null
  gemerkt: string | null
  theme: string | null
  snippets: string[]
  fehler: string | null
  onZurueck: (() => void) | null
  onOrdner(): void
  onGemerkt(): void
  onDemo(): void
  onDrucken: (() => void) | null
  mappen: Mappe[]
  onMappeOeffnen(id: string): void
  onMappeLoeschen(id: string): void
}

export function Datei(p: Props) {
  const moeglich = ordnerZugriffMoeglich()
  return (
    <div className="datei">
      <nav>
        {p.onZurueck && (
          <button className="zurueck" onClick={p.onZurueck} aria-label="Zurück zum Dokument">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="marke">Druckreif</div>
        {p.onDrucken && (
          <button onClick={p.onDrucken}>
            <Printer size={16} /> Drucken
          </button>
        )}
      </nav>
      <main>
        <h1>Öffnen</h1>
        <p className="leise">Obsidian-Lernzettel als druckfertige A4-Seiten. Der Vault wird nur gelesen; Layout-Änderungen landen in <code>.lernzettel/</code>.</p>
        <div className="kacheln">
          {p.gemerkt && moeglich && (
            <button className="kachel" onClick={p.onGemerkt}>
              <FolderOpen size={28} strokeWidth={1.4} />
              <strong>{p.gemerkt}</strong>
              <span>Zuletzt geöffnet</span>
            </button>
          )}
          <button className="kachel" disabled={!moeglich} onClick={p.onOrdner}>
            <FolderOpen size={28} strokeWidth={1.4} />
            <strong>Vault-Ordner wählen …</strong>
            <span>Obsidian-Vault auf diesem PC</span>
          </button>
          <button className="kachel" onClick={p.onDemo}>
            <Sparkles size={28} strokeWidth={1.4} />
            <strong>Demo-Vault</strong>
            <span>Beispielnotizen ansehen</span>
          </button>
        </div>
        {!moeglich && <p className="leise">Ordnerzugriff geht nur in Chrome oder Edge über localhost (start.bat).</p>}
        {p.fehler && <p className="fehler">{p.fehler}</p>}

        {p.vaultName && (
          <>
            <h2>
              <BookOpen size={18} /> Mappen
            </h2>
            {p.mappen.length === 0 && <p className="leise">Noch keine Mappen. Eine Notiz anklicken legt automatisch eine an.</p>}
            <ul className="mappenliste">
              {p.mappen.map((m) => (
                <li key={m.id}>
                  <button className="oeffnen" onClick={() => p.onMappeOeffnen(m.id)}>
                    <BookOpen size={16} />
                    <strong>{m.name}</strong>
                    <span>{m.items.length} {m.items.length === 1 ? 'Notiz' : 'Notizen'}</span>
                  </button>
                  <button
                    className="loeschen"
                    title="Mappe löschen (Notizen und Layouts bleiben erhalten)"
                    onClick={() => confirm(`Mappe „${m.name}“ löschen? Die Notizen selbst bleiben unverändert.`) && p.onMappeLoeschen(m.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <h2>
              <Info size={18} /> Informationen
            </h2>
            <dl>
              <dt>Vault</dt>
              <dd>{p.vaultName}</dd>
              <dt>Theme</dt>
              <dd>{p.theme ?? 'Obsidian-Standard (hell)'}</dd>
              <dt>Snippets</dt>
              <dd>{p.snippets.length ? p.snippets.join(', ') : 'keine'}</dd>
            </dl>
          </>
        )}
      </main>
    </div>
  )
}
