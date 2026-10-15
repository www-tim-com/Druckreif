# Druckreif – Lernzettel-Editor

Macht aus Obsidian-Lernzetteln druckfertige A4-Seiten. Der Text bleibt in der Markdown-Datei,
manuelle Layout-Änderungen landen in einer kleinen JSON-Datei daneben (`.lernzettel/`).
Läuft lokal im Browser (Chrome/Edge), ohne Server im Internet; die Notizen werden nur gelesen.

## Starten

| Was | Wie |
| --- | --- |
| Editor (Windows) | `start.bat` doppelklicken – installiert beim ersten Mal die Pakete und öffnet `http://localhost:5173` |
| Editor (Konsole) | `npm install`, dann `npm run dev` |
| Demo ohne eigenen Vault | im Editor „Demo-Vault ansehen“ oder `http://localhost:5173/?demo` |
| Demo-Version bauen | `npm run demo` – baut nach `dist/` und öffnet die Demo |
| Typen prüfen | `npm run check` |

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

Ordnerzugriff geht nur in Chrome/Edge und nur über `localhost`, nicht per Doppelklick auf eine HTML-Datei.
Die Freigabe wird pro Adresse gemerkt, deshalb ist der Port fest auf 5173 eingestellt.

**Zum Testen immer eine Kopie des Vaults öffnen**, solange der Editor neu ist. Geschrieben wird nur in `.lernzettel/`.

### Demo-Versionen

- Der Demo-Vault liegt in `demo/vault/` und ist ein normaler Obsidian-Vault (lässt sich auch in Obsidian öffnen).
  Neue Beispielnotizen einfach dort ablegen. Dateien in `demo/vault/.obsidian/` müssen in
  `src/vault/demoVault.ts` einzeln eingetragen werden (Vite übersieht Ordner mit Punkt).
- `npm run build` erzeugt in `dist/` eine fertige Version. Sie läuft auf jedem Webserver bzw. per
  `npm run preview`; über `?demo` startet sie direkt mit dem Demo-Vault. Layout-Änderungen im Demo-Vault
  bleiben nur bis zum Neuladen der Seite erhalten.

## Bedienung

Die Oberfläche ist wie Microsoft Word aufgebaut: Titelleiste mit Schnellzugriff, Menüband, Navigationsbereich links,
Seiten in der Mitte, Hinweise rechts, Statusleiste mit Seitenzahl und Zoom unten.

1. **Datei:** Vault-Ordner öffnen (wird gemerkt), Demo-Vault, Infos zu Theme und Snippets. Der Vault wird nur gebraucht,
   damit der Editor Bilder, Theme und Layout-Dateien findet – gedruckt wird nur, was du auswählst.
2. **Navigation › Notizen:** Klick auf eine Notiz = Dokument aus genau dieser Notiz. „+“ (beim Darüberfahren) hängt
   weitere an; „Im Dokument“ zeigt die Reihenfolge (↑ ↓ ×). Suche nach Titel, Filter nach Frontmatter (`lernfeld: 3`).
   Notizen mit ☰ sind Reihenfolgedateien aus Obsidian und stehen für ihre Notizen.
3. **Navigation › Überschriften:** Klick springt zur Stelle. Das **Auge** blendet einen ganzen Abschnitt im Druck aus,
   z. B. „Quellen“. Ausgeblendetes steht immer in den Hinweisen und lässt sich dort wieder einblenden.
4. **Auf der Seite:** Block anklicken = auswählen, **Rechtsklick** = Kontextmenü (Seitenumbruch, ausblenden, Bild ausrichten, zurücksetzen).
   - **Bilder:** anklicken → Registerkarte **Bildformat**. Ecke ziehen = Größe, Bild ziehen = verschieben
     (links/mittig/rechts, nach unten). Breite in mm, Ausrichtung, „Text daneben“, Abstand oben, Bild zurücksetzen.
5. **Start/Layout:** Rückgängig/Wiederholen, Schriftgröße der Notiz, Block im Druck ausblenden, Seitenumbruch davor
   erzwingen/verhindern/automatisch, Abstand vor/nach in mm, Block oder ganze Notiz zurücksetzen.
6. **Ansicht:** Zoom, Navigation und Hinweise ein/aus, „Umbrüche zeigen“ markiert manuelle Umbrüche.
7. **Drucken / PDF** (Strg+P): Druckdialog des Browsers, Ziel „Als PDF speichern“, Ränder „Standard“,
   Kopf-/Fußzeilen des Browsers aus. Dateiname: Notizname bzw. „A + B + C“, bei einer Reihenfolgedatei deren Überschrift.
8. **Hinweise** (Statusleiste oder Ansicht): entfernte Plugin-Blöcke, fehlende Bilder, ausgeblendete Abschnitte,
   gelb/rot für Layout-Einträge, die nach einer Textänderung unsicher oder gar nicht zugeordnet wurden.
   Rote Einträge: „Zuweisen …“ und dann den richtigen Block anklicken, oder „Löschen“.

Alles wird sofort in `.lernzettel/` gespeichert. Speichert man die Notiz in Obsidian, aktualisiert sich die Ansicht von selbst.

| Taste | Wirkung |
| --- | --- |
| Strg+Z / Strg+Y | Rückgängig / Wiederholen |
| Strg+Enter | Seitenumbruch vor dem gewählten Block an/aus |
| Entf | gewählten Block (bei Überschrift: ganzen Abschnitt) im Druck ausblenden |
| Strg+P | Drucken / PDF |
| Esc | Auswahl aufheben |

## Stand (Meilensteine der Spezifikation)

| # | Meilenstein | Stand |
| --- | --- | --- |
| 1 | Grundgerüst: Vault, Notizliste, Obsidian-HTML, Theme/Snippets | fertig |
| 2 | Seiten: Paged.js, Druck-Stylesheet, PDF über Druckdialog | fertig, Vergleich mit `_Referenz.pdf` steht aus |
| 3 | Automatisches Layout | teilweise: Abschnitte, Callouts, Tabellen, Listen, Bilder bleiben per CSS zusammen; Leerraum-Regel und gezielte Teilung überlanger Einheiten (Messen) fehlen |
| 4 | Nachjustieren | fertig: Bilder ziehen/skalieren/ausrichten/Textfluss, Umbrüche, Abstände, Schriftgröße, Ausblenden, automatisches Speichern |
| 5 | Verankerung | fertig: Fingerabdrücke, Zuordnung still/gelb/rot, Hinweisliste mit Zuweisen/Löschen, Neu laden |
| 6 | Feinschliff | Druckliste, Reihenfolgedatei, Rückgängig/Wiederholen, Zurücksetzen (Block/Notiz) fertig; Treueprüfung und „Seite zurücksetzen“ fehlen |

## Aufbau

```
src/
  App.tsx                Zustand und Verdrahtung der Oberfläche
  hinweise.ts            Typ der Hinweisliste
  vault/                 Dateizugriff
    vault.ts             Vault-Interface, Pfadhilfen, dateiFinden() (Bildsuche wie Obsidian)
    ordnerVault.ts       echter Ordner (File System Access API)
    demoVault.ts         eingebauter Demo-Vault aus demo/vault/
    speicher.ts          IndexedDB: Ordnerfreigabe merken
    notizen.ts           Notizliste, Frontmatter, Reihenfolgedatei, Filter
  markdown/              Markdown -> HTML im Obsidian-Gerüst
    vorbereiten.ts       Textebene: Frontmatter, %%Kommentare%%, Trennlinien, ^Block-IDs, Tag-Zeilen
    obsidian.ts          markdown-it-Plugin: [[Links]], ![[Bilder]], #tags, Callouts, Aufgaben, Codeblöcke
    umwandeln.ts         markdown-it mit KaTeX, Fußnoten, ==Markierung==
  dokument/
    aufbauen.ts          Ablauf: Notiz(en) -> HTML + Blöcke + Hinweise
    bloecke.ts           Titel, Bild+Beschriftung, Abschnitts-Container, Blöcke mit Fingerabdruck
    diagramme.ts         Mermaid -> SVG
  layout/
    layoutDatei.ts       Format der Layout-Datei, laden/speichern
    zuordnen.ts          Fingerabdrücke abgleichen, Layout im HTML anwenden
    bearbeiten.ts        Layout-Änderungen als reine Funktionen (Basis für Rückgängig)
  stil/
    stil.ts              .obsidian/app.json + appearance.json lesen
    obsidian-basis.css   Obsidian-Standardvariablen (hell)
    druck.css            Seite, Ränder, Schrift, Fußzeile (hat Vorrang)
    vorschau.css         nur Bildschirm: graue Fläche, Umbruch-Modus
  vorschau/
    Vorschau.tsx         zwei iframes im Wechsel + Paged.js, Zoom, Drucken
    interaktion.ts       auf der Seite: auswählen, Rechtsklick, Bilder ziehen und skalieren
  ui/                    Word-Oberfläche: Titelleiste, Menueband (+ Band-Bausteine), Navigationsbereich,
                         Seitenleiste, Druckliste, Gliederung, Hinweise, Statusleiste, Kontextmenue, Datei
demo/vault/              Demo-Vault mit allen Syntax-Fällen der Export-Anweisung
```

## Offene Punkte

- **Schrift:** Noto Sans ist eingestellt (Variable `--druck-schrift` in `src/stil/druck.css`). Klären, ob stattdessen „Anthropic Serif“ gilt.
- **Emojis:** es wird die Emoji-Schrift von Windows genutzt, Noto Color Emoji ist nicht eingebunden.
- **Callout-Icons** fehlen noch (nur Titel).
- **Ausblenden** ist eine Erweiterung des Layout-Formats (`"hidden": true` am Eintrag). Ausgeblendetes erscheint immer
  in den Hinweisen, damit nie unbemerkt Inhalt fehlt.
- **Bildgrößen ohne Angabe** werden nur begrenzt (Textbreite, 45 % Satzspiegel), nicht nach Lesbarkeit gewählt.
- Weitere offene Fragen siehe Spezifikation (Ablage `.lernzettel/`, PWA, Textkorrekturen, Anki).
