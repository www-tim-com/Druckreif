// Mermaid-Diagramme vorab als SVG zeichnen (Mermaid wird erst geladen, wenn eine Notiz eines enthält).

let zaehler = 0
// Zeichnen ist langsam – fertige SVGs pro Quelltext merken
const fertig = new Map<string, string>()

export async function diagrammeZeichnen(container: HTMLElement, fehler: (text: string) => void): Promise<void> {
  const diagramme = [...container.querySelectorAll<HTMLElement>('.mermaid-diagramm')]
  if (diagramme.length === 0) return
  const mermaid = (await import('mermaid')).default
  if (zaehler === 0) mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })
  for (const el of diagramme) {
    const quelle = el.dataset.quelle ?? ''
    try {
      let svg = fertig.get(quelle)
      if (!svg) {
        svg = (await mermaid.render(`mermaid-${++zaehler}`, quelle)).svg
        fertig.set(quelle, svg)
      }
      el.innerHTML = svg
    } catch (e) {
      // Nie Rohcode drucken und nie stillschweigend weglassen
      el.innerHTML = '<div class="mermaid-fehler">Diagramm konnte nicht gezeichnet werden</div>'
      fehler(`Mermaid-Diagramm fehlerhaft: ${(e as Error).message.split('\n')[0]}`)
    }
    el.removeAttribute('data-quelle')
  }
}
