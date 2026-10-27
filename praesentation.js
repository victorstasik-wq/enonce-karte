// Präsentation: Folien mit Pfeiltasten, Leertaste oder den Knöpfen; #1 … #5 in der Adresse; F = Vollbild.
const folien = [...document.querySelectorAll(".folie")];
const zahl = document.getElementById("zahl");
let nr = 0;
function zeige(i, merken = true) {
  nr = Math.max(0, Math.min(folien.length - 1, i));
  folien.forEach((f, k) => f.classList.toggle("aktiv", k === nr));
  zahl.textContent = `${nr + 1} / ${folien.length}`;
  document.getElementById("zurueck").disabled = nr === 0;
  document.getElementById("weiter").disabled = nr === folien.length - 1;
  // Live-Karte erst laden, wenn ihre Folie gezeigt wird
  folien[nr].querySelectorAll("iframe[data-src]").forEach((f) => { if (f.src === "about:blank" || !f.src) f.src = f.dataset.src; });
  if (merken) history.replaceState(null, "", "#" + (nr + 1));
}
document.getElementById("zurueck").addEventListener("click", () => zeige(nr - 1));
document.getElementById("weiter").addEventListener("click", () => zeige(nr + 1));
document.getElementById("vollbild").addEventListener("click", () => vollbild());
const vollbild = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
document.addEventListener("keydown", (e) => {
  if (e.target.closest("a, input, textarea")) return;
  if (["ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); zeige(nr + 1); }
  else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); zeige(nr - 1); }
  else if (e.key === "Home") zeige(0);
  else if (e.key === "End") zeige(folien.length - 1);
  else if (e.key === "f" || e.key === "F") vollbild();
});
zeige((parseInt(location.hash.slice(1), 10) || 1) - 1, false);
