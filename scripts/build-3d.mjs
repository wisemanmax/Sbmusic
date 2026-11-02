#!/usr/bin/env node
/* ============================================================
   build:3d — the ONE optional build step behind the 3D layer.
   The site itself stays no-build: everything this writes is committed, and the
   hand-written scene code in assets/3d/*.js is shipped as-is (plain ES modules).

   1. Vendor bundle → assets/3d/vendor/
        three.js  three.js core + the addons the scenes use (tree-shaken)
        gltf.js   GLTFLoader (lazy — only for real merch product models)
        gsap.js   GSAP + ScrollTrigger
        chunk-*.js code shared between those entries (esbuild code-splitting)
      Served same-origin, so the strict CSP (script-src 'self') needs no CDN hole.

   2. AR model files → assets/models/
        <name>.glb   Android Scene Viewer + any glTF viewer
        <name>.usdz  iOS / iPadOS Quick Look
      Baked from the same procedural builder the in-browser viewer uses
      (assets/3d/merch-models.js), at real-world scale.

   Run: npm run build:3d          (both)
        npm run build:3d -- vendor (just the bundle)
        npm run build:3d -- models (just the AR files)
   ============================================================ */
import { build } from 'esbuild';
import { readdir, rm, mkdir, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = path.join(ROOT, 'assets/3d/vendor');
const MODELS = path.join(ROOT, 'assets/models');
const want = new Set(process.argv.slice(2));
const all = want.size === 0;

/* Every merch card in shows.html points at one of these (data-ar-glb / data-usdz). */
export const AR_MODELS = [
  { file: 'sb-emblem-slime', kind: 'emblem', finish: 'slime' },
  { file: 'sb-emblem-blood', kind: 'emblem', finish: 'blood' },
  { file: 'sb-emblem-onyx', kind: 'emblem', finish: 'onyx' },
  { file: 'sb-pendant-ice', kind: 'chain', finish: 'ice' },
  { file: 'sb-emblem-venom', kind: 'emblem', finish: 'venom' },
  { file: 'sb-emblem-alien', kind: 'emblem', finish: 'alien' },
];

const kb = (n) => (n / 1024).toFixed(1) + ' KB';

async function vendor() {
  await rm(VENDOR, { recursive: true, force: true });
  await mkdir(VENDOR, { recursive: true });
  const res = await build({
    absWorkingDir: ROOT,
    entryPoints: {
      three: 'scripts/3d/three.entry.js',
      gltf: 'scripts/3d/gltf.entry.js',
      gsap: 'scripts/3d/gsap.entry.js',
    },
    outdir: VENDOR,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    target: ['es2020'],
    chunkNames: 'chunk-[hash]',
    legalComments: 'eof',
    metafile: true,
    logLevel: 'warning',
  });
  for (const f of (await readdir(VENDOR)).sort()) {
    const s = await stat(path.join(VENDOR, f));
    console.log('  vendor/' + f.padEnd(24) + kb(s.size));
  }
  return res;
}

async function models() {
  /* GLTFExporter reads its own Blobs back through FileReader — Node has Blob but
     not FileReader, so give it the two methods it calls. */
  if (typeof globalThis.FileReader === 'undefined') {
    globalThis.FileReader = class {
      _done(r) { this.result = r; if (this.onload) this.onload({ target: this }); if (this.onloadend) this.onloadend({ target: this }); }
      readAsArrayBuffer(b) { b.arrayBuffer().then((x) => this._done(x)); }
      readAsDataURL(b) { b.arrayBuffer().then((x) => this._done('data:' + (b.type || 'application/octet-stream') + ';base64,' + Buffer.from(x).toString('base64'))); }
    };
  }
  const THREE = await import('three');
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
  const { buildMerchModel } = await import(path.join(ROOT, 'assets/3d/merch-models.js'));
  await mkdir(MODELS, { recursive: true });
  for (const m of AR_MODELS) {
    const piece = buildMerchModel(THREE, { kind: m.kind, finish: m.finish, detail: 0.45 });
    // untextured pieces: UVs are dead weight in the files
    piece.traverse((o) => { if (o.isMesh && o.geometry.getAttribute('uv')) o.geometry.deleteAttribute('uv'); });
    const scene = new THREE.Scene();
    piece.scale.setScalar(piece.userData.arScale || 0.1);   // scene units → metres
    scene.add(piece);
    scene.updateMatrixWorld(true);
    const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
    const usdz = await new USDZExporter().parseAsync(scene, { quickLookCompatible: true });
    await writeFile(path.join(MODELS, m.file + '.glb'), Buffer.from(glb));
    await writeFile(path.join(MODELS, m.file + '.usdz'), Buffer.from(usdz));
    console.log('  models/' + (m.file + '.glb').padEnd(24) + kb(glb.byteLength) + '   .usdz ' + kb(usdz.byteLength));
  }
}

if (all || want.has('vendor')) { console.log('build:3d — vendor bundle'); await vendor(); }
if (all || want.has('models')) { console.log('build:3d — AR models'); await models(); }
