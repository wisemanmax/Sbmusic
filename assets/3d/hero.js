/* ============================================================
   HOME HERO — the SB mark as a wet, glossy 3D sculpture.
   · tube swept along the logo's own SVG Béziers (mono.js)
   · physical "slime" material (clearcoat + iridescence) lit by a studio env
     + neon point lights; a fresnel rim shell does the glow (alpha-safe, no bloom pass)
   · bass → surface wobble + rim flare; beats → scale kick + extra drips
   · slime drips form on the underside and fall
   · pointer tilts it; scrolling out of the hero spins it away (GSAP ScrollTrigger scrub)
   · rage mode bleeds it red; tapping the mark fires the site's slime splash
   Renders onto a transparent canvas between the 2D ember layer and the hero text.
   ============================================================ */
import { THREE, C, IS_MOBILE, REDUCED, makeRenderer, envFor, addWobble, glowMaterial, cursorBig, disposeTree } from './kit.js';
import { buildMonoGeometry, monoCurves } from './mono.js';
import { gsap } from './vendor/gsap.js';

export function create(hero, S) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero3d';
  canvas.setAttribute('aria-hidden', 'true');
  const ref = hero.querySelector('#heroCanvas');
  if (ref) ref.after(canvas); else hero.prepend(canvas);
  hero.classList.add('has-3d');

  const renderer = makeRenderer(canvas, { alpha: true });
  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.set(0, 0, 9);

  const rig = new THREE.Group(); scene.add(rig);
  const geo = buildMonoGeometry(THREE, { radius: 0.16, tubular: IS_MOBILE ? 180 : 300, radial: IS_MOBILE ? 14 : 22 });
  const baseCol = new THREE.Color('#3fb512'), rageCol = new THREE.Color('#b30d18');
  const baseEm = new THREE.Color('#1c5a00'), rageEm = new THREE.Color('#4a0006');
  const mat = new THREE.MeshPhysicalMaterial({
    color: baseCol.clone(), roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    iridescence: 0.35, iridescenceIOR: 1.3, emissive: baseEm.clone(), emissiveIntensity: 0.3, envMapIntensity: 0.8,
    // sheen lights the grazing edges green — without it the clearcoat mirrors the studio's grey
    // walls there and the tube reads as if it had a dark outline
    sheen: 1, sheenColor: C.slime.clone(), sheenRoughness: 0.35,
  });
  const wob = addWobble(mat, 'sbhero');
  const mark = new THREE.Mesh(geo, mat); rig.add(mark);
  const glowMat = glowMaterial(C.slime, { thickness: 0.1, power: 1.8, intensity: 0.85 });
  const glow = new THREE.Mesh(geo, glowMat); glow.renderOrder = 2; rig.add(glow);

  const L1 = new THREE.PointLight(C.slime2.clone(), 30, 20, 2); L1.position.set(-3, 2.5, 4); scene.add(L1);
  const L2 = new THREE.PointLight(C.alien.clone(), 40, 20, 2); L2.position.set(3.5, -1, 2); scene.add(L2);
  const L3 = new THREE.PointLight(C.blood.clone(), 25, 20, 2); L3.position.set(0, -3, -2); scene.add(L3);

  /* ---- slime drips (one instanced draw) ---- */
  const DN = IS_MOBILE ? 14 : 26;
  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.06, 12, 10),
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#4fd11a'), roughness: 0.08, clearcoat: 1, emissive: baseEm.clone(), emissiveIntensity: 0.6 }),
    DN);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  scene.add(drops);
  const sCurve = monoCurves(THREE).s;
  const D = Array.from({ length: DN }, () => ({ p: new THREE.Vector3(), vy: 0, grow: 0, wait: Math.random() * 4, live: false }));
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), tv = new THREE.Vector3();
  function spawn(d) {
    tv.copy(sCurve.getPointAt(Math.random())); tv.y -= 0.14;
    mark.localToWorld(tv); d.p.copy(tv); d.vy = 0; d.grow = 0; d.live = true;
  }
  function forceDrips(n) { for (const d of D) { if (n <= 0) break; if (!d.live) { d.wait = 0; n--; } } }

  /* ---- scroll scrub: spin + lift + shrink away as the hero leaves ---- */
  const scroll = { p: 0 };
  const tween = REDUCED ? null : gsap.to(scroll, {
    p: 1, ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.6 },
  });

  /* ---- tap the mark → the site's slime splash ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hover = false, kick = 0, lastPick = 0;
  function hit(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(mark, false).length > 0;
  }
  const onMove = (e) => {
    const now = performance.now(); if (now - lastPick < 80) return; lastPick = now;
    const h = hit(e); if (h !== hover) { hover = h; canvas.style.cursor = h ? 'pointer' : ''; cursorBig(h); }
  };
  const onLeave = () => { if (hover) { hover = false; cursorBig(false); } };
  const onClick = (e) => {
    if (!hit(e)) return;
    kick = 1; forceDrips(4);
    try { S.site().splash(e.clientX, e.clientY); } catch (_) {}
  };
  canvas.addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);

  let fit = 1, baseOp = 1, time = 0, rx = 0, ry = 0, lastOp = -1;

  return {
    canvas, renderer,
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const visW = visH * camera.aspect;
      const portrait = camera.aspect < 0.8;                    // phones: smaller + dimmer so the title stays the hero
      fit = Math.min(visH * (portrait ? 0.58 : 0.74) / 3.05, visW * (portrait ? 0.66 : 0.8) / 1.95);   // mark ≈ 1.95 × 3.05 units
      baseOp = portrait ? 0.72 : 1;
    },
    update(t, dt, S) {
      const a = S.audio;
      time += dt * (1 + S.rage * 0.9);
      kick *= Math.pow(0.02, dt);
      const idle = REDUCED ? 0 : Math.sin(time * 0.45) * 0.3;
      const k = Math.min(1, dt * 3);
      ry += (S.pointer.x * 0.45 + idle - ry) * k;
      rx += (S.pointer.y * 0.18 - rx) * k;
      rig.rotation.set(rx, ry + scroll.p * Math.PI * 1.1, REDUCED ? 0 : Math.sin(time * 0.3) * 0.04);
      rig.position.y = scroll.p * 1.4 + (REDUCED ? 0 : Math.sin(time * 0.8) * 0.05);
      rig.scale.setScalar(fit * (1 + a.beat * 0.06 + kick * 0.12) * (1 - scroll.p * 0.35));

      const amp = 0.008 + a.bass * 0.05 + kick * 0.06 + S.rage * 0.025;
      wob.uTime.value = time; wob.uAmp.value = amp;
      glowMat.uniforms.uTime.value = time; glowMat.uniforms.uAmp.value = amp;
      mat.color.copy(baseCol).lerp(rageCol, S.rage);
      mat.sheenColor.copy(C.slime).lerp(C.blood, S.rage);
      mat.emissive.copy(baseEm).lerp(rageEm, S.rage);
      drops.material.color.copy(mat.color);
      glowMat.uniforms.uColor.value.copy(C.slime).lerp(C.blood, S.rage);
      glowMat.uniforms.uIntensity.value = 0.7 + a.bass * 1.1 + a.beat * 0.6 + kick;
      L1.color.copy(C.slime2).lerp(C.blood, S.rage);

      const op = Math.round(baseOp * (1 - scroll.p * 0.85) * 100) / 100;
      if (op !== lastOp) { lastOp = op; canvas.style.opacity = String(op); }

      /* drips */
      if (a.beatHit) forceDrips(2);
      rig.updateMatrixWorld();
      for (let i = 0; i < DN; i++) {
        const d = D[i];
        if (!d.live) {
          d.wait -= dt;
          if (d.wait <= 0 && !REDUCED) spawn(d);
          else { m4.makeScale(0, 0, 0); drops.setMatrixAt(i, m4); continue; }
        }
        if (d.grow < 1) d.grow = Math.min(1, d.grow + dt * 1.4);
        else { d.vy -= dt * 4.2; d.p.y += d.vy * dt; }
        if (d.p.y < -3.4) { d.live = false; d.wait = 0.4 + Math.random() * 2.6; }
        const st = 1 + Math.min(1.6, -d.vy * 0.35), g = d.grow * fit;
        sv.set(g / Math.sqrt(st), g * st, g / Math.sqrt(st));
        m4.compose(d.p, q0, sv); drops.setMatrixAt(i, m4);
      }
      drops.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
    },
    dispose() {
      if (tween) { if (tween.scrollTrigger) tween.scrollTrigger.kill(); tween.kill(); }
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('click', onClick);
      if (hover) cursorBig(false);
      disposeTree(scene);
      canvas.remove();
      hero.classList.remove('has-3d');
    },
  };
}
