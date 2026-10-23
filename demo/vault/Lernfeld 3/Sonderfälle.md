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

## Eingerückte Bilder und Tabellen

- Bild unter einem Aufzählungspunkt:
	![[Lunge.png|120]]
- Bild als eigener Absatz im Punkt:

	![[Atemwege.svg|100]]
	*Abb.: Atemwege, eingerückt*
- Tabelle im Punkt:

	| Wert | Norm |
	| --- | --- |
	| AF | 12–20 /min |
	| SpO₂ | ≥ 95 % |

1. Nummerierter Punkt
	1. Tiefer eingerückt mit Bild
		![[Lunge.png|90]]

- Punkt mit Bild direkt vor einer Unterliste
	![[Lunge.png|60]]
	- Unterpunkt bleibt unter dem Bild
- Eingefügte Notiz im Punkt (bleibt ein Block am Stück):
	![[Atmung#Normwerte]]

> [!note] Bild und Tabelle im Callout
> ![[Atemwege.svg|100]]
>
> | Gas | Anteil |
> | --- | --- |
> | O₂ | 21 % |

> Zitat mit Bild
> ![[Lunge.png|100]]

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
