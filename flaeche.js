// Gelände als geschlossene Fläche (statt Punktwolke).
// Geometrie: Höhenraster (Uint16, Dezimeter, 0 = keine Daten), Schattierung: vorgerechnete Textur.
import * as THREE from "./vendor/potree/libs/three.js/build/three.module.js";

export async function ladeFlaeche(f, renderer) {
  const r = await fetch(f.hoehen);
  if (!r.ok) throw new Error(`${f.hoehen}: ${r.status}`);
  const h = new Uint16Array(await r.arrayBuffer());
  const { nx, ny, schritt: s, e0, n0 } = f;
  const [tE0, tN0, tE1, tN1] = f.textur_bbox;

  let zmin = Infinity;
  for (const v of h) if (v > 0 && v < zmin) zmin = v;

  const pos = new Float32Array(nx * ny * 3);
  const uv = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const E = e0 + i * s, N = n0 + j * s;
      pos[3 * k] = i * s;                       // lokal, relativ zu (e0, n0)
      pos[3 * k + 1] = j * s;
      pos[3 * k + 2] = (h[k] > 0 ? h[k] : zmin) / 10;
      uv[2 * k] = (E - tE0) / (tE1 - tE0);
      uv[2 * k + 1] = (N - tN0) / (tN1 - tN0);
    }
  }
  // nur Zellen, deren vier Ecken Daten haben
  const idx = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (h[a] && h[b] && h[c] && h[d]) idx.push(a, b, d, a, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
  geo.computeBoundingBox();

  const tex = await new THREE.TextureLoader().loadAsync(f.textur);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshBasicMaterial({
    map: tex, side: THREE.DoubleSide,
    // Fläche in der Tiefe leicht nach hinten schieben, damit die Route nicht in ihr verschwindet
    polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 8,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(e0, n0, 0);
  mesh.updateMatrixWorld();
  const bb = geo.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  return { mesh, bb };
}
