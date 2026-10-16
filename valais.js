// Übersichtskarte „Western Alps (Overview)“: Wallis, Waadtländer Alpen (Aigle, Riviera–Pays-d'Enhaut),
// Berner Oberland (Frutigen-Niedersimmental, Obersimmental-Saanen, Interlaken-Oberhasli).
// Leaflet; Grundkarte = swisstopo-Relief (invertiert); alle Ebenen als eigene Vektordaten in data/valais/,
// ausser Relief und historischer Karte (Kacheln von wmts.geo.admin.ch).
/* global L */

const $id = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const json = async (p) => { const r = await fetch(p, { cache: "no-cache" }); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const wmts = (layer, zeit = "current", ext = "png") => `https://wmts.geo.admin.ch/1.0.0/${layer}/default/${zeit}/3857/{z}/{x}/{y}.${ext}`;
const D = "data/valais/";

// Farben: eine eigene Farbe pro Ebene, auf den dunklen Grund abgestimmt (Victor, 13.10.2026)
const F = {
  rand: "#ffffff",
  permaMoeglich: "#4fc3e8", permaWahrscheinlich: "#2a7fff",
  almen: "#9bd36a", landwirtschaft: "#e8c15a", alpgebaeude: "#ff9f43",
  alpWald: "#c46bdb", alpUnprod: "#f08fb8", gebWeg: "#ff5c5c", ausserBetrieb: "#ff5c5c",
  solarGross: "#ffd400", pv: "#fff07a", wasserkraft: "#38b6ff", stau: "#9fe3ff", wasser: "#5fe0d0",
  leitung: "#c7a6ff", energieareal: "#c7a6ff", seilbahn: "#e0e0e0", transportseil: "#a0a0a0",
  huette: "#ff4f7b", wind: "#ffffff",
  sieg1900: "#e9d5b0", siegWeg: "#ff2d2d", gwrNutzlos: "#ffa600", gwrAbbruch: "#9a9a9a", gwrAbbruchAlp: "#ff7a4d",
};

// ---------- Karte ----------
const karte = L.map("karte", {
  zoomControl: false, attributionControl: false,
  minZoom: 8, maxZoom: 17, zoomSnap: 0.25, wheelPxPerZoomLevel: 120,
  maxBounds: [[45.5, 6.0], [47.2, 9.2]], maxBoundsViscosity: 0.8,
  preferCanvas: true,
});
karte.fitBounds([[45.86, 6.8], [46.80, 8.45]], { paddingTopLeft: [380, 0] });
window.karte = karte;
L.control.zoom({ position: "bottomright" }).addTo(karte);

const pane = (name, z) => { const p = karte.createPane(name); p.style.zIndex = z; return name; };
pane("relief", 200); pane("historisch", 250);
pane("flaechen", 400); pane("ehemalig", 410); pane("permafrost", 420); pane("maske", 430);
pane("gletscher", 440); pane("linien", 450); pane("gebaeude", 455); pane("punkte", 460); pane("rand", 470); pane("fieldtrips", 480);

// Grundkarte: swissALTI3D-Relief (multidirektional), im CSS invertiert -> dunkel
L.tileLayer(wmts("ch.swisstopo.swissalti3d-reliefschattierung"), { pane: "relief", maxNativeZoom: 17, className: "relief-kachel" }).addTo(karte);

// ---------- Hilfen ----------
const laden = async (datei) => { try { return await json(D + datei); } catch (e) { console.warn("fehlt:", datei); return null; } };
const popup = (latlng, html) => L.popup({ className: "valais-popup", closeButton: false, autoPan: false }).setLatLng(latlng).setContent(html).openOn(karte);
const zeile = (k, v) => (v === null || v === undefined || v === "" ? "" : `<br>${esc(k)}: ${esc(v)}`);
// Fläche ohne Rand, weich gefüllt
const flaeche = (farbe, deck, paneName = "flaechen") => (d) => L.geoJSON(d, { pane: paneName, interactive: false,
  style: { stroke: false, fill: true, fillColor: farbe, fillOpacity: deck } });
// Punkte als kleine Kreise (Canvas)
const punkte = (farbe, radius, info, paneName = "punkte", filter = null) => (d) => L.geoJSON(d, {
  pane: paneName, filter,
  pointToLayer: (f, ll) => L.circleMarker(ll, { pane: paneName, radius, stroke: true, weight: 1, color: "#0f1113", opacity: 0.8, fillColor: farbe, fillOpacity: 0.95 }),
  onEachFeature: (f, l) => info && l.on("click", (e) => popup(e.latlng, info(f.properties || {}))),
});
const linien = (farbe, gewicht, info, strich = null, filter = null) => (d) => L.geoJSON(d, {
  pane: "linien", filter,
  style: { color: farbe, weight: gewicht, opacity: 0.9, dashArray: strich },
  onEachFeature: (f, l) => info && l.on("click", (e) => popup(e.latlng, info(f.properties || {}))),
});

// ---------- Ebenen-Definition ----------
// art: linie | voll | punkt | quadrat | strich | kachel | titel
const GRUPPEN = [];
let gruppe = null;
const G = (titel, offen = true) => { gruppe = { titel, offen, ebenen: [] }; GRUPPEN.push(gruppe); };
const E = (def) => { const e = { an: false, ...def }; gruppe.ebenen.push(e); return e; };

// Gletscher: Punktwolke (2D, von oben), die von 1850 bis heute zurückgeht und dann auf dem letzten Stand bleibt
const GletscherWolke = L.Layer.extend({
  initialize() { this.jahr = 1850; this.daten = null; this.dauer = 14000; },
  onAdd(map) {
    this._map = map;
    this._c = L.DomUtil.create("canvas", "gletscher-wolke");
    this._c.style.pointerEvents = "none";
    map.getPane("gletscher").appendChild(this._c);
    map.on("moveend zoomend resize viewreset", this._zeichne, this);
    map.on("zoomstart", this._verstecke, this);
    this._laden().then(() => this.abspielen());
  },
  onRemove(map) {
    map.off("moveend zoomend resize viewreset", this._zeichne, this);
    map.off("zoomstart", this._verstecke, this);
    cancelAnimationFrame(this._raf); this._c.remove();
  },
  async _laden() {
    if (this.daten) return;
    const [m, buf] = await Promise.all([json(D + "gletscher_punkte.json"), fetch(D + "gletscher_punkte.bin").then((r) => r.arrayBuffer())]);
    const n = m.anzahl, u8 = new Uint8Array(buf);
    this.daten = { m, n, x: new Uint16Array(buf.slice(0, 2 * n)), y: new Uint16Array(buf.slice(2 * n, 4 * n)), t: u8.subarray(4 * n, 5 * n) };
  },
  abspielen() {
    cancelAnimationFrame(this._raf);
    const t0 = performance.now(), ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const schritt = (t) => {
      const f = ruhig ? 1 : Math.min(1, (t - t0) / this.dauer);
      this.jahr = 1850 + f * (2016 - 1850);
      this._zeichne(); anzeige(Math.round(this.jahr));
      if (f < 1) this._raf = requestAnimationFrame(schritt);
    };
    this._raf = requestAnimationFrame(schritt);
  },
  _verstecke() { if (this._c) this._c.style.visibility = "hidden"; },
  _zeichne() {
    const map = this._map, d = this.daten; if (!map || !d) return;
    const gr = map.getSize(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = this._c; c.style.visibility = "visible";
    if (c.width !== gr.x * dpr || c.height !== gr.y * dpr) { c.width = gr.x * dpr; c.height = gr.y * dpr; c.style.width = gr.x + "px"; c.style.height = gr.y + "px"; }
    L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
    const ctx = c.getContext("2d"), img = ctx.createImageData(c.width, c.height), px = new Uint32Array(img.data.buffer);
    const z = map.getZoom(), E = 40075016.68557849, H = E / 2, s = 256 * Math.pow(2, z) / E * dpr;
    const o = map.getPixelBounds().min;                 // Pixel des linken oberen Rands bei Zoom z
    const ox = (d.m.ox + H) * s - o.x * dpr, oy = (H - d.m.oy) * s - o.y * dpr, k = d.m.schritt * s;
    const grenze = this.jahr - 1850, W = c.width, Hh = c.height;
    // Punktgrösse: 1 Pixel; weiss mit leichter Transparenz, damit Dichte sichtbar bleibt
    const farbe = (230 << 24) | (255 << 16) | (255 << 8) | 255;   // ABGR (little endian): a=230, b, g, r = 255
    const breit = z >= 13 ? 2 : 1;
    // weit draussen nur jeden n-ten Punkt zeichnen, damit es eine Punktwolke bleibt und keine Fläche wird
    const mpp = 1 / s * Math.cos(46.3 * Math.PI / 180);            // Meter (am Boden) pro Bildpixel
    const n = Math.max(1, Math.ceil(Math.pow(mpp / d.m.abstand_m, 2) / 1.1));
    for (let i = 0; i < d.n; i += n) {
      const ti = d.t[i];
      if (ti !== 255 && ti <= grenze) continue;          // schon verschwunden
      const x = (ox + d.x[i] * k) | 0, y = (oy - d.y[i] * k) | 0;
      if (x < 0 || y < 0 || x >= W - 1 || y >= Hh - 1) continue;
      const j = y * W + x; px[j] = farbe;
      if (breit === 2) { px[j + 1] = farbe; px[j + W] = farbe; px[j + W + 1] = farbe; }
    }
    ctx.putImageData(img, 0, 0);
  },
});
let anzeige = () => {};

// Fieldtrips: Routen aus data/fieldtrips.json (LV95), Klick → Popup mit Link zur 3D-Karte
// LV95 → WGS84, Näherungsformeln swisstopo (Genauigkeit ca. 1 m)
const lv95 = (e, n) => {
  const y = (e - 2600000) / 1e6, x = (n - 1200000) / 1e6;
  const lam = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const phi = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.014 * x * x * x;
  return [phi * 100 / 36, lam * 100 / 36];
};
const fieldtripRouten = (konfig) => {
  const gruppe = L.layerGroup();
  const svg = L.svg({ pane: "fieldtrips" });
  for (const ft of konfig.fieldtrips || []) {
    if (!ft.route) continue;
    Promise.all([json(ft.route), ft.stationen ? json(ft.stationen).catch(() => []) : []]).then(([r, st]) => {
      const ll = r.punkte.filter((_, i) => i % 3 === 0 || i === r.punkte.length - 1).map(([e, n]) => lv95(e, n));
      const kurz = ft.id.replace(/^F_0?/, "F");
      const html = `<strong>${esc(ft.titel)}</strong><br>${esc(ft.ort)} · ${st.length} station${st.length === 1 ? "" : "s"}`
        + `<br><a href="karte.html?ft=${encodeURIComponent(ft.id)}">Open 3D map →</a>`;
      const mitte = ll[Math.floor(ll.length / 2)];   // Schild in der Mitte: F2 und F3 beginnen am selben Ort
      const auf = (e) => popup(e.latlng || L.latLng(mitte), html);
      L.polyline(ll, { pane: "fieldtrips", renderer: svg, color: "#ffffff", weight: 2.2, opacity: 1, interactive: false }).addTo(gruppe);
      // breiter unsichtbarer Streifen, damit die dünne Linie leicht zu treffen ist
      L.polyline(ll, { pane: "fieldtrips", renderer: svg, color: "#ffffff", weight: 16, opacity: 0 }).on("click", auf).addTo(gruppe);
      L.marker(mitte, { pane: "fieldtrips", icon: L.divIcon({ className: "ft-schild", html: esc(kurz), iconSize: null, iconAnchor: [0, 0] }) })
        .on("click", auf).addTo(gruppe);
    }).catch((err) => console.warn("Route", ft.id, err));
  }
  return gruppe;
};
G("Fieldtrips");
E({ name: "Fieldtrip routes — click for the 3D map", art: "linie", farbe: "#ffffff", an: true, datei: "../fieldtrips.json", bau: fieldtripRouten });

G("Glaciers — GLAMOS inventories 1850 → 2016");
const gletscherWolke = new GletscherWolke();
E({ name: "Glacier extent as point cloud (animation 1850 → 2016)", art: "punkt", farbe: "#ffffff", an: true, animation: true,
  bau: () => gletscherWolke });

// Permafrost (eigene Darstellung der BAFU-Hinweiskarte)
G("Permafrost — BAFU indicative map (model, 2005)", false);
E({ name: "possible locally (classes 1–3)", art: "voll", farbe: F.permaMoeglich, datei: "permafrost_moeglich.json", bau: flaeche(F.permaMoeglich, 0.28, "permafrost") });
E({ name: "likely, extensive (classes 4–6)", art: "voll", farbe: F.permaWahrscheinlich, datei: "permafrost_wahrscheinlich.json", bau: flaeche(F.permaWahrscheinlich, 0.5, "permafrost") });

// Landnutzung
G("Land use 2025 — BLW agricultural areas, swissTLM3D");
E({ name: "Alpine summer pastures (Sömmerungsweiden)", art: "voll", farbe: F.almen, an: true, datei: "almen.json", bau: flaeche(F.almen, 0.42) });
E({ name: "Agricultural land (meadows, pastures, arable, vineyards, orchards)", art: "voll", farbe: F.landwirtschaft, datei: "landwirtschaft.json", bau: flaeche(F.landwirtschaft, 0.55) });
E({ name: "Buildings on or next to summer pastures (≤ 30 m)", art: "quadrat", farbe: F.alpgebaeude, datei: "alpgebaeude.json",
  bau: (d) => L.geoJSON(d, { pane: "gebaeude", style: { stroke: true, weight: 1.2, color: F.alpgebaeude, opacity: 1, fill: true, fillColor: F.alpgebaeude, fillOpacity: 0.9 },
    onEachFeature: (f, l) => l.on("click", (e) => { const p = f.properties || {};
      popup(e.latlng, `<strong>${esc(p.name || "Building")}</strong><br>swissTLM3D: ${esc(p.objektart)}${p.nutzung ? ` · ${esc(p.nutzung)}` : ""}${zeile("Altitude", p.hoehe != null ? `${p.hoehe} m` : "")}`); }) }) });

// Ehemalige Flächen und Anlagen
G("Former & abandoned", false);
E({ name: "Alpine pasture → forest or shrub (BFS, 1979/85 → 2013/17)", art: "voll", farbe: F.alpWald, datei: "ehemalig_alp_zu_wald.json", bau: flaeche(F.alpWald, 0.6, "ehemalig") });
E({ name: "Alpine pasture → unproductive (BFS, 1979/85 → 2013/17)", art: "voll", farbe: F.alpUnprod, datei: "ehemalig_alp_zu_unproduktiv.json", bau: flaeche(F.alpUnprod, 0.6, "ehemalig") });
E({ name: "Building area → no longer built (BFS, 1979/85 → 2013/17)", art: "voll", farbe: F.gebWeg, datei: "ehemalig_gebaeude_weg.json", bau: flaeche(F.gebWeg, 0.8, "ehemalig") });
E({ name: "Lifts and ropeways out of service (swissTLM3D)", art: "strich", farbe: F.ausserBetrieb, datei: "uebrige_bahnen.json",
  bau: linien(F.ausserBetrieb, 2, (p) => `<strong>${esc(p.name || p.objektart)}</strong><br>${esc(p.objektart)} · out of service`, "4 4", (f) => f.properties.ausser_betrieb === "Wahr") });
const histJahr = { wert: 1900 };
E({ name: "Historical map (Siegfried / national map)", art: "kachel", farbe: "#bbbbbb", jahr: histJahr,
  bau: () => L.tileLayer(wmts("ch.swisstopo.zeitreihen", `${histJahr.wert}1231`), { pane: "historisch", maxNativeZoom: 16, className: "historisch-kachel" }) });

// Gebäude der Karte von 1900 (automatisch erkannt) und Gebäuderegister
const sieg = (nurWeg) => (d) => L.geoJSON(d, { pane: "gebaeude", filter: (f) => !nurWeg || f.properties.heute_weg,
  style: { stroke: true, weight: nurWeg ? 1.6 : 1, color: nurWeg ? F.siegWeg : F.sieg1900, opacity: 1, fill: true, fillColor: nurWeg ? F.siegWeg : F.sieg1900, fillOpacity: nurWeg ? 0.9 : 0.6 },
  onEachFeature: (f, l) => l.on("click", (e) => { const p = f.properties || {};
    popup(e.latlng, `<strong>Building symbol on the 1900 map</strong><br>automatically detected (may be wrong)`
      + `${zeile("Nearest building today (swissTLM3D)", p.dist_heute != null ? (p.dist_heute > 5000 ? "none nearby" : `${p.dist_heute} m`) : "")}${p.auf_alp ? "<br>on or next to a summer pasture" : ""}`); }) });
E({ name: "Buildings on the 1900 map (Siegfried, automatically detected)", art: "quadrat", farbe: F.sieg1900, datei: "siegfried_gebaeude.json", bau: sieg(false) });
E({ name: "… of these: no building today within 60 m", art: "quadrat", farbe: F.siegWeg, datei: "siegfried_gebaeude.json", bau: sieg(true) });
const gwr = (farbe, filt, r) => punkte(farbe, r, (p) => `<strong>${esc(p.name || "Building")}</strong> (GWR ${esc(p.egid)})<br>Status: ${esc(p.status)}`
  + `${zeile("Category", [p.kategorie, p.klasse].filter(Boolean).join(", "))}${zeile("Built", p.gebaut)}${zeile("Demolished", p.abbruch)}${zeile("Municipality", p.gemeinde)}`
  + `${p.auf_alp ? "<br>on or next to a summer pasture" : ""}`, "punkte", filt);
E({ name: "Not usable (GWR building status)", art: "punkt", farbe: F.gwrNutzlos, datei: "gwr_status.json", bau: gwr(F.gwrNutzlos, (f) => f.properties.status === "not usable", 4.5) });
E({ name: "Demolished 1999–2026: agricultural or on summer pastures (GWR)", art: "punkt", farbe: F.gwrAbbruchAlp, datei: "gwr_status.json", bau: gwr(F.gwrAbbruchAlp, (f) => f.properties.status === "demolished" && (f.properties.landw || f.properties.auf_alp), 3.5) });
E({ name: "Demolished 1999–2026: all (GWR)", art: "punkt", farbe: F.gwrAbbruch, datei: "gwr_status.json", bau: gwr(F.gwrAbbruch, (f) => f.properties.status === "demolished", 2.5) });

// Energie und Infrastruktur
G("Energy & infrastructure", false);
const hoehe = { min: 1000 };
E({ name: "Large solar plants (BFE, alpine solar projects)", art: "quadrat", farbe: F.solarGross, datei: "solar_gross.json",
  bau: (d) => L.geoJSON(d, { pane: "punkte",
    pointToLayer: (f, ll) => L.circleMarker(ll, { pane: "punkte", radius: 7, weight: 2, color: "#0f1113", fillColor: F.solarGross, fillOpacity: 1 }),
    onEachFeature: (f, l) => l.on("click", (e) => { const p = f.properties || {};
      popup(e.latlng, `<strong>${esc(p.name)}</strong>${zeile("Status (BFE)", p.status)}${zeile("Power", p.leistung_mw != null ? `${p.leistung_mw} MW` : "")}`
        + `${zeile("Annual / winter yield", p.jahr_gwh != null ? `${p.jahr_gwh} / ${p.winter_gwh} GWh` : "")}${zeile("Altitude", p.hoehe != null ? `${p.hoehe} m` : "")}${zeile("Developer", p.traeger)}`); }) }) });
E({ name: "Photovoltaic installations above", art: "punkt", farbe: F.pv, datei: "pv_anlagen.json", regler: hoehe,
  bau: punkte(F.pv, 2.6, (p) => `<strong>PV installation</strong>${zeile("Power", p.kw != null ? `${p.kw} kW` : "")}${zeile("In operation since", p.jahr)}${zeile("Altitude (approx.)", p.hoehe != null ? `${p.hoehe} m` : "")}`,
    "punkte", (f) => (f.properties.hoehe ?? -1) >= hoehe.min) });
E({ name: "Hydropower plants (BFE)", art: "punkt", farbe: F.wasserkraft, datei: "wasserkraft.json",
  bau: punkte(F.wasserkraft, 5, (p) => `<strong>${esc(p.name)}</strong>${zeile("Location", p.ort)}${zeile("Type", p.typ)}${zeile("In operation since", p.seit)}${zeile("Head", p.fallhoehe_m != null ? `${p.fallhoehe_m} m` : "")}`) });
E({ name: "Dams under federal supervision (BFE)", art: "quadrat", farbe: F.stau, datei: "stauanlagen.json",
  bau: punkte(F.stau, 5, (p) => `<strong>${esc(p.name)}</strong>${zeile("Type", p.typ)}${zeile("Height", p.hoehe_m != null ? `${p.hoehe_m} m` : "")}${zeile("Built", p.baujahr)}`) });
E({ name: "Water supply, springs, fountains (swissTLM3D)", art: "punkt", farbe: F.wasser, datei: "wasserversorgung.json",
  bau: punkte(F.wasser, 3, (p) => `<strong>${esc(p.name || p.objektart)}</strong><br>swissTLM3D: ${esc(p.objektart)}${zeile("Altitude", p.hoehe != null ? `${p.hoehe} m` : "")}`) });
E({ name: "Power lines (swissTLM3D)", art: "linie", farbe: F.leitung, datei: "stromleitungen.json",
  bau: linien(F.leitung, 1.2, (p) => `<strong>Power line</strong>${zeile("Grid level", p.netzebene === "ub" ? "not specified" : p.netzebene)}${zeile("Name", p.name)}`) });
E({ name: "Power plant and substation sites (swissTLM3D)", art: "voll", farbe: F.energieareal, datei: "energieareale.json", bau: flaeche(F.energieareal, 0.7) });
E({ name: "Reservoirs, weirs, basins (swissTLM3D)", art: "voll", farbe: F.stau, datei: "staubauten.json",
  bau: (d) => L.geoJSON(d, { pane: "gebaeude", filter: (f) => f.properties.objektart !== "Schutzdamm",
    style: { stroke: true, weight: 1, color: F.stau, fill: true, fillColor: F.stau, fillOpacity: 0.6 },
    onEachFeature: (f, l) => l.on("click", (e) => popup(e.latlng, `<strong>${esc(f.properties.name || f.properties.objektart)}</strong><br>swissTLM3D: ${esc(f.properties.objektart)}`)) }) });
E({ name: "Cableways with federal licence (BAV)", art: "linie", farbe: F.seilbahn, datei: "seilbahnen.json",
  bau: linien(F.seilbahn, 1.4, (p) => `<strong>${esc(p.name)}</strong>${zeile("Type", [p.typ, p.fahrzeug].filter(Boolean).join(", "))}${zeile("Valid since", p.seit)}${zeile("Height difference", p.hoehendiff_m != null ? `${p.hoehendiff_m} m` : "")}`) });
E({ name: "Material ropeways and lifts (swissTLM3D)", art: "strich", farbe: F.transportseil, datei: "uebrige_bahnen.json",
  bau: linien(F.transportseil, 1.2, (p) => `<strong>${esc(p.name || p.objektart)}</strong><br>swissTLM3D: ${esc(p.objektart)}`, "3 3", (f) => f.properties.ausser_betrieb !== "Wahr" && ["Transportseil", "Skilift", "Foerderband"].includes(f.properties.objektart)) });
E({ name: "Huts and bivouacs (swissNAMES3D)", art: "punkt", farbe: F.huette, datei: "huetten.json",
  bau: punkte(F.huette, 4, (p) => `<strong>${esc(p.name)}</strong>${zeile("Altitude", p.hoehe != null ? `${p.hoehe} m` : "")}`) });
E({ name: "Wind turbines (swissTLM3D)", art: "punkt", farbe: F.wind, datei: "windturbinen.json", bau: punkte(F.wind, 4, null) });

// ---------- Laden, Schalten, Legende ----------
const alle = GRUPPEN.flatMap((g) => g.ebenen);
const cache = {};
async function schalten(e, an) {
  e.an = an;
  if (!an) { if (e.layer) karte.removeLayer(e.layer); return; }
  if (!e.layer) {
    const d = e.datei ? (cache[e.datei] ??= await laden(e.datei)) : null;
    if (e.datei && !d) { e.fehlt = true; zeichneLegende(); return; }
    e.layer = e.bau(d);
  }
  if (e.an) e.layer.addTo(karte);
}
async function neuBauen(e) {   // z. B. nach Änderung des Höhenreglers oder des Jahres
  if (e.layer) karte.removeLayer(e.layer);
  e.layer = null;
  if (e.an) await schalten(e, true);
}

function zeichneLegende() {
  $id("ebenen").innerHTML = GRUPPEN.map((g, gi) => `
    <details class="ebenen-gruppe" data-g="${gi}"${g.offen ? " open" : ""}>
      <summary><span>${esc(g.titel)}</span></summary>
      ${g.ebenen.map((e) => {
        const i = alle.indexOf(e);
        let extra = "";
        if (e.regler) extra = `<label class="regler"><input type="range" min="400" max="3000" step="100" value="${e.regler.min}" data-regler="${i}"><span>${e.regler.min} m</span></label>`;
        if (e.animation) extra = `<span class="regler"><span class="gl-jahr">${Math.round(gletscherWolke.jahr)}</span><button class="gl-wieder" type="button">↺ replay</button></span>`;
        if (e.jahr) extra = `<label class="regler"><input type="range" min="1870" max="2020" step="10" value="${e.jahr.wert}" data-jahr="${i}"><span>${e.jahr.wert}</span></label>`;
        return `<div class="ebene-zeile"><button class="ebene" data-i="${i}" aria-pressed="${e.an}"${e.fehlt ? " disabled" : ""}>
          <span class="zeile"><span class="flaeche ${e.art}" style="--farbe:${e.farbe}"></span><span>${esc(e.name)}${e.fehlt ? " — data missing" : ""}</span></span>
        </button>${extra}</div>`;
      }).join("")}
    </details>`).join("");
}
$id("ebenen").addEventListener("click", (ev) => {
  if (ev.target.closest(".gl-wieder")) { if (map_hat(gletscherWolke)) gletscherWolke.abspielen(); return; }
  const b = ev.target.closest(".ebene"); if (!b || b.disabled) return;
  const e = alle[+b.dataset.i];
  b.setAttribute("aria-pressed", !e.an);
  schalten(e, !e.an);
});
$id("ebenen").addEventListener("input", (ev) => {
  const t = ev.target;
  if (t.dataset.regler) { const e = alle[+t.dataset.regler]; e.regler.min = +t.value; t.nextElementSibling.textContent = `${t.value} m`; }
  if (t.dataset.jahr) { const e = alle[+t.dataset.jahr]; e.jahr.wert = +t.value; t.nextElementSibling.textContent = t.value; }
});
$id("ebenen").addEventListener("change", (ev) => {
  const t = ev.target;
  const i = t.dataset.regler ?? t.dataset.jahr; if (i === undefined) return;
  neuBauen(alle[+i]);
});
$id("ebenen").addEventListener("toggle", (ev) => {
  const d = ev.target.closest?.(".ebenen-gruppe"); if (d) GRUPPEN[+d.dataset.g].offen = d.open;
}, true);
zeichneLegende();
function map_hat(l) { return karte.hasLayer(l); }
anzeige = (j) => { const el = document.querySelector(".gl-jahr"); if (el) el.textContent = j; };

// Gebiet: Umriss, innere Grenzen und abgedunkelte Umgebung
const [per, teile] = await Promise.all([laden("perimeter.json"), laden("teilgebiete.json")]);
if (per) {
  const ringe = [];
  for (const f of per.features) {
    const g = f.geometry; const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const p of polys) ringe.push(p[0].map(([x, y]) => [y, x]));
  }
  L.polygon([[[89, -179], [89, 179], [-89, 179], [-89, -179]], ...ringe],
    { pane: "maske", stroke: false, fillColor: "#0f1113", fillOpacity: 0.72, interactive: false }).addTo(karte);
  L.geoJSON(per, { pane: "rand", interactive: false, style: { color: F.rand, weight: 1, opacity: 0.6, fill: false } }).addTo(karte);
}
if (teile) L.geoJSON(teile, { pane: "rand", interactive: false, style: { color: F.rand, weight: 0.6, opacity: 0.25, fill: false, dashArray: "2 4" } }).addTo(karte);

// eingeschaltete Ebenen laden
await Promise.all(alle.filter((e) => e.an).map((e) => schalten(e, true)));
$id("laden").remove();

// ---------- Fieldtrip-Menü (wie auf der Karte) ----------
try {
  const konfig = await json("data/fieldtrips.json");
  $id("nav").innerHTML = (konfig.uebersicht || []).map((b) => `<a href="${esc(b.link)}"${b.link === "valais.html" ? ' aria-current="page"' : ""}>${esc(b.name)}</a>`).join("") + konfig.fieldtrips.map((f) => f.inaktiv
    ? `<span aria-disabled="true" title="Not online yet">${esc(f.nav)}</span>`
    : `<a href="karte.html?ft=${encodeURIComponent(f.id)}">${esc(f.nav)}</a>`).join("");
} catch {}
{
  const klapp = $id("nav-klapp");
  document.addEventListener("pointerdown", (e) => { if (klapp.open && !klapp.contains(e.target)) klapp.open = false; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && klapp.open) klapp.open = false; });
}

// ---------- Quellen (Credits) ----------
$id("quellen").innerHTML = `
<p><strong>Area:</strong> Canton of Valais; districts Aigle and Riviera–Pays-d'Enhaut (VD); administrative districts Frutigen-Niedersimmental, Obersimmental-Saanen and Interlaken-Oberhasli (BE). Boundaries: swissBOUNDARIES3D 2026-01, swisstopo.</p>
<p><strong>Relief:</strong> swissALTI3D multidirectional hillshade, swisstopo, via wmts.geo.admin.ch (colours inverted). <strong>Historical map:</strong> swisstopo “Zeitreise” series (Siegfried map and national maps), state of 31 December of the chosen year, via wmts.geo.admin.ch (colours inverted).</p>
<p><strong>Fieldtrip routes:</strong> from <code>data/fieldtrips.json</code>; traced afterwards in Strava, not GPS-recorded (see the 3D maps). Converted from LV95 with the swisstopo approximation formulas (about 1 m).</p>
<p><strong>Glaciers:</strong> Swiss Glacier Inventories SGI1850, SGI1931, SGI1973, SGI2010 and SGI2016, GLAMOS – Glacier Monitoring Switzerland, downloaded 13 October 2026 (DOIs 10.18750/inventory.sgi1850.r1992, …sgi1931.r2022, …sgi1973.r1976, …sgi2010.r2010, …sgi2016.r2020). All glaciers whose outline touches the area. The inventories rest on different sources: 1850 reconstructed from historical maps and geomorphological evidence; 1931 from terrestrial images and historical maps (mean year); 2010 from aerial images 2008–2011; 2016 from aerial images 2013–2018 (swissTLM3D). Their outlines are not strictly comparable. <em>Display:</em> a point cloud on a 40 m grid (points randomly offset within each cell) covering every area that is ice in at least one inventory. A point disappears after the last inventory in which it lies inside a glacier, so the cloud only shrinks (where a later inventory shows more ice, e.g. 2016 vs 2010, the point simply stays). Between two inventory dates the retreat is interpolated: points farther from the next outline vanish earlier. This in-between motion illustrates the change; it is not measured year by year.</p>
<p class="lit-klein">Linsbauer, A., M. Huss, E. Hodel, A. Bauder, M. Fischer, Y. Weidmann, H. Bärtschi, and E. Schmassmann. “The New Swiss Glacier Inventory SGI2016: From a Topographical to a Glaciological Dataset.” <em>Frontiers in Earth Science</em> (2021). https://doi.org/10.3389/feart.2021.704189.<br>
Fischer, M., M. Huss, C. Barboux, and M. Hoelzle. “The New Swiss Glacier Inventory SGI2010: Relevance of Using High-Resolution Source Data in Areas Dominated by Very Small Glaciers.” <em>Arctic, Antarctic, and Alpine Research</em> 46 (2014): 933–45.<br>
Müller, F., T. Caflisch, and G. Müller. <em>Firn und Eis der Schweizer Alpen (Gletscherinventar)</em>. Publ. Nr. 57/57a. Zürich: Geographisches Institut, ETH Zürich, 1976.<br>
Mannerfelt, E. S., A. Dehecq, R. Hugonnet, E. Hodel, M. Huss, A. Bauder, and D. Farinotti. “Halving of Swiss Glacier Volume since 1931 Observed from Terrestrial Image Photogrammetry.” <em>The Cryosphere</em> 16 (2022): 3249–68. https://doi.org/10.5194/tc-16-3249-2022.<br>
Maisch, M., A. Wipf, B. Denneler, J. Battaglia, and C. Benz. <em>Die Gletscher der Schweizer Alpen: Gletscherhochstand 1850, Aktuelle Vergletscherung, Gletscherschwund-Szenarien</em>. 2nd ed. Zürich: vdf Hochschulverlag an der ETH Zürich, 2000.<br>
Paul, F. “The New Swiss Glacier Inventory 2000 – Application of Remote Sensing and GIS.” PhD diss., University of Zurich, 2004.</p>
<p><strong>Permafrost:</strong> Hinweiskarte der potenziellen Permafrostverbreitung, Federal Office for the Environment BAFU, data status 31.10.2005 (GeoTIFF, 25 m, data.geo.admin.ch). A model derived from a digital elevation model, not measured permafrost. Shown in two groups: legend classes 1–3 (“locally possible”) and 4–6 (“extensive, likely”); edges smoothed (about 30 m), so the display is more generalised than the model.</p>
<p><strong>Alpine summer pastures and agricultural land:</strong> Landwirtschaftliche Nutzungsflächen (LNF), Federal Office for Agriculture BLW and cantons VS, BE, VD, reference year 2025; VS and BE via geodienste.ch (WFS), VD via api3.geo.admin.ch. Summer pastures = use code 930 “Sömmerungsweiden”; agricultural land = all codes below 900 (utilised agricultural area, incl. hay meadows in the summer grazing area, 621–623). Codes 901–998 (forest, unproductive areas, single trees, gardens etc.) are not shown. Merged and simplified for display.</p>
<p><strong>Buildings on summer pastures:</strong> swissTLM3D 2026-02 building footprints (swisstopo) within 30 m of a Sömmerungsweide. This is a spatial selection, not a register of alp buildings: it also catches e.g. holiday chalets or lift stations next to a pasture.</p>
<p><strong>Former:</strong> BFS Arealstatistik (land use statistics), time series, hectare sample points; survey periods 1979–1983 and 2013–2017 in this area. Alpine pasture = NOAS04 basic categories 45–49; forest/shrub = 50–60 and 64; unproductive = 65, 69, 70; building areas = 1–14, settlement = 1–36. Hectares merged with soft edges. Lifts out of service: swissTLM3D attribute “ausser Betrieb”.</p>
<p><strong>Buildings on the 1900 map:</strong> detected automatically by Claude (image analysis) in the swisstopo “Zeitreise” map, state 31 December 1900 (in this area mostly the Siegfried map 1:50,000), tiles at 2.5 m. Solid black building symbols are kept; tree symbols, stippling, lettering and rock drawing are filtered out, but not perfectly: buildings drawn together with roads or other buildings (village cores) are often missed, and single false detections occur. Candidates on rock, scree or glacier (BFS Arealstatistik 1979/85) are dropped unless near a building or hut today. “No building today” = no swissTLM3D 2026 building within 60 m of the detected symbol; the old map is generalised and its position can be off by tens of metres, so these are candidates to check, not proof of a lost building.</p>
<p><strong>Building register:</strong> Eidg. Gebäude- und Wohnungsregister (GWR), BFS, public data of 13.10.2026 (cantons VS, BE, VD). Status “not usable” (1005) and “demolished” (1007, demolition years 1999–2026). Agricultural = building classes 1271, 1276, 1277, 1278. The register is kept by the municipalities; abandoned buildings are often not marked as such.</p>
<p><strong>Energy &amp; infrastructure:</strong> BFE Photovoltaik-Grossanlagen (status 13.10.2026); BFE Elektrizitätsproduktionsanlagen (all registered, grid-connected plants, CSV, state 06.08.2026 — off-grid installations on huts and alps are largely missing); BFE Statistik der Wasserkraftanlagen; BFE Stauanlagen unter Bundesaufsicht; BAV Seilbahnen mit Bundeskonzession; swissTLM3D 2026-02 (water supply, power lines, power-plant and substation sites, reservoirs and weirs, material ropeways and lifts, wind turbines); huts and bivouacs from swissNAMES3D 2026 (buildings used as shelters or named “SAC/CAS/Hütte/Cabane/Refuge/Bivouac…”). Altitude of PV installations: lowest point of the nearest swissTLM3D building (≤ 150 m), therefore approximate.</p>`;

const credits = $id("credits");
$id("credits-knopf").addEventListener("click", () => { credits.hidden = false; $id("credits-zu").focus(); });
$id("credits-zu").addEventListener("click", () => { credits.hidden = true; });
credits.addEventListener("click", (e) => { if (e.target === credits) credits.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") credits.hidden = true; });
