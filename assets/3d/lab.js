/* ============================================================
   THE LAB — 3D "slime pool" visualizer (lab.html #visualizer).
   · a spectrogram terrain: every frame the live spectrum is written into a
     row of a DataTexture; the pool's vertices read that history, so the song's
     shape rolls toward you as glowing neon slime (bass in the middle, highs out
     at the edges, mirrored)
   · a ring of 64 spectrum bars halos the FREQUENCY wordmark (the 2D halo, in 3D)
   · a liquid blob behind the title that heaves with the bass
   · real bloom (UnrealBloomPass) — this canvas is opaque, so a post pass is safe
   The studio knobs drive the WORLD, not just the sound:
     speed  → time itself (slowed literally slows the pool, nightcore races it)
     reverb → fog + bloom (the cavern gets hazier and glows harder)
     room   → the camera pulls back and widens (a bigger room is a bigger space)
   Exposes startRecord/stopRecord for the clip recorder (clip.js).
   ============================================================ */
import { THREE, C, IS_MOBILE, REDUCED, makeRenderer, envFor, addWobble, disposeTree } from './kit.js';
import { attachRecorder } from './clip.js';

const BINS = 64, ROWS = 96;

const POOL_VS = `
  uniform sampler2D uHist; uniform float uFrac; uniform float uHeight; uniform float uTime;
  varying float vH; varying vec2 vUv; varying float vDepth;
  void main(){
    vUv = uv;
    float xm = abs(uv.x - 0.5) * 2.0;                       // mirrored: bass in the centre
    float bin = 0.008 + pow(xm, 1.35) * 0.62;               // up to ~bin 40 (~14 kHz)
    float row = clamp((1.0 - uv.y) - uFrac / ${ROWS}.0, 0.0, 1.0);   // newest row far away, rolling toward camera
    float h = texture2D(uHist, vec2(bin, row)).r;
    h = pow(clamp((h - 0.18) / 0.82, 0.0, 1.0), 1.8);      // drop the always-on floor so the song's shape reads
    vH = h;
    vec3 p = position;
    p.y += h * uHeight * (0.55 + 0.45 * (1.0 - xm)) + sin(p.x * 0.7 + uTime) * 0.06 + sin(p.z * 0.5 - uTime * 0.8) * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const POOL_FS = `
  uniform vec3 uLow; uniform vec3 uMid; uniform vec3 uHigh; uniform vec3 uPeak; uniform vec3 uBg;
  uniform float uFog; uniform float uFlash;
  varying float vH; varying vec2 vUv; varying float vDepth;
  void main(){
    vec3 col = mix(uLow, uMid, smoothstep(0.02, 0.35, vH));
    col = mix(col, uHigh, smoothstep(0.35, 0.7, vH));
    col = mix(col, uPeak, smoothstep(0.7, 1.0, vH));
    // neon grid etched into the slime
    vec2 g = vUv * vec2(48.0, 72.0);
    vec2 w = fwidth(g);
    vec2 gl = abs(fract(g - 0.5) - 0.5) / max(w, 1e-4);
    float line = 1.0 - min(min(gl.x, gl.y), 1.0);
    vec3 c = col * (0.04 + vH * 0.55) + col * line * (0.35 + vH * 2.2) + uMid * line * uFlash * 0.8;
    float fog = 1.0 - exp(-vDepth * uFog);
    gl_FragColor = vec4(mix(c, uBg, clamp(fog, 0.0, 1.0)), 1.0);
  }`;

export function create(section, S) {
  const canvas = document.createElement('canvas');
  canvas.className = 'viz3d';
  canvas.setAttribute('aria-hidden', 'true');
  const old = section.querySelector('#vizCanvas');
  if (old) old.after(canvas); else section.prepend(canvas);
  section.classList.add('has-3d');
  try { S.site().resizeAll(); } catch (_) {}   // the 2D #vizCanvas is now display:none → its loop skips it

  const renderer = makeRenderer(canvas, { alpha: false, dprCap: IS_MOBILE ? 1 : 1.5 });
  const BG = new THREE.Color('#050804');
  renderer.setClearColor(BG, 1);
  const scene = new THREE.Scene();
  scene.background = BG;
  scene.environment = envFor(renderer);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 90);

  /* ---- spectrogram history ---- */
  const hist = new Uint8Array(BINS * ROWS);
  const histTex = new THREE.DataTexture(hist, BINS, ROWS, THREE.RedFormat, THREE.UnsignedByteType);
  histTex.minFilter = histTex.magFilter = THREE.LinearFilter;
  histTex.needsUpdate = true;

  /* ---- the pool ---- */
  const poolGeo = new THREE.PlaneGeometry(18, 28, IS_MOBILE ? 80 : 128, IS_MOBILE ? 90 : 150);
  poolGeo.rotateX(-Math.PI / 2);
  const poolU = {
    uHist: { value: histTex }, uFrac: { value: 0 }, uHeight: { value: 3.6 }, uTime: { value: 0 },
    uLow: { value: new THREE.Color('#0b2a03') }, uMid: { value: C.slime.clone() }, uHigh: { value: C.alien.clone() },
    uPeak: { value: C.blood.clone() }, uBg: { value: BG.clone() }, uFog: { value: 0.035 }, uFlash: { value: 0 },
  };
  const pool = new THREE.Mesh(poolGeo, new THREE.ShaderMaterial({ uniforms: poolU, vertexShader: POOL_VS, fragmentShader: POOL_FS }));
  pool.position.set(0, -1.2, -7);
  scene.add(pool);

  /* ---- spectrum ring around the title ---- */
  const RN = 64, ring = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 1, 0.07), new THREE.MeshBasicMaterial({ toneMapped: false }), RN);
  ring.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const ringCols = [];
  for (let i = 0; i < RN; i++) {
    const p = Math.abs(i / RN - 0.5) * 2;
    const c = p < 0.5 ? C.slime.clone().lerp(C.alien, p * 2) : C.alien.clone().lerp(C.blood, (p - 0.5) * 2);
    ringCols.push(c); ring.setColorAt(i, c);
  }
  const ringRig = new THREE.Group(); ringRig.position.set(0, 2.1, -6.2); ringRig.add(ring); scene.add(ringRig);

  /* ---- the blob ---- */
  const blobMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0c1a06'), roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03,
    iridescence: 1, iridescenceIOR: 1.6, emissive: new THREE.Color('#12380a'), emissiveIntensity: 0.6, envMapIntensity: 1.6,
  });
  const blobW = addWobble(blobMat, 'sbblob');
  const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, IS_MOBILE ? 18 : 32), blobMat);
  blob.position.copy(ringRig.position);
  scene.add(blob);
  const K1 = new THREE.PointLight(C.slime.clone(), 60, 30, 2); K1.position.set(-4, 4, -2); scene.add(K1);
  const K2 = new THREE.PointLight(C.alien.clone(), 70, 30, 2); K2.position.set(4, 1, -3); scene.add(K2);
  const K3 = new THREE.PointLight(C.blood.clone(), 40, 30, 2); K3.position.set(0, -1, -9); scene.add(K3);

  /* ---- post ---- */
  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.9, 0.5, 0.42);   // threshold: only the grid, peaks + ring bloom
  composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());

  let cw = 1, ch = 1, rec = null, afterRender = null;
  const baseDpr = renderer.getPixelRatio();
  function applySize() {
    const w = rec ? rec.w : cw, h = rec ? rec.h : ch, dpr = rec ? 1 : baseDpr;
    renderer.setPixelRatio(dpr); composer.setPixelRatio(dpr);
    renderer.setSize(w, h, false); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  let time = 0, tScale = 1, rowAcc = 0, flash = 0, sway = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const look = new THREE.Vector3(0, 1.4, -6);
  const rageLow = new THREE.Color('#2a0303'), baseLow = new THREE.Color('#0b2a03');
  const blobEm = new THREE.Color('#12380a'), blobRageEm = new THREE.Color('#4a0606'), tc = new THREE.Color();
  let lastRage = 0;

  const api = {
    canvas, renderer, watchEl: section,
    resize(w, h) { cw = w; ch = h; applySize(); },
    /* recorder hooks: render at a fixed portrait size (CSS object-fit keeps the
       on-screen view filled) and hand each finished frame to the compositor */
    startRecord(w, h, cb) { rec = { w, h }; afterRender = cb; api.force = true; canvas.classList.add('rec'); applySize(); },
    stopRecord() { rec = null; afterRender = null; api.force = false; canvas.classList.remove('rec'); applySize(); },
    update(t, dt, S) {
      const a = S.audio, L = S.lab;
      const rate = L.on ? L.rate : 1;
      tScale += (rate - tScale) * Math.min(1, dt * 3);
      const step = dt * tScale * (REDUCED ? 0.35 : 1);
      time += step;

      /* push spectrum rows at a speed that follows the lab's speed knob */
      rowAcc += step * 32;
      while (rowAcc >= 1) {
        rowAcc -= 1;
        hist.copyWithin(BINS, 0, BINS * (ROWS - 1));
        for (let i = 0; i < BINS; i++) hist[i] = Math.min(255, (a.levels[i] || 0) * 255) | 0;
      }
      histTex.needsUpdate = true;
      poolU.uFrac.value = rowAcc;
      poolU.uTime.value = time;
      if (a.beatHit) flash = 1;
      flash *= Math.pow(0.05, dt);
      poolU.uFlash.value = flash;
      poolU.uFog.value = 0.022 + L.rev * 0.05 * (L.on ? 1 : 0.4);
      poolU.uLow.value.copy(baseLow).lerp(rageLow, S.rage);
      poolU.uMid.value.copy(C.slime).lerp(C.blood, S.rage);
      poolU.uHigh.value.copy(C.alien).lerp(C.blood, S.rage * 0.6);

      /* ring */
      const rageDirty = Math.abs(S.rage - lastRage) > 0.002;
      ringRig.rotation.z += step * (0.12 + a.energy * 0.5 + S.rage * 0.4);
      const R = 2.25;
      for (let i = 0; i < RN; i++) {
        const ang = (i / RN) * Math.PI * 2, lv = a.levels[(i * 2) % 40] || 0, len = 0.12 + lv * 1.5;
        pv.set(Math.cos(ang) * (R + len / 2), Math.sin(ang) * (R + len / 2), 0);
        q.setFromAxisAngle(zAxis, ang - Math.PI / 2);
        sv.set(1, len, 1);
        m4.compose(pv, q, sv); ring.setMatrixAt(i, m4);
        if (rageDirty) ring.setColorAt(i, tc.copy(ringCols[i]).lerp(C.blood, S.rage));
      }
      ring.instanceMatrix.needsUpdate = true;
      if (rageDirty && ring.instanceColor) ring.instanceColor.needsUpdate = true;
      lastRage = S.rage;

      /* blob */
      blobW.uTime.value = time * 1.4; blobW.uAmp.value = 0.05 + a.bass * 0.22 + flash * 0.08 + S.rage * 0.06;
      blob.scale.setScalar(1 + a.beat * 0.08);
      blob.rotation.y += step * 0.25; blob.rotation.x += step * 0.11;
      blobMat.emissive.copy(blobEm).lerp(blobRageEm, S.rage);

      /* the room: reverb hazes + blooms it, room size pulls the camera back */
      bloom.strength = 0.55 + L.rev * 0.8 * (L.on ? 1 : 0.5) + a.beat * 0.4 + S.rage * 0.25;
      bloom.radius = 0.35 + L.room * 0.5;
      const camZ = 7.5 + L.room * 3.5;
      sway += (S.pointer.x * 0.9 - sway) * Math.min(1, dt * 2);
      camera.position.set(sway + (REDUCED ? 0 : Math.sin(time * 0.2) * 0.4), 2.2 + L.room * 0.6, camZ);
      const fov = 48 + L.room * 8;
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      camera.lookAt(look);

      composer.render(dt);
      if (afterRender) afterRender(canvas);
    },
    dispose() {
      if (recorder) recorder.dispose();
      composer.dispose();
      histTex.dispose();
      disposeTree(scene);
      canvas.remove();
      section.classList.remove('has-3d');
    },
  };
  const recorder = attachRecorder(section, api, S);
  return api;
}
