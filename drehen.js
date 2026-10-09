// Ruhige Kamerasteuerung: Das Modell bleibt in der Bildmitte.
// Die Kamera kreist um einen Drehpunkt und schaut auf ihn: ohne offene Station die Mitte des
// Geländes, bei offener Station die Station (bzw. ihr Blickziel).
//  - Ziehen (Maus links oder rechts, ein Finger): drehen und kippen
//  - Mausrad / Trackpad / zwei Finger: näher oder weiter weg
//  - Verschieben gibt es nicht; Doppelklick springt nicht mehr.
import * as THREE from "./vendor/potree/libs/three.js/build/three.module.js";

const GRAD = Math.PI / 180;

export class Drehsteuerung extends THREE.EventDispatcher {
  constructor(viewer, drehpunkt, { minAbstand = 400, maxAbstand = 80000 } = {}) {
    super();
    this.viewer = viewer;
    this.enabled = true;
    this.scene = null;
    this.sceneControls = new THREE.Scene();   // Potree zeichnet diese Szene für Steuerungs-Hilfen
    this.drehpunkt = drehpunkt.clone();
    this.minAbstand = minAbstand;
    this.maxAbstand = maxAbstand;
    this.folgen = true;                       // false, solange ein Flug die Kamera bewegt
    this.blick = this.drehpunkt.clone();      // wohin die Kamera gerade schaut
    this.soll = { az: 0, ne: 0, ab: 1 };      // Zielwerte (Eingabe)
    this.ist = { az: 0, ne: 0, ab: 1 };       // weich nachgeführte Werte
    this.beiEingabe = null;                    // Rückruf, z. B. um einen laufenden Flug zu stoppen

    this.addEventListener("drag", (e) => {
      if (e.drag.object) return;
      const el = viewer.renderer.domElement;
      this.eingabe();
      this.soll.az += (e.drag.lastDrag.x / el.clientWidth) * 200 * GRAD;
      this.soll.ne += (e.drag.lastDrag.y / el.clientHeight) * 120 * GRAD;
      this.soll.ne = THREE.MathUtils.clamp(this.soll.ne, -89 * GRAD, 89 * GRAD);
    });

    // Zoom stufenlos über deltaY (Trackpad liefert viele kleine Schritte); eigener Listener,
    // damit sich die Schritte nicht aufsummieren und über den Drehpunkt hinausschiessen.
    viewer.renderer.domElement.addEventListener("wheel", (e) => {
      e.preventDefault();
      const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      this.eingabe();
      this.zoom(Math.exp(THREE.MathUtils.clamp(d, -120, 120) * 0.0015));
    }, { passive: false });

    let vorher = null;
    this.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        const abst = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        if (vorher) { this.eingabe(); this.zoom(vorher / abst(e.touches)); }
        vorher = abst(e.touches);
      } else vorher = null;
    });
    this.addEventListener("touchend", () => { vorher = null; });
  }

  zoom(faktor) {
    this.soll.ab = THREE.MathUtils.clamp(this.soll.ab * faktor, this.minAbstand, this.maxAbstand);
  }

  eingabe() {
    if (!this.folgen) {          // Flug läuft noch: abbrechen, Drehpunkt des Flugziels übernehmen
      this.beiEingabe?.();
      if (this.naechsterDrehpunkt) this.drehpunkt.copy(this.naechsterDrehpunkt);
      this.uebernehmen();
    }
    this.zurMitte = true;        // Blick gleitet weich auf den Drehpunkt
  }

  // Ein Flug übernimmt die Kamera; danach gilt p als Drehpunkt
  fliegen(p) {
    this.folgen = false;
    this.naechsterDrehpunkt = p.clone();
  }
  angekommen(p) {
    this.drehpunkt.copy(p);
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
    // kürzester Weg beim Azimut
    let dAz = this.soll.az - this.ist.az;
    dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
    this.ist.az += dAz * k;
    this.ist.ne += (this.soll.ne - this.ist.ne) * k;
    this.ist.ab *= Math.pow(this.soll.ab / this.ist.ab, k);
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
