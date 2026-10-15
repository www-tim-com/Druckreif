// „Datei“-Ansicht wie in Word (Backstage): Vault öffnen, Demo, Drucken, Infos zum Vault.
// Ohne geöffneten Vault ist sie die Startseite.

import { ArrowLeft, FolderOpen, Info, Printer, Sparkles } from 'lucide-react'
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
