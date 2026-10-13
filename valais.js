// Übersichtskarte Wallis (Valais): Leaflet, Grundkarte = swisstopo-Relief (dunkel invertiert),
// darüber eigene Vektorebenen (Gletscherstände GLAMOS, Almen und Landwirtschaft BLW) und die
// Permafrost-Hinweiskarte des BAFU als Kachel von geo.admin.ch.
/* global L */

const $id = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const json = async (p) => { const r = await fetch(p, { cache: "no-cache" }); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const wmts = (layer, ext = "png") => `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.${ext}`;

// Palette A (siehe style.css)
const FARBE = {
  rand: "#ffffff",
  gletscher: { 1850: "#5e6e7c", 1931: "#889aaa", 1973: "#a8b6bb", 2010: "#b9cfe1", 2016: "#ffffff" },
  almen: "#7b8884",           // Lichen
  landwirtschaft: "#d4e2eb",  // Frost
};

// ---------- Karte ----------
const karte = L.map("karte", {
  zoomControl: false, attributionControl: false,
  minZoom: 8, maxZoom: 16, zoomSnap: 0.25, wheelPxPerZoomLevel: 120,
  maxBounds: [[45.55, 6.2], [46.95, 9.0]], maxBoundsViscosity: 0.8,
  preferCanvas: true,
});
karte.fitBounds([[45.86, 6.77], [46.66, 8.48]]);
window.karte = karte;
L.control.zoom({ position: "bottomright" }).addTo(karte);

// Grundkarte: swissALTI3D-Relief (multidirektional), im CSS invertiert -> dunkel
karte.createPane("relief").style.zIndex = 200;
L.tileLayer(wmts("ch.swisstopo.swissalti3d-reliefschattierung"), { pane: "relief", maxNativeZoom: 17, className: "relief-kachel" }).addTo(karte);

// eigene Ebenen in Panes, damit die Reihenfolge fest ist
const pane = (name, z) => { const p = karte.createPane(name); p.style.zIndex = z; return name; };
pane("landwirtschaft", 400); pane("almen", 410); pane("permafrost", 420);
pane("maske", 430); pane("gletscher", 440); pane("rand", 450);

// Permafrost (BAFU, Kachel; Farben des BAFU, abgeschwächt)
const permafrost = L.tileLayer(wmts("ch.bafu.permafrost"), { pane: "permafrost", opacity: 0.55, maxNativeZoom: 17, className: "permafrost-kachel" });

// ---------- Ebenen-Verwaltung und Legende ----------
// Jede Zeile: { name, art, farbe, an, layer, gruppe? }  (gruppe: Unterzeile eines Sammelschalters)
const ebenen = [];
function ebene(def) { ebenen.push(def); if (def.an && def.layer && !def.gruppe) def.layer.addTo(karte); zeichneLegende(); return def; }
function zeichneLegende() {
  $id("ebenen").innerHTML = ebenen.map((e, i) => `
    <button class="ebene${e.gruppe ? " unter" : ""}" data-i="${i}" aria-pressed="${e.an}"${e.layer ? "" : " disabled"}>
      <span class="zeile"><span class="flaeche ${e.art}" style="--farbe:${e.farbe}"></span><span>${esc(e.name)}${e.layer ? "" : " — data to follow"}</span></span>
    </button>`).join("");
}
$id("ebenen").addEventListener("click", (ev) => {
  const b = ev.target.closest(".ebene"); if (!b || b.disabled) return;
  const e = ebenen[+b.dataset.i];
  e.an = !e.an;
  const ziel = e.gruppe ? e.gruppe : karte;   // Unterzeilen schalten innerhalb ihrer Gruppe
  if (e.an) ziel.addLayer(e.layer); else ziel.removeLayer(e.layer);
  b.setAttribute("aria-pressed", e.an);
});

// ---------- Daten ----------
const D = "data/valais/";
const laden = async (p) => { try { return await json(D + p); } catch (e) { console.warn("fehlt:", p); return null; } };

const [kanton, almen, ...gl] = await Promise.all([
  laden("kanton_VS.json"), laden("almen.json"),
  ...[1850, 1931, 1973, 2010, 2016].map((j) => laden(`gletscher_${j}.json`)),
]);

// Gletscherstände: 1850 dunkle feine Linie … 2016 weisse Fläche
const jahre = [1850, 1931, 1973, 2010, 2016];
const standLayer = jahre.map((j, i) => {
  const d = gl[i]; if (!d) return null;
  const neu = j === 2016;
  return L.geoJSON(d, {
    pane: "gletscher",
    style: { color: FARBE.gletscher[j], weight: neu ? 0.8 : 0.9, opacity: 0.95,
      fill: neu, fillColor: "#ffffff", fillOpacity: neu ? 0.85 : 0 },
    onEachFeature: (f, l) => l.on("click", (e) => {
      const p = f.properties || {};
      L.popup({ className: "valais-popup", closeButton: false, autoPan: false })
        .setLatLng(e.latlng)
        .setContent(`<strong>${esc(p.name || (j === 2016 ? "unnamed glacier" : "Glacier outline"))}</strong><br>`
          + `SGI${j}${p.jahr_aufnahme ? ` (image ${esc(p.jahr_aufnahme)})` : ""}${p.datum ? ` (${esc(p.datum)})` : ""}`
          + `${p.flaeche_km2 != null ? ` · ${Number(p.flaeche_km2).toFixed(2)} km²` : ""}${p.sgi_id ? ` · ${esc(p.sgi_id)}` : ""}`)
        .openOn(karte);
    }),
  });
});
const gletscherGruppe = L.layerGroup(standLayer.filter(Boolean));
ebene({ name: "Glaciers — GLAMOS inventories", art: "titel", farbe: "transparent", an: true,
  layer: standLayer.some(Boolean) ? gletscherGruppe : null });
const STAND = { 1850: "1850 (reconstructed)", 1931: "1931 (mean year)", 1973: "1973", 2010: "2010 (images 2008–2011)", 2016: "2016 (images 2013–2018)" };
jahre.forEach((j, i) => ebene({ name: STAND[j], gruppe: gletscherGruppe,
  art: j === 2016 ? "voll" : "linie", farbe: FARBE.gletscher[j], an: true, layer: standLayer[i] }));

ebene({ name: "Permafrost — potential distribution (BAFU model, 2005)", art: "kachel", farbe: "#8a7fb8", an: false, layer: permafrost });
ebene({ name: "Alpine summer pastures (Sömmerungsweiden, 2025)", art: "voll", farbe: FARBE.almen, an: true,
  layer: almen && L.geoJSON(almen, { pane: "almen", interactive: false,
    style: { stroke: false, fill: true, fillColor: FARBE.almen, fillOpacity: 0.55 } }) });
// Landwirtschaft (ca. 11 MB): erst laden, wenn die Ebene eingeschaltet wird
const landwGruppe = L.layerGroup();
let landwGeladen = false;
landwGruppe.on("add", async () => {
  if (landwGeladen) return; landwGeladen = true;
  const d = await laden("landwirtschaft.json");
  if (d) landwGruppe.addLayer(L.geoJSON(d, { pane: "landwirtschaft", interactive: false,
    style: { stroke: false, fill: true, fillColor: FARBE.landwirtschaft, fillOpacity: 0.6 } }));
});
ebene({ name: "Agricultural land (meadows, pastures, arable, vineyards, orchards, 2025)", art: "voll", farbe: FARBE.landwirtschaft, an: false, layer: landwGruppe });

// Kanton: Umriss und abgedunkelte Umgebung
if (kanton) {
  const ringe = [];
  for (const f of kanton.features || [kanton]) {
    const g = f.geometry || f;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    for (const p of polys) ringe.push(p[0].map(([x, y]) => [y, x]));
  }
  L.polygon([[[89, -179], [89, 179], [-89, 179], [-89, -179]], ...ringe],
    { pane: "maske", stroke: false, fillColor: "#0f1113", fillOpacity: 0.72, interactive: false }).addTo(karte);
  L.geoJSON(kanton, { pane: "rand", interactive: false, style: { color: FARBE.rand, weight: 1, opacity: 0.6, fill: false } }).addTo(karte);
}

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
<p><strong>Relief:</strong> swissALTI3D multidirectional hillshade, Federal Office of Topography swisstopo, via wmts.geo.admin.ch (colours inverted). Canton boundary: swissBOUNDARIES3D, swisstopo.</p>
<p><strong>Glaciers:</strong> Swiss Glacier Inventories SGI1850, SGI1931, SGI1973, SGI2010 and SGI2016, GLAMOS – Glacier Monitoring Switzerland, www.glamos.ch, downloaded 13 October 2026. Dataset DOIs: 10.18750/inventory.sgi1850.r1992, …sgi1931.r2022, …sgi1973.r1976, …sgi2010.r2010, …sgi2016.r2020. Shown are all glaciers whose outline touches the canton. The inventories rest on different sources: 1850 reconstructed from historical maps and geomorphological evidence; 1931 from terrestrial images and historical maps (mean year); 2010 from aerial images 2008–2011; 2016 from aerial images 2013–2018 (swissTLM3D). Their outlines are therefore not strictly comparable. Lines simplified for display (4 m).</p>
<p class="lit-klein">Linsbauer, A., M. Huss, E. Hodel, A. Bauder, M. Fischer, Y. Weidmann, H. Bärtschi, and E. Schmassmann. “The New Swiss Glacier Inventory SGI2016: From a Topographical to a Glaciological Dataset.” <em>Frontiers in Earth Science</em> (2021). https://doi.org/10.3389/feart.2021.704189.<br>
Fischer, M., M. Huss, C. Barboux, and M. Hoelzle. “The New Swiss Glacier Inventory SGI2010: Relevance of Using High-Resolution Source Data in Areas Dominated by Very Small Glaciers.” <em>Arctic, Antarctic, and Alpine Research</em> 46 (2014): 933–45.<br>
Müller, F., T. Caflisch, and G. Müller. <em>Firn und Eis der Schweizer Alpen (Gletscherinventar)</em>. Publ. Nr. 57/57a. Zürich: Geographisches Institut, ETH Zürich, 1976.<br>
Mannerfelt, E. S., A. Dehecq, R. Hugonnet, E. Hodel, M. Huss, A. Bauder, and D. Farinotti. “Halving of Swiss Glacier Volume since 1931 Observed from Terrestrial Image Photogrammetry.” <em>The Cryosphere</em> 16 (2022): 3249–68. https://doi.org/10.5194/tc-16-3249-2022.<br>
Maisch, M., A. Wipf, B. Denneler, J. Battaglia, and C. Benz. <em>Die Gletscher der Schweizer Alpen: Gletscherhochstand 1850, Aktuelle Vergletscherung, Gletscherschwund-Szenarien</em>. 2nd ed. Zürich: vdf Hochschulverlag an der ETH Zürich, 2000.<br>
Paul, F. “The New Swiss Glacier Inventory 2000 – Application of Remote Sensing and GIS.” PhD diss., University of Zurich, 2004.</p>
<p><strong>Permafrost:</strong> Hinweiskarte der potenziellen Permafrostverbreitung, Federal Office for the Environment BAFU, data status 31.10.2005, via wmts.geo.admin.ch. A model derived from a digital elevation model, not a map of measured permafrost.</p>
<p><strong>Alpine summer pastures and agricultural land:</strong> Landwirtschaftliche Nutzungsflächen (LNF), Federal Office for Agriculture BLW and Canton of Valais, reference year 2025, via geodienste.ch (WFS). Summer pastures = use code 930 “Sömmerungsweiden”; agricultural land = all other use codes (including hay meadows in the summer grazing area, codes 621–623). Areas merged and simplified for display (6–8 m; pieces under 400 m² omitted).</p>`;

const credits = $id("credits");
$id("credits-knopf").addEventListener("click", () => { credits.hidden = false; $id("credits-zu").focus(); });
$id("credits-zu").addEventListener("click", () => { credits.hidden = true; });
credits.addEventListener("click", (e) => { if (e.target === credits) credits.hidden = true; });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") credits.hidden = true; });
