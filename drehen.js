// Ruhige Kamerasteuerung ohne Verschieben.
// Die Kamera kreist um einen Drehpunkt und schaut auf ihn.
//  - Ziehen (Maus links oder rechts, ein Finger): drehen und kippen um den Drehpunkt
//  - Mausrad / Trackpad / zwei Finger: zoomen zu der Stelle unter der Maus. Diese Stelle bleibt
//    beim Zoomen unter der Maus und wird zum neuen Drehpunkt (wie bei Google Earth).
//    Beim Herauszoomen gleitet der Drehpunkt zurück zur Mitte des Geländes (ganz draussen genau Mitte).
//  - Station öffnen: Drehpunkt = Station; Blatt schliessen: zurück zur Mitte (siehe app.js).
//  - Doppelklick springt nicht.
import * as THREE from "./vendor/potree/libs/three.js/build/three.module.js";

const GRAD = Math.PI / 180;
const HEIM_ABSTAND = 25000;   // ab diesem Abstand dreht sich alles wieder um die Mitte

export class Drehsteuerung extends THREE.EventDispatcher {
  constructor(viewer, heim, { minAbstand = 300, maxAbstand = 80000 } = {}) {
    super();
    this.viewer = viewer;
    this.enabled = true;
    this.scene = null;
    this.sceneControls = new THREE.Scene();   // Potree zeichnet diese Szene für Steuerungs-Hilfen
    this.heim = heim.clone();                 // Mitte des Geländes
    this.drehpunkt = heim.clone();            // aktueller (weich nachgeführter) Drehpunkt
    this.sollPunkt = heim.clone();            // Ziel-Drehpunkt
    this.minAbstand = minAbstand;
    this.maxAbstand = maxAbstand;
    this.folgen = true;                       // false, solange ein Flug die Kamera bewegt
    this.blick = heim.clone();                // wohin die Kamera schaut (= Drehpunkt, ausser kurz nach Flügen)
    this.soll = { az: 0, ne: 0, ab: 1 };
    this.ist = { az: 0, ne: 0, ab: 1 };
    this.beiEingabe = null;                    // Rückruf, z. B. um einen laufenden Flug zu stoppen
    const el = viewer.renderer.domElement;

    // Drehen mit eigenen Pointer-Ereignissen. (Potrees „drag“ rechnet die erste Bewegung von einer
    // veralteten Mausposition aus – kommt die Maus z. B. über einen Kasten ins Bild, springt die
    // Ansicht beim ersten Klick.) Jede Bewegung zählt nur ab der letzten eigenen Position.
    const zeiger = new Map();
    el.addEventListener("pointerdown", (e) => {
      zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch {}
    });
    el.addEventListener("pointermove", (e) => {
      const z = zeiger.get(e.pointerId);
      if (!z) return;
      const dx = e.clientX - z.x, dy = e.clientY - z.y;
      z.x = e.clientX; z.y = e.clientY;
      if (zeiger.size !== 1) return;              // zwei Finger: zoomen, nicht drehen
      const max = 120;                           // Sicherheit gegen Ausreisser
      this.eingabe();
      this.soll.az += (THREE.MathUtils.clamp(dx, -max, max) / el.clientWidth) * 200 * GRAD;
      this.soll.ne += (THREE.MathUtils.clamp(dy, -max, max) / el.clientHeight) * 120 * GRAD;
      this.soll.ne = THREE.MathUtils.clamp(this.soll.ne, -89 * GRAD, 89 * GRAD);
    });
    const los = (e) => zeiger.delete(e.pointerId);
    el.addEventListener("pointerup", los);
    el.addEventListener("pointercancel", los);
    el.addEventListener("contextmenu", (e) => e.preventDefault());

    // Zoom zur Maus. Der Punkt unter der Maus wird einmal pro Zoom-Geste gesucht (nicht bei
    // jedem einzelnen Trackpad-Schritt), damit nichts springt.
    let treffer = null, zuletzt = 0;
    el.addEventListener("wheel", (e) => {
      e.preventDefault();
      const jetzt = performance.now();
      if (jetzt - zuletzt > 250) treffer = this.punktUnter(e.offsetX, e.offsetY);
      zuletzt = jetzt;
      const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      this.eingabe();
      this.zoom(Math.exp(THREE.MathUtils.clamp(d, -120, 120) * 0.0015), treffer);
    }, { passive: false });

    let vorher = null, mitteTouch = null;
    this.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        const t = e.touches, r = el.getBoundingClientRect();
        const abst = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        if (!vorher) mitteTouch = this.punktUnter((t[0].pageX + t[1].pageX) / 2 - r.left, (t[0].pageY + t[1].pageY) / 2 - r.top);
        else { this.eingabe(); this.zoom(vorher / abst, mitteTouch); }
        vorher = abst;
      } else vorher = null;
    });
    this.addEventListener("touchend", () => { vorher = null; });
  }

  // Geländepunkt unter einer Bildschirmposition (oder null)
  punktUnter(x, y) {
    try {
      const v = this.viewer;
      const I = Potree.Utils.getMousePointCloudIntersection(new THREE.Vector2(x, y),
        v.scene.getActiveCamera(), v, v.scene.pointclouds.filter((p) => p.visible), { pickClipped: false });
      return I ? new THREE.Vector3(I.location.x, I.location.y, I.location.z) : null;
    } catch { return null; }
  }

  // Zoomen um den Faktor f (f < 1: näher). Mit einem Treffpunkt H wird die ganze Kameralage um H
  // skaliert: H bleibt an seiner Stelle im Bild, der Drehpunkt rückt auf H zu.
  zoom(f, H = null) {
    const ab0 = this.soll.ab;
    const ab = THREE.MathUtils.clamp(ab0 * f, this.minAbstand, this.maxAbstand);
    f = ab / ab0;
    this.soll.ab = ab;
    if (f < 1 && H) {
      // hinein: die ganze Kameralage um H skalieren – H bleibt unter der Maus, der Drehpunkt rückt auf H zu
      this.sollPunkt.sub(H).multiplyScalar(f).add(H);
    } else if (f > 1) {
      // hinaus: Drehpunkt gleitet zurück zur Mitte; bei HEIM_ABSTAND ist er wieder genau dort
      const anteil = ab0 >= HEIM_ABSTAND ? 1 : Math.min(1, Math.log(f) / Math.log(HEIM_ABSTAND / ab0));
      this.sollPunkt.lerp(this.heim, anteil);
    }
  }

  eingabe() {
    if (!this.folgen) {          // Flug läuft noch: abbrechen, Drehpunkt des Flugziels übernehmen
      this.beiEingabe?.();
      if (this.naechsterDrehpunkt) this.setzePunkt(this.naechsterDrehpunkt);
      this.uebernehmen();
      this.zurMitte = true;      // Blick gleitet weich auf den Drehpunkt
    }
  }

  setzePunkt(p) { this.drehpunkt.copy(p); this.sollPunkt.copy(p); }

  // Ein Flug übernimmt die Kamera; danach gilt p als Drehpunkt
  fliegen(p) {
    this.folgen = false;
    this.naechsterDrehpunkt = p.clone();
  }
  angekommen(p) {
    this.setzePunkt(p);
    this.naechsterDrehpunkt = null;
    this.uebernehmen(p);
  }

  // Werte aus der aktuellen Kamera ableiten (Start, nach einem Flug)
  uebernehmen(blick) {
    const pos = this.viewer.scene.view.position;
    const v = pos.clone().sub(this.drehpunkt);
    const ab = Math.max(v.length(), 1);
    const werte = { az: Math.atan2(v.x, v.y), ne: Math.asin(THREE.MathUtils.clamp(v.z / ab, -1, 1)), ab };
    Object.assign(this.ist, werte);
    Object.assign(this.soll, werte);
    if (blick) this.blick.copy(blick);
    this.zurMitte = false;
    this.folgen = true;
  }

  setScene(scene) { this.scene = scene; }
  stop() {}

  update(delta) {
    if (!this.folgen) return;
    const k = 1 - Math.exp(-delta * 10);     // Dämpfung
    let dAz = this.soll.az - this.ist.az;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));   // kürzester Weg
    this.ist.az += dAz * k;
    this.ist.ne += (this.soll.ne - this.ist.ne) * k;
    this.ist.ab *= Math.pow(this.soll.ab / this.ist.ab, k);
    // Drehpunkt weich nachführen; der Blick wandert mit
    const vorher = this.drehpunkt.clone();
    this.drehpunkt.lerp(this.sollPunkt, k);
    this.blick.add(this.drehpunkt.clone().sub(vorher));
    if (this.zurMitte) this.blick.lerp(this.drehpunkt, 1 - Math.exp(-delta * 3));

    const { az, ne, ab } = this.ist;
    const view = this.viewer.scene.view;
    view.position.set(
      this.drehpunkt.x + ab * Math.sin(az) * Math.cos(ne),
      this.drehpunkt.y + ab * Math.cos(az) * Math.cos(ne),
      this.drehpunkt.z + ab * Math.sin(ne));
    view.lookAt(this.blick);
    this.viewer.setMoveSpeed(ab);
  }
}
