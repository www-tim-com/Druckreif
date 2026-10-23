// Bedienung direkt auf den Seiten (im iframe der Vorschau), wie in Word:
// Klick wählt einen Block, Rechtsklick öffnet das Kontextmenü, Bilder lassen sich ziehen und an den Ecken skalieren,
// bei Tabellen lassen sich Spaltengrenzen und der rechte Rand ziehen.
// Während des Ziehens wird nur das DOM verändert; erst beim Loslassen geht die Änderung an die App (speichern, neu umbrechen).

import { spaltenSetzen } from '../layout/zuordnen'

type Ausrichtung = 'left' | 'center' | 'right'

/** Block, an dem ein umfließendes Bild abgelegt wurde (wie in Word am Absatz verankert) */
interface Bezug {
  block: string
  versatzMm: number
}

export interface Rueckrufe {
  auswahl(id: string | null): void
  kontext(id: string, x: number, y: number): void
  bildGroesse(id: string, breiteMm: number): void
  /**
   * neue Ausrichtung und Verschiebung nach unten (mm, relativ zur bisherigen Lage); bei umfließenden Bildern
   * zusätzlich der Block, an dem die Oberkante abgelegt wurde, und wie weit unter dessen Anfang (mm)
   */
  bildVerschieben(id: string, ausrichtung: Ausrichtung, versatzMm: number, bezug?: Bezug): void
  tabelleSpalten(id: string, prozent: number[]): void
  tabelleBreite(id: string, prozent: number): void
  /** keydown und keyup (Alt allein zeigt die Zugriffstasten) */
  taste(e: KeyboardEvent): void
  /** Strg+Mausrad: Zoom ändern (deltaY wie beim Rad) */
  zoomRad(deltaY: number): void
  seite(nummer: number): void
  /** Knopf in der Leerraum-Markierung (Index in der Liste aus leerraumFinden) */
  leerraum(index: number): void
  /** Platzhalter einer nicht eingefügten Notiz angeklickt */
  einbettung(notiz: string, ziel: string): void
}

const MIN_BREITE_MM = 15
const MIN_SPALTE_PX = 24
const gezogen = new WeakSet<Document>()
const ZIEH_SCHWELLE_PX = 4

/** Richtet die Bedienung in einem fertig umbrochenen iframe ein. `rueckrufe` liefert immer die aktuellen Funktionen. */
export function einrichten(iframe: HTMLIFrameElement, rueckrufe: () => Rueckrufe): void {
  const dok = iframe.contentDocument!
  const fenster = iframe.contentWindow!

  dok.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    const ziel = e.target as Element
    const griff = ziel.closest<HTMLElement>('.druckreif-griff')
    const block = blockVon(ziel)
    const spalte = ziel.closest<HTMLElement>('.druckreif-spaltengriff')
    if (spalte) {
      e.preventDefault()
      spalteZiehen(dok, spalte, e, rueckrufe)
    } else if (ziel.closest('.druckreif-breitengriff')) {
      e.preventDefault()
      tabellenbreiteZiehen(dok, e, rueckrufe)
    } else if (griff?.closest('.druckreif-ueberlagerung')) {
      e.preventDefault()
      tabelleSkalieren(dok, griff, e, rueckrufe)
    } else if (griff) {
      e.preventDefault()
      skalieren(dok, griff, e, rueckrufe)
    } else if (block?.tagName === 'FIGURE' && block.classList.contains('druckreif-auswahl') && ziel.tagName === 'IMG') {
      e.preventDefault()
      verschieben(dok, block, e, rueckrufe)
    } else if (block?.tagName === 'TABLE' && block.classList.contains('druckreif-auswahl')) {
      // Gewählte Tabelle wie ein Bild ziehen (nur der erste Teil einer über Seiten geteilten Tabelle trägt die Lage)
      e.preventDefault()
      verschieben(dok, block, e, rueckrufe)
    }
  })

  dok.addEventListener('click', (e) => {
    // Nach dem Ziehen löst der Browser einen Klick am Loslass-Punkt aus – der soll die Auswahl nicht ändern
    if (gezogen.has(dok)) {
      gezogen.delete(dok)
      return
    }
    const ziel = e.target as Element
    // Links nie öffnen: das iframe verließe sonst die Seitenansicht (Klick wählt nur den Block)
    if (ziel.closest('a[href]')) e.preventDefault()
    const leerraum = ziel.closest<HTMLElement>('.druckreif-leerraum button')
    if (leerraum) return rueckrufe().leerraum(Number(leerraum.dataset.leerraum))
    const einbettung = ziel.closest<HTMLElement>('span.einbettung:not(.verschachtelt)')
    if (einbettung) {
      const notiz = einbettung.closest<HTMLElement>('article.notiz')?.dataset.notiz
      if (notiz) return rueckrufe().einbettung(notiz, einbettung.dataset.ziel ?? '')
    }
    if ((e.target as Element).closest('.druckreif-griff, .druckreif-ueberlagerung')) return
    rueckrufe().auswahl(blockVon(e.target as Element)?.getAttribute('data-block') ?? null)
  })

  dok.addEventListener('contextmenu', (e) => {
    const id = blockVon(e.target as Element)?.getAttribute('data-block')
    if (!id) return
    e.preventDefault()
    const rand = iframe.getBoundingClientRect()
    rueckrufe().auswahl(id)
    rueckrufe().kontext(id, rand.left + e.clientX, rand.top + e.clientY)
  })

  dok.addEventListener('keydown', (e) => rueckrufe().taste(e))
  dok.addEventListener('keyup', (e) => rueckrufe().taste(e))
  dok.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      rueckrufe().zoomRad(e.deltaY)
    },
    { passive: false },
  )

  fenster.addEventListener('scroll', () => {
    const mitte = fenster.innerHeight / 2
    const seiten = [...dok.querySelectorAll('.pagedjs_page')]
    const nr = seiten.findIndex((s) => s.getBoundingClientRect().bottom > mitte)
    rueckrufe().seite(nr < 0 ? seiten.length : nr + 1)
  })
}

function blockVon(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>('[data-block]')
}

/** Markiert den gewählten Block; bei Bildern mit Rahmen und Ziehpunkten an den Ecken. */
export function auswahlZeigen(dok: Document, id: string | null): void {
  for (const el of dok.querySelectorAll('.druckreif-auswahl')) el.classList.remove('druckreif-auswahl')
  for (const el of dok.querySelectorAll('.druckreif-rahmen, .druckreif-ueberlagerung')) el.remove()
  if (!id) return
  const bloecke = [...dok.querySelectorAll<HTMLElement>(`[data-block="${id}"]`)]
  for (const el of bloecke) el.classList.add('druckreif-auswahl')
  const figure = bloecke.find((el) => el.tagName === 'FIGURE')
  if (figure) rahmenSetzen(figure)
  const tabelle = bloecke.find((el) => el.tagName === 'TABLE') as HTMLTableElement | undefined
  if (tabelle) tabellenGriffe(tabelle)
}

/**
 * Griffe an den Spaltengrenzen und am rechten Rand einer Tabelle. Sie liegen in einer Ebene über der Seite
 * (direkt im body), weil Elemente innerhalb einer Tabelle die Tabelle selbst verändern würden.
 */
function tabellenGriffe(tabelle: HTMLTableElement) {
  const dok = tabelle.ownerDocument
  dok.querySelector('.druckreif-ueberlagerung')?.remove()
  const fenster = dok.defaultView!
  const rand = tabelle.getBoundingClientRect()
  const ebene = dok.createElement('div')
  ebene.className = 'druckreif-ueberlagerung'
  ebene.dataset.tabelle = tabelle.dataset.block
  Object.assign(ebene.style, {
    left: `${rand.left + fenster.scrollX}px`,
    top: `${rand.top + fenster.scrollY}px`,
    width: `${rand.width}px`,
    height: `${rand.height}px`,
  })
  const zellen = [...(tabelle.rows[0]?.cells ?? [])]
  zellen.slice(0, -1).forEach((zelle, i) => {
    const griff = dok.createElement('div')
    griff.className = 'druckreif-spaltengriff'
    griff.dataset.spalte = String(i)
    griff.style.left = `${zelle.getBoundingClientRect().right - rand.left}px`
    ebene.append(griff)
  })
  const breite = dok.createElement('div')
  breite.className = 'druckreif-breitengriff'
  breite.title = 'Tabellenbreite ziehen'
  ebene.append(breite)
  // Ecken wie beim Bild: ziehen ändert die Breite
  for (const ecke of ['nw', 'ne', 'sw', 'se']) {
    const griff = dok.createElement('span')
    griff.className = `druckreif-griff ${ecke}`
    griff.dataset.ecke = ecke
    ebene.append(griff)
  }
  dok.body.append(ebene)
}

function tabelleZurEbene(dok: Document): HTMLTableElement | null {
  const id = dok.querySelector<HTMLElement>('.druckreif-ueberlagerung')?.dataset.tabelle
  return id ? dok.querySelector<HTMLTableElement>(`table[data-block="${id}"]`) : null
}

function spalteZiehen(dok: Document, griff: HTMLElement, start: PointerEvent, rueckrufe: () => Rueckrufe) {
  const tabelle = tabelleZurEbene(dok)
  if (!tabelle) return
  const i = Number(griff.dataset.spalte)
  const gesamt = tabelle.getBoundingClientRect().width
  const breiten = [...tabelle.rows[0].cells].map((z) => z.getBoundingClientRect().width)
  const paar = breiten[i] + breiten[i + 1]
  let prozent = breiten.map((b) => (b / gesamt) * 100)

  ziehen(dok, start, (dx) => {
    const links = Math.min(paar - MIN_SPALTE_PX, Math.max(MIN_SPALTE_PX, breiten[i] + dx))
    const neu = [...breiten]
    neu[i] = links
    neu[i + 1] = paar - links
    prozent = neu.map((b) => Math.round((b / gesamt) * 1000) / 10)
    spaltenSetzen(tabelle, prozent)
    tabellenGriffe(tabelle)
  }, (bewegt) => {
    if (bewegt) rueckrufe().tabelleSpalten(tabelle.dataset.block!, prozent)
  })
}

function tabellenbreiteZiehen(dok: Document, start: PointerEvent, rueckrufe: () => Rueckrufe) {
  const tabelle = tabelleZurEbene(dok)
  if (!tabelle) return
  const startBreite = tabelle.getBoundingClientRect().width
  const verfuegbar = tabelle.parentElement?.getBoundingClientRect().width ?? startBreite
  let prozent = Math.round((startBreite / verfuegbar) * 100)

  ziehen(dok, start, (dx) => {
    prozent = Math.round(Math.min(100, Math.max(20, ((startBreite + dx) / verfuegbar) * 100)))
    tabelle.style.width = `${prozent}%`
    tabellenGriffe(tabelle)
  }, (bewegt) => {
    if (bewegt) rueckrufe().tabelleBreite(tabelle.dataset.block!, prozent)
  })
}

/** Tabelle an einer Ecke größer oder kleiner ziehen – wie ein Bild (gespeichert in % der Textbreite) */
function tabelleSkalieren(dok: Document, griff: HTMLElement, start: PointerEvent, rueckrufe: () => Rueckrufe) {
  const tabelle = tabelleZurEbene(dok)
  if (!tabelle) return
  const startBreite = tabelle.getBoundingClientRect().width
  const verfuegbar = tabelle.parentElement?.getBoundingClientRect().width ?? startBreite
  const richtung = griff.dataset.ecke?.endsWith('w') ? -1 : 1
  let prozent = Math.round((startBreite / verfuegbar) * 100)

  ziehen(dok, start, (dx) => {
    prozent = Math.round(Math.min(100, Math.max(20, ((startBreite + richtung * dx) / verfuegbar) * 100)))
    tabelle.style.width = `${prozent}%`
    tabellenGriffe(tabelle)
  }, (bewegt) => {
    if (bewegt) rueckrufe().tabelleBreite(tabelle.dataset.block!, prozent)
  })
}

function rahmenSetzen(figure: HTMLElement) {
  const img = figure.querySelector('img')
  if (!img) return
  let rahmen = figure.querySelector<HTMLElement>('.druckreif-rahmen')
  if (!rahmen) {
    rahmen = figure.ownerDocument.createElement('div')
    rahmen.className = 'druckreif-rahmen'
    for (const ecke of ['nw', 'ne', 'sw', 'se']) {
      const griff = figure.ownerDocument.createElement('span')
      griff.className = `druckreif-griff ${ecke}`
      griff.dataset.ecke = ecke
      rahmen.append(griff)
    }
    figure.append(rahmen)
  }
  Object.assign(rahmen.style, {
    left: `${img.offsetLeft}px`,
    top: `${img.offsetTop}px`,
    width: `${img.offsetWidth}px`,
    height: `${img.offsetHeight}px`,
  })
}

/** Bildschirm-Pixel pro Millimeter (berücksichtigt den Zoom): Seitenbreite ist 210 mm. */
function pxProMm(dok: Document): number {
  const seite = dok.querySelector('.pagedjs_page')
  return seite ? seite.getBoundingClientRect().width / 210 : 96 / 25.4
}

function skalieren(dok: Document, griff: HTMLElement, start: PointerEvent, rueckrufe: () => Rueckrufe) {
  const figure = griff.closest<HTMLElement>('figure')!
  const img = figure.querySelector('img')!
  const faktor = pxProMm(dok)
  const startMm = img.getBoundingClientRect().width / faktor
  // Ecken links ziehen das Bild nach links größer
  const richtung = griff.dataset.ecke?.endsWith('w') ? -1 : 1
  const textbreiteMm = (figure.parentElement?.getBoundingClientRect().width ?? 600) / faktor
  let breite = startMm

  ziehen(dok, start, (dx) => {
    breite = Math.round(Math.min(textbreiteMm, Math.max(MIN_BREITE_MM, startMm + (richtung * dx) / faktor)))
    img.style.width = `${breite}mm`
    img.style.maxHeight = 'none'
    rahmenSetzen(figure)
  }, (bewegt) => {
    if (bewegt) rueckrufe().bildGroesse(figure.dataset.block!, breite)
  })
}

/** Bild (figure) oder Tabelle ziehen: Ausrichtung, Abstand und beim Textumbruch der Bezugsblock */
function verschieben(dok: Document, figure: HTMLElement, start: PointerEvent, rueckrufe: () => Rueckrufe) {
  const faktor = pxProMm(dok)
  const inhalt = figure.closest('.pagedjs_page_content') ?? dok.body
  const ebene = dok.querySelector<HTMLElement>('.druckreif-ueberlagerung')
  let dxMm = 0
  let dyMm = 0

  ziehen(dok, start, (dx, dy) => {
    dxMm = dx / faktor
    dyMm = dy / faktor
    figure.style.transform = `translate(${dxMm}mm, ${dyMm}mm)`
    figure.style.opacity = '0.8'
    if (ebene) ebene.style.visibility = 'hidden'
  }, (bewegt) => {
    figure.style.transform = ''
    figure.style.opacity = ''
    if (ebene) ebene.style.visibility = ''
    if (!bewegt) return
    const img = (figure.querySelector('img') ?? figure).getBoundingClientRect()
    const flaeche = inhalt.getBoundingClientRect()
    const anteil = (img.left + img.width / 2 + dxMm * faktor - flaeche.left) / flaeche.width
    const id = figure.dataset.block!
    if (figure.classList.contains('umfliessen')) {
      // Umfließend: linke oder rechte Hälfte, verankert am Block unter der neuen Oberkante; Text fließt neu herum
      const bezug = bezugFinden(dok, id, img.top + dyMm * faktor)
      const ausrichtung: Ausrichtung = anteil < 1 / 2 ? 'left' : 'right'
      rueckrufe().bildVerschieben(id, ausrichtung, Math.round(dyMm), bezug ? { block: bezug.block, versatzMm: bezug.versatzPx / faktor } : undefined)
      return
    }
    // Ausrichtung nach der Lage der Bildmitte im Satzspiegel: linkes, mittleres oder rechtes Drittel
    const ausrichtung: Ausrichtung = anteil < 1 / 3 ? 'left' : anteil > 2 / 3 ? 'right' : 'center'
    rueckrufe().bildVerschieben(id, ausrichtung, Math.round(dyMm))
  })
}

/**
 * Block, auf dessen Höhe `y` (Bildschirm-Pixel) liegt: der zuletzt davor beginnende, das Bild selbst ausgenommen.
 * Der Versatz (px) zählt bei über Seiten geteilten Blöcken die Teile auf den Seiten davor mit.
 */
function bezugFinden(dok: Document, bildId: string, y: number): { block: string; versatzPx: number } | null {
  let bester: HTMLElement | null = null
  let besteOben = -Infinity
  for (const el of dok.querySelectorAll<HTMLElement>('.pagedjs_page_content [data-block]')) {
    if (el.dataset.block === bildId || el.parentElement?.closest('[data-block]')) continue
    const oben = el.getBoundingClientRect().top
    if (oben <= y && oben >= besteOben) [bester, besteOben] = [el, oben]
  }
  if (!bester) return null
  const block = bester.dataset.block!
  let versatz = y - besteOben
  for (const teil of dok.querySelectorAll<HTMLElement>(`[data-block="${block}"]`)) {
    if (teil === bester) break
    versatz += teil.getBoundingClientRect().height
  }
  return { block, versatzPx: versatz }
}

function ziehen(
  dok: Document,
  start: PointerEvent,
  bewegen: (dx: number, dy: number) => void,
  ende: (bewegt: boolean) => void,
) {
  let bewegt = false
  const zug = (e: PointerEvent) => {
    const dx = e.clientX - start.clientX
    const dy = e.clientY - start.clientY
    if (!bewegt && Math.hypot(dx, dy) < ZIEH_SCHWELLE_PX) return
    bewegt = true
    bewegen(dx, dy)
  }
  const los = () => {
    dok.removeEventListener('pointermove', zug)
    dok.removeEventListener('pointerup', los)
    dok.removeEventListener('pointercancel', los)
    if (bewegt) {
      gezogen.add(dok)
      setTimeout(() => gezogen.delete(dok), 300) // falls kein Klick folgt
    }
    ende(bewegt)
  }
  // Zeiger festhalten: auch Loslassen außerhalb des iframes (über Menüband oder Navigation) beendet das Ziehen
  ;(start.target as Element | null)?.setPointerCapture?.(start.pointerId)
  dok.addEventListener('pointermove', zug)
  dok.addEventListener('pointerup', los)
  dok.addEventListener('pointercancel', los)
}
