/* ============================================================
   SB WORLD — the five powers as a 3D orbit (world.html #universe).
   · a small glowing SB mark at the core; the powers orbit it on a tilted ring
   · each orb takes its colour from the CMS (universe.powers[].c) and pulses
     with its own slice of the spectrum (bass → highs)
   · hover / tap an orb (or its floating label) → GSAP flies the camera into it,
     then opens that power's lore card (the same openPower() the panels use);
     closing the card flies back out
   · rebuilds itself when published content arrives (the `sb:powers` event)
   The panels underneath stay the accessible / keyboard path; this stage is
   aria-hidden decoration on top.
   ============================================================ */
import { THREE, C, IS_MOBILE, REDUCED, makeRenderer, envFor, additive, glowMaterial, glowTexture, cursorBig, disposeTree } from './kit.js';
import { buildMonoGeometry } from './mono.js';
import { gsap } from './vendor/gsap.js';

const BANDS = [[0, 2], [3, 7], [8, 14], [15, 24], [25, 40]];

export function create(upanels, S) {
  const stage = document.createElement('div');
  stage.className = 'orbit3d';
  stage.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  const labels = document.createElement('div'); labels.className = 'olabels';
  const tip = document.createElement('div'); tip.className = 'ohint'; tip.textContent = IS_MOBILE ? 'tap a force to fly in' : 'click a force to fly in';
  stage.append(canvas, labels, tip);
  upanels.before(stage);

  const renderer = makeRenderer(canvas, { alpha: true });
  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);
  scene.environmentIntensity = 0.45;   // keep the orbs saturated, not washed white by the studio env
  const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 60);
  const HOME = { x: 0, y: 1.5, z: 8.2 };
  const cam = { ...HOME }, look = { x: 0, y: 0, z: 0 };

  /* core: the SB mark */
  const coreRig = new THREE.Group(); scene.add(coreRig);
  const geo = buildMonoGeometry(THREE, { radius: 0.16, tubular: 160, radial: 14 });
  const coreMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#3fb512'), roughness: 0.12, clearcoat: 1, iridescence: 0.6, emissive: new THREE.Color('#1c5a00'), emissiveIntensity: 0.5 });
  coreRig.add(new THREE.Mesh(geo, coreMat));
  const coreGlow = glowMaterial(C.slime, { thickness: 0.1, intensity: 1 });
  coreRig.add(new THREE.Mesh(geo, coreGlow));
  coreRig.scale.setScalar(0.55);

  /* orbit path */
  const RXo = 3.1, RZo = 1.55, TILT = 0.22;
  const orbit = new THREE.Group(); orbit.rotation.x = TILT; orbit.rotation.z = -0.08; scene.add(orbit);
  const pts = []; for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * RXo, 0, Math.sin(a) * RZo)); }
  const ringMat = additive(new THREE.LineBasicMaterial({ color: C.slime.clone(), opacity: 0.28 }));
  orbit.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), ringMat));

  scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0a0a, 0.4));
  const kl = new THREE.PointLight(0xffffff, 30, 20, 2); kl.position.set(0, 4, 5); scene.add(kl);

  /* orbs */
  let orbs = [];
  const sphere = new THREE.SphereGeometry(IS_MOBILE ? 0.3 : 0.32, 32, 20);
  function build() {
    for (const o of orbs) { orbit.remove(o.g); o.mat.dispose(); o.spriteMat.dispose(); o.label.remove(); }
    orbs = [];
    const list = (S.site().powers && S.site().powers()) || [];
    list.forEach((p, i) => {
      const col = new THREE.Color(/^#[0-9a-f]{3,8}$/i.test(p.c || '') ? p.c : '#8dff2b');
      const g = new THREE.Group();
      const mat = new THREE.MeshPhysicalMaterial({ color: col.clone(), emissive: col.clone(), emissiveIntensity: 0.55, roughness: 0.18, clearcoat: 1, iridescence: 0.4 });
      const ball = new THREE.Mesh(sphere, mat); ball.userData.i = i; g.add(ball);
      const spriteMat = additive(new THREE.SpriteMaterial({ map: glowTexture(), color: col.clone(), opacity: 0.7 }));
      const halo = new THREE.Sprite(spriteMat); halo.scale.setScalar(1.6); g.add(halo);
      orbit.add(g);
      const label = document.createElement('button');
      label.type = 'button'; label.tabIndex = -1; label.className = 'olabel';
      label.style.setProperty('--c', '#' + col.getHexString(THREE.SRGBColorSpace));
      label.innerHTML = '<span class="oi"></span><span class="on"></span>';
      label.querySelector('.oi').textContent = p.id || String(i + 1).padStart(2, '0');
      label.querySelector('.on').textContent = p.n || 'force';
      label.addEventListener('click', () => enter(i));
      label.addEventListener('pointerenter', () => { hoverI = i; });
      label.addEventListener('pointerleave', () => { if (hoverI === i) hoverI = -1; });
      labels.appendChild(label);
      orbs.push({ g, ball, mat, spriteMat, halo, label, a: (i / list.length) * Math.PI * 2, col, s: 1 });
    });
  }
  build();
  const onPowers = () => build();
  document.addEventListener('sb:powers', onPowers);

  /* ---- fly in / out ---- */
  let flying = false, waitClose = false, sawOpen = false, spinK = 1, hoverI = -1, tl = null;
  const wv = new THREE.Vector3();
  function enter(i) {
    if (flying || !orbs[i]) return;
    const site = S.site();
    try { site.track('power_orbit', { power: orbs[i].label.textContent }); } catch (_) {}
    if (REDUCED) { site.openPower(i); return; }
    flying = true;
    orbs[i].g.getWorldPosition(wv);
    const dir = new THREE.Vector3(cam.x - wv.x, cam.y - wv.y, cam.z - wv.z).normalize();
    if (tl) tl.kill();
    tl = gsap.timeline({ onComplete: () => { site.openPower(i); waitClose = true; sawOpen = true; } });
    tl.to({ k: spinK }, { k: 0, duration: 0.4, onUpdate() { spinK = this.targets()[0].k; } }, 0)
      .to(cam, { x: wv.x + dir.x * 1.6, y: wv.y + dir.y * 1.6 + 0.2, z: wv.z + dir.z * 1.6, duration: 0.85, ease: 'power3.inOut' }, 0)
      .to(look, { x: wv.x, y: wv.y, z: wv.z, duration: 0.85, ease: 'power3.inOut' }, 0);
  }
  function leave() {
    waitClose = false;
    if (tl) tl.kill();
    tl = gsap.timeline({ onComplete: () => { flying = false; } });
    tl.to(cam, { ...HOME, duration: 0.9, ease: 'power3.inOut' }, 0)
      .to(look, { x: 0, y: 0, z: 0, duration: 0.9, ease: 'power3.inOut' }, 0)
      .to({ k: 0 }, { k: 1, duration: 0.9, onUpdate() { spinK = this.targets()[0].k; } }, 0.2);
  }

  /* ---- pointer picking on the canvas ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(orbs.map((o) => o.ball), false)[0];
    return hit ? hit.object.userData.i : -1;
  }
  let canvasHover = -1;
  const onMove = (e) => { const i = pick(e); if (i !== canvasHover) { canvasHover = i; canvas.style.cursor = i >= 0 ? 'pointer' : ''; cursorBig(i >= 0); } };
  const onClick = (e) => { const i = pick(e); if (i >= 0) enter(i); };
  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('click', onClick);

  let time = 0, W = 1, H = 1, base = 0;
  const pv = new THREE.Vector3(), tcol = new THREE.Color(), CORE = new THREE.Color('#3fb512');

  return {
    canvas, renderer, sizeEl: stage, watchEl: stage,
    resize(w, h) {
      W = w; H = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // fit the ring's width (+ labels) on narrow stages, but never closer than the core + bob need vertically
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      HOME.z = Math.max(6.4, (RXo * 2 + 2.6) / camera.aspect / (2 * tanH));
      if (!flying) cam.z = HOME.z;
      camera.updateProjectionMatrix();
    },
    update(t, dt, S) {
      const a = S.audio;
      time += dt;
      if (waitClose) { const open = S.site().modalOpen(); if (open) sawOpen = true; else if (sawOpen) leave(); }

      base += dt * (0.16 + S.rage * 0.5) * spinK * (REDUCED ? 0 : 1);
      coreRig.rotation.y += dt * (0.5 + S.rage) * (REDUCED ? 0 : 1);
      coreRig.scale.setScalar(0.55 * (1 + a.beat * 0.08));
      coreMat.color.copy(CORE).lerp(C.blood, S.rage);
      coreGlow.uniforms.uColor.value.copy(C.slime).lerp(C.blood, S.rage);
      coreGlow.uniforms.uIntensity.value = 0.8 + a.bass * 1.2 + a.beat * 0.5;
      ringMat.color.copy(C.slime).lerp(C.blood, S.rage);
      ringMat.opacity = 0.2 + a.energy * 0.4;

      camera.position.set(cam.x + (flying ? 0 : S.pointer.x * 0.5), cam.y + (flying ? 0 : -S.pointer.y * 0.3), cam.z);
      camera.lookAt(look.x, look.y, look.z);

      const hot = canvasHover >= 0 ? canvasHover : hoverI;
      for (let i = 0; i < orbs.length; i++) {
        const o = orbs[i], ang = o.a + base;
        o.g.position.set(Math.cos(ang) * RXo, Math.sin(time * 0.9 + i) * 0.12, Math.sin(ang) * RZo);
        const [b0, b1] = BANDS[i % BANDS.length];
        let lv = 0; for (let k = b0; k <= b1; k++) lv += a.levels[k] || 0; lv /= (b1 - b0 + 1);
        o.s += ((hot === i ? 1.3 : 1) + lv * 0.35 - o.s) * Math.min(1, dt * 8);
        o.g.scale.setScalar(o.s);
        o.mat.emissiveIntensity = 0.45 + lv * 0.9;
        o.spriteMat.opacity = 0.45 + lv * 0.6;
        o.spriteMat.color.copy(tcol.copy(o.col).lerp(C.blood, S.rage * 0.5));
        /* project the label next to its orb; fade the ones behind the core */
        o.g.getWorldPosition(pv); const depth = pv.z; pv.project(camera);
        const x = (pv.x + 1) / 2 * W, y = (1 - pv.y) / 2 * H;
        o.label.style.transform = `translate(${x.toFixed(1)}px,${(y + 26 * o.s).toFixed(1)}px) translate(-50%,0)`;
        o.label.style.opacity = flying ? '0' : String(depth < -0.4 ? 0.45 : 1);
        o.label.style.zIndex = String(depth < 0 ? 1 : 3);
        o.label.classList.toggle('hot', hot === i);
      }
      renderer.render(scene, camera);
    },
    dispose() {
      if (tl) tl.kill();
      document.removeEventListener('sb:powers', onPowers);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('click', onClick);
      if (canvasHover >= 0) cursorBig(false);
      for (const o of orbs) { o.mat.dispose(); o.spriteMat.dispose(); }
      disposeTree(scene);
      stage.remove();
    },
  };
}
