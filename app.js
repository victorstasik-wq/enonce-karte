import * as THREE from "./vendor/potree/libs/three.js/build/three.module.js";
import { Line2 } from "./vendor/potree/libs/three.js/lines/Line2.js";
import { LineGeometry } from "./vendor/potree/libs/three.js/lines/LineGeometry.js";
import { LineMaterial } from "./vendor/potree/libs/three.js/lines/LineMaterial.js";

const $id = (id) => document.getElementById(id);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

async function json(pfad) {
  const r = await fetch(pfad);
  if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
  return r.json();
}

// ---------- Viewer ----------
const viewer = new Potree.Viewer($id("karte"));
window.viewer = viewer;
viewer.setEDLEnabled(false);
viewer.setFOV(60);
viewer.setPointBudget(3_000_000);
viewer.setBackground(null);   // Hintergrund kommt aus dem CSS-Verlauf
viewer.setControls(viewer.orbitControls);

// ---------- Konfiguration ----------
const params = new URLSearchParams(location.search);
const konfigPfad = params.get("konfig") || "data/fieldtrips.json";
const konfig = await json(konfigPfad);
const ftId = params.get("ft") || konfig.start;
const ft = konfig.fieldtrips.find((f) => f.id === ftId) || konfig.fieldtrips[0];

$id("titel").textContent = ft.titel;
$id("quellen").textContent = `Terrain: ${ft.gelaende.quelle}, ${ft.gelaende.copyright}`;

// ---------- Gelände ----------
const wolke = await new Promise((ok, fehler) => {
  Potree.loadPointCloud(ft.gelaende.pfad, ft.id, (e) => e.pointcloud ? ok(e.pointcloud) : fehler(e));
});
const m = wolke.material;
m.activeAttributeName = "rgba";
m.pointSizeType = Potree.PointSizeType.FIXED;   // feste Punktgrösse: beim Heranzoomen wird das 10-m-Raster sichtbar
m.size = 2.5;
m.shape = Potree.PointShape.SQUARE;
viewer.scene.addPointCloud(wolke);
$id("laden").remove();

const bb = wolke.boundingBox.clone().applyMatrix4(wolke.matrixWorld);
const mitte = bb.getCenter(new THREE.Vector3());

// ---------- Route ----------
const route = await json(ft.route);
$id("route-label").textContent = `Route ${route.name} – ${route.typ}`;
{
  const o = route.punkte[0];
  const lokal = route.punkte.flatMap(([e, n, h]) => [e - o[0], n - o[1], h - o[2]]);
  const geo = new LineGeometry();
  geo.setPositions(lokal);
  const mat = new LineMaterial({ color: 0xff6a3d, linewidth: 3, resolution: new THREE.Vector2(1, 1) });
  viewer.addEventListener("update", () => viewer.renderer.getSize(mat.resolution));
  const linie = new Line2(geo, mat);
  linie.position.set(o[0], o[1], o[2]);
  linie.computeLineDistances();
  viewer.scene.scene.add(linie);
}

// ---------- Startansicht: schräg von Süden ----------
function startansicht() {
  const groesse = bb.getSize(new THREE.Vector3());
  const ziel = new THREE.Vector3(mitte.x, mitte.y + groesse.y * 0.05, bb.min.z + groesse.z * 0.3);
  const pos = new THREE.Vector3(mitte.x, bb.min.y - groesse.y * 0.02, bb.max.z + groesse.y * 0.2);
  viewer.scene.view.position.copy(pos);
  viewer.scene.view.lookAt(ziel);
}
startansicht();

// ---------- Stationen ----------
const stationen = await json(ft.stationen);
$id("untertitel").textContent = stationen.length
  ? `${stationen.length} station${stationen.length > 1 ? "s" : ""}`
  : "No stations yet";

function blick(st) {
  const ziel = [st.lv95.e, st.lv95.n, st.lv95.h];
  return { ziel, pos: [ziel[0], ziel[1] - 650, ziel[2] + 420] };
}

function flugZu(st) {
  const b = blick(st);
  const p = new THREE.Vector3(...b.ziel);
  const pos = new THREE.Vector3(...b.pos);
  if (Potree.Utils && Potree.Utils.moveTo) {
    Potree.Utils.moveTo(viewer.scene, pos, p);
  } else {
    viewer.scene.view.position.copy(pos);
    viewer.scene.view.lookAt(p);
  }
}

function zeigeBlatt(st) {
  const o = st.ortung || {};
  const fotos = (st.fotos || []).map((f) => `
    <figure><img src="${esc(f.datei)}" alt="${esc(f.legende)}" loading="lazy">
    ${f.legende ? `<figcaption>${esc(f.legende)}</figcaption>` : ""}</figure>`).join("");
  const lit = (st.literatur || []).map((l) => `
    <div class="lit">
      <div><strong>${esc(l.kurz || l.quelle_id)}</strong>${l.seite ? `, p. ${esc(l.seite)}` : ""}</div>
      ${l.verifiziert && l.zitat
        ? `<blockquote>“${esc(l.zitat)}”</blockquote>`
        : `<div class="hinweis">Quotation not yet checked against the original – not shown.</div>`}
      ${l.bezug ? `<div class="bezug">Own interpretation: ${esc(l.bezug)}</div>` : ""}
    </div>`).join("");
  const leer = (t) => `<p class="leer">${t}</p>`;

  $id("blatt-inhalt").innerHTML = `
    <h2>${esc(st.id)}</h2>
    <div class="meta">${esc(st.datum || "")}</div>

    <h3>Location</h3>
    <dl>
      <dt>LV95</dt><dd>${esc(st.lv95.e_text ?? st.lv95.e)} / ${esc(st.lv95.n_text ?? st.lv95.n)}</dd>
      <dt>Altitude</dt><dd>${st.lv95.h != null ? esc(Math.round(st.lv95.h)) + " m a.s.l." : "–"}</dd>
      <dt>Located by</dt><dd>${esc(o.methode || "–")}${o.genauigkeit_m != null ? `, ± ${esc(o.genauigkeit_m)} m` : ""}</dd>
      <dt>Marks</dt><dd>${esc(o.bezug || "–")}</dd>
    </dl>

    <h3>Photos</h3>${fotos || leer("No photos yet.")}
    <h3>Model</h3>${st.modell && st.modell.datei ? `<p>${esc(st.modell.datei)}</p>` : leer("No scan yet.")}
    <h3>Description</h3>${st.beschreibung ? `<p>${esc(st.beschreibung)}</p>` : leer("–")}
    <h3>Notes</h3>${st.notizen ? `<p>${esc(st.notizen)}</p>` : leer("–")}
    <h3>References</h3>${lit || leer("–")}
  `;
  $id("blatt").hidden = false;
}

$id("blatt-zu").addEventListener("click", () => { $id("blatt").hidden = true; });

for (const st of stationen) {
  const b = blick(st);
  const a = new Potree.Annotation({
    position: [st.lv95.e, st.lv95.n, st.lv95.h + 15],
    title: st.id,
    cameraPosition: b.pos,   // Potree fliegt beim Klick selbst hierhin
    cameraTarget: b.ziel,
  });
  viewer.scene.annotations.add(a);
  a.addEventListener("click", () => zeigeBlatt(st));
}

// Direktaufruf einer Station über ?station=F2_01
const direkt = params.get("station");
if (direkt) {
  const st = stationen.find((s) => s.id === direkt);
  if (st) { flugZu(st); zeigeBlatt(st); }
}
