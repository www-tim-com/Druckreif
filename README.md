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

1. **Datei:** Vault-Ordner öffnen (wird gemerkt), Demo-Vault, alle **Mappen** öffnen oder löschen, Infos zu Theme und
   Snippets. Der Vault wird nur gebraucht, damit der Editor Bilder, Theme und Layout-Dateien findet.
2. **Mappen** sind deine Dokumente: eine benannte Zusammenstellung von Notizen, gespeichert in `.lernzettel/mappen.json`.
   Offene Mappen stehen als **Reiter** über den Seiten (Doppelklick = umbenennen, „+“ = neue Mappe, × = schließen).
3. **Dokument durchsuchen** (Strg+F, oben im Navigationsbereich): Treffer werden auf den Seiten markiert und mit
   Seitenzahl aufgelistet; Enter/F3 = nächster, Umschalt+Enter/Umschalt+F3 = vorheriger Treffer, Esc leert die Suche.
   **Navigation › Notizen:** Klick auf eine Notiz hängt sie an die aktive Mappe (steht sie schon drin: Sprung dorthin).
   Das Ordner-Symbol beim Darüberfahren öffnet die Notiz in einer neuen Mappe. Suche nach Titel, Filter nach
   Frontmatter (`lernfeld: 3`). Notizen mit ☰ sind Reihenfolgedateien aus Obsidian und stehen für ihre Notizen.
4. **Navigation › Mappe:** Reihenfolge per Ziehen, × entfernt. Pro Notiz: Seiten-Symbol = beginnt auf **neuer Seite**
   oder **schließt direkt an**; Pfeil aufklappen = **nur einzelne ##-Abschnitte** übernehmen (Häkchen). Ein Auszug steht
   immer in den Hinweisen.
5. **Navigation › Überschriften:** Klick springt zur Stelle. Das **Auge** blendet einen ganzen Abschnitt im Druck aus,
   z. B. „Quellen“. Ausgeblendetes steht immer in den Hinweisen und lässt sich dort wieder einblenden.
   **Navigation › Seiten:** Miniaturen aller Seiten, Klick springt hin; ⚠ markiert halb leere Seiten.
6. **Auf der Seite:** Block anklicken = auswählen, **Rechtsklick** = Kontextmenü (Seitenumbruch, ausblenden, Bild ausrichten, zurücksetzen).
   - **Bilder:** anklicken → Registerkarte **Bildformat**. Ecke ziehen = Größe, Bild ziehen = verschieben
     (links/mittig/rechts, nach unten). Breite in mm, Ausrichtung, „Text daneben“, Abstand oben, Bild zurücksetzen.
   - **Tabellen:** anklicken → Registerkarte **Tabellenlayout**. Spaltengrenzen und rechten Rand ziehen; Breite in %,
     Ausrichtung, Spalten automatisch, Schriftgröße, kompakte Zeilen, „Über Seiten teilen“, Tabelle zurücksetzen.
7. **Start:** Rückgängig/Wiederholen, **Schriftgröße und Zeilenabstand** der Auswahl (ohne Auswahl: der Notiz), Block
   im Druck ausblenden, Seitenumbruch, **Aktualisieren** (F5), Drucken.
8. **Layout:** Seitenumbruch davor erzwingen/verhindern/automatisch, **Teilen erlauben** (Abschnitt, Liste, Callout,
   Codeblock oder Tabelle darf über Seiten laufen), Abstand vor/nach in mm, Block zurücksetzen, Grundschrift und
   Zeilenabstand der Notiz, Layout der Notiz zurücksetzen. Gruppe **Mappe:**
   - **Automatisch formatieren:** Seitenzahl eingeben – die größte Grundschrift (12–8 pt, Zeilenabstand passend), bei der
     alles auf diese Seitenzahl passt, wird ausprobiert und als normale Notiz-Einstellung gespeichert. Danach frei
     änderbar; Strg+Z nimmt es für alle Notizen in einem Schritt zurück.
   - **Tinte sparen:** Callouts und Tabellenköpfe ohne farbige Flächen, in Graustufen (pro Mappe gespeichert).
   Gruppe **Zurücksetzen:** „Seite N zurücksetzen“ verwirft alle manuellen Änderungen an Blöcken dieser Seite (Seite
   des gewählten Blocks, sonst die sichtbare; ein Umbruch am Seitenende zählt mit). „Alles zurücksetzen“ fängt komplett
   neu an: Layout aller Notizen der Mappe, „Direkt anschließen“ und „Tinte sparen“. Notizen, Reihenfolge, Auszüge und
   eingefügte Notizen bleiben.
9. **Ansicht:** Zoom, Navigation und Hinweise ein/aus, „Umbrüche zeigen“, Aktualisieren.
10. **Aktualisieren** (F5): liest den Vault neu ein – geänderte Notizen, neue/verschobene/ersetzte Bilder, Theme,
    Snippets, Mappen. Geänderte Notizen und Bilder werden zusätzlich alle 1,5 s automatisch erkannt.
11. **Drucken / PDF** (Strg+P): Druckdialog des Browsers, Ziel „Als PDF speichern“, Ränder „Standard“,
   Kopf-/Fußzeilen des Browsers aus. Dateiname = Name der Mappe.
12. **Hinweise** (Statusleiste oder Ansicht): entfernte Plugin-Blöcke, fehlende Bilder, ausgeblendete Abschnitte,
   gelb/rot für Layout-Einträge, die nach einer Textänderung unsicher oder gar nicht zugeordnet wurden.
   Rote Einträge: „Zuweisen …“ und dann den richtigen Block anklicken, oder „Löschen“.
   - **Leerraum:** Seiten, die zu mindestens 40 % leer bleiben, weil die nächste Seite mit einem Umbruch beginnt, sind auf
     der Seite schraffiert und stehen hier – mit passendem Knopf: „Umbruch entfernen“ (manueller Umbruch), „Notiz direkt
     anschließen“, „Teilen erlauben“/„Tabelle teilen“ (Einheit, die am Stück bleiben sollte) oder „Bild auswählen“.
   - **Eingebettete Notizen** `![[Notiz]]` bzw. `![[Notiz#Abschnitt]]` werden nicht automatisch eingefügt. Auf der Seite
     steht an der Stelle ein Hinweis (nur Bildschirm); Klick darauf oder „Einfügen“ in den Hinweisen fügt den Inhalt ein,
     „Nicht einfügen“ nimmt ihn wieder heraus. Die Wahl steht in der Layout-Datei der Notiz.

**Rückgängig** (Strg+Z/Strg+Y) gilt für alle Änderungen an Layout und Mappe: Umbrüche, Bilder, Schrift, automatisch
formatieren, Tinte sparen, Notizen hinzufügen/entfernen/verschieben, anschließen, Auszüge, Zurücksetzen.
Alles wird sofort in `.lernzettel/` gespeichert. Speichert man die Notiz in Obsidian, aktualisiert sich die Ansicht von selbst.

| Taste | Wirkung |
| --- | --- |
| Strg+Z / Strg+Y | Rückgängig / Wiederholen |
| Strg+Enter | Seitenumbruch vor dem gewählten Block an/aus |
| Entf | gewählten Block (bei Überschrift: ganzen Abschnitt) im Druck ausblenden |
| Strg+P | Drucken / PDF |
| Strg+F, F3 | Dokument durchsuchen, nächster Treffer |
| F5 | Aktualisieren |
| Esc | Auswahl aufheben |

## Stand (Meilensteine der Spezifikation)

| # | Meilenstein | Stand |
| --- | --- | --- |
| 1 | Grundgerüst: Vault, Notizliste, Obsidian-HTML, Theme/Snippets | fertig |
| 2 | Seiten: Paged.js, Druck-Stylesheet, PDF über Druckdialog | fertig, Vergleich mit `_Referenz.pdf` steht aus |
| 3 | Automatisches Layout | Abschnitte, Kapitel ohne ###, Callouts, Tabellen, Listen, Bilder bleiben per CSS zusammen; Leerraum wird gemessen und gemeldet (Beheben per Knopf), „Automatisch formatieren“ auf N Seiten; automatische Teilung ohne Nachfrage fehlt |
| 4 | Nachjustieren | fertig: Bilder ziehen/skalieren/ausrichten/Textfluss, Umbrüche, Abstände, Schriftgröße, Ausblenden, automatisches Speichern |
| 5 | Verankerung | fertig: Fingerabdrücke, Zuordnung still/gelb/rot, Hinweisliste mit Zuweisen/Löschen, Neu laden |
| 6 | Feinschliff | Mappen mit Reitern (Auszüge, direkt anschließen), Aktualisieren, Tabellen, Schrift/Zeilenabstand, Reihenfolgedatei, Rückgängig/Wiederholen (auch für Mappen), Zurücksetzen (Block/Seite/Notiz/alles) fertig; Treueprüfung fehlt |

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
  mappen/mappen.ts       Mappen (.lernzettel/mappen.json): Notizen, neue Seite/anschließen, Auszüge
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
    leerraum.ts          halb leere Seiten finden und markieren
    suche.ts             Suchen im Dokument (Strg+F)
  ui/                    Word-Oberfläche: Titelleiste, Menueband (+ Band-Bausteine), Navigationsbereich,
                         Mappenreiter, MappeBereich, Seitenleiste, Gliederung, Seitenminiaturen, Hinweise, Statusleiste,
                         Kontextmenue, Datei
demo/vault/              Demo-Vault mit allen Syntax-Fällen der Export-Anweisung
```

## Offene Punkte

- **Schrift:** Noto Sans ist eingestellt (Variable `--druck-schrift` in `src/stil/druck.css`). Klären, ob stattdessen „Anthropic Serif“ gilt.
- **Emojis:** es wird die Emoji-Schrift von Windows genutzt, Noto Color Emoji ist nicht eingebunden.
- **Callout-Icons** fehlen noch (nur Titel).
- **Erweiterungen des Layout-Formats:** `hidden`, `fontSizePt`/`lineHeight` am Block, `split` am Block,
  `settings.lineHeight`, `settings.embeds` (eingefügte Notizen), `table` (`widthPct`, `align`, `columnsPct`, `fontSizePt`,
  `compact`, `split`), `index` auch im Anker von Bildern (unterscheidet Kopien desselben Bildes im Abschnitt).
  Ältere Dateien bleiben gültig. In `mappen.json`: `inkSaving` pro Mappe.
- **Tabellen über Seiten:** Paged.js wiederholt die Kopfzeile auf der Folgeseite nicht zuverlässig.
- **Ausblenden und Auszüge** nehmen Inhalt aus dem Druck – nur auf ausdrücklichen Wunsch. Ausgeblendetes erscheint immer
  in den Hinweisen, damit nie unbemerkt Inhalt fehlt.
- **Bildgrößen ohne Angabe** werden nur begrenzt (Textbreite, 45 % Satzspiegel), nicht nach Lesbarkeit gewählt.
- Weitere offene Fragen siehe Spezifikation (Ablage `.lernzettel/`, PWA, Textkorrekturen, Anki).
