// Seite „Énoncé“: Inhaltsverzeichnis und Diagramm „Anatomy of the work“.
// Klick auf einen Eintrag im Inhaltsverzeichnis zoomt das Diagramm auf den zugehörigen Bereich (viewBox).
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

// ---------- Diagramm laden ----------
const rahmen = $id("anatomie");
let svg = null, jetzt = BEREICHE.gesamt.slice(), lauf = null;
try {
  const text = await (await fetch("data/anatomie_der_arbeit.svg?v=7", { cache: "no-cache" })).text();
  rahmen.innerHTML = text.replace(/^<\?xml[^>]*>\s*/, "");
  svg = rahmen.querySelector("svg");
  svg.removeAttribute("width"); svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");
} catch (e) {
  rahmen.textContent = "Diagram could not be loaded.";
}

const setze = (v) => { jetzt = v; svg?.setAttribute("viewBox", v.map((z) => z.toFixed(1)).join(" ")); };
const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
function zoome(ziel) {
  if (!svg) return;
  if (lauf) cancelAnimationFrame(lauf);
  const von = jetzt.slice(), t0 = performance.now(), dauer = ruhig ? 0 : 750;
  const schritt = (t) => {
    const f = dauer ? Math.min(1, (t - t0) / dauer) : 1;
    const e = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
    setze(von.map((v, i) => v + (ziel[i] - v) * e));
    if (f < 1) lauf = requestAnimationFrame(schritt);
  };
  lauf = requestAnimationFrame(schritt);
}

// ---------- Inhaltsverzeichnis ↔ Diagramm ----------
const ganz = document.querySelector(".ganz-knopf");
const knoepfe = [...document.querySelectorAll(".toc-knopf")];
function waehle(knopf) {
  const namen = knopf.dataset.ziel.split(" ");
  const ganzesBild = namen.length === 1 && namen[0] === "gesamt";
  zoome(ganzesBild ? BEREICHE.gesamt : vereinigt(namen));
  knoepfe.forEach((k) => k.setAttribute("aria-pressed", String(k === knopf)));
  ganz.hidden = ganzesBild;
  // auf schmalen Bildschirmen steht das Diagramm unter der Liste: hinscrollen
  if (matchMedia("(max-width: 900px)").matches) $id("anatomie").scrollIntoView({ behavior: ruhig ? "auto" : "smooth", block: "center" });
}
knoepfe.forEach((k) => k.addEventListener("click", () => waehle(k)));
ganz.addEventListener("click", () => {
  zoome(BEREICHE.gesamt); ganz.hidden = true;
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
