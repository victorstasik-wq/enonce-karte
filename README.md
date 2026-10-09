# Énoncé – Karte der Fieldtrips

Drehbare 3D-Geländekarte zum Énoncé théorique (EPFL, Architektur), Victor Stasik.
Website: https://victorstasik-wq.github.io/enonce-karte/

## Aufbau

- `index.html`, `app.js`, `style.css` – die Seite
- `data/fieldtrips.json` – welche Fieldtrips es gibt und welche Dateien dazugehören
- `data/route_F_01.json` – Route F_01 in LV95 (aus `F_01.gpx`, Höhe aus dem Gelände + 4 m)
- `data/stationen_F_01.json` – Stationen von F_01
- `photos/` – Fotos der Stationen (900 px)
- `pointclouds/F_01_v15/basis_10m/` – Gelände als Potree-Punktwolke, 10-m-Punkte (ausserhalb der dichten Zone)
- `pointclouds/F_01_v15/2m/dicht_EEEE_NNNN/` – gemessene 2-m-Punkte (swissALTI3D) entlang der Route (±500 m) und
  im Umkreis von 2 km um die Stationen, in 4-km-Blöcken. Grauwerte = berechnete Schattierung
  (Licht Nordwest 35°, weiche Schlagschatten, Himmelssicht, lokales Relief)
- Aufbau-Animation: jeder Punkt trägt im Attribut `point source id` eine Wachstumszeit (0–1000), berechnet als Laufzeit
  (Fast Marching) von der Route aus über ein aderartiges Rauschfeld. `app.js` blendet die Punkte über den
  Point-Source-ID-Filter von Potree in etwa 9 s ein, sobald die erste Ansicht geladen ist (spätestens nach 6 s).
- `flaeche.js` – alternative Darstellung als geschlossene Fläche (zurzeit nicht genutzt; wird nur mit `flaeche`
  in `fieldtrips.json` geladen)
- `vendor/potree/` – Potree 1.8.2 (nur benötigte Teile). Eine Änderung in `build/potree/potree.js`: der Header
  `content-type: multipart/byteranges` bei den Range-Anfragen ist entfernt, weil GitHub Pages solche Anfragen mit 400 ablehnt.

Direktaufruf einer Station: `index.html?ft=F_01&station=ID`

## Quellen und Lizenzen

- Gelände: swissALTI3D 2024/2025, Bundesamt für Landestopografie swisstopo, © swisstopo.
  Entlang der Route 2-m-Kacheln (240), sonst auf 10 m gemittelt (236 Kacheln). Zwischen den Messpunkten wird die Fläche geglättet; feinere Formen als die Rasterweite sind nicht in den Daten.
  Schattierung aus dem Gelände berechnet.
- Route: nach der Wanderung in Strava exakt nachgezeichnet (`F_01.gpx`), nicht per GPS aufgezeichnet. Umrechnung WGS84 → LV95 mit
  den Näherungsformeln von swisstopo (Genauigkeit etwa 1 m).
- Viewer: Potree 1.8.2 (Markus Schütz u. a.), siehe `vendor/potree/LICENSE`. Enthält three.js, jQuery, tween.js, proj4js.
- Konvertierung: PotreeConverter 2.1.1, Kodierung BROTLI.
