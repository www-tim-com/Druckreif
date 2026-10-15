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

1. **Vault öffnen:** Ordner wählen; beim nächsten Start „… wieder öffnen“. Der Vault wird nur gebraucht,
   damit der Editor Bilder, Theme und Layout-Dateien findet – gedruckt wird immer nur, was du auswählst.
2. **Notizen wählen:** Klick auf eine Notiz = Dokument aus genau dieser Notiz. Mit „+“ (erscheint beim Darüberfahren)
   weitere Notizen anhängen. Die Liste „Im Dokument“ oben links zeigt die Reihenfolge; ↑ ↓ sortieren, × entfernen.
   Jede Notiz beginnt auf einer neuen Seite, die Seitenzahlen laufen durch. Die Liste wird pro Vault gemerkt.
   Suche nach Titel und Filter nach Frontmatter (`lernfeld: 3`, `status: fertig`) helfen beim Finden.
   Notizen mit ☰ sind Reihenfolgedateien aus Obsidian (Überschrift + Liste von `[[Links]]`) und stehen für ihre Notizen.
3. **Vorschau:** echte A4-Seiten mit Theme, Snippets und Akzentfarbe aus `.obsidian/`.
4. **Nachjustieren:** „Umbrüche setzen“ einschalten, dann auf einen Block klicken = Seitenumbruch davor an/aus.
   Schriftgröße pro Notiz. Alles wird sofort gespeichert. „Layout zurücksetzen“ verwirft die Änderungen der Notiz.
5. **Drucken / PDF:** Druckdialog des Browsers, Ziel „Als PDF speichern“. Dateiname: Notizname bzw. „A + B + C“,
   bei einer Reihenfolgedatei deren Überschrift. Ränder „Standard“, Kopf-/Fußzeilen des Browsers aus.
6. **Hinweise** unten: entfernte Plugin-Blöcke und eingebettete Notizen, fehlende Bilder,
   gelb/rot für Layout-Einträge, die nach einer Textänderung unsicher oder gar nicht zugeordnet werden konnten.
   Wird die Notiz in Obsidian gespeichert, aktualisiert sich die Vorschau von selbst.

## Stand (Meilensteine der Spezifikation)

| # | Meilenstein | Stand |
| --- | --- | --- |
| 1 | Grundgerüst: Vault, Notizliste, Obsidian-HTML, Theme/Snippets | fertig |
| 2 | Seiten: Paged.js, Druck-Stylesheet, PDF über Druckdialog | fertig, Vergleich mit `_Referenz.pdf` steht aus |
| 3 | Automatisches Layout: Einheiten messen, Umbruch- und Bildregeln | nur Grundlage per CSS (`break-inside: avoid`, Abschnitts-Container) |
| 4 | Nachjustieren | Umbrüche, Schriftgröße, Speichern fertig; Bilder ziehen/skalieren und Abstände fehlen in der Oberfläche (Datei-Format und Anwendung sind da) |
| 5 | Verankerung | Fingerabdrücke, Zuordnung (still/gelb/rot), Hinweisliste, Neu laden fertig; „rot per Klick zuweisen“ fehlt |
| 6 | Feinschliff | Druckliste (mehrere Notizen), Reihenfolgedatei und Layout zurücksetzen fertig; Rückgängig, Treueprüfung fehlen |

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
  vorschau/Vorschau.tsx  iframe + Paged.js, Drucken
  ui/                    Seitenleiste, Druckliste, Hinweise
demo/vault/              Demo-Vault mit allen Syntax-Fällen der Export-Anweisung
```

## Offene Punkte

- **Schrift:** Noto Sans ist eingestellt (Variable `--druck-schrift` in `src/stil/druck.css`). Klären, ob stattdessen „Anthropic Serif“ gilt.
- **Emojis:** es wird die Emoji-Schrift von Windows genutzt, Noto Color Emoji ist nicht eingebunden.
- **Callout-Icons** fehlen noch (nur Titel).
- **Bildgrößen ohne Angabe** werden nur begrenzt (Textbreite, 45 % Satzspiegel), nicht nach Lesbarkeit gewählt.
- Weitere offene Fragen siehe Spezifikation (Ablage `.lernzettel/`, PWA, Textkorrekturen, Anki).
