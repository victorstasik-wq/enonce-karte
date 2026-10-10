# Énoncé – Karte der Fieldtrips

Drehbare 3D-Geländekarte zum Énoncé théorique (EPFL, Architektur), Victor Stasik.
Website: https://victorstasik-wq.github.io/enonce-karte/

## Aufbau

- `index.html`, `app.js`, `style.css` – die Seite
- `data/fieldtrips.json` – welche Fieldtrips es gibt und welche Dateien dazugehören
- `data/route_F_01.json` – Route F_01 in LV95 (aus `F_01.gpx`, Höhe aus dem Gelände + 4 m)
- `data/stationen_F_01.json` – Stationen von F_01
- `photos/` – Fotos der Stationen (900 px, im Infoblatt); `photos/gross/` – dieselben Fotos mit 1800 px für das Foto-Fenster
  (Klick auf ein Foto: Fenster 70 % × 70 %, weiss mit 80 % Deckkraft; Umblättern wie in einem Notizbuch mit Rücken links, mit Pfeilen, Tastatur oder Wischen).
  Neue Fotos: in `rohdaten/<Station>/fotos` legen, Legenden in `station.txt`; sie werden verkleinert und in
  `data/stationen_F_01.json` eingetragen (`datei`, `gross`, `legende`).
- `pointclouds/F_01_v18/basis_10m/` – Gelände als Potree-Punktwolke, 10-m-Punkte (ausserhalb der dichten Zone)
- `pointclouds/F_01_v18/2m/dicht_EEEE_NNNN/` – gemessene 2-m-Punkte (swissALTI3D) im Gelände um Route und Station, in 4-km-Blöcken.
  Der Rand folgt wo möglich Graten und Einzugsgebietsgrenzen (Wasserscheiden der geglätteten Geländeoberfläche),
  begrenzt auf die Umgebung der Route und auf die vorhandenen 2-m-Kacheln. Grauwerte = berechnete Schattierung
  (Licht Nordwest 35°, weiche Schlagschatten, Himmelssicht, lokales Relief)
- Aufbau-Animation: Die Punktwolke verdichtet sich überall gleichzeitig. Jeder Punkt trägt im Attribut `point source id`
  eine zufällige Erscheinungszeit (0–1008, 64 Stufen); `app.js` blendet die Punkte über den Point-Source-ID-Filter von
  Potree in etwa 7 s ein (zuerst wenige, dann immer mehr), sobald die erste Ansicht geladen ist (spätestens nach 6 s).
- `drehen.js` – Kamerasteuerung ohne Verschieben: Ziehen dreht/kippt um den Drehpunkt; Zoomen geht zur Stelle unter der
  Maus, die dabei zum neuen Drehpunkt wird. Beim Herauszoomen gleitet der Drehpunkt zurück zur Mitte (ab 25 km genau Mitte).
  Station öffnen: Drehpunkt = Station; Blatt schliessen: Rückflug zur Gesamtansicht.
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
