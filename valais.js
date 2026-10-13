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
  gletscher: { 1850: "#5e6e7c", 1931: "#889aaa", 1973: "#a8b6bb", 2010: "#b9cfe1", 2016: "#ffffff" },
  permaMoeglich: "#4fc3e8", permaWahrscheinlich: "#2a7fff",
  almen: "#9bd36a", landwirtschaft: "#e8c15a", alpgebaeude: "#ff9f43",
  alpWald: "#c46bdb", alpUnprod: "#f08fb8", gebWeg: "#ff5c5c", ausserBetrieb: "#ff5c5c",
  solarGross: "#ffd400", pv: "#fff07a", wasserkraft: "#38b6ff", stau: "#9fe3ff", wasser: "#5fe0d0",
  leitung: "#c7a6ff", energieareal: "#c7a6ff", seilbahn: "#e0e0e0", transportseil: "#a0a0a0",
  huette: "#ff4f7b", wind: "#ffffff",
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
pane("gletscher", 440); pane("linien", 450); pane("gebaeude", 455); pane("punkte", 460); pane("rand", 470);

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

// Gletscher
G("Glaciers — GLAMOS inventories");
const STAND = { 1850: "1850 (reconstructed)", 1931: "1931 (mean year)", 1973: "1973", 2010: "2010 (images 2008–2011)", 2016: "2016 (images 2013–2018)" };
for (const j of [1850, 1931, 1973, 2010, 2016]) {
  const neu = j === 2016;
  E({ name: STAND[j], art: neu ? "voll" : "linie", farbe: F.gletscher[j], an: true, datei: `gletscher_${j}.json`,
    bau: (d) => L.geoJSON(d, { pane: "gletscher",
      style: { color: F.gletscher[j], weight: neu ? 0.8 : 0.9, opacity: 0.95, fill: neu, fillColor: "#ffffff", fillOpacity: neu ? 0.85 : 0 },
      onEachFeature: (f, l) => l.on("click", (e) => { const p = f.properties || {};
        popup(e.latlng, `<strong>${esc(p.name || (neu ? "unnamed glacier" : "Glacier outline"))}</strong><br>SGI${j}`
          + `${p.jahr_aufnahme ? ` (image ${esc(p.jahr_aufnahme)})` : ""}${p.datum ? ` (${esc(p.datum)})` : ""}`
          + `${p.flaeche_km2 != null ? ` · ${Number(p.flaeche_km2).toFixed(2)} km²` : ""}${p.sgi_id ? ` · ${esc(p.sgi_id)}` : ""}`); }) }) });
}

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
G("Former — change 1979/85 → 2013/17 (BFS land use statistics)", false);
E({ name: "Alpine pasture → forest or shrub", art: "voll", farbe: F.alpWald, datei: "ehemalig_alp_zu_wald.json", bau: flaeche(F.alpWald, 0.6, "ehemalig") });
E({ name: "Alpine pasture → unproductive (grass, rock, scree)", art: "voll", farbe: F.alpUnprod, datei: "ehemalig_alp_zu_unproduktiv.json", bau: flaeche(F.alpUnprod, 0.6, "ehemalig") });
E({ name: "Building area → no longer built", art: "voll", farbe: F.gebWeg, datei: "ehemalig_gebaeude_weg.json", bau: flaeche(F.gebWeg, 0.8, "ehemalig") });
E({ name: "Lifts and ropeways out of service (swissTLM3D)", art: "strich", farbe: F.ausserBetrieb, datei: "uebrige_bahnen.json",
  bau: linien(F.ausserBetrieb, 2, (p) => `<strong>${esc(p.name || p.objektart)}</strong><br>${esc(p.objektart)} · out of service`, "4 4", (f) => f.properties.ausser_betrieb === "Wahr") });
const histJahr = { wert: 1900 };
E({ name: "Historical map (Siegfried / national map)", art: "kachel", farbe: "#bbbbbb", jahr: histJahr,
  bau: () => L.tileLayer(wmts("ch.swisstopo.zeitreihen", `${histJahr.wert}1231`), { pane: "historisch", maxNativeZoom: 16, className: "historisch-kachel" }) });

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
        if (e.jahr) extra = `<label class="regler"><input type="range" min="1870" max="2020" step="10" value="${e.jahr.wert}" data-jahr="${i}"><span>${e.jahr.wert}</span></label>`;
        return `<div class="ebene-zeile"><button class="ebene" data-i="${i}" aria-pressed="${e.an}"${e.fehlt ? " disabled" : ""}>
          <span class="zeile"><span class="flaeche ${e.art}" style="--farbe:${e.farbe}"></span><span>${esc(e.name)}${e.fehlt ? " — data missing" : ""}</span></span>
        </button>${extra}</div>`;
      }).join("")}
    </details>`).join("");
}
$id("ebenen").addEventListener("click", (ev) => {
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
<p><strong>Glaciers:</strong> Swiss Glacier Inventories SGI1850, SGI1931, SGI1973, SGI2010 and SGI2016, GLAMOS – Glacier Monitoring Switzerland, downloaded 13 October 2026 (DOIs 10.18750/inventory.sgi1850.r1992, …sgi1931.r2022, …sgi1973.r1976, …sgi2010.r2010, …sgi2016.r2020). All glaciers whose outline touches the area. The inventories rest on different sources: 1850 reconstructed from historical maps and geomorphological evidence; 1931 from terrestrial images and historical maps (mean year); 2010 from aerial images 2008–2011; 2016 from aerial images 2013–2018 (swissTLM3D). Their outlines are not strictly comparable. Simplified for display (4 m).</p>
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
<p><strong>Energy &amp; infrastructure:</strong> BFE Photovoltaik-Grossanlagen (status 13.10.2026); BFE Elektrizitätsproduktionsanlagen (all registered, grid-connected plants, CSV, state 06.08.2026 — off-grid installations on huts and alps are largely missing); BFE Statistik der Wasserkraftanlagen; BFE Stauanlagen unter Bundesaufsicht; BAV Seilbahnen mit Bundeskonzession; swissTLM3D 2026-02 (water supply, power lines, power-plant and substation sites, reservoirs and weirs, material ropeways and lifts, wind turbines); huts and bivouacs from swissNAMES3D 2026 (buildings used as shelters or named “SAC/CAS/Hütte/Cabane/Refuge/Bivouac…”). Altitude of PV installations: lowest point of the nearest swissTLM3D building (≤ 150 m), therefore approximate.</p>`;

const credits = $id("credits");
$id("credits-knopf").addEventListener("click", () => { credits.hidden = false; $id("credits-zu").focus(); });
$id("credits-zu").addEventListener("click", () => { credits.hidden = true; });
credits.addEventListener("click", (e) => { if (e.target === credits) credits.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") credits.hidden = true; });
