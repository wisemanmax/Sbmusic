/* ============================================================
   SB 3D kit — small shared helpers for every scene (browser only).
   ============================================================ */
import * as THREE from './vendor/three.js';

export { THREE };

export const IS_MOBILE = matchMedia('(pointer:coarse)').matches || innerWidth < 700;
export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* brand palette (sRGB hex → THREE.Color converts to linear working space) */
export const C = {
  slime: new THREE.Color('#8dff2b'), slime2: new THREE.Color('#b6ff5a'), venom: new THREE.Color('#2a7a00'),
  blood: new THREE.Color('#ff1f2e'), alien: new THREE.Color('#9b3cff'), alien2: new THREE.Color('#c47bff'),
  ink: new THREE.Color('#f2efe9'),
};

/* One renderer per scene canvas. DPR is capped (phones 1.5, desktop 2) — the
   snake pit already owns a full-page WebGL context, so every scene stays lean. */
export function makeRenderer(canvas, { alpha = true, dprCap } = {}) {
  const r = new THREE.WebGLRenderer({
    canvas, alpha, antialias: !IS_MOBILE, powerPreference: 'high-performance',
    premultipliedAlpha: true, preserveDrawingBuffer: false,
  });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, dprCap || (IS_MOBILE ? 1.5 : 2)));
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.1;
  if (alpha) r.setClearColor(0x000000, 0);
  return r;
}

/* Studio reflections without shipping an HDR: three's RoomEnvironment through PMREM.
   Cached per renderer (textures can't cross WebGL contexts). */
const _env = new WeakMap();
export function envFor(renderer) {
  if (_env.has(renderer)) return _env.get(renderer);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  pm.dispose();
  _env.set(renderer, tex);
  return tex;
}

/* Audio-reactive "wet" wobble: displaces vertices along their normal with a few
   layered sines. Patches any built-in material via onBeforeCompile. */
export function addWobble(material, key = 'sbwobble') {
  const u = { uTime: { value: 0 }, uAmp: { value: 0.02 }, uFreq: { value: 1 } };
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'uniform float uTime;\nuniform float uAmp;\nuniform float uFreq;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float sbw = sin(position.y*4.0*uFreq + uTime*2.2)*0.5
                 + sin(position.x*5.0*uFreq - uTime*1.7)*0.35
                 + sin((position.x+position.y+position.z)*9.0*uFreq + uTime*3.1)*0.15;
       transformed += normal * sbw * uAmp;`);
  };
  material.customProgramCacheKey = () => key;
  return u;
}

/* Glow on a TRANSPARENT canvas. Additive blending there leaves "colour with ~no alpha"
   pixels — not valid premultiplied data — and the page compositor turns them into a
   dark halo around the glow. Plain "over" blending is always valid: the glow tints the
   page under it instead of punching a hole. Straight (non-premultiplied) alpha here,
   because three's sprite shader never premultiplies its colour — with
   premultipliedAlpha on, every glow sprite rendered as a solid, hard-edged disc. */
export function additive(m, premultiplied = false) {
  m.blending = THREE.NormalBlending;
  m.premultipliedAlpha = premultiplied;   // true only for shaders that premultiply their own output (the halo below)
  m.transparent = true; m.depthWrite = false;
  return m;
}

/* Halo shell: an inflated copy of a mesh drawn from the BACK, lit by the inverse
   fresnel — brightest hugging the object, fading to nothing at its outer edge (the
   classic "atmosphere" glow). The object itself occludes the middle, so only the
   soft aura around its silhouette shows. Alpha-safe on a transparent canvas. */
export function glowMaterial(color, { thickness = 0.09, power = 2.2, intensity = 1 } = {}) {
  return additive(new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() }, uIntensity: { value: intensity }, uThick: { value: thickness },
      uPower: { value: power }, uTime: { value: 0 }, uAmp: { value: 0 },
    },
    vertexShader: `
      uniform float uThick; uniform float uTime; uniform float uAmp;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float sbw = sin(position.y*4.0 + uTime*2.2)*0.5 + sin(position.x*5.0 - uTime*1.7)*0.35;
        vec3 p = position + normal * (uThick + sbw*uAmp);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uIntensity; uniform float uPower;
      varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(abs(dot(normalize(vN), normalize(vV))), uPower) * uIntensity;
        gl_FragColor = vec4(uColor * max(1.0, f), clamp(f, 0.0, 1.0));   // over-driven halos get hotter, not wider
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb *= gl_FragColor.a;                             // premultiply AFTER the sRGB encode
      }`,
    side: THREE.BackSide,
  }), true);
}

/* soft radial dot for additive sprite glows */
let _dot = null;
export function glowTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _dot = new THREE.CanvasTexture(c); _dot.colorSpace = THREE.SRGBColorSpace;
  return _dot;
}

/* the custom cursor ring (body{cursor:none}) — grow it over interactive 3D bits */
export function cursorBig(on) { const c = document.getElementById('cursor'); if (c) c.classList.toggle('big', !!on); }

/* dispose everything a scene graph holds on the GPU */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); }
  });
}
