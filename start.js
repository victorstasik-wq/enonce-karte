// Startseite „Assembled Periphery“: Titel, Menü „Content“ (Bibliografie, Übersicht, Fieldtrips),
// im Hintergrund dreht sich langsam das Gelände (hintergrund.js, nicht bedienbar).

// alte Direktlinks (index.html?ft=…&station=…) führen weiter zur Karte
if (location.search.includes("ft=") || location.search.includes("station=")) {
  location.replace("karte.html" + location.search);
}

import { starteHintergrund } from "./hintergrund.js?v=3";

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

// ---------- Übersichtskarten (z. B. Valais) ----------
$id("uebersicht").innerHTML = (konfig.uebersicht || []).map((b) =>
  `<li><a href="${esc(b.link)}"><span class="ft-name mark">${esc(b.name)}</span><span class="ft-meta mark">${esc(b.meta || "")}</span></a></li>`).join("");

// ---------- Énoncé: Bibliografie ----------
$id("bereiche").innerHTML = (konfig.bereiche || []).map((b) => b.inaktiv || !b.link
  ? `<li class="inaktiv"><span class="ft-name mark">${esc(b.name)}</span><span class="ft-meta mark">coming soon</span></li>`
  : `<li><a href="${esc(b.link)}"><span class="ft-name mark">${esc(b.name)}</span></a></li>`).join("");

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
starteHintergrund(konfig, $id("hintergrund"));
