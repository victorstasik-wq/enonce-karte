// Seite „Énoncé“: Inhaltsverzeichnis und Diagramm „Anatomy of the work“.
// Klick auf einen Eintrag im Inhaltsverzeichnis zoomt das Diagramm auf den zugehörigen Bereich; Klick aufs Diagramm
// öffnet es in einem Fenster, in dem man frei zoomen und verschieben kann.
const $id = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// Bereiche im Diagramm (Koordinaten des SVG, 1191 × 1684): x, y, Breite, Höhe
const BEREICHE = {
  gesamt: [0, 0, 1191, 1684],
  vernacular: [210, 90, 430, 170],
  gaze: [780, 80, 400, 140],
  condition: [600, 230, 585, 215],
  time: [600, 375, 590, 205],
  assembly: [540, 530, 640, 180],
  bricolage: [20, 360, 520, 220],
  object: [20, 820, 440, 200],
  periphery: [10, 1080, 330, 290],
  fieldtrips: [280, 560, 905, 680],
  f1: [10, 590, 520, 190],
  f2: [690, 700, 490, 180],
  f23: [690, 700, 490, 340],
  theorie: [10, 1340, 1175, 240],
  ungers_ls: [10, 1450, 1175, 130],
};
const vereinigt = (namen) => {
  const b = namen.map((n) => BEREICHE[n]).filter(Boolean);
  const x0 = Math.min(...b.map((r) => r[0])), y0 = Math.min(...b.map((r) => r[1]));
  const x1 = Math.max(...b.map((r) => r[0] + r[2])), y1 = Math.max(...b.map((r) => r[1] + r[3]));
  const rand = 16;
  return [x0 - rand, y0 - rand, x1 - x0 + 2 * rand, y1 - y0 + 2 * rand];
};

// ---------- Zoom über CSS-Transform (flüssig: der Browser verschiebt ein Bild statt das SVG neu zu zeichnen) ----------
const VB = [1191, 1684];
class Zoom {
  constructor(rahmen, svgText) {
    this.r = rahmen;
    this.b = document.createElement("div"); this.b.className = "zoom-buehne";
    this.b.innerHTML = svgText;
    const svg = this.b.querySelector("svg");
    svg.removeAttribute("width"); svg.removeAttribute("height"); svg.setAttribute("aria-hidden", "true");
    rahmen.appendChild(this.b);
    this.s = 1; this.tx = 0; this.ty = 0; this.ziel = BEREICHE.gesamt;
    this.b.addEventListener("transitionend", () => this.b.classList.remove("bewegt"));
    new ResizeObserver(() => this.zeige(this.ziel, false)).observe(rahmen);
  }
  masse() {
    const fw = this.r.clientWidth, fh = this.r.clientHeight;
    const g = Math.min(fw / VB[0], fh / VB[1]);              // Grundmassstab: ganzes Diagramm passt hinein
    this.b.style.width = VB[0] * g + "px"; this.b.style.height = VB[1] * g + "px";
    return { fw, fh, g };
  }
  setze(s, tx, ty, weich) {
    this.s = s; this.tx = tx; this.ty = ty;
    this.b.classList.toggle("weich", weich);
    if (weich) this.b.classList.add("bewegt");
    this.b.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  }
  zeige(ziel, weich = true) {                               // Bereich [x, y, w, h] in Diagramm-Koordinaten
    this.ziel = ziel;
    const { fw, fh, g } = this.masse(), [x, y, w, h] = ziel;
    const s = Math.min(fw / (w * g), fh / (h * g));
    this.setze(s, fw / 2 - (x + w / 2) * g * s, fh / 2 - (y + h / 2) * g * s, weich && !ruhig);
  }
  zoomBei(px, py, f) {                                      // um einen Punkt im Rahmen zoomen (Mausrad, Pinch, Knöpfe)
    const s = Math.min(14, Math.max(0.6, this.s * f)), k = s / this.s;
    this.setze(s, px - (px - this.tx) * k, py - (py - this.ty) * k, false);
  }
  verschiebe(dx, dy) { this.setze(this.s, this.tx + dx, this.ty + dy, false); }
}
const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Diagramm laden ----------
const rahmen = $id("anatomie");
let haupt = null, svgText = "";
try {
  svgText = (await (await fetch("data/anatomie_der_arbeit.svg?v=8", { cache: "no-cache" })).text()).replace(/^<\?xml[^>]*>\s*/, "");
  haupt = new Zoom(rahmen, svgText);
  haupt.zeige(BEREICHE.gesamt, false);
} catch (e) {
  rahmen.textContent = "Diagram could not be loaded.";
}

// ---------- Fenster: Diagramm gross, frei zoomen und verschieben (wie die Fotos bei den Stationen) ----------
const fenster = (() => {
  const el = document.createElement("div");
  el.id = "diagramm-galerie"; el.className = "diagramm-galerie"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Anatomy of the work");
  el.innerHTML = `
    <div class="galerie-fenster diagramm-fenster" tabindex="-1">
      <div class="diagramm-flaeche"></div>
      <div class="diagramm-steuer">
        <button type="button" class="z-plus" aria-label="Zoom in">+</button>
        <button type="button" class="z-minus" aria-label="Zoom out">−</button>
        <button type="button" class="z-ganz" aria-label="Whole diagram">Whole diagram</button>
      </div>
      <div class="galerie-zahl">Scroll or pinch to zoom · drag to move</div>
      <button class="galerie-zu" aria-label="Close">×</button>
    </div>`;
  document.body.appendChild(el);
  const flaeche = el.querySelector(".diagramm-flaeche"), kasten = el.querySelector(".diagramm-fenster");
  let z = null, vorher = null;
  const zu = () => { el.hidden = true; vorher?.focus(); };
  el.querySelector(".galerie-zu").addEventListener("click", zu);
  el.addEventListener("click", (e) => { if (e.target === el) zu(); });
  document.addEventListener("keydown", (e) => {
    if (el.hidden) return;
    if (e.key === "Escape") zu();
    else if (e.key === "+" || e.key === "=") z.zoomBei(flaeche.clientWidth / 2, flaeche.clientHeight / 2, 1.3);
    else if (e.key === "-") z.zoomBei(flaeche.clientWidth / 2, flaeche.clientHeight / 2, 1 / 1.3);
  });
  el.querySelector(".z-plus").addEventListener("click", () => z.zoomBei(flaeche.clientWidth / 2, flaeche.clientHeight / 2, 1.4));
  el.querySelector(".z-minus").addEventListener("click", () => z.zoomBei(flaeche.clientWidth / 2, flaeche.clientHeight / 2, 1 / 1.4));
  el.querySelector(".z-ganz").addEventListener("click", () => z.zeige(BEREICHE.gesamt));
  // Mausrad: zoomen an der Mausposition
  flaeche.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = flaeche.getBoundingClientRect();
    z.zoomBei(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });
  // Ziehen (eine Hand) und Pinch (zwei Finger)
  const zeiger = new Map(); let pinch = null;
  flaeche.addEventListener("pointerdown", (e) => { flaeche.setPointerCapture(e.pointerId); zeiger.set(e.pointerId, [e.clientX, e.clientY]); flaeche.classList.add("zieht"); });
  flaeche.addEventListener("pointermove", (e) => {
    if (!zeiger.has(e.pointerId)) return;
    const alt = zeiger.get(e.pointerId); zeiger.set(e.pointerId, [e.clientX, e.clientY]);
    if (zeiger.size === 1) z.verschiebe(e.clientX - alt[0], e.clientY - alt[1]);
    else if (zeiger.size === 2) {
      const [a, b] = [...zeiger.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = flaeche.getBoundingClientRect();
      if (pinch) z.zoomBei((a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, d / pinch);
      pinch = d;
    }
  });
  const los = (e) => { zeiger.delete(e.pointerId); if (zeiger.size < 2) pinch = null; if (!zeiger.size) flaeche.classList.remove("zieht"); };
  flaeche.addEventListener("pointerup", los); flaeche.addEventListener("pointercancel", los);
  return {
    oeffne(ziel) {
      vorher = document.activeElement; el.hidden = false;
      if (!z) z = new Zoom(flaeche, svgText);
      z.zeige(ziel, false); kasten.focus();
    },
  };
})();
rahmen.addEventListener("click", () => { if (haupt) fenster.oeffne(haupt.ziel); });
rahmen.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && haupt) { e.preventDefault(); fenster.oeffne(haupt.ziel); } });

// ---------- Inhaltsverzeichnis ↔ Diagramm ----------
const ganz = document.querySelector(".ganz-knopf");
const knoepfe = [...document.querySelectorAll(".toc-knopf")];
function waehle(knopf) {
  const namen = knopf.dataset.ziel.split(" ");
  const ganzesBild = namen.length === 1 && namen[0] === "gesamt";
  haupt?.zeige(ganzesBild ? BEREICHE.gesamt : vereinigt(namen));
  knoepfe.forEach((k) => k.setAttribute("aria-pressed", String(k === knopf)));
  ganz.hidden = ganzesBild;
  // das Diagramm steht unter dem Inhaltsverzeichnis: hinscrollen, wenn es nicht gut sichtbar ist
  const r = rahmen.getBoundingClientRect();
  if (r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.3) $id("anatomie-abb").scrollIntoView({ behavior: ruhig ? "auto" : "smooth", block: "start" });
}
knoepfe.forEach((k) => k.addEventListener("click", () => waehle(k)));
ganz.addEventListener("click", () => {
  haupt?.zeige(BEREICHE.gesamt); ganz.hidden = true;
  knoepfe.forEach((k) => k.setAttribute("aria-pressed", "false"));
});

// ---------- Reiter: Contents · Bibliography · Interviews and conversations · Notes ----------
const menue = $id("menue");
const reiterKnoepfe = [...document.querySelectorAll('.reiter [role="tab"]')];
function zeigeReiter(name, merken = true) {
  if (!document.getElementById("r-" + name)) name = "contents";
  reiterKnoepfe.forEach((k) => k.setAttribute("aria-selected", String(k.dataset.reiter === name)));
  document.querySelectorAll(".reiter-feld").forEach((f) => { f.hidden = f.id !== "r-" + name; });
  if (merken) history.replaceState(null, "", name === "contents" ? location.pathname : "#" + name);
}
reiterKnoepfe.forEach((k) => k.addEventListener("click", () => zeigeReiter(k.dataset.reiter)));
document.querySelectorAll(".reiter-link").forEach((k) => k.addEventListener("click", () => zeigeReiter(k.dataset.reiter)));
// Direktlink (z. B. von der Startseite): enonce.html#bibliography öffnet das Menü auf diesem Reiter
{
  const h = location.hash.slice(1);
  if (h) { menue.open = true; zeigeReiter(h, false); }
  window.addEventListener("hashchange", () => { const n = location.hash.slice(1); if (n) { menue.open = true; zeigeReiter(n, false); } });
}

// ---------- Notes: Blätter zum Durchblättern (wie die Fotos bei den Stationen) ----------
const galerie = (() => {
  const el = document.createElement("div");
  el.id = "galerie"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Notes");
  el.innerHTML = `
    <div class="galerie-fenster notes-fenster">
      <figure><img alt=""><figcaption></figcaption></figure>
      <button class="galerie-pfeil zurueck" aria-label="Previous sheet">‹</button>
      <button class="galerie-pfeil weiter" aria-label="Next sheet">›</button>
      <div class="galerie-zahl"></div>
      <button class="galerie-zu" aria-label="Close notes">×</button>
    </div>`;
  document.body.appendChild(el);
  const img = el.querySelector("img"), text = el.querySelector("figcaption"), zahl = el.querySelector(".galerie-zahl");
  const fenster = el.querySelector(".galerie-fenster"); fenster.tabIndex = -1;
  let liste = [], nr = 0, vorher = null;
  const zeige = () => {
    const f = liste[nr];
    img.src = f.datei; img.alt = f.legende || ""; text.textContent = f.legende || "";
    zahl.textContent = `${nr + 1} / ${liste.length}`;
    el.querySelectorAll(".galerie-pfeil").forEach((b) => { b.hidden = liste.length < 2; });
    for (const d of [1, -1]) if (liste.length > 1) new Image().src = liste[(nr + d + liste.length) % liste.length].datei;
  };
  const blaettern = (d) => { if (liste.length < 2) return; nr = (nr + d + liste.length) % liste.length; zeige(); };
  const zu = () => { el.hidden = true; vorher?.focus(); };
  el.querySelector(".zurueck").addEventListener("click", () => blaettern(-1));
  el.querySelector(".weiter").addEventListener("click", () => blaettern(1));
  el.querySelector(".galerie-zu").addEventListener("click", zu);
  el.addEventListener("click", (e) => { if (e.target === el) zu(); });
  document.addEventListener("keydown", (e) => {
    if (el.hidden) return;
    if (e.key === "Escape") zu(); else if (e.key === "ArrowLeft") blaettern(-1); else if (e.key === "ArrowRight") blaettern(1);
  });
  let x0 = null;
  fenster.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  fenster.addEventListener("touchend", (e) => {
    if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) blaettern(dx < 0 ? 1 : -1);
  });
  return { oeffne(l, i) { liste = l; nr = i; vorher = document.activeElement; el.hidden = false; zeige(); fenster.focus(); } };
})();
try {
  const notes = await (await fetch("data/notes/notes.json?v=1", { cache: "no-cache" })).json();
  $id("notes-liste").innerHTML = notes.map((n, i) =>
    `<li><button type="button" class="notes-knopf" data-i="${i}"><span class="mark"><span class="nr">${i + 1}</span>${esc(n.titel)}</span></button></li>`).join("");
  $id("notes-liste").addEventListener("click", (e) => {
    const b = e.target.closest(".notes-knopf"); if (b) galerie.oeffne(notes, Number(b.dataset.i));
  });
} catch {}

// ---------- Fieldtrip-Menü oben rechts (wie auf den Kartenseiten) ----------
try {
  const konfig = await (await fetch("data/fieldtrips.json", { cache: "no-cache" })).json();
  $id("nav").innerHTML = (konfig.uebersicht || []).map((b) => `<a href="${esc(b.link)}"${b.link === "enonce.html" ? ' aria-current="page"' : ""}>${esc(b.name)}</a>`).join("")
    + konfig.fieldtrips.map((f) => f.inaktiv
      ? `<span aria-disabled="true" title="Not online yet">${esc(f.nav)}</span>`
      : `<a href="karte.html?ft=${encodeURIComponent(f.id)}">${esc(f.nav)}</a>`).join("");
} catch {}
{
  const klapp = $id("nav-klapp");
  document.addEventListener("pointerdown", (e) => { if (klapp.open && !klapp.contains(e.target)) klapp.open = false; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && klapp.open) klapp.open = false; });
}
