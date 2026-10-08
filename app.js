import * as THREE from "./vendor/potree/libs/three.js/build/three.module.js";
import { Line2 } from "./vendor/potree/libs/three.js/lines/Line2.js";
import { LineGeometry } from "./vendor/potree/libs/three.js/lines/LineGeometry.js";
import { LineMaterial } from "./vendor/potree/libs/three.js/lines/LineMaterial.js";
import { ladeGelaende } from "./flaeche.js?v=7";

const $id = (id) => document.getElementById(id);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

async function json(pfad) {
  const r = await fetch(pfad, { cache: "no-cache" });   // Konfiguration immer frisch laden
  if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
  return r.json();
}

// ---------- Viewer ----------
const viewer = new Potree.Viewer($id("karte"));
window.viewer = viewer;
viewer.setEDLEnabled(false);
viewer.setFOV(60);
viewer.setPointBudget(8_000_000);
viewer.setBackground(null);   // Hintergrund kommt aus dem CSS (schwarz)
viewer.setControls(viewer.orbitControls);
// volle Bildschirmauflösung (Retina), sonst wird nur mit halber Auflösung gerendert und hochskaliert
viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

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

const hinweise = ft.flaeche ? [] : (ft.verdichtung || []).map((v) => v.hinweis).filter(Boolean);
const quelle = ft.flaeche ? ft.flaeche.quelle : ft.gelaende.quelle;
$id("quellen").textContent =
  `Terrain: ${quelle}, ${ft.gelaende.copyright}.` + (hinweise.length ? " " + hinweise.join(" ") : "");

// ---------- Gelände ----------
function stil(pc) {
  const m = pc.material;
  m.activeAttributeName = "rgba";
  m.pointSizeType = Potree.PointSizeType.FIXED;   // feine, feste Punktgrösse
  // Punktgrösse in Bildschirmpixeln; bei Retina (devicePixelRatio 2) sonst nur halb so gross
  m.size = 1.2 * Math.min(window.devicePixelRatio || 1, 2);
  m.shape = Potree.PointShape.SQUARE;
}
const laden = (pfad, name) => new Promise((ok, fehler) => {
  Potree.loadPointCloud(pfad, name, (e) => e.pointcloud ? ok(e.pointcloud) : fehler(e));
});

let bb;
if (ft.flaeche) {
  // Gelände als Fläche (Übersicht + nachgeladene 2-m-Detailkacheln)
  const f = await ladeGelaende(ft.flaeche, viewer);
  viewer.scene.scene.add(f.gruppe);
  // gleiche Art Startansicht wie bei der Punktwolke: deren Box ist ein Würfel (Höhe = Seitenlänge)
  bb = f.bb.clone();
  bb.max.z = bb.min.z + (bb.max.x - bb.min.x);
  $id("laden").remove();
} else {
  // Gelände als Punktwolke (Basis + Verdichtungen)
  // „Myzel“: Punkte wachsen von der Route aus (Wachstumszeit 0…1000 als gps-time in den Punktwolken)
  viewer.setFilterGPSTimeRange(-1e9, -1e8);   // zuerst nichts zeigen
  const wolke = await laden(ft.gelaende.pfad, ft.id);
  stil(wolke);
  viewer.scene.addPointCloud(wolke);
  $id("laden").remove();
  for (const [i, v] of (ft.verdichtung || []).entries()) {
    laden(v.pfad, `${ft.id}_dicht_${i}`).then((pc) => { stil(pc); viewer.scene.addPointCloud(pc); }).catch(() => {});
  }
  bb = wolke.boundingBox.clone().applyMatrix4(wolke.matrixWorld);
  wachsen();
}

function wachsen(dauer = 9000) {
  const t = { x: 0 };
  setTimeout(() => {
    new TWEEN.Tween(t).to({ x: 1 }, dauer)
      .easing(TWEEN.Easing.Sinusoidal.InOut)
      .onUpdate(() => viewer.setFilterGPSTimeRange(-1e9, t.x * 1015))
      .onComplete(() => viewer.setFilterGPSTimeRange(-1e9, 1e9))
      .start();
  }, 600);
}
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
  // Route immer sichtbar über den dichten Punkten (sonst verdecken die Punkte die Linie)
  mat.depthTest = false;
  const linie = new Line2(geo, mat);
  linie.renderOrder = 999;
  linie.position.set(o[0], o[1], o[2]);
  linie.computeLineDistances();
  viewer.scene.scene.add(linie);
}

// ---------- Ansichten ----------
// Kamera aus Zielpunkt, Richtung (Azimut ab Nord im Uhrzeigersinn, vom Ziel zur Kamera), Neigung und Abstand
function ansicht(a) {
  const az = THREE.MathUtils.degToRad(a.azimut), ne = THREE.MathUtils.degToRad(a.neigung);
  const [e, n, h] = a.ziel;
  return { ziel: [e, n, h], pos: [e + a.abstand * Math.sin(az) * Math.cos(ne), n + a.abstand * Math.cos(az) * Math.cos(ne), h + a.abstand * Math.sin(ne)] };
}

// ---------- Startansicht ----------
if (ft.start) {
  const s = ansicht(ft.start);
  viewer.scene.view.position.set(...s.pos);
  viewer.scene.view.lookAt(new THREE.Vector3(...s.ziel));
} else {   // ohne Angabe: schräg von Süden
  const groesse = bb.getSize(new THREE.Vector3());
  const ziel = new THREE.Vector3(mitte.x, mitte.y + groesse.y * 0.05, bb.min.z + groesse.z * 0.3);
  const pos = new THREE.Vector3(mitte.x, bb.min.y - groesse.y * 0.02, bb.max.z + groesse.y * 0.2);
  viewer.scene.view.position.copy(pos);
  viewer.scene.view.lookAt(ziel);
}

// ---------- Zusätzliche Ebenen (z. B. Gletscherfläche), in der Legende ein- und ausschaltbar ----------
async function ladeEbene(eb) {
  const [grau, farbig, umriss] = await Promise.all([laden(eb.grau, eb.id + "_grau"), laden(eb.farbig, eb.id + "_farbig"), json(eb.umriss)]);
  for (const pc of [grau, farbig]) { stil(pc); viewer.scene.addPointCloud(pc); }
  const linien = umriss.ringe.map((ring) => {
    const o = ring[0];
    const geo = new LineGeometry();
    geo.setPositions(ring.flatMap(([e, n, h]) => [e - o[0], n - o[1], h - o[2]]));
    const mat = new LineMaterial({ color: new THREE.Color(eb.farbe).getHex(), linewidth: 2, resolution: new THREE.Vector2(1, 1) });
    viewer.addEventListener("update", () => viewer.renderer.getSize(mat.resolution));
    mat.depthTest = false;
    const l = new Line2(geo, mat);
    l.renderOrder = 998; l.position.set(o[0], o[1], o[2]); l.computeLineDistances();
    viewer.scene.scene.add(l);
    return l;
  });
  const knopf = document.createElement("button");
  knopf.className = "zeile ebene";
  knopf.innerHTML = `<span class="flaeche" style="--farbe:${esc(eb.farbe)}"></span><span>${esc(eb.name)}</span>`;
  const setze = (an) => {
    farbig.visible = an; grau.visible = !an; linien.forEach((l) => { l.visible = an; });
    knopf.setAttribute("aria-pressed", String(an));
  };
  knopf.addEventListener("click", () => setze(knopf.getAttribute("aria-pressed") !== "true"));
  $id("ebenen").append(knopf);
  setze(eb.an !== false);
}
for (const eb of ft.ebenen || []) ladeEbene(eb).catch((err) => console.warn("Ebene", eb.id, err));
if ((ft.ebenen || []).length) {
  $id("quellen").textContent += " " + ft.ebenen.map((eb) => eb.quelle).filter(Boolean).join(" ");
}

// ---------- Stationen ----------
const stationen = await json(ft.stationen);
$id("untertitel").textContent = `${ft.ort} · ${stationen.length} station${stationen.length === 1 ? "" : "s"}`;

function blick(st) {
  if (st.blick) return ansicht(st.blick);   // eigene Ansicht je Station (z. B. ganzer Gletscher)
  const ziel = [st.lv95.e, st.lv95.n, st.lv95.h];
  return { ziel, pos: [ziel[0], ziel[1] - 650, ziel[2] + 420] };
}

// Langsamer, weicher Flug zur Station (Potree selbst fliegt in 0,5 s)
const FLUGDAUER = 2800;   // Millisekunden
let flugTween = null;
function flugZu(st) {
  const b = blick(st);
  const view = viewer.scene.view;
  const cam = viewer.scene.getActiveCamera();
  const p0 = view.position.clone();
  const z0 = p0.clone().add(cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(view.radius));
  const p1 = new THREE.Vector3(...b.pos), z1 = new THREE.Vector3(...b.ziel);
  const t = { x: 0 };
  if (flugTween) flugTween.stop();
  flugTween = new TWEEN.Tween(t).to({ x: 1 }, FLUGDAUER)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      view.position.lerpVectors(p0, p1, t.x);
      view.lookAt(new THREE.Vector3().lerpVectors(z0, z1, t.x));
    })
    .start();
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
  a.moveHere = () => flugZu(st);   // eigener, langsamerer Flug statt Potree-Standard
  viewer.scene.annotations.add(a);
  a.addEventListener("click", () => zeigeBlatt(st));
}

// Direktaufruf einer Station über ?station=F1_01
const direkt = params.get("station");
if (direkt) {
  const st = stationen.find((s) => s.id === direkt);
  if (st) oeffne(st);
}
