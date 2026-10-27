# Énoncé – Karte der Fieldtrips

Drehbare 3D-Geländekarte zum Énoncé théorique (EPFL, Architektur), Victor Stasik.
Website: https://victorstasik-wq.github.io/enonce-karte/

## Aufbau

- `index.html`, `start.js` – Startseite „Assembled Periphery (Archive)“: Titel, Einleitung (Platzhalter), Liste der Fieldtrips,
  im Hintergrund dreht sich langsam das Gelände von Fieldtrip 01. Alte Links `index.html?ft=…` leiten zur Karte weiter.
- `karte.html`, `app.js`, `style.css` – die Fieldtrip-Karte
- `data/fieldtrips.json` – welche Fieldtrips es gibt und welche Dateien dazugehören
- `data/route_F_01.json` – Route F_01 in LV95 (aus `F_01.gpx`, Höhe aus dem Gelände + 4 m)
- `data/stationen_F_01.json` – Stationen von F_01
- `photos/` – Fotos der Stationen (900 px, im Infoblatt); `photos/gross/` – dieselben Fotos mit 1800 px für das Foto-Fenster
  (Klick auf ein Foto: hochkantiges Fenster, 92 % der Bildschirmhöhe, weiss mit 90 % Deckkraft, Fotos ohne Rand; blättern mit Pfeilen, Tastatur oder Wischen). Das Infoblatt ist ebenfalls weiss mit 90 % Deckkraft.
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
- Fieldtrip 02 (Cabane de Chanrion) und Fieldtrip 03 (Mauvoisin – Le Châble) teilen sich ein durchgehendes Gelände
  im Val de Bagnes: `pointclouds/F_23_v1/` (`basis_10m`, `2m/dicht_*` in 21 Blöcken, `gletscher_B82-27` = Glacier d'Otemma,
  `gletscher_B82-14` = Glacier du Giétro, je `grau`/`farbig`). Gelände: swissALTI3D 2 m, E 2574–2605 / N 1082–1107 km
  (264 Kacheln von F2 + 122 neue für F3), NE-Schnitt von F2 beibehalten; Maske um beide Routen (±500 m) und Station F2_01.
  Gletscherumrisse aus SGI2016 (GLAMOS): `data/gletscher_F2_01.json` (Otemma), `data/gletscher_F3_gietro.json` (Giétro).
  Routen: `data/route_F_02.json`, `data/route_F_03.json` (aus `rohdaten/gpx/F_03.gpx`, Höhen aus dem 2-m-Modell).
  In `fieldtrips.json` zeigt `weitere_routen` die jeweils andere Route gestrichelt und blass an.
  Stationen: `data/stationen_F_02.json`, `data/stationen_F_03.json` (noch leer).
  Build-Skripte: `rohdaten/gelaende/build_F_23/`. Die alten Ordner `pointclouds/F_02_v2/` und `F2_01_gletscher_v2/` werden nicht mehr verwendet.
- `flaeche.js` – alternative Darstellung als geschlossene Fläche (zurzeit nicht genutzt; wird nur mit `flaeche`
  in `fieldtrips.json` geladen)
- `vendor/potree/` – Potree 1.8.2 (nur benötigte Teile). Eine Änderung in `build/potree/potree.js`: der Header
  `content-type: multipart/byteranges` bei den Range-Anfragen ist entfernt, weil GitHub Pages solche Anfragen mit 400 ablehnt.

Direktaufruf einer Station: `karte.html?ft=F_01&station=ID`

## Seite „Énoncé“ (`enonce.html`, `enonce.css`, `enonce.js`)

Inhaltsverzeichnis (Victors Gliederung vom 21.10.2026, englische Titel als Vorschlag von Claude) und das Diagramm
„Anatomie der Arbeit“ (v8 vom 21.10.2026) als `data/anatomie_der_arbeit.svg`. Das SVG ist die Fassung aus dem Artifact,
nur umgefärbt auf den dunklen Grund der Website: Grautöne umgekehrt, Weiss → #0f1113, Rot → Stationsorange #ff6400;
in der Lesehilfe „schwarz“ → „weiss“. Menüeintrag über `uebersicht` in `data/fieldtrips.json`.

## Quellen und Lizenzen

- Gelände: swissALTI3D 2024/2025, Bundesamt für Landestopografie swisstopo, © swisstopo.
  Entlang der Route 2-m-Kacheln (240), sonst auf 10 m gemittelt (236 Kacheln). Zwischen den Messpunkten wird die Fläche geglättet; feinere Formen als die Rasterweite sind nicht in den Daten.
  Schattierung aus dem Gelände berechnet.
- Route: nach der Wanderung in Strava exakt nachgezeichnet (`F_01.gpx`), nicht per GPS aufgezeichnet. Umrechnung WGS84 → LV95 mit
  den Näherungsformeln von swisstopo (Genauigkeit etwa 1 m).
- Viewer: Potree 1.8.2 (Markus Schütz u. a.), siehe `vendor/potree/LICENSE`. Enthält three.js, jQuery, tween.js, proj4js.
- Konvertierung: PotreeConverter 2.1.1, Kodierung BROTLI.

## Übersichtskarte „Western Alps (Overview)“ (`valais.html`, `valais.js`)

Gebiet: Kanton Wallis; Bezirke Aigle und Riviera–Pays-d'Enhaut (VD); Verwaltungskreise Frutigen-Niedersimmental,
Obersimmental-Saanen, Interlaken-Oberhasli (BE). Leaflet 1.9.4 (`vendor/leaflet/`, BSD-2). Menüeintrag `uebersicht` in
`data/fieldtrips.json`. Daten in `data/valais/` (Dateiname bleibt aus historischen Gründen „valais“).

- Live von wmts.geo.admin.ch (braucht Internet): Relief (swissALTI3D-Reliefschattierung, invertiert) und historische Karte
  (`ch.swisstopo.zeitreihen`, Jahr per Regler). Alle anderen Ebenen liegen im Repository.
- Gletscher: GLAMOS SGI1850/1931/1973/2010/2016 (DOIs 10.18750/inventory.sgiJJJJ.rJJJJ). Methoden verschieden; 2016 ist
  in den Dateien flächenmässig grösser als 2010 → nicht ungeprüft vergleichen.
- Permafrost: BAFU-Hinweiskarte 2005 (GeoTIFF 25 m), Klassen 1–3 und 4–6 zusammengefasst, Ränder geglättet (~30 m).
  Zuordnung Rasterwert 0–5 = Legendenklasse 1–6, geprüft an den BAFU-Kachelfarben.
- Almen = LNF-Code 930; Landwirtschaft = LNF-Codes < 900; Codes 901–998 (Wald, Bäume, Gärten …) nicht gezeigt.
  VS und BE über geodienste.ch (WFS), VD über api3.geo.admin.ch (bei geodienste nicht frei).
- Gebäude an Sömmerungsweiden: swissTLM3D-Gebäude ≤ 30 m von Code 930 (räumliche Auswahl, kein Alpgebäude-Register).
- Ehemalig: BFS Arealstatistik Zeitreihe, Erhebungen 1979–83 und 2013–17; NOAS04 45–49 = Alpwirtschaft (geprüft: ~75 %
  dieser Hektaren liegen in Sömmerungsweiden; Code 72 deckt sich mit den Gletschern 2016). Weich gezeichnet.
- Energie: BFE PV-Grossanlagen, BFE Elektrizitätsproduktionsanlagen (**CSV verwenden – das GeoPackage ist bei 100'000
  Zeilen abgeschnitten**), BFE Wasserkraft, BFE Stauanlagen, BAV Seilbahnen, swissTLM3D (Wasserversorgung, Leitungen,
  Kraftwerk-/Unterwerkareale, Staubauten, Transportseile, Windturbinen), swissNAMES3D (Hütten). Höhe der PV-Anlagen =
  tiefster Punkt des nächsten TLM-Gebäudes (≤ 150 m), ungefähr. Inselanlagen fehlen im Register weitgehend.
- Rohdaten und Skripte: `ET/rohdaten/alpen/`, `ET/rohdaten/valais/` (`lade_valais.command`, `lade_alpen.command`,
  `lade_vd.py`, Verarbeitung in `verarbeitung/v2/`).
- Gebäude der Karte 1900 (`siegfried_gebaeude.json`): automatisch erkannt (Bildanalyse) in swisstopo „Zeitreise“ Stand
  31.12.1900, Kacheln 2,5 m (`ET/rohdaten/siegfried_1900/`, Skripte `rohdaten/valais/siegfried/`). Nur strenge Kandidaten
  (fast quadratisch, keine Strich-/Punktketten, nicht in Fels/Geröll/Gletscher 1979/85). „Heute weg“ = kein swissTLM3D-Gebäude
  ≤ 60 m. Stichprobe von 48 „heute weg“-Kandidaten: etwa 6 von 10 sind echte Gebäudesignaturen. Kandidaten, kein Beweis.
- GWR (`gwr_status.json`): öffentliches Gebäuderegister (BFS, 13.10.2026), Status 1005 „nicht nutzbar“ (111) und
  1007 „abgebrochen“ (8929, Abbruch 1999–2026).

