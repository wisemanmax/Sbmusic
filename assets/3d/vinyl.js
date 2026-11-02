/* ============================================================
   MUSIC — the SB deck: a 3D turntable above the slime player.
   · the record's label is the current cover art; grooves are a generated
     roughness map, so studio reflections streak across them like real vinyl
   · spins up to 33⅓ rpm when the site player plays and spins down when it stops
     (follows the same play state as every other transport)
   · the tonearm swings onto the record and tracks the song's progress inward
   · tap the record → play / pause · drag it → scratch (seeks the track)
   · the plinth's slime light pulses with the bass; rage mode turns it blood red
   ============================================================ */
import { THREE, C, IS_MOBILE, REDUCED, makeRenderer, envFor, cursorBig, disposeTree } from './kit.js';

const RPM = 33.333, OMEGA = (RPM / 60) * Math.PI * 2;
const SEC_PER_TURN = 60 / RPM;          // 1.8 s of audio per revolution, like a real record

function grooveTextures() {
  const n = IS_MOBILE ? 512 : 1024;
  const mk = (fn) => { const c = document.createElement('canvas'); c.width = c.height = n; fn(c.getContext('2d'), n / 2); return c; };
  const rough = mk((g, r) => {
    g.fillStyle = '#666'; g.fillRect(0, 0, n, n);
    for (let i = r; i > r * 0.36; i -= 1.5) {
      const v = 70 + Math.random() * 90 | 0; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 1;
      g.beginPath(); g.arc(r, r, i, 0, Math.PI * 2); g.stroke();
    }
    g.fillStyle = '#333';                    // the smooth run-out + lead-in bands
    g.beginPath(); g.arc(r, r, r * 0.4, 0, Math.PI * 2); g.fill();
  });
  const color = mk((g, r) => {
    g.fillStyle = '#0a0a0b'; g.fillRect(0, 0, n, n);
    for (let i = r; i > r * 0.36; i -= 9 + Math.random() * 30) {
      g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 2;
      g.beginPath(); g.arc(r, r, i, 0, Math.PI * 2); g.stroke();
    }
  });
  const t1 = new THREE.CanvasTexture(rough), t2 = new THREE.CanvasTexture(color);
  t2.colorSpace = THREE.SRGBColorSpace;
  return { rough: t1, color: t2 };
}

function currentArt() {
  const a = document.querySelector('#music .pwart');
  const m = a && /url\(["']?([^"')]+)["']?\)/.exec(a.style.backgroundImage || getComputedStyle(a).backgroundImage || '');
  return m ? m[1] : 'assets/my-time-cover.jpg';
}

export function create(playerwin, S) {
  const deck = document.createElement('div');
  deck.className = 'deck3d';
  deck.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  const hint = document.createElement('div');
  hint.className = 'deckhint';
  hint.textContent = IS_MOBILE ? 'tap the record to play · drag to scratch' : 'click the record to play · drag it to scratch';
  deck.append(canvas, hint);
  playerwin.before(deck);

  const renderer = makeRenderer(canvas, { alpha: true });
  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);
  scene.environmentIntensity = 0.32;   // the studio env is a white room — keep black vinyl black
  const camera = new THREE.PerspectiveCamera(34, 2, 0.1, 50);

  const world = new THREE.Group(); scene.add(world);

  /* plinth + its slime light */
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 2.6),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#070505'), roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  plinth.position.y = -0.17; world.add(plinth);
  const stripMat = new THREE.MeshBasicMaterial({ color: C.slime.clone(), toneMapped: false });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(3.52, 0.025, 2.62), stripMat);
  strip.position.y = -0.27; world.add(strip);

  /* platter */
  const RX = -0.4;
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.14, 0.08, 96),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1a1a1e'), metalness: 0.85, roughness: 0.32 }));
  platter.position.set(RX, -0.02, 0); world.add(platter);
  const haloMat = new THREE.MeshBasicMaterial({ color: C.slime.clone(), transparent: true, opacity: 0.5, toneMapped: false });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.012, 8, 128), haloMat);
  halo.rotation.x = Math.PI / 2; halo.position.set(RX, -0.065, 0); world.add(halo);

  /* the record: grooved vinyl + cover-art label, spinning together */
  const spin = new THREE.Group(); spin.position.set(RX, 0.03, 0); world.add(spin);
  const tex = grooveTextures();
  const top = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#ffffff'), map: tex.color, roughnessMap: tex.rough, roughness: 0.9, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18 });
  const edge = new THREE.MeshStandardMaterial({ color: new THREE.Color('#050505'), roughness: 0.4 });
  const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.014, 128), [edge, top, top]);
  spin.add(vinyl);
  const labelMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#ffffff'), roughness: 0.55 });
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.37, 72), labelMat);
  label.rotation.x = -Math.PI / 2; label.position.y = 0.0085; spin.add(label);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 16),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#d8dde3'), metalness: 1, roughness: 0.15 }));
  spindle.position.y = 0.04; spin.add(spindle);
  let artUrl = '';
  const loader = new THREE.TextureLoader();
  function loadArt() {
    const u = currentArt(); if (u === artUrl) return; artUrl = u;
    loader.load(u, (t) => { t.colorSpace = THREE.SRGBColorSpace; if (labelMat.map) labelMat.map.dispose(); labelMat.map = t; labelMat.needsUpdate = true; });
  }
  loadArt();

  /* tonearm: pivot at the back right; modelled pointing along +z */
  const chrome = new THREE.MeshStandardMaterial({ color: new THREE.Color('#cfd5dc'), metalness: 1, roughness: 0.18 });
  const pivot = new THREE.Group(); pivot.position.set(1.2, 0.08, -0.82); world.add(pivot);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.12, 32),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#1c1c20'), metalness: 0.8, roughness: 0.3 }));
  base.position.y = -0.06; pivot.add(base);
  const arm = new THREE.Group(); pivot.add(arm);
  const ARM = 1.65;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, ARM, 12), chrome);
  tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.06, ARM / 2 - 0.08); arm.add(tube);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.2),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#111'), roughness: 0.4 }));
  shell.position.set(0, 0.04, ARM - 0.05); arm.add(shell);
  const weight = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 24), chrome);
  weight.rotation.x = Math.PI / 2; weight.position.set(0, 0.06, -0.22); arm.add(weight);
  /* angles (radians, about +y): rest off the record, then outer → inner groove */
  const REST = 0.12, OUTER = 0.52, INNER = 0.84;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x101010, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-2, 5, 3); scene.add(key);
  const rim = new THREE.PointLight(C.alien.clone(), 18, 12, 2); rim.position.set(2.4, 1.2, -1.8); scene.add(rim);
  const glow = new THREE.PointLight(C.slime.clone(), 10, 8, 2); glow.position.set(RX, 0.9, 1.6); scene.add(glow);

  /* ---- interaction: tap = play/pause, drag = scratch ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), cv = new THREE.Vector3();
  let drag = null, hover = false, seekAcc = 0, seekT = 0;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(spin, true).length > 0;
  }
  function screenAngle(e) {
    const r = canvas.getBoundingClientRect();
    cv.set(RX, 0.03, 0); world.localToWorld(cv); cv.project(camera);
    const cx = r.left + (cv.x + 1) / 2 * r.width, cy = r.top + (1 - cv.y) / 2 * r.height;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }
  function flushSeek(force) {
    const P = S.player(); if (!P || !P.seek) return;
    const now = performance.now();
    if (Math.abs(seekAcc) > 0.04 && (force || now - seekT > 120)) {
      seekT = now; const d = P.duration ? P.duration() : 0, t = (P.time ? P.time() : 0) + seekAcc;
      P.seek(Math.max(0, isFinite(d) && d > 0 ? Math.min(d - 0.25, t) : t)); seekAcc = 0;
    }
  }
  const onDown = (e) => {
    if (!pick(e)) return;
    drag = { a: screenAngle(e), x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  };
  const onMove = (e) => {
    if (drag) {
      const a = screenAngle(e); let d = a - drag.a; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      drag.a = a; drag.moved += Math.hypot(e.clientX - drag.x, e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY;
      spin.rotation.y -= d;                        // screen clockwise = record clockwise (seen from above)
      seekAcc += (d / (Math.PI * 2)) * SEC_PER_TURN * 2;
      flushSeek(false);
      return;
    }
    const h = pick(e); if (h !== hover) { hover = h; canvas.style.cursor = h ? 'grab' : ''; cursorBig(h); }
  };
  const onUp = (e) => {
    if (!drag) return;
    const tap = drag.moved < 8 && performance.now() - drag.t < 350;
    drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    if (tap) { const P = S.player(); if (P) P.toggle(); }
    else { flushSeek(true); try { S.site().track('scratch', { track: S.player() && S.player().title() }); } catch (_) {} }
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', () => { if (hover && !drag) { hover = false; cursorBig(false); } });

  let omega = 0, phi = REST, lift = 0, lastTitle = '', time = 0;
  const cBase = C.slime.clone(), tcol = new THREE.Color();

  return {
    canvas, renderer, sizeEl: deck, watchEl: deck,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // frame the whole deck: pull back on narrow (phone) widths
      const dist = camera.aspect < 1.4 ? 6.4 - camera.aspect * 1.2 : 4.6;
      camera.position.set(0.15, dist * 0.72, dist * 0.78);
      camera.lookAt(0.1, -0.15, 0.05);
      camera.updateProjectionMatrix();
    },
    update(t, dt, S) {
      const a = S.audio, P = S.player();
      time += dt;
      const playing = a.playing;
      const title = P && P.title ? P.title() : '';
      if (title !== lastTitle) { lastTitle = title; loadArt(); }

      /* platter speed: spin up / down like a real motor; a hand on the record stops it */
      const target = drag ? 0 : (playing ? OMEGA : 0);
      omega += (target - omega) * Math.min(1, dt * (target ? 2.2 : 1.4));
      if (!drag) spin.rotation.y -= omega * dt;

      /* tonearm follows song progress */
      let prog = 0;
      if (P && P.time && P.duration) { const d = P.duration(); if (isFinite(d) && d > 0) prog = Math.min(1, P.time() / d); }
      const phiT = playing || drag ? OUTER + (INNER - OUTER) * prog : REST;
      phi += (phiT - phi) * Math.min(1, dt * 2.5);
      lift += ((Math.abs(phiT - phi) > 0.02 ? 1 : 0) - lift) * Math.min(1, dt * 6);
      arm.rotation.set(-0.06 * lift, -phi, 0);

      /* the slime light breathes with the bass; rage turns it red */
      tcol.copy(cBase).lerp(C.blood, S.rage);
      const pulse = 0.55 + a.bass * 0.9 + a.beat * 0.5;
      stripMat.color.copy(tcol).multiplyScalar(pulse);
      haloMat.color.copy(tcol); haloMat.opacity = 0.25 + a.bass * 0.6;
      glow.color.copy(tcol); glow.intensity = 6 + a.bass * 18;
      world.position.y = REDUCED ? 0 : a.beat * 0.012;

      renderer.render(scene, camera);
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      if (hover) cursorBig(false);
      disposeTree(scene);
      deck.remove();
    },
  };
}
