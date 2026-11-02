/* Vendor entry → assets/3d/vendor/three.js (see scripts/build-3d.mjs).
   Only what the SB scenes use is exported, so esbuild can tree-shake the rest
   of three.js away. Using a new class in a scene? Add it here and re-run
   `npm run build:3d`. */
export {
  ACESFilmicToneMapping, AdditiveBlending, Box3, BoxGeometry, BufferAttribute, BufferGeometry,
  CanvasTexture, CatmullRomCurve3, CircleGeometry, Color, CubicBezierCurve3, CurvePath,
  CylinderGeometry, DataTexture, DirectionalLight, DoubleSide, DynamicDrawUsage, Group,
  HemisphereLight, IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineCurve3, LineLoop,
  LinearFilter, MathUtils, Matrix3, Matrix4, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, OctahedronGeometry, PMREMGenerator, PerspectiveCamera, PlaneGeometry,
  PointLight, Quaternion, Raycaster, RedFormat, RingGeometry, SRGBColorSpace, Scene,
  ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, TextureLoader, TorusGeometry,
  TubeGeometry, UnsignedByteType, Vector2, Vector3, WebGLRenderer, REVISION,
  NormalBlending, BackSide,
} from 'three';
export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
export { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
export { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
export { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
