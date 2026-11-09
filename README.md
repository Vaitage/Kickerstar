# ⚽ KickerStars

Lokale Tischkicker-Liga für den Verein: anmelden mit Namen, Tisch wählen, Spiele 1 gegen 1 oder 2 gegen 2 eintragen. Dazu gibt es eine Live-Übersicht aller Tische und ein Ranking mit Punkten, Quote, Elo und Tordifferenz.

## Funktionen

- **Spielleiter mit PIN:** Beim ersten Start wird eine Spielleiter-PIN festgelegt. Nur der Spielleiter trägt Spieler ein (auch mehrere auf einmal), benennt sie um, ändert Einstellungen und löscht Spiele.
- **Anmeldung der Spieler** durch Antippen des eigenen Namens. Spieler können Spiele starten, Ergebnisse eintragen und laufende Spiele abbrechen.
- **Tische:** 3 Tische voreingestellt, Anzahl und Namen sind änderbar.
- **Spiel starten:** Tisch, Modus 1:1 oder 2:2, Spieler per Dropdown. Belegte Tische und Spieler, die gerade spielen, sind gesperrt.
- **Ergebnis eintragen mit 3 Tipps:** Gewinner antippen (bekommt automatisch 10 Tore), Tore des Verlierers antippen (0–9), Speichern. Für Ausnahmen gibt es „Anderes Ergebnis eintragen“ mit +/−. Die Tore zum Sieg sind einstellbar.
- **Punkte:** 1:1-Sieg = 2 Punkte, 2:2-Sieg = 1 Punkt für jeden Sieger (einstellbar).
- **Tore und Tordifferenz** pro Spieler, im Doppel zählen die Teamtore für beide.
- **Ranking** wahlweise nach Punkten, Quote oder Elo, mit Podium und Formkurve (letzte 5 Spiele).
- **Mindestspielzahl** (Standard 10). Darunter wird man angezeigt, aber nicht gewertet (einstellbar).
- **Statistik** mit Zeitfilter (Alle, 30 Tage, 7 Tage, Heute): Kennzahlen, Spiele pro Tag, Uhrzeiten, Tische, Ergebnisverteilung, Blau gegen Rot, Rekorde und Bestenlisten (Siegesserie, meiste Spiele und Tore, bestes Duo, größte Rivalität).
- **Spielerseite** mit Statistik, bestem Partner, Angstgegner und Elo-Verlauf pro Spiel.
- **Sicherung** als JSON herunterladen und wieder laden.
- Installierbar als App (PWA), funktioniert **offline**.

> Die PIN schützt vor versehentlichen Änderungen, sie ist kein Bankschutz. Im Lokal-Modus liegt sie im Browser des Geräts. Im Server-Modus prüft der Server sie und gibt sie nie heraus. PIN vergessen? Im Server-Modus `adminPin` in `data/state.json` leeren und den Server neu starten. Im Lokal-Modus hilft nur, die Browserdaten der Seite zu löschen (vorher eine Sicherung machen).
>
> In der **Demo** (Knopf beim ersten Start) lautet die Spielleiter-PIN **1234**.

Wie die faire Gewichtung funktioniert, steht in [docs/GEWICHTUNG.md](docs/GEWICHTUNG.md).

## Zwei Betriebsarten

Die App erkennt selbst, ob ein KickerStars-Server da ist.

| | **Lokal (Handy)** | **Server (Laptop/Pi + Tailscale)** |
|---|---|---|
| Daten liegen | im Browser des Handys | in `data/state.json` auf dem Server |
| Mehrere Geräte | nein, ein Handy für alle | ja, alle sehen live dasselbe |
| Start | Seite öffnen | `node server.js` |

Der Umzug von Lokal auf Server geht so: Auf dem Handy unter *Einstellungen → Sicherung herunterladen* speichern, dann in der Server-Version *Sicherung laden*.

### A) Auf dem Android-Handy

Eine PWA braucht `https://` oder `localhost`. Es gibt zwei Wege:

**1. Über GitHub Pages** (am einfachsten, Daten bleiben trotzdem nur auf dem Handy)
Repo → *Settings → Pages* → Source „Deploy from a branch“, Branch `gh-pages`, Ordner `/ (root)`. Der Branch `gh-pages` enthält den Inhalt von `public/`.
Danach `https://vaitage.github.io/Kickerstar/` in Chrome öffnen und über das Menü **„App installieren“** wählen.
(Pages für private Repos braucht GitHub Pro. Sonst das Repo öffentlich schalten oder Weg 2 nehmen.)

**2. Mit Termux direkt auf dem Handy** (komplett ohne Internet)
```bash
pkg install nodejs git
git clone https://github.com/Vaitage/Kickerstar.git
cd Kickerstar && node server.js
```
Dann in Chrome `http://localhost:8080` öffnen und **„App installieren“** wählen. In diesem Fall läuft die App im Server-Modus auf dem Handy selbst.

### B) Auf dem Laptop / Pi mit Tailscale

```bash
git clone https://github.com/Vaitage/Kickerstar.git
cd Kickerstar
node server.js            # braucht Node 18+, keine weiteren Pakete
# oder mit Docker:
docker compose up -d
```
Die Handys im Tailnet öffnen `http://<tailscale-name>:8080`.
Für „App installieren“ auf Android ist https nötig. Das geht mit `tailscale serve --bg 8080`, danach die App unter `https://<name>.<tailnet>.ts.net` öffnen.

## Design

Der Hintergrund ist ein Kickertisch in der Draufsicht mit Rasen, Linien, Stangen, roten und blauen Figuren und Ball. Er wird von `tools/make_bg.py` als SVG erzeugt (`public/img/`). Die Bedienelemente sind in Metall/Silber gehalten.
Das vorige Design ist im Branch `backup/design-v1` gesichert.

## Entwicklung

```bash
npm test        # Tests der Spiel- und Ranking-Logik
npm start       # Server auf Port 8080 (PORT=… zum Ändern)
```

Aufbau:
- `public/core.js` – Spielregeln, Punkte, Ranking, Elo (läuft im Browser **und** im Server)
- `public/store.js` – Datenhaltung lokal oder per Server
- `public/app.js`, `index.html`, `styles.css` – Oberfläche
- `server.js` – kleiner Node-Server ohne Abhängigkeiten
