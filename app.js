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
viewer.setPointBudget(6_000_000);
viewer.setBackground(null);   // Hintergrund kommt aus dem CSS (weiss)
viewer.setControls(viewer.orbitControls);

// ---------- Konfiguration ----------
const params = new URLSearchParams(location.search);
const konfig = await json(params.get("konfig") || "data/fieldtrips.json");
const ftId = params.get("ft") || konfig.start;
const ft = konfig.fieldtrips.find((f) => f.id === ftId && !f.inaktiv) || konfig.fieldtrips[0];

$id("projekt").textContent = konfig.projekt || "";
$id("titel").textContent = ft.titel;
document.title = `${ft.titel} – Énoncé Fieldtrip Map`;

// Navigation: aktive Fieldtrips als Link, noch nicht vorhandene als grauer Text
$id("nav").innerHTML = konfig.fieldtrips.map((f) => f.inaktiv
  ? `<span aria-disabled="true" title="Not online yet">${esc(f.nav)}</span>`
  : `<a href="?ft=${encodeURIComponent(f.id)}"${f.id === ft.id ? ' aria-current="page"' : ""}>${esc(f.nav)}</a>`
).join("");

const hinweise = (ft.verdichtung || []).map((v) => v.hinweis).filter(Boolean);
$id("quellen").textContent =
  `Terrain: ${ft.gelaende.quelle}, ${ft.gelaende.copyright}.` + (hinweise.length ? " " + hinweise.join(" ") : "");

// ---------- Gelände (Basis + Verdichtungen) ----------
function stil(pc) {
  const m = pc.material;
  m.activeAttributeName = "rgba";
  m.pointSizeType = Potree.PointSizeType.FIXED;   // feine, feste Punktgrösse
  m.size = 1.2;
  m.shape = Potree.PointShape.SQUARE;
}
const laden = (pfad, name) => new Promise((ok, fehler) => {
  Potree.loadPointCloud(pfad, name, (e) => e.pointcloud ? ok(e.pointcloud) : fehler(e));
});

const wolke = await laden(ft.gelaende.pfad, ft.id);
stil(wolke);
viewer.scene.addPointCloud(wolke);
$id("laden").remove();
for (const [i, v] of (ft.verdichtung || []).entries()) {
  laden(v.pfad, `${ft.id}_dicht_${i}`).then((pc) => { stil(pc); viewer.scene.addPointCloud(pc); }).catch(() => {});
}

const bb = wolke.boundingBox.clone().applyMatrix4(wolke.matrixWorld);
const mitte = bb.getCenter(new THREE.Vector3());

// ---------- Route ----------
const route = await json(ft.route);
$id("route-label").textContent = `Route — ${route.typ}`;
{
  const o = route.punkte[0];
  const lokal = route.punkte.flatMap(([e, n, h]) => [e - o[0], n - o[1], h - o[2]]);
  const geo = new LineGeometry();
  geo.setPositions(lokal);
  const mat = new LineMaterial({ color: 0x202f3a, linewidth: 2.5, resolution: new THREE.Vector2(1, 1) });
  viewer.addEventListener("update", () => viewer.renderer.getSize(mat.resolution));
  const linie = new Line2(geo, mat);
  linie.position.set(o[0], o[1], o[2]);
  linie.computeLineDistances();
  viewer.scene.scene.add(linie);
}

// ---------- Startansicht: schräg von Süden ----------
{
  const groesse = bb.getSize(new THREE.Vector3());
  const ziel = new THREE.Vector3(mitte.x, mitte.y + groesse.y * 0.05, bb.min.z + groesse.z * 0.3);
  const pos = new THREE.Vector3(mitte.x, bb.min.y - groesse.y * 0.02, bb.max.z + groesse.y * 0.2);
  viewer.scene.view.position.copy(pos);
  viewer.scene.view.lookAt(ziel);
}

// ---------- Stationen ----------
const stationen = await json(ft.stationen);
$id("untertitel").textContent = `${ft.ort} · ${stationen.length} station${stationen.length === 1 ? "" : "s"}`;

function blick(st) {
  const ziel = [st.lv95.e, st.lv95.n, st.lv95.h];
  return { ziel, pos: [ziel[0], ziel[1] - 650, ziel[2] + 420] };
}

function flugZu(st) {
  const b = blick(st);
  Potree.Utils.moveTo(viewer.scene, new THREE.Vector3(...b.pos), new THREE.Vector3(...b.ziel));
}

const hoehe = (st) => (st.lv95.h != null ? `${Math.round(st.lv95.h)} m a.s.l.` : "");

function zeigeBlatt(st) {
  const o = st.ortung || {};
  const feld = (k, v) => `<dt>${k}</dt><dd>${v ? esc(v) : "–"}</dd>`;
  const ortung = [o.methode, o.genauigkeit_m != null ? `± ${o.genauigkeit_m} m` : ""].filter(Boolean).join(", ");
  const fotos = (st.fotos || []).map((f) =>
    `<img src="${esc(f.datei)}" alt="${esc(st.id + (f.legende ? ": " + f.legende : ""))}" loading="lazy">`).join("");
  const lit = (st.literatur || []).map((l) => `
    <div class="lit">
      <div><strong>${esc(l.kurz || l.quelle_id)}</strong>${l.seite ? `, p. ${esc(l.seite)}` : ""}</div>
      ${l.verifiziert && l.zitat
        ? `<blockquote>“${esc(l.zitat)}”</blockquote>`
        : `<div class="hinweis">Quotation not yet checked against the original – not shown.</div>`}
      ${l.bezug ? `<div class="bezug">Own interpretation: ${esc(l.bezug)}</div>` : ""}
    </div>`).join("");

  $id("blatt-inhalt").innerHTML = `
    <div class="blatt-kopf">
      <div>
        <div class="leise klein">${esc(st.id)}</div>
        <h2>${esc(st.titel || st.id)}</h2>
      </div>
      <button id="blatt-zu" aria-label="Close">×</button>
    </div>
    <dl class="felder">
      ${feld("Date", st.datum)}
      ${feld("Location", `LV95 ${st.lv95.e_text ?? st.lv95.e} / ${st.lv95.n_text ?? st.lv95.n}`)}
      ${feld("Altitude", hoehe(st))}
      ${feld("Located by", ortung)}
      ${feld("Marks", o.bezug)}
    </dl>
    ${fotos ? `<div class="fotos">${fotos}</div>` : ""}
    <div class="abschnitt">
      <div class="label">Description</div>
      ${st.beschreibung ? `<p>${esc(st.beschreibung)}</p>` : `<p class="leer">–</p>`}
      ${st.schaetzung ? `<p class="schaetzung">${esc(st.schaetzung)}</p>` : ""}
    </div>
    ${st.notizen ? `<div class="abschnitt"><div class="label">Notes</div><p>${esc(st.notizen)}</p></div>` : ""}
    <div class="abschnitt">
      <div class="label">References</div>
      ${lit || `<p class="leer">–</p>`}
    </div>`;
  $id("blatt").hidden = false;
  $id("blatt-zu").addEventListener("click", () => { $id("blatt").hidden = true; });
}

function oeffne(st) { flugZu(st); zeigeBlatt(st); }

$id("liste-eintraege").innerHTML = stationen.map((st, i) => `
  <a href="?ft=${encodeURIComponent(ft.id)}&station=${encodeURIComponent(st.id)}" data-i="${i}">
    <span class="liste-id">${esc(st.id)}</span>
    <span class="liste-meta">${esc([hoehe(st), st.datum].filter(Boolean).join(" · "))}</span>
  </a>`).join("");
$id("liste-eintraege").addEventListener("click", (ev) => {
  const a = ev.target.closest("a[data-i]");
  if (!a) return;
  ev.preventDefault();
  oeffne(stationen[Number(a.dataset.i)]);
});

for (const st of stationen) {
  const b = blick(st);
  const a = new Potree.Annotation({
    position: [st.lv95.e, st.lv95.n, st.lv95.h],
    title: st.id,
    cameraPosition: b.pos,   // Potree fliegt beim Klick selbst hierhin
    cameraTarget: b.ziel,
  });
  viewer.scene.annotations.add(a);
  a.addEventListener("click", () => zeigeBlatt(st));
}

// Direktaufruf einer Station über ?station=F1_01
const direkt = params.get("station");
if (direkt) {
  const st = stationen.find((s) => s.id === direkt);
  if (st) oeffne(st);
}
