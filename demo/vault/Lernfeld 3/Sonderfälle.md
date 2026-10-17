---
lernfeld: 3
status: beispiel
---
# Sonderfälle

Beispiele für Syntax, die beim Umwandeln leicht kaputtgeht. Ein Tag mitten im Satz bleibt sichtbar: Sauerstoffgabe #wichtig bei SpO₂ unter 90 %.

## Code bleibt unverändert

Alles im Codeblock wird wortgleich gedruckt – auch Zeilen, die außerhalb entfernt würden:

```bash
# Kommentarzeile, keine Überschrift
echo "Dosis: 5 mg" ^nicht-entfernen
---
%% bleibt stehen %%
#auch-kein-tag
```

> [!tip] Code im Callout
> ```
> Druck = Kraft / Fläche ^2
> ---
> ```
> ---
> Text nach der Linie im selben Callout.

- Liste mit Code darin:
    ```
    Zeile mit #tag-only
    ---
    ```

## Formeln

$$
A = \pi \cdot r ^2
$$

Eine Formel, die KaTeX nicht kennt, wird nie als Rohcode gedruckt: $\ce{CO2}$

## Aufgaben

- [ ] offen
- [x] erledigt
- [/] angefangen
- [-] abgebrochen
- [>] verschoben

## Bilder

![[lunge.png|160]]

*Abb.: Kursive Zeile im selben Absatz wie ein weiteres Bild*
![[Atemwege.svg|120]]

## Zwei Einbettungen in einem Absatz

Nach dem Einfügen stehen beide in derselben Reihenfolge wie hier:
![[Asthma bronchiale#Ursachen]]
![[copd#Definition]]

##### Kleine Überschrift

Ausblenden der Überschrift blendet auch diesen Text aus.

## Links

Ein Verweis in [eckigen Klammern wie [[Atmung]]] bringt den Aufbau nicht durcheinander, auch nicht in einer Fußnote.^[siehe [[Atmung]]]

Fußnoten bleiben pro Notiz eindeutig.[^1]

[^1]: Gleiche Nummer wie in „Atmung“, trotzdem ein eigener Anker.
