/* ============================================================
   MERCH — 3D product turntable inside the product modal (shows.html).
   · data-model="…glb" on a product card → that real model is shown
     (GLTFLoader is a separate lazy chunk; only fetched when a card has one)
   · otherwise the procedural SB piece for the card (data-kind / data-finish)
   · auto-turns; drag to spin it yourself (with a little inertia)
   · lives only while the modal is open — the core unmounts it on close
   AR ("view in your space") is plain links built in app.js — it doesn't need
   WebGL at all, so it works even when this viewer is skipped (lite mode).
   ============================================================ */
import { THREE, C, IS_MOBILE, REDUCED, makeRenderer, envFor, additive, glowTexture, disposeTree } from './kit.js';
import { buildMerchModel } from './merch-models.js';

async function loadGLB(url) {
  const { GLTFLoader } = await import('./vendor/gltf.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  return gltf.scene;
}

export async function create(host, S, data) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  let model;
  try { model = data.model ? await loadGLB(data.model) : buildMerchModel(THREE, { kind: data.kind, finish: data.finish }); }
  catch (e) { console.warn('[sb3d] merch model', e); model = buildMerchModel(THREE, { kind: data.kind, finish: data.finish }); }
  if (!host.isConnected) { canvas.remove(); disposeTree(model); return null; }

  const renderer = makeRenderer(canvas, { alpha: true });
  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);
  const camera = new THREE.PerspectiveCamera(32, 4 / 3, 0.05, 50);
  camera.position.set(0, 0.55, 6.2);
  camera.lookAt(0, 0, 0);

  /* normalise any model to ~2.6 units tall, centred on the turntable */
  const turn = new THREE.Group(); scene.add(turn);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const k = 2.6 / Math.max(size.y, size.x * 0.8, 1e-3);
  model.position.sub(ctr); const holder = new THREE.Group(); holder.add(model); holder.scale.setScalar(k);
  turn.add(holder);
  const floorY = -size.y * k / 2;

  /* glowing pedestal ring + soft floor light */
  const ringMat = new THREE.MeshBasicMaterial({ color: C.slime.clone(), transparent: true, opacity: 0.8, toneMapped: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 96), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = floorY - 0.02; scene.add(ring);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4),
    additive(new THREE.MeshBasicMaterial({ map: glowTexture(), color: C.slime.clone(), opacity: 0.35 })));
  pool.rotation.x = -Math.PI / 2; pool.position.y = floorY - 0.03; scene.add(pool);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 0.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(2, 4, 3); scene.add(key);
  const l1 = new THREE.PointLight(C.slime.clone(), 25, 12, 2); l1.position.set(-2.5, 1, 2); scene.add(l1);
  const l2 = new THREE.PointLight(C.alien.clone(), 30, 12, 2); l2.position.set(2.5, -0.5, -1.5); scene.add(l2);

  /* drag to spin */
  let vel = REDUCED ? 0 : 0.6, dragX = null, lastT = 0, auto = true;
  const onDown = (e) => { dragX = e.clientX; lastT = performance.now(); auto = false; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} };
  const onMove = (e) => {
    if (dragX == null) return;
    const now = performance.now(), dx = e.clientX - dragX; dragX = e.clientX;
    const dy = dx * 0.012; turn.rotation.y += dy; vel = dy / Math.max(0.008, (now - lastT) / 1000); lastT = now;
  };
  const onUp = (e) => { dragX = null; try { canvas.releasePointerCapture(e.pointerId); } catch (_) {} };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  host.classList.add('live');

  return {
    canvas, renderer, sizeEl: host,
    force: true,      // the modal box may fade in under the observer's radar — always render while alive
    overModal: true,  // it lives IN the modal, so it's the one scene that keeps running while one is open
    alive: () => { try { return S.site().modalOpen(); } catch (_) { return true; } },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = camera.aspect < 1 ? 7.6 : 6.2;
      camera.updateProjectionMatrix();
    },
    update(t, dt, S) {
      const a = S.audio;
      if (dragX == null) {
        const target = REDUCED ? 0 : 0.6;
        vel += ((auto ? target : target * 0.5) - vel) * Math.min(1, dt * (auto ? 2 : 0.8));
        turn.rotation.y += vel * dt;
      }
      turn.position.y = REDUCED || IS_MOBILE ? 0 : Math.sin(t * 1.2) * 0.04;
      const c = ringMat.color.copy(C.slime).lerp(C.blood, S.rage);
      pool.material.color.copy(c);
      ringMat.opacity = 0.55 + a.bass * 0.45;
      renderer.render(scene, camera);
    },
    dispose() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      disposeTree(scene);
      canvas.remove();
      host.classList.remove('live');
    },
  };
}
