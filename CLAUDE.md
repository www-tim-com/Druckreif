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
`dokument/aufbauen.ts` steuert den Ablauf, `App.tsx` hält nur Zustand.

## Stolperfallen

- Paged.js versteht kein `:is()`/`:where()` in CSS → Selektoren ausschreiben.
- Paged.js löst `url()` gegen `about:srcdoc` auf → `urlsAbsolut()` in `Vorschau.tsx`.
- Paged.js verwirft `@media screen` aus verarbeiteten Stylesheets → `vorschau.css` wird erst nach dem Umbruch eingefügt.
- Vites `import.meta.glob` übersieht Ordner mit Punkt → Dateien aus `demo/vault/.obsidian/` in `demoVault.ts` einzeln importieren.
- Die Polyfill-Datei von Paged.js ist nicht über `exports` freigegeben → Import über `/node_modules/...?url`.

## Prüfen

```bash
npm run check        # TypeScript
npm run build        # Produktionsbuild nach dist/
npm run dev          # http://localhost:5173/?demo
```

- Keine Test-Suite. Prüfen im Browser mit dem Demo-Vault (Playwright: Chromium unter `/opt/pw-browsers` falls vorhanden).
  Testskripte und Screenshots ins Scratchpad, nicht ins Projekt.
- Neue Obsidian-Syntax immer auch als Beispiel in `demo/vault/` aufnehmen.
