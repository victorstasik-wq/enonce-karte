// Startseite „Assembled Periphery (Archive)“: Titel, Einleitung, Liste der Fieldtrips,
// im Hintergrund dreht sich langsam das Gelände von Fieldtrip 01 (nicht bedienbar).

// alte Direktlinks (index.html?ft=…&station=…) führen weiter zur Karte
if (location.search.includes("ft=") || location.search.includes("station=")) {
  location.replace("karte.html" + location.search);
}

const $id = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const json = async (p) => { const r = await fetch(p, { cache: "no-cache" }); if (!r.ok) throw new Error(p); return r.json(); };

const konfig = await json("data/fieldtrips.json");

// ---------- Liste der Fieldtrips ----------
const zeilen = await Promise.all(konfig.fieldtrips.map(async (f) => {
  if (f.inaktiv) {
    return `<li class="inaktiv"><span class="ft-name mark">${esc(f.nav)}</span><span class="ft-meta mark">coming soon</span></li>`;
  }
  let n = null;
  try { n = (await json(f.stationen)).length; } catch {}
  const meta = n == null ? "" : `${n} station${n === 1 ? "" : "s"}`;
  return `<li><a href="karte.html?ft=${encodeURIComponent(f.id)}"><span class="ft-name mark">${esc(f.nav)}</span><span class="ft-meta mark">${esc(meta)}</span></a></li>`;
}));
$id("fieldtrips").innerHTML = zeilen.join("");

// ---------- weitere Bereiche: Notebook / Fieldnotes, Literature ----------
$id("bereiche").innerHTML = (konfig.bereiche || []).map((b) => b.inaktiv || !b.link
  ? `<li class="inaktiv"><span class="ft-name mark">${esc(b.name)}</span><span class="ft-meta mark">coming soon</span></li>`
  : `<li><a href="${esc(b.link)}"><span class="ft-name mark">${esc(b.name)}</span><span class="ft-meta mark"></span></a></li>`).join("");

// ---------- Menü „Content“: nur die Liste scrollt, die Seite selbst nicht ----------
{
  const klapp = document.querySelector(".inhalt-aufklapp"), liste = document.querySelector(".inhalt-liste");
  const hoehe = () => {
    if (!klapp.open) return;
    const unten = window.innerWidth <= 760 ? 48 : 64;   // Platz für den swisstopo-Hinweis
    liste.style.maxHeight = `${Math.max(160, window.innerHeight - liste.getBoundingClientRect().top - unten)}px`;
  };
  klapp.addEventListener("toggle", hoehe);
  window.addEventListener("resize", hoehe);
}

// ---------- Hintergrund: langsam drehendes Gelände ----------
const ft = konfig.fieldtrips.find((f) => f.id === konfig.start && !f.inaktiv);
if (ft && ft.gelaende && ft.start) {
  const viewer = new Potree.Viewer($id("hintergrund"));
  viewer.setEDLEnabled(false);
  viewer.setFOV(60);
  viewer.setPointBudget(2_500_000);
  viewer.setBackground(null);
  viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  viewer.setFilterPointSourceIDRange(0, -1);   // zuerst nichts zeigen, dann verdichten

  const stil = (pc) => {
    const m = pc.material;
    m.activeAttributeName = "rgba";
    m.pointSizeType = Potree.PointSizeType.FIXED;
    m.size = 1.2 * Math.min(window.devicePixelRatio || 1, 2);
    m.shape = Potree.PointShape.SQUARE;
  };
  const laden = (pfad, name) => new Promise((ok, fehler) =>
    Potree.loadPointCloud(pfad, name, (e) => (e.pointcloud ? ok(e.pointcloud) : fehler(e))));

  // Kamera kreist um das Ziel der Startansicht (eine Umdrehung in 4 Minuten)
  const [ze, zn, zh] = ft.start.ziel;
  const ne = (ft.start.neigung * Math.PI) / 180, ab = ft.start.abstand * 1.05;
  const az0 = (ft.start.azimut * Math.PI) / 180, t0 = performance.now();
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
  viewer.addEventListener("update", () => {
    const az = az0 + (ruhig ? 0 : ((performance.now() - t0) / 240000) * 2 * Math.PI);
    const v = viewer.scene.view;
    v.position.set(ze + ab * Math.sin(az) * Math.cos(ne), zn + ab * Math.cos(az) * Math.cos(ne), zh + ab * Math.sin(ne));
    v.lookAt(new v.position.constructor(ze, zn, zh));
  });

  try {
    const basis = await laden(ft.gelaende.pfad, "basis");
    stil(basis); viewer.scene.addPointCloud(basis);
    for (const [i, v] of (ft.verdichtung || []).entries()) {
      laden(v.pfad, `dicht_${i}`).then((pc) => { stil(pc); viewer.scene.addPointCloud(pc); }).catch(() => {});
    }
    // verdichten wie auf der Karte: zuerst wenige Punkte, dann immer mehr
    setTimeout(() => {
      const t = { x: 0 };
      new TWEEN.Tween(t).to({ x: 1 }, 7000).easing(TWEEN.Easing.Linear.None)
        .onUpdate(() => viewer.setFilterPointSourceIDRange(0, Math.pow(t.x, 3) * 1015))
        .onComplete(() => viewer.setFilterPointSourceIDRange(0, 65535))
        .start();
    }, 1500);
  } catch (e) {
    console.warn("Hintergrund konnte nicht geladen werden", e);
  }
}
