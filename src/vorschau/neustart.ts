// Lange Notizen schneller neu umbrechen: Seiten vor der ersten Änderung bleiben, Paged.js setzt erst ab dort.
// Der Umbruch läuft von vorn nach hinten – was auf einer Seite steht, hängt nur vom Inhalt davor ab. Ausnahme sind
// Einheiten, die zusammenbleiben (break-inside: avoid, Überschrift mit ihrem ersten Block): die beginnen, wo sie
// ganz hinpassen. Deshalb wird ab dem Anfang der Einheit neu gesetzt, und eine Seite früher, wenn sie oben auf ihrer
// Seite steht (verkleinert passt sie vielleicht auf die vorige). Wiederaufgesetzt wird nur an einer „sauberen“
// Stelle: die Seite beginnt mit einem Block, der dort anfängt, nur in Notiz und Abschnitten (keine Liste, Tabelle …).
// Die Hüllen (Notiz, Abschnitte) setzen dort fort – wie bei Paged.js mit data-split-from (ohne oberen Abstand).
// Umgekehrt am Ende: beginnt eine neu gesetzte Seite sauber mit demselben Block wie eine alte, und ist ab diesem
// Block alles unverändert, sind die alten Seiten ab dort wieder gültig (wiederGleich) – Paged.js kann aufhören.

/** Gruppe der sichtbaren Fassung: ihr HTML (geparst gemerkt in `dom`) und ihre Seiten im sichtbaren iframe */
interface AlteGruppe {
  schluessel: string
  sichtbar: HTMLElement[]
  dom?: HTMLElement
}

export interface Neustart {
  /** Index der ersten neu zu setzenden Seite (davor bleibt alles) */
  seite: number
  /** HTML ab dieser Seite: Hüllen als Fortsetzung, Inhalt davor entfernt */
  html: string
  /** Für eine neu gesetzte Seite: Index der alten Seite, ab der die alten Seiten wieder stimmen – sonst null */
  wiederGleich(seite: HTMLElement): number | null
}

/**
 * `nachher`: die Notizen der Gruppe in der neuen Fassung (wird nicht verändert). Liefert null, wenn die ganze Gruppe
 * neu umbrochen werden muss (Änderung auf der ersten Seite, keine saubere Stelle …).
 */
export function neustartFinden(alt: AlteGruppe, nachher: HTMLElement): Neustart | null {
  const vorher = (alt.dom ??= parsen(alt.schluessel))
  // Erste Abweichung (auch an Hüllen, z. B. Umbruch vor einem Abschnitt) und der erste Block ab dort
  const unterschied = abweichungen(vorher, nachher)
  if (!unterschied) return null
  const abweichung = unterschied.erste
  const a = [...vorher.querySelectorAll<HTMLElement>('[data-block]')]
  const ab = a.findIndex((b) => b === abweichung || b.contains(abweichung) || abweichung.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
  // hinter dem letzten Block (z. B. angehängter Inhalt): ab dem letzten Block
  const k = ab < 0 ? a.length - 1 : ab
  if (k < 0) return null

  const seiten = alt.sichtbar
  // Ausgeblendete Blöcke stehen auf keiner Seite: dann zählt der letzte sichtbare Block davor
  let stelle: { seite: number; element: HTMLElement } | null = null
  for (let i = k; i >= 0 && !stelle; i--) stelle = anfangFinden(seiten, `[data-block="${a[i].dataset.block}"]`)
  if (!stelle) return null
  const einheit = einheitFinden(stelle.element)
  const beginn = einheit === stelle.element ? stelle : anfangFinden(seiten, `[data-ref="${einheit.dataset.ref}"]`)
  if (!beginn) return null
  let seite = beginn.seite
  const erster = seiten[seite].querySelector<HTMLElement>('.pagedjs_page_content [data-block]')
  if (erster && (erster === beginn.element || beginn.element.contains(erster))) seite--

  for (; seite > 0; seite--) {
    const anfang = sauberAnfang(seiten[seite])
    if (!anfang) continue
    const block = anfang.block
    // Alles vor diesem Block muss unverändert sein (die erste Abweichung liegt im Block oder dahinter)
    const blockAlt = vorher.querySelector(`[data-block="${block}"]`)
    if (!blockAlt || (abweichung !== blockAlt && !(blockAlt.compareDocumentPosition(abweichung) & Node.DOCUMENT_POSITION_FOLLOWING))) return null
    const html = restAb(nachher, anfang)
    if (html === null) return null
    const neustart = seite
    const wiederGleich = (neu: HTMLElement) => {
      const id = sauberAnfang(neu)?.block
      if (!id || !unterschied.gleichAb(id)) return null
      const alt = seiten.findIndex((s, i) => i > neustart && sauberAnfang(s)?.block === id)
      return alt < 0 ? null : alt
    }
    return { seite, html, wiederGleich }
  }
  return null
}

/**
 * Wo sich alte und neue Fassung unterscheiden: erste Abweichung (Knoten der alten Fassung) und ob ab einem Block der
 * neuen Fassung alles gleich ist (der Block, sein Inhalt, alles danach und die Hüllen um ihn). Knoten in Dokumentreihenfolge,
 * verglichen von vorn und von hinten. null: beide gleich.
 */
function abweichungen(vorher: HTMLElement, nachher: HTMLElement): { erste: Node; gleichAb(id: string): boolean } | null {
  const a = knoten(vorher)
  const b = knoten(nachher)
  let vorn = 0
  while (vorn < a.length && vorn < b.length && signatur(a[vorn]) === signatur(b[vorn])) vorn++
  if (vorn === a.length && vorn === b.length) return null
  let hinten = 0
  while (hinten < a.length - vorn && hinten < b.length - vorn && signatur(a[a.length - 1 - hinten]) === signatur(b[b.length - 1 - hinten])) hinten++
  // ab hier (Index in b) stimmt die neue Fassung bis zum Ende mit der alten überein
  const grenze = b.length - hinten
  const index = new Map(b.map((k, i) => [k, i]))
  const gleich = (k: Node) => {
    const i = index.get(k)
    return i !== undefined && (i < vorn || i >= grenze)
  }
  return {
    // neue Fassung hat nur angehängt: dann gilt der letzte alte Knoten
    erste: a[vorn] ?? a[a.length - 1],
    gleichAb(id) {
      const block = nachher.querySelector(`[data-block="${id}"]`)
      if (!block || index.get(block)! < grenze) return false
      for (let huelle = block.parentElement; huelle && huelle !== nachher; huelle = huelle.parentElement) if (!gleich(huelle)) return false
      return true
    },
  }
}

function knoten(wurzel: HTMLElement): Node[] {
  const gaenger = document.createTreeWalker(wurzel, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  const liste: Node[] = []
  for (let k = gaenger.nextNode(); k; k = gaenger.nextNode()) liste.push(k)
  return liste
}

/** Tag mit Attributen bzw. Text; data-gruppe (Lage in der Mappe) zählt nicht */
function signatur(knoten: Node): string {
  if (!(knoten instanceof Element)) return `#${knoten.textContent}`
  const attribute = [...knoten.attributes].filter((a) => a.name !== 'data-gruppe')
  return [knoten.tagName, ...attribute.map((a) => `${a.name}=${a.value}`)].join(' ')
}

function parsen(html: string): HTMLElement {
  const wurzel = document.createElement('div')
  wurzel.innerHTML = html
  return wurzel
}

/** Erste Seite, auf der ein passendes Element beginnt (nicht die Fortsetzung eines geteilten) */
function anfangFinden(seiten: HTMLElement[], selektor: string): { seite: number; element: HTMLElement } | null {
  for (const [seite, s] of seiten.entries()) {
    const element = s.querySelector<HTMLElement>(`.pagedjs_page_content ${selektor}:not([data-split-from])`)
    if (element) return { seite, element }
  }
  return null
}

/** Äußerste Einheit um den Block, die zusammenbleiben soll – samt Überschrift davor, die an ihr hängt */
function einheitFinden(block: HTMLElement): HTMLElement {
  const fenster = block.ownerDocument.defaultView!
  let einheit = block
  for (let el = block.parentElement; el && !el.classList.contains('pagedjs_page_content'); el = el.parentElement) {
    if (fenster.getComputedStyle(el).breakInside.startsWith('avoid')) einheit = el
  }
  for (let davor = einheit.previousElementSibling as HTMLElement | null; davor; davor = einheit.previousElementSibling as HTMLElement | null) {
    const haengt =
      davor.dataset.breakAfter === 'avoid' ||
      einheit.dataset.previousBreakAfter === 'avoid' ||
      einheit.dataset.breakBefore === 'avoid' ||
      /^H[1-6]$/.test(davor.tagName)
    if (!haengt) break
    einheit = davor
  }
  return einheit
}

const HUELLE = (el: Element) => el.tagName === 'ARTICLE' || el.tagName === 'SECTION' || el.matches('div.print.markdown-reading-view')

/** Sauberer Seitenanfang: der Block und je Hülle um ihn (von innen nach außen), ob sie auf dieser Seite fortgesetzt wird */
interface Anfang {
  block: string
  fortsetzung: boolean[]
}

/** Wenn die Seite sauber mit einem Block beginnt: davor nur Hüllen, der Block selbst beginnt hier – sonst null */
function sauberAnfang(seite: HTMLElement): Anfang | null {
  const inhalt = seite.querySelector('.pagedjs_page_content')
  const block = inhalt?.querySelector<HTMLElement>('[data-block]')
  if (!inhalt || !block?.dataset.block || block.hasAttribute('data-split-from')) return null
  const fortsetzung: boolean[] = []
  for (let el: Element = block; el.parentElement && el.parentElement !== inhalt; el = el.parentElement) {
    const huelle: Element = el.parentElement
    for (let davor = el.previousSibling; davor; davor = davor.previousSibling) {
      if (davor.nodeType !== Node.TEXT_NODE || davor.textContent!.trim()) return null
    }
    // die äußerste Ebene ist Paged.js' eigener div um den Inhalt
    if (huelle.parentElement === inhalt) break
    if (!HUELLE(huelle)) return null
    fortsetzung.push(huelle.hasAttribute('data-split-from'))
  }
  return { block: block.dataset.block, fortsetzung }
}

/** HTML ab dem Block, die Hüllen als Fortsetzung – null, wenn eine Hülle keine Notiz/kein Abschnitt ist */
/**
 * HTML ab dem Block; die Hüllen setzen fort, wo sie es auf der alten Seite taten (Paged.js legt mitunter den leeren
 * Anfang eines Abschnitts noch auf die vorige Seite). null, wenn eine Hülle keine Notiz/kein Abschnitt ist.
 */
function restAb(nachher: HTMLElement, anfang: Anfang): string | null {
  const rest = nachher.cloneNode(true) as HTMLElement
  const block = rest.querySelector(`[data-block="${anfang.block}"]`)
  if (!block) return null
  const huellen: Element[] = []
  for (let huelle = block.parentElement; huelle && huelle !== rest; huelle = huelle.parentElement) {
    if (!HUELLE(huelle)) return null
    huellen.push(huelle)
  }
  // auf der Seite steht zusätzlich die Hülle des ganzen Dokuments (div.print) – die setzt nachsetzen()
  if (huellen.length !== anfang.fortsetzung.length - 1) return null
  const bereich = document.createRange()
  bereich.setStart(rest, 0)
  bereich.setEndBefore(block)
  bereich.deleteContents()
  huellen.forEach((huelle, i) => {
    if (anfang.fortsetzung[i]) huelle.setAttribute('data-split-from', '')
  })
  return rest.innerHTML
}
