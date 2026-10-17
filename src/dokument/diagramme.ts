// Mermaid-Diagramme vorab als SVG zeichnen (Mermaid wird erst geladen, wenn eine Notiz eines enthält).

let zaehler = 0
// Zeichnen ist langsam – fertige SVGs pro Quelltext merken
const fertig = new Map<string, string>()

export async function diagrammeZeichnen(container: HTMLElement, fehler: (text: string, notiz: string) => void): Promise<void> {
  const diagramme = [...container.querySelectorAll<HTMLElement>('.mermaid-diagramm')]
  if (diagramme.length === 0) return
  const mermaid = (await import('mermaid')).default
  if (zaehler === 0) mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict', suppressErrorRendering: true })
  // suppressErrorRendering: sonst hängt Mermaid bei jedem Fehler ein Fehlerbild an document.body
  for (const el of diagramme) {
    const quelle = decodeURIComponent(el.dataset.quelle ?? '')
    try {
      let svg = fertig.get(quelle)
      if (!svg) {
        svg = (await mermaid.render(`mermaid-${++zaehler}`, quelle)).svg
        fertig.set(quelle, svg)
      }
      el.innerHTML = svg
      // Stil im SVG lassen: Paged.js zöge ihn sonst in den <head>, übernommene Seiten (Teil-Umbruch) verlören ihn
      el.querySelectorAll('style').forEach((stil) => stil.setAttribute('data-pagedjs-ignore', ''))
    } catch (e) {
      // Nie Rohcode drucken und nie stillschweigend weglassen
      el.innerHTML = '<div class="mermaid-fehler">Diagramm konnte nicht gezeichnet werden</div>'
      fehler(`Mermaid-Diagramm fehlerhaft: ${(e as Error).message.split('\n')[0]}`, el.closest<HTMLElement>('article.notiz')?.dataset.notiz ?? '')
    }
    el.removeAttribute('data-quelle')
  }
}
