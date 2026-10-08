# Énoncé – Karte der Fieldtrips

Drehbare 3D-Geländekarte zum Énoncé théorique (EPFL, Architektur), Victor Stasik.
Website: https://victorstasik-wq.github.io/enonce-karte/

## Aufbau

- `index.html`, `app.js`, `style.css` – die Seite
- `data/fieldtrips.json` – welche Fieldtrips es gibt und welche Dateien dazugehören
- `data/route_F_01.json` – Route F_01 in LV95 (aus `F_01.gpx`, Höhe aus dem Gelände + 4 m)
- `data/stationen_F_01.json` – Stationen von F_01
- `photos/` – Fotos der Stationen (900 px)
- `flaeche.js` + `terrain/` – Gelände als Fläche (aktuelle Darstellung): `F_01_hoehen_10m.bin` = 10-m-Höhenraster
  (1600 × 1600, Uint16 in Dezimetern, 0 = keine Daten, Zeile 0 = Süden), `F_01_modell.jpg` = vorgerechnete Schattierung
  (4096 px über 16 km; Licht Nordwest 35°, weiche Schlagschatten, Himmelssicht)
- `pointclouds/F_01_gelaende/` – Gelände als Potree-Punktwolke (frühere Darstellung, wird nur ohne `flaeche` geladen)
- `vendor/potree/` – Potree 1.8.2 (nur benötigte Teile). Eine Änderung in `build/potree/potree.js`: der Header
  `content-type: multipart/byteranges` bei den Range-Anfragen ist entfernt, weil GitHub Pages solche Anfragen mit 400 ablehnt.

Direktaufruf einer Station: `index.html?ft=F_01&station=ID`

## Quellen und Lizenzen

- Gelände: swissALTI3D 2024/2025, Bundesamt für Landestopografie swisstopo, © swisstopo.
  Auf 10 m gemittelt (236 Kacheln). Zwischen den 10-m-Punkten wird die Fläche geglättet; feinere Formen sind nicht in den Daten.
  Schattierung aus dem Gelände berechnet.
- Route: nach der Wanderung in Strava exakt nachgezeichnet (`F_01.gpx`), nicht per GPS aufgezeichnet. Umrechnung WGS84 → LV95 mit
  den Näherungsformeln von swisstopo (Genauigkeit etwa 1 m).
- Viewer: Potree 1.8.2 (Markus Schütz u. a.), siehe `vendor/potree/LICENSE`. Enthält three.js, jQuery, tween.js, proj4js.
- Konvertierung: PotreeConverter 2.1.1, Kodierung BROTLI.
