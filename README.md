# Énoncé – Karte der Fieldtrips

Drehbare Punktwolkenkarte zum Énoncé théorique (EPFL, Architektur), Victor Stasik.
Website: https://victorstasik-wq.github.io/enonce-karte/

## Aufbau

- `index.html`, `app.js`, `style.css` – die Seite
- `data/fieldtrips.json` – welche Fieldtrips es gibt und welche Dateien dazugehören
- `data/route_F_01.json` – Route F_01 in LV95 (aus `F_01.gpx`, Höhe aus dem Gelände + 4 m)
- `data/stationen_F_01.json` – Stationen von F_01 (noch leer)
- `pointclouds/F_01_gelaende/` – Gelände als Potree-Punktwolke
- `vendor/potree/` – Potree 1.8.2 (nur benötigte Teile). Eine Änderung in `build/potree/potree.js`: der Header
  `content-type: multipart/byteranges` bei den Range-Anfragen ist entfernt, weil GitHub Pages solche Anfragen mit 400 ablehnt.

Direktaufruf einer Station: `index.html?ft=F_01&station=ID`

## Quellen und Lizenzen

- Gelände: swissALTI3D 2024/2025, Bundesamt für Landestopografie swisstopo, © swisstopo.
  Auf 10 m gemittelt (236 Kacheln), Schummerung aus dem Gelände berechnet.
- Route: nach der Wanderung in Strava exakt nachgezeichnet (`F_01.gpx`), nicht per GPS aufgezeichnet. Umrechnung WGS84 → LV95 mit
  den Näherungsformeln von swisstopo (Genauigkeit etwa 1 m).
- Viewer: Potree 1.8.2 (Markus Schütz u. a.), siehe `vendor/potree/LICENSE`. Enthält three.js, jQuery, tween.js, proj4js.
- Konvertierung: PotreeConverter 2.1.1, Kodierung BROTLI.
