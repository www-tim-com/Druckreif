# CLAUDE.md

Lernzettel-Editor: macht aus einer Obsidian-Notiz oder mehreren hintereinander (Druckliste) druckfertige A4-Seiten (Vorschau mit Paged.js, PDF über den Druckdialog).
Manuelle Layout-Änderungen werden pro Notiz in `.lernzettel/<Pfad mit __>.layout.json` im Vault gespeichert,
verankert an Blöcken (Fingerabdruck), nie an Seitenpositionen. Läuft lokal im Browser (Chrome/Edge), Windows-PC.
Grundlage: Spezifikation „Lernzettel-Editor“ und die „PDF-Export-Anweisung“ (Regeln für Syntax, Bilder, Umbrüche).

## Grundsätze

- **Inhalt unverändert** ist die oberste Regel (medizinische Lernzettel: Dosierungen, Grenzwerte). Entfernt wird nur,
  was die Export-Anweisung ausdrücklich nennt. Was nicht sicher umgewandelt werden kann, nie als Rohcode drucken und nie
  stillschweigend weglassen: sichtbarer Platzhalter + roter Hinweis.
- **Simpel halten.** Funktionen statt Klassen, reine Funktionen wo möglich (`layout/bearbeiten.ts`), keine State-Bibliothek,
  kein CSS-Framework. Neue Abhängigkeiten nur, wenn sie viel Code sparen.
- Notizen werden nur gelesen. Geschrieben wird ausschließlich in `.lernzettel/`.
- Das Format der Layout-Datei (englische Schlüssel) ist Teil der Spezifikation – nur abwärtskompatibel erweitern.
- Code, Kommentare, Bezeichner und Oberfläche auf Deutsch (ohne Umlaute in Bezeichnern).

## Datenfluss

`vault/` (Dateien) → `markdown/` (Markdown → Obsidian-HTML) → `dokument/bloecke.ts` (gliedern, Fingerabdrücke)
→ `layout/zuordnen.ts` (Layout-Datei anwenden) → `vorschau/Vorschau.tsx` (iframe + Paged.js).
Was gedruckt wird, bestimmt die aktive **Mappe** (`mappen/mappen.ts`, `.lernzettel/mappen.json`): Notizen in
Reihenfolge, je mit `newPage` und optional `sections` (Auszug). `dokument/aufbauen.ts` steuert den Ablauf, `App.tsx` hält Zustand (Auswahl, Rückgängig-Verlauf) und verdrahtet die
Word-Oberfläche in `ui/`. Bedienung auf den Seiten (Klick, Rechtsklick, Bild ziehen) steckt in `vorschau/interaktion.ts`
und meldet nur Absichten an die App; jede Layout-Änderung läuft über die reinen Funktionen in `layout/bearbeiten.ts`.

## Stolperfallen

- Paged.js versteht kein `:is()`/`:where()` in CSS → Selektoren ausschreiben. Es verwirft außerdem `@media` außer
  `print` und schreibt Selektoren mit `+`/`nth-of-type` mit geringerer Spezifität und Zufallsnamen um. Deshalb gehen
  Schriften, `obsidian-basis.css` und Vault-CSS (Theme, Snippets) an Paged.js vorbei (`data-pagedjs-ignore`, der Browser
  wendet sie an); nur `@page`, Umbruch- und Zählerangaben aus dem Vault-CSS bekommt Paged.js (`stil/aufteilen.ts`).
  `druck.css` läuft durch Paged.js: dort keine Selektoren mit `+` oder `nth-of-type` (Notizbeginn: Klasse `folgend`).
- DOM wie Obsidians PDF-Export: `div.print.markdown-reading-view` > `article.notiz.markdown-preview-view.markdown-rendered`
  (+ `cssclasses` aus dem Frontmatter). Obsidian-Variablen (`--h2-color`, `--bold-color` …) liest `obsidian-basis.css`
  mit Ersatzwert.
- Paged.js 0.4 hält Elemente mit `style`-Attribut für unsichtbar (Umbrüche dahinter fielen weg) → Korrektur-Handler
  `PAGED_KORREKTUR` in `Vorschau.tsx`.
- Teil-Umbruch (`Vorschau.tsx`): Gruppen = Notiz mit neuer Seite + direkt anschließende. Unveränderte Gruppen (gleiches
  HTML, gleiches CSS) übernehmen ihre Seiten aus der sichtbaren Fassung (unberührte Kopie vor Auswahl/Markierungen),
  nur geänderte bricht Paged.js um; danach neu nummerieren. Passt etwas nicht, wird alles umbrochen. Hängt Paged.js-CSS
  von der Lage im Dokument ab (Zähler, linke/rechte Seiten), immer alles umbrechen (`NICHT_TEILBAR`).
- Layout-Änderungen bauen sofort mit dem neuen Layout auf (`ausstehend` in `App.tsx`), nicht erst nach dem Speichern.
- Paged.js löst `url()` gegen `about:srcdoc` auf → `urlsAbsolut()` in `Vorschau.tsx`.
- Paged.js verwirft `@media screen` aus verarbeiteten Stylesheets → `vorschau.css` wird erst nach dem Umbruch eingefügt.
- Vites `import.meta.glob` übersieht Ordner mit Punkt → Dateien aus `demo/vault/.obsidian/` in `demoVault.ts` einzeln importieren
  (CSS mit `?raw`: über `?url` liefert der Entwicklungsserver ein JS-Modul).
- Jede Änderung baut das Dokument neu und bricht es in einem zweiten iframe um; erst dann wird umgeschaltet
  (kein Flackern). Block-IDs (`n0-12`) sind nur innerhalb einer Fassung gültig, Layout hängt am Fingerabdruck.
- Ausblenden darf nie Inhalt stillschweigend entfernen: jeder ausgeblendete Block erzeugt einen Hinweis mit „Einblenden“.
  Fußnoten gehören zur Notiz, nicht zum letzten Abschnitt (`bloecke.ts`).
- Der erste Umbruch läuft ebenfalls im unsichtbaren iframe (sonst kurz roher, seitenbreiter Text sichtbar).
- `Vault.aktualisieren()` liest die Dateiliste neu; `bilderVergessen()` verwirft die Blob-URLs (verzögert freigeben,
  die sichtbare Fassung nutzt sie noch).
- Tabellen-Griffe liegen in einer Ebene direkt im body (`.druckreif-ueberlagerung`), nie innerhalb der Tabelle.
- Die Polyfill-Datei von Paged.js ist nicht über `exports` freigegeben → Import über `/node_modules/...?url`.
- Notiz-HTML läuft durch DOMPurify (`saeubern()` in `umwandeln.ts`, Entferntes wird als Hinweis gemeldet). Deshalb
  KaTeX nur als HTML (MathML würde entfernt) und die Mermaid-Quelle URL-kodiert in `data-quelle` (`-->` im Attribut).
- Automatisch neu laden: `Dokument.quellen` hält die Änderungszeit jeder gelesenen Datei (vor dem Lesen genommen);
  die App vergleicht alle 1,5 s dagegen und liest bei Änderung auch die Dateiliste neu (neu eingefügte Bilder).
- `bilderFinden()` und der Wikilink-Renderer müssen dieselben Bildnamen liefern (`bildZiel()`, `dekodieren()`).
- Leerraum (`vorschau/leerraum.ts`) misst im fertig umbrochenen iframe und nutzt Paged.js' `data-split-from`
  (Fortsetzung eines geteilten Elements). Markierungen liegen in `.pagedjs_page`, nur Bildschirm.
- „Automatisch formatieren“ misst in einem dritten, unsichtbaren iframe (`seitenMessen`). Die Probe-Schrift wird als
  Inline-Stil an `article.notiz` gesetzt – ein zusätzliches Stylesheet mit `!important` kam bei Paged.js nicht an.
- Seitenminiaturen sind eine Kopie des umbrochenen DOM ohne `<script>` (sonst bricht Paged.js erneut um).
- Eingebettete Notizen: Platzhalter `span.einbettung` aus dem Wikilink-Renderer; `aufbauen.ts` ersetzt ihn durch den
  Inhalt (eigener Block) oder lässt ihn in einem `p.nur-einbettung` ohne Höhe stehen, das kein Block ist.
- Textumbruch um Bilder (`image.wrap`) ist ein CSS-Float. Kästen daneben (Callout, Code) brauchen `display: flow-root`,
  sonst liegt ihr Hintergrund unter dem Bild; solche Blöcke weichen dem ganzen Float aus, nicht nur dem Bild. Deshalb
  „tiefer im Absatz“ als unsichtbarer Float ohne Breite davor (`.umfluss-abstand`) + `clear`, nicht als Innenabstand.
  `image.before` verankert das Bild an einem Block desselben Abschnitts (beim Ziehen gesetzt).
- Layout-Dateien, die sich nicht lesen lassen, sind gesperrt (`NotizTeil.layoutKaputt`, in der App `kaputteLayouts`) –
  nie überschreiben. Dasselbe gilt für eine beschädigte `mappen.json` (`mappenGesperrt` in `App.tsx`).
- Hinweise tragen den Index des Layout-Eintrags aus dem zuletzt aufgebauten Dokument; Aktionen darauf suchen den Eintrag
  im neuesten Layout über den Anker (`hinweisEintragAendern`), weil sich Indizes bei schnellem Klicken verschieben.
- KaTeX: nur eine Fassung im Projekt (`overrides` in `package.json`, sonst passt das HTML nicht zu `katex.min.css`).
  Fehler erkennt `formelFehlerErsetzen()` an der Klasse `katex-error` oder der Fehlerfarbe `#cc0001`.
- Code- und `$$`-Formelblöcke (auch in Callouts und Listen) erkennt `geschuetzteZeilen()` in `vorbereiten.ts` – auch für
  das Ausschneiden eingebetteter Abschnitte. Frontmatter entfernt der Aufrufer, nicht `vorbereiten()`.
- In die Vorschau-iframes geht Vault-CSS nur mit `<` als CSS-Escape (`\3c`), sonst beendet `</style>` das Element.
- Tempo (jede Aktion baut alles neu auf): `markdownUmwandeln` merkt Ergebnisse, wenn der Kontext einen `schluessel`
  hat – der muss alles enthalten, was die Rückrufe liefern (Bild-URLs, Einbettungen); Hinweise werden beim
  Wiederverwenden erneut ausgelöst. Notizen und Bilder werden parallel gelesen (Hinweise je Notiz gesammelt).
  Nach erfolgreichem Speichern kein zweiter Aufbau. Der Notizbaum (`Seitenleiste`) ist `memo` mit stabilen Rückrufen
  und zeichnet zugeklappte Ordner nicht. `leerraumFinden` erst messen, dann markieren (sonst ein Layout pro Seite).
- Setzer (`Vorschau.tsx`): geänderte Gruppen bricht Paged.js in einem dauerhaft geladenen unsichtbaren iframe um
  (`new Paged.Previewer().preview(...)`), danach werden nur deren Seiten im sichtbaren iframe getauscht
  (`seitenEinsetzen` fasst unveränderte Seiten nicht an). Erzeugt Paged.js dabei anderes CSS als für die sichtbare
  Fassung (`pagedCss`), oder passt etwas nicht, wird wie bisher alles im zweiten iframe umbrochen. Paged.js wartet
  sonst nach jeder Seite auf einen Bildschirm-Frame → `PAGED_TAKT` (MessageChannel).
- Neustart (`neustart.ts`): bei einer geänderten Notiz erst ab der Seite vor der ersten Abweichung neu setzen
  (zusammengehaltene Einheiten und Überschriften beachtet), Hüllen als Fortsetzung wie auf der alten Seite
  (`data-split-from`); Paged.js hört auf (Fehler aus `afterPageLayout`, es kennt kein Anhalten), sobald eine neue
  Seite sauber mit demselben Block beginnt wie eine alte und ab dort alles gleich ist. Prüfen: Seiten nach
  Teil-Umbruch mit einem vollständigen vergleichen (Blöcke je Seite, Textlängen, Hüllen, Leerraum).
- Seiten außerhalb des Sichtbereichs: `content-visibility: auto` (nur Bildschirm, `vorschau.css`). Leerraum wird nur
  ab der ersten geänderten Seite neu gemessen. Aufbau und Umbruch starten in `useLayoutEffect` (nicht erst nach dem
  nächsten Frame); Notiztexte merkt `aufbauen.ts` mit Änderungszeit.

## Prüfen

```bash
npm run check        # TypeScript
npm run build        # Produktionsbuild nach dist/
npm run dev          # http://localhost:5173/?demo
```

- Keine Test-Suite. Prüfen im Browser mit dem Demo-Vault (Playwright: Chromium unter `/opt/pw-browsers` falls vorhanden).
  Testskripte und Screenshots ins Scratchpad, nicht ins Projekt.
- Neue Obsidian-Syntax immer auch als Beispiel in `demo/vault/` aufnehmen.
