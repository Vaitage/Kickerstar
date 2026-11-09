# Faire Gewichtung im KickerStars-Ranking

Die Grundregel: Pro Spiel gibt es **2 Punkte**. Im **1 gegen 1** bekommt der Sieger beide Punkte, im **2 gegen 2** bekommt jeder der beiden Sieger einen Punkt.

Das ist pro Spiel fair verteilt. Über eine ganze Saison entstehen aber vier Schieflagen. Hier steht, woher sie kommen und wie man sie ausgleichen kann.

---

## Problem 1: Viel spielen schlägt gut spielen

Wer 40 Spiele macht, sammelt fast immer mehr Punkte als jemand mit 12 Spielen, auch wenn dieser fast alle gewinnt. Die **Punkte-Summe** misst also vor allem den *Fleiß*.

**Lösung: Durchschnitt statt Summe.** Man teilt durch die Anzahl der Spiele, zum Beispiel „Punkte pro Spiel“.

## Problem 2: 1:1 bringt doppelt so viel wie 2:2

Ein Sieg im Einzel bringt 2 Punkte, ein Sieg im Doppel nur 1. Wer lieber Einzel spielt, kommt schneller nach oben. Wer meistens im Doppel steht, wird benachteiligt, obwohl er nicht schlechter ist. Darum taugt auch der einfache Schnitt „Punkte pro Spiel“ nicht.

**Lösung: Punktequote.** Man rechnet die geholten Punkte geteilt durch die *möglichen* Punkte:

```
Quote = geholte Punkte / mögliche Punkte
        (mögliche Punkte: je Einzel 2, je Doppel 1)
```

Beispiel: Anna spielt 6 Einzel (4 gewonnen) und 4 Doppel (3 gewonnen).
Sie holt 4×2 + 3×1 = **11** von 6×2 + 4×1 = **16** möglichen Punkten. Das ist eine Quote von **69 %**.

Die Quote hängt weder von der Spielanzahl noch vom Verhältnis Einzel zu Doppel ab. In der App heißt dieser Modus **„Quote“**.

> Variante: Einzel und Doppel getrennt werten (zwei Rankings). Das ist sauber, halbiert aber die Datenmenge je Tabelle.

## Problem 3: Wenige Spiele sind Glückssache

Wer 3 von 3 Spielen gewinnt, hat 100 %, ist aber nicht zwangsläufig besser als jemand mit 80 % aus 40 Spielen.

**Lösung A: Mindestspielzahl** (bereits eingebaut, Standard 10, einstellbar). Erst danach wird man gewertet. Vorher wird man angezeigt, aber ohne Platz.

**Lösung B: Bayes-Durchschnitt** (gleitender Einstieg statt harter Grenze). Jeder startet so, als hätte er schon *m* „Durchschnitts-Spiele“ gemacht:

```
gewichtete Quote = (geholte Punkte + m × Ø-Quote aller) / (mögliche Punkte + m × Ø-mögliche Punkte)
```

Mit m = 5 bleibt ein Neuling mit 3/3 Siegen noch nahe am Durchschnitt. Erst mit mehr Spielen zählt die eigene Leistung voll. Das wäre ein möglicher nächster Ausbauschritt.

## Problem 4: Partner und Gegner sind unterschiedlich stark

Wer im Doppel immer mit dem besten Spieler zusammen spielt oder oft gegen Anfänger antritt, gewinnt leichter. Punkte und Quote sehen nur *ob* man gewonnen hat, nicht *gegen wen*.

**Lösung: Elo-Wertung** (in der App als Modus **„Elo“**, wie im Schach):

1. Jeder startet mit 1000 Punkten.
2. Im Doppel zählt das Team mit dem **Durchschnitt** seiner beiden Spieler.
3. Vor dem Spiel wird die Siegchance berechnet:
   `Erwartung A = 1 / (1 + 10^((Elo B − Elo A) / 400))`
4. Nach dem Spiel bekommt jeder Spieler eines Teams:
   `Änderung = K × (Ergebnis − Erwartung)`  (Ergebnis 1 = Sieg, 0 = Niederlage; K = 32, einstellbar)

Was das bewirkt:
- Ein Sieg gegen Stärkere bringt viel (z. B. +24), ein Sieg gegen Schwächere wenig (z. B. +8).
- Eine Niederlage gegen Schwächere kostet viel.
- Wer mit einem starken Partner gewinnt, bekommt weniger, weil das Team als Favorit galt.
- Die Spielanzahl spielt keine Rolle, und Einzel und Doppel zählen gleich.

Mögliche Erweiterungen:
- **Tordifferenz einbeziehen**: K mit einem Faktor wie `ln(|Tordifferenz| + 1)` multiplizieren. Ein 10:0 zählt dann mehr als ein 10:9.
- **Einzel- und Doppel-Elo getrennt** führen.
- **Inaktivität**: Wer lange nicht gespielt hat, rutscht langsam Richtung 1000 zurück.

---

## Was die App heute macht

| Modus | Bewertet | Fair bei Spielanzahl | Fair bei 1:1 / 2:2 | Berücksichtigt Gegnerstärke |
|---|---|---|---|---|
| **Punkte** | Summe (eure Grundregel) | ✗ | ✗ | ✗ |
| **Quote** | Punkte ÷ mögliche Punkte | ✓ | ✓ | ✗ |
| **Elo** | Spielstärke | ✓ | ✓ | ✓ |

Bei Gleichstand entscheidet in allen Modi: **1. Tordifferenz → 2. mehr Tore → 3. weniger Spiele**.

**Empfehlung:** Für ein faires Vereins-Ranking die **Quote** als Standard nehmen. Sie ist leicht zu erklären („wie viel Prozent der möglichen Punkte hast du geholt?“). Dazu die Mindestspielzahl 10. Elo läuft nebenher für alle, die es genauer wissen wollen. Den Standard stellt ihr unter *Einstellungen → Standard-Sortierung im Ranking* um.
