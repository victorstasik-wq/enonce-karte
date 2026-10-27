// Seite „Énoncé“: Inhaltsverzeichnis und Diagramm „Anatomie der Arbeit“ (statisch in enonce.html).
// Hier nur das Fieldtrip-Menü oben rechts, wie auf den Kartenseiten.
const $id = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
try {
  const r = await fetch("data/fieldtrips.json", { cache: "no-cache" });
  const konfig = await r.json();
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
