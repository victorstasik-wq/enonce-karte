// Gelände als geschlossene Fläche („Gipsmodell“) in zwei Stufen:
//  - Übersicht: 1-km-Kacheln aus einem 20-m-Raster, eine gemeinsame Schattierungstextur
//  - Detail:   1-km-Kacheln aus den swissALTI3D-2-m-Daten (Geometrie 4 m, Textur 1024 px ≈ 1 m),
//              werden nachgeladen, wenn die Kamera näher als LADEN_M kommt, und wieder entfernt.
// Höhen: Uint16 in Dezimetern, 0 = keine Daten. Alle Raster: Zeile 0 = Süden.
import * as THREE from "./vendor/potree/libs/three.js/build/three.module.js";

const LADEN_M = 2600;      // Detailkachel laden, wenn die Kamera näher ist
const ENTLADEN_M = 4200;   // wieder entfernen, wenn weiter weg
const MAX_DETAIL = 40;     // höchstens so viele Detailkacheln gleichzeitig
const GLEICHZEITIG = 4;    // parallele Ladevorgänge
const SCHUERZE_M = 40;     // senkrechter Rand je Kachel gegen Spalten zwischen den Stufen

const holeBin = async (pfad) => {
  const r = await fetch(pfad);
  if (!r.ok) throw new Error(`${pfad}: ${r.status}`);
  return new Uint16Array(await r.arrayBuffer());
};

function material(tex, renderer) {
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return new THREE.MeshBasicMaterial({
    map: tex, side: THREE.DoubleSide,
    // Fläche in der Tiefe leicht nach hinten, damit die Route sichtbar bleibt
    polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8,
  });
}

// n×n Höhenwerte (dm) -> Geometrie mit Schürze. hoehe(i,j) liefert dm (0 = keine Daten).
function baueGitter(n, hoehe, ox, oy, schritt, uv) {
  const pos = [], uvs = [], idx = [];
  const nr = new Int32Array(n * n).fill(-1);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const h = hoehe(i, j);
    if (!h) continue;
    const x = ox + i * schritt, y = oy + j * schritt;
    nr[j * n + i] = pos.length / 3;
    pos.push(x, y, h / 10);
    uvs.push(...uv(x, y));
  }
  const v = (i, j) => nr[j * n + i];
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
    const a = v(i, j), b = v(i + 1, j), c = v(i, j + 1), d = v(i + 1, j + 1);
    if (a >= 0 && b >= 0 && c >= 0 && d >= 0) idx.push(a, b, d, a, d, c);
  }
  // Schürze entlang der vier Ränder
  const rand = (punkte) => {
    for (let k = 0; k < punkte.length - 1; k++) {
      const p = v(...punkte[k]), q = v(...punkte[k + 1]);
      if (p < 0 || q < 0) continue;
      const base = pos.length / 3;
      for (const w of [p, q]) {
        pos.push(pos[3 * w], pos[3 * w + 1], pos[3 * w + 2] - SCHUERZE_M);
        uvs.push(uvs[2 * w], uvs[2 * w + 1]);
      }
      idx.push(p, q, base + 1, p, base + 1, base);
    }
  };
  const L = [...Array(n).keys()];
  rand(L.map((i) => [i, 0])); rand(L.map((i) => [i, n - 1]));
  rand(L.map((j) => [0, j])); rand(L.map((j) => [n - 1, j]));
  if (!idx.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  return geo;
}

export async function ladeGelaende(f, viewer) {
  const o = f.ordner;
  const [meta, detail, h20, tex] = await Promise.all([
    fetch(o + "uebersicht.json").then((r) => r.json()),
    fetch(o + "detail.json").then((r) => r.json()),
    holeBin(o + "uebersicht_20m.bin"),
    new THREE.TextureLoader().loadAsync(o + "uebersicht.jpg"),
  ]);
  const { e0, n0, nx, ny, schritt } = meta;
  const [tE0, tN0, tE1, tN1] = meta.textur_bbox;
  const gruppe = new THREE.Group();
  gruppe.position.set(e0, n0, 0);       // alles lokal relativ zur Südwestecke
  const matU = material(tex, viewer.renderer);

  // --- Übersicht in 1-km-Kacheln (50 Maschen à 20 m) ---
  const proKm = 1000 / schritt;
  const uebersicht = new Map();
  for (let tj = 0; tj * proKm < ny - 1; tj++) for (let ti = 0; ti * proKm < nx - 1; ti++) {
    const geo = baueGitter(proKm + 1,
      (i, j) => h20[(tj * proKm + j) * nx + ti * proKm + i],
      ti * 1000, tj * 1000, schritt,
      (x, y) => [(x + e0 - tE0) / (tE1 - tE0), (y + n0 - tN0) / (tN1 - tN0)]);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, matU);
    gruppe.add(m);
    uebersicht.set(`${e0 / 1000 + ti}-${n0 / 1000 + tj}`, m);
  }
  gruppe.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(gruppe);

  // --- Detailkacheln ---
  const hoeheBei = (E, N) => {   // grobe Höhe aus dem 20-m-Raster (für Distanzen)
    const i = Math.min(nx - 1, Math.max(0, Math.round((E - e0) / schritt)));
    const j = Math.min(ny - 1, Math.max(0, Math.round((N - n0) / schritt)));
    return h20[j * nx + i] / 10 || meta.zmin;
  };
  const kacheln = detail.kacheln.map(([e, n]) => ({
    key: `${e}-${n}`, e, n,
    mitte: new THREE.Vector3(e * 1000 + 500, n * 1000 + 500, hoeheBei(e * 1000 + 500, n * 1000 + 500)),
    mesh: null, laedt: false,
  }));
  let aktiv = 0;

  async function lade(k) {
    k.laedt = true; aktiv++;
    try {
      const [h, t] = await Promise.all([
        holeBin(`${o}d/${k.key}.bin`),
        new THREE.TextureLoader().loadAsync(`${o}d/${k.key}.jpg`),
      ]);
      const N = detail.ecken, s = detail.schritt;
      const geo = baueGitter(N, (i, j) => h[j * N + i],
        k.e * 1000 - e0, k.n * 1000 - n0, s,
        (x, y) => [(x + e0 - k.e * 1000) / 1000, (y + n0 - k.n * 1000) / 1000]);
      k.mesh = new THREE.Mesh(geo, material(t, viewer.renderer));
      gruppe.add(k.mesh);
      const u = uebersicht.get(k.key); if (u) u.visible = false;
    } catch (err) {
      console.warn("Detailkachel", k.key, err);
    } finally { k.laedt = false; aktiv--; }
  }
  function entlade(k) {
    gruppe.remove(k.mesh);
    k.mesh.geometry.dispose(); k.mesh.material.map.dispose(); k.mesh.material.dispose();
    k.mesh = null;
    const u = uebersicht.get(k.key); if (u) u.visible = true;
  }

  let zuletzt = 0;
  viewer.addEventListener("update", () => {
    const jetzt = performance.now();
    if (jetzt - zuletzt < 250) return;
    zuletzt = jetzt;
    const cam = viewer.scene.getActiveCamera().position;
    for (const k of kacheln) k.d = cam.distanceTo(k.mitte);
    const nah = kacheln.filter((k) => k.d < LADEN_M).sort((a, b) => a.d - b.d).slice(0, MAX_DETAIL);
    const behalten = new Set(nah);
    for (const k of kacheln) if (k.mesh && (k.d > ENTLADEN_M || (!behalten.has(k) && k.d > LADEN_M))) entlade(k);
    for (const k of nah) {
      if (aktiv >= GLEICHZEITIG) break;
      if (!k.mesh && !k.laedt) lade(k);
    }
  });

  return { gruppe, bb };
}
