/* ============================================================
   Procedural merch pieces for the 3D product viewer (+ AR).
   Until real product scans exist, each piece is built from the SB mark:
     kind 'emblem' → the mark standing on a small plinth, in the product's finish
     kind 'chain'  → the iced SB pendant: chrome mark set with stones, on a chain
   Takes THREE as a parameter so scripts/build-3d.mjs can run it under Node and
   bake the same models to GLB (Android Scene Viewer) and USDZ (iOS Quick Look).
   A real product file (data-model on the card) replaces all of this.
   ============================================================ */
import { monoCurves, buildMonoGeometry, mergeGeometries } from './mono.js';

export const FINISHES = {
  slime: { color: '#47c414', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.6, iridescenceIOR: 1.3, emissive: '#1a5c00', emissiveIntensity: 0.3 },
  venom: { color: '#1e6b05', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, emissive: '#0b2a00', emissiveIntensity: 0.35 },
  blood: { color: '#c20f1b', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#3a0005', emissiveIntensity: 0.35 },
  alien: { color: '#7b2fe0', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.5, emissive: '#2a0a5a', emissiveIntensity: 0.35 },
  onyx:  { color: '#121214', roughness: 0.08, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.02 },
  ice:   { color: '#e4edf5', roughness: 0.05, metalness: 1 },
};

export function finishMaterial(THREE, finish) {
  const f = FINISHES[finish] || FINISHES.slime;
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(f.color), roughness: f.roughness, metalness: f.metalness || 0,
    clearcoat: f.clearcoat || 0, clearcoatRoughness: f.clearcoatRoughness || 0,
    iridescence: f.iridescence || 0, iridescenceIOR: f.iridescenceIOR || 1.3,
  });
  if (f.emissive) { m.emissive = new THREE.Color(f.emissive); m.emissiveIntensity = f.emissiveIntensity || 0.3; }
  m.name = 'sb-' + finish;
  return m;
}

/* stones set along the front face of the mark's tube */
function stoneGeometry(THREE, detail) {
  const { s, bar } = monoCurves(THREE);
  const gem = new THREE.OctahedronGeometry(0.05, 0);
  const R = 0.15 * 1.02, parts = [], m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const z = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
  const place = (curve, n) => {
    for (let i = 0; i <= n; i++) {
      const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u).normalize();
      const nrm = new THREE.Vector3(-t.y, t.x, 0).normalize();
      for (const a of [-0.9, 0, 0.9]) {
        const dir = z.clone().multiplyScalar(Math.cos(a)).add(nrm.clone().multiplyScalar(Math.sin(a))).normalize();
        q.setFromUnitVectors(up, dir);
        m.compose(p.clone().addScaledVector(dir, R), q, new THREE.Vector3(1, 0.7, 1));
        parts.push({ geo: gem, matrix: m.clone() });
      }
    }
  };
  place(s, Math.round(64 * detail)); place(bar, Math.round(20 * detail));
  return mergeGeometries(THREE, parts);
}

/* a hanging loop of alternating chain links, starting at the pendant's bail */
function chainGeometry(THREE, top, detail) {
  const rx = 1.2, ry = 1.55, cy = top + ry;
  const link = new THREE.TorusGeometry(0.07, 0.022, 6, Math.round(14 * Math.max(0.6, detail)));
  const pts = [];
  for (let i = 0; i <= 400; i++) { const a = -Math.PI / 2 + (i / 400) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rx, cy + Math.sin(a) * ry, 0)); }
  const loop = new THREE.CatmullRomCurve3(pts, true);
  const n = Math.floor(loop.getLength() / 0.115), parts = [], z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < n; i++) {
    const u = i / n, p = loop.getPointAt(u), t = loop.getTangentAt(u).normalize();
    const b = i % 2 ? z.clone() : new THREE.Vector3(-t.y, t.x, 0).normalize();
    const c = new THREE.Vector3().crossVectors(t, b).normalize();
    const m = new THREE.Matrix4().makeBasis(t, b, c).scale(new THREE.Vector3(1.45, 1, 1)).setPosition(p);
    parts.push({ geo: link, matrix: m });
  }
  return mergeGeometries(THREE, parts);
}

/* Build a piece. Returned group sits on y = 0 (its floor), centred in x/z, so AR
   viewers drop it onto the floor naturally. userData.arScale = metres per unit. */
export function buildMerchModel(THREE, { kind = 'emblem', finish = 'slime', detail = 1 } = {}) {
  const g = new THREE.Group();
  g.name = 'sb-' + kind + '-' + finish;
  const mono = buildMonoGeometry(THREE, { radius: 0.15, tubular: Math.round(240 * detail), radial: Math.round(18 * detail) });
  if (kind === 'chain') {
    const mark = new THREE.Mesh(mono, finishMaterial(THREE, 'ice')); mark.name = 'mark'; g.add(mark);
    const stones = new THREE.Mesh(stoneGeometry(THREE, detail), new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'), roughness: 0, metalness: 0, ior: 2.4, clearcoat: 1, iridescence: 0.35, envMapIntensity: 2.4,
    }));
    stones.name = 'stones'; g.add(stones);
    const bailY = 1.36 + 0.15 + 0.1;
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 10, 28), finishMaterial(THREE, 'ice'));
    bail.rotation.y = Math.PI / 2; bail.position.y = bailY; bail.name = 'bail'; g.add(bail);
    const chain = new THREE.Mesh(chainGeometry(THREE, bailY + 0.08, detail), finishMaterial(THREE, 'ice'));
    chain.name = 'chain'; g.add(chain);
    g.userData.arScale = 0.03;
  } else {
    const mark = new THREE.Mesh(mono, finishMaterial(THREE, finish)); mark.name = 'mark'; g.add(mark);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.12, 48), finishMaterial(THREE, 'onyx'));
    plinth.position.y = -1.51 - 0.06; plinth.name = 'plinth'; g.add(plinth);
    g.userData.arScale = 0.1;
  }
  const box = new THREE.Box3().setFromObject(g), c = box.getCenter(new THREE.Vector3());
  for (const ch of g.children) ch.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  g.userData.height = box.max.y - box.min.y;
  return g;
}
