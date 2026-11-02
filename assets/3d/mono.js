/* ============================================================
   SB monogram → 3D geometry.
   The site's logo is one SVG path (SNAKE_PATH in app.js):
     M70 28 C70 18 30 18 30 32 C30 46 70 42 70 58 C70 74 30 74 30 62 M50 16 L50 84
   It's an open, round-capped STROKE (an S plus a vertical bar), so it's swept as
   a tube along the same Béziers — extruding it as a filled shape would be wrong.
   Takes THREE as a parameter (no import) so the same code builds the in-browser
   scenes AND runs under Node in scripts/build-3d.mjs to bake the AR model files.
   ============================================================ */

/* SVG units (0..100, y down) → scene units (centred, y up). 25 SVG px = 1 unit,
   so the mark is ~1.6 wide × 2.72 tall before the tube radius. */
function P(THREE, x, y) { return new THREE.Vector3((x - 50) / 25, -(y - 50) / 25, 0); }

export function monoCurves(THREE) {
  const s = new THREE.CurvePath();
  const segs = [
    [70, 28, 70, 18, 30, 18, 30, 32],
    [30, 32, 30, 46, 70, 42, 70, 58],
    [70, 58, 70, 74, 30, 74, 30, 62],
  ];
  for (const [ax, ay, bx, by, cx, cy, dx, dy] of segs) {
    s.add(new THREE.CubicBezierCurve3(P(THREE, ax, ay), P(THREE, bx, by), P(THREE, cx, cy), P(THREE, dx, dy)));
  }
  const bar = new THREE.LineCurve3(P(THREE, 50, 16), P(THREE, 50, 84));
  return { s, bar, ends: [P(THREE, 70, 28), P(THREE, 30, 62), P(THREE, 50, 16), P(THREE, 50, 84)] };
}

/* Merge geometries (each with an optional Matrix4) into one indexed BufferGeometry.
   Keeps position / normal / uv. Small on purpose — avoids pulling BufferGeometryUtils
   into the vendor bundle. */
export function mergeGeometries(THREE, parts) {
  let vCount = 0, iCount = 0;
  const prepared = parts.map(({ geo, matrix }) => {
    const g = geo;   // non-indexed parts get a sequential index below
    const pos = g.getAttribute('position');
    const idx = g.index ? g.index.array : null;
    vCount += pos.count; iCount += idx ? idx.length : pos.count;
    return { g, matrix, idx };
  });
  const position = new Float32Array(vCount * 3), normal = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2);
  const index = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const { g, matrix, idx } of prepared) {
    const pa = g.getAttribute('position'), na = g.getAttribute('normal'), ua = g.getAttribute('uv');
    if (matrix) nm.getNormalMatrix(matrix);
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i); if (matrix) v.applyMatrix4(matrix);
      position.set([v.x, v.y, v.z], (vo + i) * 3);
      if (na) { v.fromBufferAttribute(na, i); if (matrix) v.applyMatrix3(nm).normalize(); normal.set([v.x, v.y, v.z], (vo + i) * 3); }
      if (ua) uv.set([ua.getX(i), ua.getY(i)], (vo + i) * 2);
    }
    if (idx) for (let i = 0; i < idx.length; i++) index[io + i] = idx[i] + vo;
    else for (let i = 0; i < pa.count; i++) index[io + i] = vo + i;
    io += idx ? idx.length : pa.count; vo += pa.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere(); out.computeBoundingBox();
  return out;
}

/* The full mark as ONE geometry: S tube + bar tube + four round end caps. */
export function buildMonoGeometry(THREE, { radius = 0.15, tubular = 260, radial = 20 } = {}) {
  const { s, bar, ends } = monoCurves(THREE);
  const parts = [
    { geo: new THREE.TubeGeometry(s, tubular, radius, radial, false) },
    { geo: new THREE.TubeGeometry(bar, Math.max(8, tubular >> 3), radius, radial, false) },
  ];
  const cap = new THREE.SphereGeometry(radius, radial, Math.max(8, radial >> 1));
  for (const e of ends) parts.push({ geo: cap, matrix: new THREE.Matrix4().makeTranslation(e.x, e.y, e.z) });
  return mergeGeometries(THREE, parts);
}
