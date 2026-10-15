// Mermaid-Diagramme vorab als SVG zeichnen (Mermaid wird erst geladen, wenn eine Notiz eines enthält).

let zaehler = 0

export async function diagrammeZeichnen(container: HTMLElement, fehler: (text: string) => void): Promise<void> {
  const diagramme = [...container.querySelectorAll<HTMLElement>('.mermaid-diagramm')]
  if (diagramme.length === 0) return
  const mermaid = (await import('mermaid')).default
  mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' })
  for (const el of diagramme) {
    const quelle = el.dataset.quelle ?? ''
    try {
      const { svg } = await mermaid.render(`mermaid-${++zaehler}`, quelle)
      el.innerHTML = svg
    } catch (e) {
      // Nie Rohcode drucken und nie stillschweigend weglassen
      el.innerHTML = '<div class="mermaid-fehler">Diagramm konnte nicht gezeichnet werden</div>'
      fehler(`Mermaid-Diagramm fehlerhaft: ${(e as Error).message.split('\n')[0]}`)
    }
    el.removeAttribute('data-quelle')
  }
}
