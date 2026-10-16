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

- Paged.js versteht kein `:is()`/`:where()` in CSS → Selektoren ausschreiben.
- Paged.js löst `url()` gegen `about:srcdoc` auf → `urlsAbsolut()` in `Vorschau.tsx`.
- Paged.js verwirft `@media screen` aus verarbeiteten Stylesheets → `vorschau.css` wird erst nach dem Umbruch eingefügt.
- Vites `import.meta.glob` übersieht Ordner mit Punkt → Dateien aus `demo/vault/.obsidian/` in `demoVault.ts` einzeln importieren.
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
- Layout-Dateien, die sich nicht lesen lassen, sind gesperrt (`NotizTeil.layoutKaputt`) – nie überschreiben.

## Prüfen

```bash
npm run check        # TypeScript
npm run build        # Produktionsbuild nach dist/
npm run dev          # http://localhost:5173/?demo
```

- Keine Test-Suite. Prüfen im Browser mit dem Demo-Vault (Playwright: Chromium unter `/opt/pw-browsers` falls vorhanden).
  Testskripte und Screenshots ins Scratchpad, nicht ins Projekt.
- Neue Obsidian-Syntax immer auch als Beispiel in `demo/vault/` aufnehmen.
