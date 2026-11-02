/* Vendor entry → assets/3d/vendor/gsap.js — GSAP core + ScrollTrigger,
   registered once here so scenes just `import { gsap } from './vendor/gsap.js'`. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };
