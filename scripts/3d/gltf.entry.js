/* Vendor entry → assets/3d/vendor/gltf.js — lazy: only loaded when a merch card
   points at a real product model (data-model="….glb"). Shares three.js's code
   with vendor/three.js through esbuild's split chunk, so nothing is duplicated. */
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
