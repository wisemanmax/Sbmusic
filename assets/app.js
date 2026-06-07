/* ============================================================
   SLIME BY — site engine (shared by every page)
   1. Injects the shared "chrome" (nav, footer, player, overlays,
      modal …) from one source of truth so the navbar is identical
      and all-linking on every page.
   2. Wires every interactive feature. Each feature is guarded so a
      page that doesn't contain a given section simply skips it —
      the one script drives all pages.
   ============================================================ */
const SNAKE_PATH = "M70 28 C70 18 30 18 30 32 C30 46 70 42 70 58 C70 74 30 74 30 62 M50 16 L50 84";
const SB_NAV_FALLBACK = [
  { href: 'index.html', label: 'home' }, { href: 'music.html', label: 'music' },
  { href: 'lab.html', label: 'slowed' }, { href: 'world.html', label: 'sb world' },
  { href: 'vault.html', label: 'vault' }, { href: 'shows.html', label: 'shows' },
  { href: 'connect.html', label: 'tap in' },
];
function currentPage(){ const p=(location.pathname.split('/').pop()||'').toLowerCase(); return p===''?'index.html':p; }
function buildChrome(){
  if(document.getElementById('nav')) return;            // double-run / already-present guard
  const NAV=(window.SB_NAV&&window.SB_NAV.length)?window.SB_NAV:SB_NAV_FALLBACK;
  const here=currentPage();
  const links=NAV.map(n=>`<a href="${n.href}"${n.href.toLowerCase()===here?' class="active"':''}>${n.label}</a>`).join('');
  const top=`
<a class="skip" href="#main">skip to content</a>
<div class="bgwrap"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>
<canvas id="snake"></canvas>
<div class="grain"></div><div class="scan"></div><div class="vig"></div>
<div id="rageOverlay"></div><div id="flash"></div>
<div class="cursor" id="cursor"></div>
<canvas id="trail"></canvas>
<div class="rmtag">☠ RAGE MODE ☠ click again to exit</div>
<nav id="nav">
  <a class="logo" href="index.html" aria-label="Slime By — home">
    <svg class="mk" viewBox="0 0 100 100"><path d="${SNAKE_PATH}"/></svg>
    <div class="wm">SLIME BY</div>
  </a>
  <div class="navlinks">${links}</div>
  <button class="btnX" type="button" id="rageBtn">☠ rage mode</button>
  <button class="burger" id="burger" aria-label="menu" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
</nav>`;
  const bottom=`
<footer>
  <a class="fmark" href="index.html" aria-label="Slime By — home">SB</a>
  <div class="fbadges"><span class="fbadge">★ BEST VIEWED IN RAGE MODE</span><span class="fbadge">MADE IN DE</span><span class="fbadge">100% INDEPENDENT</span><span class="fbadge">SB UNIVERSE ☠</span></div>
  <div class="fcopy">© 2026 slime by · delaware · the snake moves</div>
</footer>
<div class="musicbar" id="musicbar">
  <div class="disc" id="disc" style="background-image:url('assets/my-time-cover.jpg')" role="button" tabindex="0" aria-label="play / pause"></div>
  <div class="minfo"><div class="now">now playing</div><div class="stitle">Man Of My Word</div></div>
  <button class="pbtn" id="pbtn" aria-label="play / pause">▶</button>
</div>
<button class="totop" id="totop" aria-label="back to top">↑</button>
<button class="helpbtn" id="helpbtn" aria-label="keyboard shortcuts" title="keyboard shortcuts">?</button>
<audio id="audio" loop preload="auto" src="assets/man-of-my-word.mp3" crossorigin="anonymous"></audio>
<div id="toasts" aria-live="polite"></div>
<div class="modal" id="modal" role="dialog" aria-modal="true" aria-hidden="true">
  <div class="box" id="modalBox"><button class="x" id="modalX" aria-label="close">✕</button><div id="modalContent"></div></div>
</div>`;
  document.body.classList.add('page-'+here.replace(/\.html$/,''));
  const frag=html=>{const t=document.createElement('template');t.innerHTML=html;return t.content;};
  const main=document.querySelector('main');
  document.body.insertBefore(frag(top),document.body.firstChild);
  if(main&&main.parentNode===document.body) main.after(frag(bottom));
  else document.body.appendChild(frag(bottom));
}
buildChrome();

/* cross-page: route visitors to the join-the-list form (connect page) */
function gotoConnectJoin(msg){
  const g=document.getElementById('gemail');
  if(g){const c=document.getElementById('connect');if(c)c.scrollIntoView({behavior:'smooth'});setTimeout(()=>g.focus(),500);if(msg)toast(msg);}
  else location.href='connect.html#join';
}

/* LOADER + AUTOPLAY ON LOAD */
function hideLoader(){const l=document.getElementById('loader');if(l)l.classList.add('gone');}
window.addEventListener('load',()=>{setTimeout(hideLoader,400);/* kick the track the moment the page is in — falls back to first interaction if the browser blocks it. carries the play state across pages: if the visitor paused earlier, stay paused. */ if(!/[?&]preview\b/.test(location.search)){ if(_hadAudioState&&!_resumeWanted){try{ensureCtx();}catch(_){}} else {try{startAudio();}catch(_){}} }});
setTimeout(hideLoader,2600); /* safety: never let the loader trap the page */
(()=>{const el=document.getElementById('vcount');let n=parseInt(localStorage.getItem('sb_visits')||'0',10);if(!n||isNaN(n))n=690+Math.floor(Math.random()*9000);if(!sessionStorage.getItem('sb_counted')){n++;try{localStorage.setItem('sb_visits',n);sessionStorage.setItem('sb_counted','1');}catch(_){}}if(el)el.textContent=String(n).padStart(6,'0');})();

/* NAV */
const nav=document.getElementById('nav');
addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>40));
const burger=document.getElementById('burger');
function setMenu(open){nav.classList.toggle('open',open);burger.setAttribute('aria-expanded',open?'true':'false');}
burger.onclick=()=>setMenu(!nav.classList.contains('open'));
document.querySelectorAll('.navlinks a').forEach(a=>a.onclick=()=>setMenu(false));
addEventListener('click',e=>{if(nav.classList.contains('open')&&!e.target.closest('#nav'))setMenu(false);});

/* Active nav link is set per-page in buildChrome() (multi-page site). */

/* escape CMS-supplied values before they go into innerHTML/attributes */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* MARQUEE */
function renderMarquee(words){const tr=document.getElementById('track');if(!tr)return;let mh='';for(let r=0;r<2;r++){(words||[]).forEach(w=>mh+=`<span>${esc(w)}</span><span>✦</span>`)}tr.innerHTML=mh;}

/* REVEAL */
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* CURSOR + EMBERS */
const cursor=document.getElementById('cursor');
let mx=innerWidth/2,my=innerHeight/2,cxp=mx,cyp=my;
const hoverEls='a,button,.rel,.vcard,.upanel,.prod,.disc,.pwplay,.sbmono';
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;emit(e.clientX,e.clientY,1);
  const hx=(e.clientX/innerWidth-.5),hy=(e.clientY/innerHeight-.5);const hi=document.getElementById('heroinner');if(hi){hi.style.setProperty('--px',(hx*16)+'px');hi.style.setProperty('--py',(hy*12)+'px');}});
document.addEventListener('mouseover',e=>{if(e.target.closest(hoverEls))cursor.classList.add('big')});
document.addEventListener('mouseout',e=>{if(e.target.closest(hoverEls))cursor.classList.remove('big')});
(function cl(){cxp+=(mx-cxp)*.25;cyp+=(my-cyp)*.25;cursor.style.left=cxp+'px';cursor.style.top=cyp+'px';requestAnimationFrame(cl)})();
const tcv=document.getElementById('trail'),tctx=tcv.getContext('2d');
let embers=[];const emberC=['#ff1f2e','#8dff2b','#9b3cff','#b6ff5a'];
function emit(x,y,n){for(let i=0;i<n;i++){if(Math.random()<.5)embers.push({x,y,vx:(Math.random()-.5)*.6,vy:-Math.random()*1.2-.3,life:1,c:emberC[Math.floor(Math.random()*emberC.length)],s:Math.random()*2.4+.8})}if(embers.length>180)embers.splice(0,embers.length-180);}
function burst(x,y,n,c){for(let i=0;i<n;i++){const a=Math.random()*7,sp=Math.random()*4+1;embers.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:1,c:c||emberC[Math.floor(Math.random()*emberC.length)],s:Math.random()*3+1})}}
function sizeTrail(){tcv.width=innerWidth;tcv.height=innerHeight;}sizeTrail();

/* AUDIO GRAPH */
const audio=document.getElementById('audio');audio.volume=.55;
const pbtn=document.getElementById('pbtn'),disc=document.getElementById('disc'),musicbar=document.getElementById('musicbar'),pwplay=document.getElementById('pwplay');
let actx,analyser,srcNode,mix,shaper,dry,conv,wet,freq,graphReady=false,playing=false,noiseBuf;
/* slowed + reverb state (drives the whole-site track) */
let userRate=0.80,revAmt=0.30,roomP=0.55;
/* ── audio continuity: the track follows you across pages ──
   On each navigation we save position / volume / fx + play state, and restore
   them here so the song picks up where it left off instead of restarting. */
const SB_AUDIO_KEY='sb_audio';let _seekTo=null,_resumeWanted=false,_hadAudioState=false;
try{const s=JSON.parse(sessionStorage.getItem(SB_AUDIO_KEY)||'null');if(s){_hadAudioState=true;if(typeof s.vol==='number')audio.volume=s.vol;if(typeof s.rate==='number')userRate=s.rate;if(typeof s.rev==='number')revAmt=s.rev;if(typeof s.room==='number')roomP=s.room;if(typeof s.t==='number'&&isFinite(s.t))_seekTo=s.t;_resumeWanted=!!s.playing;}}catch(_){}
function saveAudioState(){try{sessionStorage.setItem(SB_AUDIO_KEY,JSON.stringify({t:audio.currentTime||0,vol:audio.volume,rate:userRate,rev:revAmt,room:roomP,playing:!audio.paused}));}catch(_){}}
addEventListener('pagehide',saveAudioState);addEventListener('beforeunload',saveAudioState);
try{audio.preservesPitch=false;audio.mozPreservesPitch=false;audio.webkitPreservesPitch=false;}catch(_){}
audio.playbackRate=userRate;
function ensureCtx(){if(!actx){try{
    actx=new(window.AudioContext||window.webkitAudioContext)();
    analyser=actx.createAnalyser();analyser.fftSize=128;analyser.smoothingTimeConstant=.82;
    mix=actx.createGain();mix.gain.value=.9;
    shaper=actx.createWaveShaper();shaper.oversample='2x';/* curve=null => clean passthrough; rage swaps in distortion */
    dry=actx.createGain();dry.gain.value=1;
    conv=actx.createConvolver();
    wet=actx.createGain();wet.gain.value=0;
    mix.connect(shaper);
    shaper.connect(dry);dry.connect(analyser);
    shaper.connect(conv);conv.connect(wet);wet.connect(analyser);
    analyser.connect(actx.destination);
    freq=new Uint8Array(analyser.frequencyBinCount);
    noiseBuf=actx.createBuffer(1,actx.sampleRate,actx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    rebuildImpulse();applyAudioFx();
  }catch(e){}}if(actx&&actx.state==='suspended')actx.resume();}
function rebuildImpulse(){if(!actx||!conv)return;const sec=0.4+roomP*3.6,rate=actx.sampleRate,len=Math.max(1,Math.floor(sec*rate));const buf=actx.createBuffer(2,len,rate);for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);}conv.buffer=buf;}
function rageRate(){return Math.min(1.3,Math.max(1.12,userRate+0.32));}
function applyAudioFx(){if(!actx)return;const t=actx.currentTime;
  if(dry)dry.gain.setTargetAtTime((rageOn?0.72:1)*(1-revAmt*0.35),t,0.03);
  if(wet)wet.gain.setTargetAtTime(revAmt*0.9,t,0.03);
  if(shaper)shaper.curve=rageOn?distc(7):null;
  try{audio.preservesPitch=false;audio.mozPreservesPitch=false;audio.webkitPreservesPitch=false;}catch(_){}
  audio.playbackRate=rageOn?rageRate():userRate;}
function connectMedia(){if(graphReady)return;ensureCtx();try{srcNode=actx.createMediaElementSource(audio);srcNode.connect(mix);graphReady=true;}catch(e){}}
function startAudio(){connectMedia();ensureCtx();applyAudioFx();armKick();audio.play().then(()=>setUI(true)).catch(()=>{});}
function setUI(on){playing=on;const ic=on?'❚❚':'▶';if(pbtn)pbtn.textContent=ic;if(pwplay)pwplay.textContent=ic;if(disc)disc.classList.toggle('spin',on);if(musicbar)musicbar.classList.toggle('open',on);const sp=document.getElementById('srPlay');if(sp)sp.textContent=on?'❚❚ pause':'▶ play';const sa=document.getElementById('srArt');if(sa)sa.classList.toggle('spin',on);}
function toggle(){if(audio.paused)startAudio();else{audio.pause();setUI(false);}}
if(pbtn)pbtn.onclick=toggle;if(disc)disc.onclick=toggle;if(pwplay)pwplay.onclick=toggle;
audio.addEventListener('play',()=>setUI(true));audio.addEventListener('pause',()=>setUI(false));
function listenNow(){startAudio();const v=document.getElementById('visualizer');if(v)v.scrollIntoView({behavior:'smooth'});}
/* Always arm a first-interaction fallback: the very first tap / scroll / key resumes the
   audio context (required even when autoplay "succeeds" into a still-suspended context) and
   starts the track if the browser blocked autoplay outright. */
let kicked=false,armed=false;
function armKick(){if(kicked||armed)return;armed=true;const evs=['pointerdown','touchstart','keydown','wheel','scroll'];function kick(){if(kicked)return;kicked=true;evs.forEach(e=>removeEventListener(e,kick));ensureCtx();if(audio.paused){audio.play().then(()=>setUI(true)).catch(()=>{});}else setUI(true);}evs.forEach(e=>addEventListener(e,kick,{once:true,passive:true}));}
const pwcur=document.getElementById('pwcur'),pwdur=document.getElementById('pwdur'),pwfill=document.getElementById('pwprogfill'),pwprog=document.getElementById('pwprog');
function fmt(s){if(!isFinite(s))return'0:00';const m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+String(x).padStart(2,'0');}
audio.addEventListener('loadedmetadata',()=>{const d=fmt(audio.duration);if(pwdur)pwdur.textContent=d;const sd=document.getElementById('srDur');if(sd)sd.textContent=d;if(_seekTo!=null&&isFinite(audio.duration)){try{audio.currentTime=Math.max(0,Math.min(_seekTo,audio.duration-0.25));}catch(_){}_seekTo=null;}});
audio.addEventListener('timeupdate',()=>{const c=fmt(audio.currentTime),pct=(audio.currentTime/audio.duration*100||0)+'%';if(pwcur)pwcur.textContent=c;if(pwfill)pwfill.style.width=pct;const sc=document.getElementById('srCur'),sf=document.getElementById('srProgFill');if(sc)sc.textContent=c;if(sf)sf.style.width=pct;});
if(pwprog)pwprog.onclick=e=>{if(!isFinite(audio.duration))return;const r=pwprog.getBoundingClientRect();audio.currentTime=(e.clientX-r.left)/r.width*audio.duration;};
/* VOLUME */
const pwvol=document.getElementById('pwvol');if(pwvol){pwvol.value=Math.round(audio.volume*100);pwvol.addEventListener('input',()=>{audio.volume=pwvol.value/100;});}
/* BACK TO TOP */
const totop=document.getElementById('totop');totop.onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>totop.classList.toggle('show',scrollY>600));
/* SPACEBAR = play/pause (when not typing / not on a control) */
addEventListener('keydown',e=>{if(e.code==='Space'&&!isTyping()&&!e.target.closest('button,a,input,[role=button]')){e.preventDefault();toggle();}});
disc.addEventListener('keydown',e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();toggle();}});

/* SYNTH */
function distc(amt){const n=256,c=new Float32Array(n);for(let i=0;i<n;i++){const x=i/n*2-1;c[i]=(Math.PI+amt)*x/(Math.PI+amt*Math.abs(x));}return c;}
function env(g,t0,a,peak,d){g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(peak,t0+a);g.gain.exponentialRampToValueAtTime(.0001,t0+a+d);}
function pluck(base){ensureCtx();const t=actx.currentTime,g=actx.createGain();const ws=actx.createWaveShaper();ws.curve=distc(1.5);g.connect(ws);ws.connect(mix);[1,2,3].forEach((r,i)=>{const o=actx.createOscillator();o.type=i===0?'triangle':'sine';o.frequency.value=base*r;const og=actx.createGain();og.gain.value=[1,.4,.2][i];o.connect(og);og.connect(g);o.start(t);o.stop(t+.55);});env(g,t,.004,.5,.5);spike(.55);}
function eight0eight(){ensureCtx();const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain(),ws=actx.createWaveShaper();ws.curve=distc(6);o.type='sine';o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(44,t+.12);o.connect(ws);ws.connect(g);g.connect(mix);env(g,t,.004,.9,.55);o.start(t);o.stop(t+.7);spike(.9);}
function sub(){ensureCtx();const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();o.type='sine';o.frequency.setValueAtTime(70,t);o.frequency.exponentialRampToValueAtTime(38,t+.2);o.connect(g);g.connect(mix);env(g,t,.004,.95,.7);o.start(t);o.stop(t+.9);spike(1);}
function hat(open){ensureCtx();const t=actx.currentTime,s=actx.createBufferSource();s.buffer=noiseBuf;const hp=actx.createBiquadFilter();hp.type='highpass';hp.frequency.value=7000;const g=actx.createGain();s.connect(hp);hp.connect(g);g.connect(mix);env(g,t,.001,.35,open?.25:.05);s.start(t);s.stop(t+.3);spike(.3);}
function snare(){ensureCtx();const t=actx.currentTime;const s=actx.createBufferSource();s.buffer=noiseBuf;const bp=actx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1800;const g=actx.createGain();s.connect(bp);bp.connect(g);g.connect(mix);env(g,t,.001,.5,.18);s.start(t);s.stop(t+.25);const o=actx.createOscillator(),og=actx.createGain();o.type='triangle';o.frequency.value=180;o.connect(og);og.connect(mix);env(og,t,.001,.3,.12);o.start(t);o.stop(t+.15);spike(.6);}
function stab(){ensureCtx();const t=actx.currentTime,ws=actx.createWaveShaper();ws.curve=distc(3);const lp=actx.createBiquadFilter();lp.type='lowpass';lp.frequency.setValueAtTime(2600,t);lp.frequency.exponentialRampToValueAtTime(500,t+.4);const g=actx.createGain();ws.connect(lp);lp.connect(g);g.connect(mix);[220,261.6,329.6].forEach(f=>{const o=actx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=(Math.random()*14-7);o.connect(ws);o.start(t);o.stop(t+.5);});env(g,t,.006,.5,.5);spike(.8);}
function spike(amt){for(let i=0;i<levels.length;i++){levels[i]=Math.min(1,levels[i]+amt*(0.5+Math.random()*0.6));}}

function isTyping(){const a=document.activeElement;return a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable);}

/* SLIME SPLASH (replaces bells) */
function slimeSplash(x,y){stab();if(x!=null)burst(x,y,18,'#8dff2b');snakeLunge();}
const _heroMono=document.getElementById('heroMono');if(_heroMono)_heroMono.onclick=e=>slimeSplash(e.clientX,e.clientY);
const _contactMono=document.getElementById('contactMono');if(_contactMono)_contactMono.onclick=e=>slimeSplash(e.clientX,e.clientY);

/* ---------- INTERACTIVE BACKGROUND SNAKES (a whole pit) ---------- */
const snakeCv=document.getElementById('snake'),sctx=snakeCv.getContext('2d');
let SW=0,SH=0,sdpr=1;
function sizeSnake(){sdpr=Math.min(devicePixelRatio||1,2);SW=innerWidth;SH=innerHeight;snakeCv.width=SW*sdpr;snakeCv.height=SH*sdpr;sctx.setTransform(sdpr,0,0,sdpr,0,0);}
let snakes=[],tongueT=0;
function buildSnakes(){
  const big=innerWidth>900,mid=innerWidth>620;
  const count=big?5:(mid?4:3); // fewer on small screens to stay smooth
  snakes=[];
  for(let i=0;i<count;i++){
    const main=i===0,seg=main?44:(big?30:22),sx=Math.random()*SW,sy=Math.random()*SH,pts=[];
    for(let j=0;j<seg;j++)pts.push({x:sx,y:sy});
    snakes.push({main,seg,pts,headX:sx,headY:sy,
      phase:Math.random()*1000,off:Math.random()*2000,
      sp:main?1:(0.45+Math.random()*0.8),
      amp:main?Math.min(SW*0.34,260):(50+Math.random()*150),
      band:0.12+Math.random()*0.72,vamp:0.10+Math.random()*0.16,
      width:main?16:(4+Math.random()*7),light:main?1:(0.4+Math.random()*0.45),
      dir:Math.random()<0.5?1:-1,lungeT:0});
  }
}
sizeSnake();buildSnakes();
function snakeLunge(){if(snakes[0])snakes[0].lungeT=1;for(let i=1;i<snakes.length;i++)snakes[i].lungeT=0.5;}
function scrollProg(){const m=document.documentElement.scrollHeight-innerHeight;return m>0?Math.min(1,Math.max(0,scrollY/m)):0;}
function snakeColors(s){const a=(0.14*s.light+0.05).toFixed(3);
  if(rageOn)return{g22:'rgba(255,31,46,0.22)',glow:'rgba(255,70,60,'+a+')',c0:'#ff6a55',c1:'#ff1f2e',c2:'#6e0006',blur:28};
  return{g22:'rgba(141,255,43,0.22)',glow:'rgba(141,255,43,'+a+')',c0:'#b6ff5a',c1:'#8dff2b',c2:'#2a7a00',blur:22};}
function moveSnake(s,t,energy){
  const rs=rageOn?1.7:1;let tx,ty;
  if(s.main){ // the lead snake tracks scroll + the cursor, like before
    const sp=scrollProg(),weave=Math.sin(t*0.0011*rs+sp*7)*s.amp+Math.sin(t*0.0023*rs)*40;
    tx=SW*0.5+weave+(mx-SW*0.5)*0.12;ty=70+sp*(SH-150);
  }else{ // the rest roam across the page at their own depth, speed + direction
    const span=SW+360,travel=((t*0.018*s.sp*rs+s.off)%span);
    tx=(s.dir>0?travel:span-travel)-180;
    ty=SH*s.band+Math.sin(t*0.0009*s.sp*rs+s.phase)*SH*s.vamp;
  }
  if(s.lungeT>0){tx+=(mx-tx)*0.6*s.lungeT;ty+=(my-ty)*0.6*s.lungeT;s.lungeT*=0.9;if(s.lungeT<0.02)s.lungeT=0;}
  const ease=s.main?0.09:0.06;s.headX+=(tx-s.headX)*ease;s.headY+=(ty-s.headY)*ease;
  const p=s.pts;p[0].x=s.headX;p[0].y=s.headY;
  const wbase=(rageOn?5:2)+(energy||0)*4;
  for(let i=1;i<s.seg;i++){const q=p[i-1],wig=Math.sin(i*0.5+t*0.012*rs+s.phase)*wbase*(0.5+s.light);
    p[i].x+=((q.x+(i%2?wig:-wig))-p[i].x)*0.5;p[i].y+=(q.y-p[i].y)*0.5;}
}
function drawSnakeBody(s){
  const p=s.pts,col=snakeColors(s);
  sctx.save();sctx.lineCap='round';sctx.lineJoin='round';
  if(s.main){
    for(let pass=0;pass<2;pass++){
      sctx.beginPath();sctx.moveTo(p[0].x,p[0].y);for(let i=1;i<s.seg;i++)sctx.lineTo(p[i].x,p[i].y);
      if(pass===0){sctx.strokeStyle=col.g22;sctx.lineWidth=30;sctx.shadowColor=col.c1;sctx.shadowBlur=col.blur;}
      else{const g=sctx.createLinearGradient(p[0].x,p[0].y,p[s.seg-1].x,p[s.seg-1].y);g.addColorStop(0,col.c0);g.addColorStop(.5,col.c1);g.addColorStop(1,col.c2);sctx.strokeStyle=g;sctx.lineWidth=s.width;sctx.shadowColor=col.c1;sctx.shadowBlur=14;}
      sctx.stroke();
    }
    sctx.beginPath();sctx.moveTo(p[0].x,p[0].y-3);for(let i=1;i<s.seg;i++)sctx.lineTo(p[i].x,p[i].y-3);
    sctx.strokeStyle='rgba(255,255,255,0.25)';sctx.lineWidth=3;sctx.shadowBlur=0;sctx.stroke();
  }else{ // cheaper glow for background snakes: a wide translucent stroke instead of shadowBlur
    sctx.beginPath();sctx.moveTo(p[0].x,p[0].y);for(let i=1;i<s.seg;i++)sctx.lineTo(p[i].x,p[i].y);
    sctx.strokeStyle=col.glow;sctx.lineWidth=s.width*2.6;sctx.stroke();
    const g=sctx.createLinearGradient(p[0].x,p[0].y,p[s.seg-1].x,p[s.seg-1].y);g.addColorStop(0,col.c0);g.addColorStop(1,col.c2);
    sctx.globalAlpha=0.35+s.light*0.5;sctx.strokeStyle=g;sctx.lineWidth=s.width;sctx.stroke();sctx.globalAlpha=1;
  }
  sctx.restore();
  // head
  const hx=p[0].x,hy=p[0].y,ang=Math.atan2(p[0].y-p[2].y,p[0].x-p[2].x),hr=s.main?16:Math.max(6,s.width*0.7);
  sctx.save();sctx.translate(hx,hy);sctx.rotate(ang);
  if(s.main){sctx.shadowColor=col.c1;sctx.shadowBlur=18;}
  sctx.fillStyle=col.c0;sctx.beginPath();sctx.ellipse(0,0,hr,hr*0.78,0,0,7);sctx.fill();sctx.shadowBlur=0;
  if(s.main){
    sctx.fillStyle='#fff';sctx.beginPath();sctx.arc(5,-5,3.2,0,7);sctx.arc(5,5,3.2,0,7);sctx.fill();
    sctx.fillStyle='#ff1f2e';sctx.beginPath();sctx.arc(6,-5,1.5,0,7);sctx.arc(6,5,1.5,0,7);sctx.fill();
    const flick=(Math.sin(tongueT*0.8)>.6)?1:0.3,tl=10+flick*10;
    sctx.strokeStyle='#ff1f2e';sctx.lineWidth=2;sctx.shadowColor='#ff1f2e';sctx.shadowBlur=8;
    sctx.beginPath();sctx.moveTo(14,0);sctx.lineTo(14+tl,0);sctx.moveTo(14+tl,0);sctx.lineTo(14+tl+5,-4);sctx.moveTo(14+tl,0);sctx.lineTo(14+tl+5,4);sctx.stroke();
  }else{sctx.fillStyle='rgba(255,255,255,0.7)';sctx.beginPath();sctx.arc(hr*0.3,-hr*0.3,hr*0.2,0,7);sctx.arc(hr*0.3,hr*0.3,hr*0.2,0,7);sctx.fill();}
  sctx.restore();
}
function drawSnakes(t,energy){tongueT+=0.05;for(const s of snakes){moveSnake(s,t,energy);drawSnakeBody(s);}}

/* ---------- VISUALIZER CANVAS ---------- */
function fit(cv){if(!cv)return{};const dpr=Math.min(devicePixelRatio||1,2);const r=cv.getBoundingClientRect();cv.width=r.width*dpr;cv.height=r.height*dpr;const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return{x,w:r.width,h:r.height};}
const heroCv=document.getElementById('heroCanvas'),vizCv=document.getElementById('vizCanvas'),conCv=document.getElementById('contactCanvas'),eqCv=document.getElementById('pweq'),srWaveCv=document.getElementById('srWave');
let H={},V={},C={},E={},SRW={};
function resizeAll(){H=fit(heroCv);V=fit(vizCv);C=fit(conCv);E=fit(eqCv);SRW=fit(srWaveCv);}
resizeAll();

/* ---------- VISIBILITY CULLING — only paint canvases that are on-screen ---------- */
let heroIn=true,vizIn=false,conIn=false,labIn=false,musicIn=true;
(function(){
  const set={hero:v=>heroIn=v,viz:v=>vizIn=v,con:v=>conIn=v,lab:v=>labIn=v,music:v=>musicIn=v};
  const ob=new IntersectionObserver(es=>es.forEach(e=>{const k=e.target.getAttribute('data-vk');if(set[k])set[k](e.isIntersecting);}),{threshold:0,rootMargin:'120px'});
  [['#top','hero'],['#visualizer','viz'],['#connect','con'],['#lab','lab'],['#music','music']].forEach(([sel,k])=>{const el=document.querySelector(sel);if(el){el.setAttribute('data-vk',k);ob.observe(el);}});
})();

/* ---------- ONE debounced resize handler for every canvas + the snake pit ---------- */
let _rzT;addEventListener('resize',()=>{clearTimeout(_rzT);_rzT=setTimeout(()=>{sizeTrail();sizeSnake();buildSnakes();resizeAll();},150);});
function rg(ctx,w){const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,'#ff1f2e');g.addColorStop(.5,'#9b3cff');g.addColorStop(1,'#8dff2b');return g;}
let levels=new Array(64).fill(0);
function updateLevels(t){if(graphReady&&playing&&analyser){analyser.getByteFrequencyData(freq);for(let i=0;i<levels.length;i++)levels[i]+=(freq[i%freq.length]/255-levels[i])*.4;}else{for(let i=0;i<levels.length;i++){const b=.14+.12*Math.sin(t*.0013+i*.35)+.09*Math.sin(t*.0026+i*.7);levels[i]+=(Math.max(0,b)-levels[i])*.08;}}}
function snakeWave(ctx,w,h,t,amp,thick,yc){ctx.save();ctx.lineCap='round';ctx.shadowColor='#ff1f2e';ctx.shadowBlur=18;const seg=70;for(let pass=0;pass<2;pass++){ctx.beginPath();for(let i=0;i<=seg;i++){const p=i/seg,x=p*w;const lv=levels[Math.floor(p*(levels.length-1))]||0;const wob=Math.sin(p*7+t*.0022+pass*1.6)*amp*(.4+lv*1.6)+Math.sin(p*3-t*.0015)*amp*.4;const y=yc+wob;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.strokeStyle=pass===0?rg(ctx,w):'rgba(255,255,255,.45)';ctx.globalAlpha=pass===0?.95:.3;ctx.lineWidth=thick*(pass===0?1:.4);ctx.stroke();}ctx.restore();}
function bars(ctx,w,h,base){const n=levels.length,bw=w/n,cols=['#ff1f2e','#8dff2b','#9b3cff'];for(let i=0;i<n;i++){const bh=levels[i]*h*.5;const g=ctx.createLinearGradient(0,base,0,base-bh);g.addColorStop(0,cols[i%3]);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.globalAlpha=.85;ctx.fillRect(i*bw+bw*.2,base-bh,bw*.6,bh);ctx.globalAlpha=1;}}
function ring(ctx,cx,cy,r,t){const n=48,cols=['#ff1f2e','#8dff2b','#9b3cff'];ctx.save();ctx.shadowColor='#8dff2b';ctx.shadowBlur=12;for(let i=0;i<n;i++){const a=i/n*Math.PI*2;const len=8+levels[i%levels.length]*70;ctx.strokeStyle=cols[i%3];ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a)*(r+len),cy+Math.sin(a)*(r+len));ctx.lineWidth=2;ctx.stroke();}ctx.restore();}
function eqbars(ctx,w,h){const n=22,bw=w/n,cols=['#ff1f2e','#8dff2b','#9b3cff'];ctx.clearRect(0,0,w,h);for(let i=0;i<n;i++){const bh=Math.max(2,levels[i*2%levels.length]*h);ctx.fillStyle=cols[i%3];ctx.fillRect(i*bw+1,h-bh,bw-2,bh);}}
let parts=[];for(let i=0;i<34;i++)parts.push({x:Math.random(),y:Math.random(),s:Math.random()*2+.5,v:Math.random()*.0004+.0001,c:emberC[Math.floor(Math.random()*4)]});

function frame(t){updateLevels(t);const energy=levels.reduce((a,b)=>a+b,0)/levels.length+(rageOn?0.35:0);
  // SNAKE PIT (full page, always visible)
  sctx.clearRect(0,0,SW,SH);drawSnakes(t,energy);
  if(H.w&&heroIn){const{x,w,h}=H;x.clearRect(0,0,w,h);x.save();parts.forEach(p=>{p.y-=p.v*(1+energy*3);if(p.y<0)p.y=1;x.globalAlpha=.3+energy*.5;x.fillStyle=p.c;x.beginPath();x.arc(p.x*w,p.y*h,p.s,0,7);x.fill();});x.restore();snakeWave(x,w,h,t,9+energy*8,3.5+energy*4,h*.62);}
  if(V.w&&vizIn){const{x,w,h}=V;x.clearRect(0,0,w,h);snakeWave(x,w,h,t,16+energy*18,6+energy*9,h*.5);snakeWave(x,w,h,t*.8+500,11,3+energy*6,h*.52);ring(x,w*.5,h*.5,Math.min(w,h)*.16,t);bars(x,w,h,h);}
  if(C.w&&conIn){const{x,w,h}=C;x.clearRect(0,0,w,h);snakeWave(x,w,h,t*.7,9+energy*6,3+energy*4,h*.5);}
  if(E.w&&musicIn)eqbars(E.x,E.w,E.h);
  if(SRW.w&&labIn){const{x,w,h}=SRW;x.clearRect(0,0,w,h);snakeWave(x,w,h,t*.6,7+energy*9,3+energy*4,h*.5);}
  if(embers.length){tctx.clearRect(0,0,tcv.width,tcv.height);tctx.globalCompositeOperation='lighter';
    for(const p of embers){p.life*=.95;p.x+=p.vx;p.y+=p.vy;p.vy+=.02;const s=p.s*p.life+.4;tctx.globalAlpha=p.life;tctx.fillStyle=p.c;tctx.shadowColor=p.c;tctx.shadowBlur=8;tctx.beginPath();tctx.arc(p.x,p.y,s,0,7);tctx.fill();}
    tctx.globalAlpha=1;embers=embers.filter(p=>p.life>.05);if(!embers.length)tctx.clearRect(0,0,tcv.width,tcv.height);}
  requestAnimationFrame(frame);}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){resizeAll();sizeSnake();}});

/* RAGE MODE — faster + distorted audio, red snake pit, ember bursts + strobe */
const flashEl=document.getElementById('flash');
function flash(c){if(!flashEl)return;flashEl.style.background=c||'var(--slime)';flashEl.style.transition='none';flashEl.style.opacity='.45';requestAnimationFrame(()=>{flashEl.style.transition='opacity .55s ease';flashEl.style.opacity='0';});}
let rageOn=false,rageTimer=null;
function enterRage(){
  rageOn=!rageOn;document.body.classList.toggle('rage',rageOn);ensureCtx();
  if(rageOn){
    startAudio();applyAudioFx();
    const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
    burst(innerWidth/2,innerHeight*0.5,40,'#ff1f2e');snakeLunge();toast('☠ RAGE MODE ☠','blood');
    clearInterval(rageTimer);
    rageTimer=setInterval(()=>{
      if(!rageOn)return;
      burst(Math.random()*innerWidth,innerHeight*(0.55+Math.random()*0.45),14,'#ff1f2e');
      if(!reduce&&Math.random()<0.5)flash('rgba(255,31,46,0.9)');
      if(Math.random()<0.4)snakeLunge();
    },820);
  }else{
    clearInterval(rageTimer);rageTimer=null;applyAudioFx();toast('rage off — back to the slime');
  }
}
const _rageBtn=document.getElementById('rageBtn');if(_rageBtn)_rageBtn.onclick=()=>enterRage();

/* GUESTBOOK + easter egg */
/* JOIN THE SLIME — captures email + (optional) SMS number to localStorage.
   To deliver for real, POST sb_list / sb_sms to your provider (Mailchimp/ConvertKit
   for email, Community/SimpleTexting/Twilio for SMS) — swap the storeLocal calls below. */
function storeLocal(key,val){try{const a=JSON.parse(localStorage.getItem(key)||'[]');if(!a.includes(val)){a.push(val);localStorage.setItem(key,JSON.stringify(a));}}catch(_){}}
function signbook(){
  const e=document.getElementById('gemail'),p=document.getElementById('gphone'),note=document.getElementById('joinnote');
  if(!e||!p||!note)return;
  const ev=e.value.trim(),pv=p.value.trim(),digits=pv.replace(/[^\d]/g,'');
  const emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ev);
  const phoneOk=pv===''||digits.length>=10;
  if(!emailOk){note.textContent='✗ enter a valid email';note.classList.add('bad');e.focus();return;}
  if(!phoneOk){note.textContent='✗ enter a valid phone, or leave it blank';note.classList.add('bad');p.focus();return;}
  storeLocal('sb_list',ev);
  const gotPhone=digits.length>=10;if(gotPhone)storeLocal('sb_sms',digits);
  /* also persist to the backend so sign-ups show up in the admin Audience list.
     localStorage above stays as a fallback if the backend is unreachable. */
  if(typeof sbSubscribe==='function')sbSubscribe(ev,gotPhone?digits:'');
  e.value='';p.value='';note.classList.remove('bad');
  note.textContent=gotPhone?'✓ you in — email + SMS. welcome to the slime ☠':'✓ you in — welcome to the slime ☠';
  burst(innerWidth/2,innerHeight*.7,20,'#8dff2b');snakeLunge();toast('☠ welcome to the slime');
}
let seq='';addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||isTyping())return;seq=(seq+e.key.toLowerCase()).slice(-5);if(seq==='slime'){for(let i=0;i<60;i++)setTimeout(()=>burst(innerWidth*Math.random(),innerHeight,8,'#8dff2b'),i*20);stab();snakeLunge();toast('☠ SLIME UNLOCKED ☠');}});

/* ===================== FLESH-OUT FEATURES ===================== */
/* TOASTS */
function toast(msg,type){const wrap=document.getElementById('toasts');const el=document.createElement('div');el.className='toast'+(type?' '+type:'');el.textContent=msg;wrap.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),350);},2600);}

/* MODAL */
const modal=document.getElementById('modal'),modalContent=document.getElementById('modalContent');
function openModal(html){modalContent.innerHTML=html;modal.classList.add('open');modal.setAttribute('aria-hidden','false');}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
document.getElementById('modalX').onclick=closeModal;
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeModal();});

/* MUSIC FILTER */
document.querySelectorAll('#mfilter button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#mfilter button').forEach(x=>x.classList.remove('on'));b.classList.add('on');const f=b.dataset.f;document.querySelectorAll('#mgrid .rel').forEach(c=>c.classList.toggle('hide',f!=='all'&&c.dataset.type!==f));});

/* MERCH — coming soon, route to the slime list */
const merchAlertBtn=document.getElementById('merchAlertBtn');
if(merchAlertBtn)merchAlertBtn.onclick=()=>{burst(innerWidth/2,innerHeight*.6,16,'#8dff2b');gotoConnectJoin('☠ drop your email — first access to the slime shop');};

/* VAULT — lightbox */
document.querySelectorAll('#vault .vcard').forEach(card=>card.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();const img=card.querySelector('img').src,title=card.querySelector('.vt').textContent,sub=card.querySelector('.vs').textContent,href=card.getAttribute('href');openModal(`<div class="mhead wide" style="background-image:url('${img}')"></div><div class="mbody"><span class="kicker">${sub}</span><h3>${title}</h3><p>The full visual lives in the SB vault on YouTube. Tap in for the complete drop.</p><div class="mcta"><a class="bigbtn bSlime" href="${href}" target="_blank" rel="noopener noreferrer">▶ watch on youtube</a></div></div>`);}));

/* SHOWS — content-driven (edit in the admin page) */
function renderShows(SHOWS){SHOWS=SHOWS||[];const list=document.getElementById('showlist'),empty=document.getElementById('showsEmpty');if(!list||!empty)return;if(!SHOWS.length){list.style.display='none';empty.style.display='';return;}empty.style.display='none';list.style.display='';list.innerHTML=SHOWS.map(s=>`<div class="showrow"><div class="date">${esc(s.date)}</div><div class="venue"><div class="v1">${esc(s.venue)}</div><div class="v2">${esc(s.city)}</div></div>${s.url?`<a class="tix" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">tickets</a>`:'<span class="tix" style="opacity:.5">soon</span>'}</div>`).join('');}
const _tourBtn=document.getElementById('tourAlertBtn');if(_tourBtn)_tourBtn.onclick=()=>gotoConnectJoin('drop your email below for tour alerts ☠');

/* SHORTCUTS HELP */
const SHORTCUTS=[['Space','play / pause'],['Esc','close popups'],['slime','secret burst'],['?','this menu']];
function openHelp(){openModal(`<div class="mbody" style="padding-top:26px"><span class="kicker">controls</span><h3>shortcuts</h3><p>the whole site plays. tap the mark for a slime splash, follow the snake.</p><div class="klist">${SHORTCUTS.map(s=>`<div class="krow"><kbd>${s[0]}</kbd><span>${s[1]}</span></div>`).join('')}</div></div>`);}
document.getElementById('helpbtn').onclick=openHelp;
addEventListener('keydown',e=>{if(e.key==='?'&&!isTyping()&&!modal.classList.contains('open'))openHelp();});

/* SHARE */
const _shareBtn=document.getElementById('shareBtn');if(_shareBtn)_shareBtn.onclick=async()=>{const data={title:'SLIME BY — official',text:'Delaware rap — green pressure, venom, motion.',url:location.href};try{if(navigator.share){await navigator.share(data);}else{await navigator.clipboard.writeText(location.href);toast('link copied to clipboard ☑');}}catch(_){}};

/* ===================== FEATURED DROP ===================== */
function previewFeatured(){startAudio();toast('▶ now spinning — Man Of My Word');}
function notifyDrop(){gotoConnectJoin('☠ drop your email — first to know');}
/* drop date is set from CMS content (drop.dropDate); counts down, then reads OUT NOW. */
let dropDate=new Date('2026-07-04T00:00:00');
function tickCountdown(){const el=document.getElementById('cd');if(!el)return;const d=dropDate-Date.now();if(isNaN(d)||d<=0){el.innerHTML='<span class="cdlive">OUT NOW ☠</span>';return;}const u=(n,l)=>`<div class="cdu"><b>${String(n).padStart(2,'0')}</b><span>${l}</span></div>`;el.innerHTML=u(Math.floor(d/864e5),'days')+u(Math.floor(d/36e5)%24,'hrs')+u(Math.floor(d/6e4)%60,'min')+u(Math.floor(d/1e3)%60,'sec');}
tickCountdown();setInterval(tickCountdown,1000);

/* ===================== VIDEOS (content-driven) ===================== */
let VIDEOS=[];
function renderVideos(list){VIDEOS=list||[];const g=document.getElementById('vidgrid');if(!g)return;
  g.innerHTML=VIDEOS.map((v,i)=>`<div class="vid reveal${i%3?' d'+(i%3):''}" data-i="${i}"><img loading="lazy" decoding="async" src="${esc(v.img)}" alt="${esc(v.t)}"><div class="pp">▶</div><div class="vmeta"><div class="vmt">${esc(v.t)}</div><div class="vms">${esc(v.s)}</div></div></div>`).join('');
  g.querySelectorAll('.vid').forEach(c=>{io.observe(c);c.onclick=()=>{const v=VIDEOS[+c.dataset.i];burst(innerWidth/2,innerHeight*.5,10,'#8dff2b');
    if(v.id){openModal(`<div class="mbody"><span class="kicker">${esc(v.s)}</span><h3>${esc(v.t)}</h3><div class="vembed"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(v.id)}?autoplay=1&rel=0" title="${esc(v.t)}" allow="autoplay;encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe></div></div>`);}
    else{openModal(`<div class="mbody"><span class="kicker">${esc(v.s)}</span><h3>${esc(v.t)}</h3><p>Add this clip's YouTube video ID in the admin page to play it right here. For now, catch the full vault on YouTube.</p><div class="mcta"><a class="bigbtn bSlime" href="${esc((window.SB&&SB.vault&&SB.vault.youtube)||'https://youtube.com/@slimeby_')}" target="_blank" rel="noopener noreferrer">▶ watch on youtube</a></div></div>`);}};});
}

/* ===================== THE LAB — slowed + reverb studio (drives the site track) ===================== */
const srSpeed=document.getElementById('srSpeed'),srSpeedV=document.getElementById('srSpeedV'),
      srReverb=document.getElementById('srReverb'),srReverbV=document.getElementById('srReverbV'),
      srRoom=document.getElementById('srRoom'),srRoomV=document.getElementById('srRoomV'),
      srPlayBtn=document.getElementById('srPlay'),srProgEl=document.getElementById('srProg'),
      srModeEl=document.getElementById('srMode');
function roomLabel(p){return p<0.34?'small room':p<0.7?'medium hall':'cavern';}
function srModeText(){if(rageOn)return'rage';const slow=userRate<0.97,fast=userRate>1.03,rev=revAmt>0.05;
  if(fast)return rev?'nightcore + reverb':'nightcore';
  if(slow&&rev)return'slowed + reverb';if(slow)return'slowed';if(rev)return'reverb';return'original';}
function srSync(){if(srModeEl)srModeEl.textContent=srModeText();}
function setSpeed(v){userRate=Math.max(.5,Math.min(1.25,v/100));if(srSpeedV)srSpeedV.textContent=userRate.toFixed(2)+'×';if(!rageOn)audio.playbackRate=userRate;srSync();}
function setReverb(v){revAmt=Math.max(0,Math.min(1,v/100));if(srReverbV)srReverbV.textContent=Math.round(revAmt*100)+'%';applyAudioFx();srSync();}
function setRoom(v){roomP=Math.max(0,Math.min(1,v/100));if(srRoomV)srRoomV.textContent=roomLabel(roomP);}
const SR_PRESETS={slowrev:[80,30,55],deep:[70,58,80],night:[118,8,26],clean:[100,0,40]};
function markPreset(name){document.querySelectorAll('.srpresets button').forEach(b=>b.classList.toggle('on',!!name&&b.dataset.preset===name));}
function applyPreset(name){const p=SR_PRESETS[name];if(!p)return;if(srSpeed)srSpeed.value=p[0];if(srReverb)srReverb.value=p[1];if(srRoom)srRoom.value=p[2];setSpeed(p[0]);setReverb(p[1]);setRoom(p[2]);rebuildImpulse();markPreset(name);}
if(srSpeed)srSpeed.oninput=()=>{setSpeed(+srSpeed.value);markPreset(null);};
if(srReverb)srReverb.oninput=()=>{setReverb(+srReverb.value);markPreset(null);};
if(srRoom){srRoom.oninput=()=>{setRoom(+srRoom.value);markPreset(null);};srRoom.onchange=()=>rebuildImpulse();}
document.querySelectorAll('.srpresets button').forEach(b=>b.onclick=()=>{ensureCtx();applyPreset(b.dataset.preset);if(audio.paused)startAudio();});
if(srPlayBtn)srPlayBtn.onclick=toggle;
if(srProgEl)srProgEl.onclick=e=>{if(!isFinite(audio.duration))return;const r=srProgEl.getBoundingClientRect();audio.currentTime=(e.clientX-r.left)/r.width*audio.duration;};
/* which preset (if any) matches the current speed/reverb/room state */
function matchPreset(){const cur=[Math.round(userRate*100),Math.round(revAmt*100),Math.round(roomP*100)];for(const k in SR_PRESETS){const p=SR_PRESETS[k];if(p[0]===cur[0]&&p[1]===cur[1]&&p[2]===cur[2])return k;}return null;}
/* push the live state onto the lab sliders + labels (used when resuming across pages) */
function syncLab(){setSpeed(Math.round(userRate*100));setReverb(Math.round(revAmt*100));setRoom(Math.round(roomP*100));if(srSpeed)srSpeed.value=Math.round(userRate*100);if(srReverb)srReverb.value=Math.round(revAmt*100);if(srRoom)srRoom.value=Math.round(roomP*100);rebuildImpulse();markPreset(matchPreset());}
/* boot the vibe: resume the carried-over fx if we have them, else open slowed + reverb */
if(_hadAudioState)syncLab();else applyPreset('slowrev');

/* ===================== SB UNIVERSE — five powers map (content-driven) ===================== */
let POWERS=[];
function openPower(i){const p=POWERS[i];if(!p)return;
  const meters=(p.stats||[]).map(s=>`<div class="pmeter"><span class="pml">${esc(s[0])}</span><div class="pbar"><i data-w="${esc(s[1])}"></i></div><span class="pmv">${esc(s[1])}</span></div>`).join('');
  openModal(`<div class="mbody pcard" style="--c:${esc(p.c)}"><div class="ptag">force ${esc(p.id)} · ${esc(p.tag)}</div><h3>${esc(p.n)}</h3><p>${esc(p.lore)}</p><div class="pmeters">${meters}</div></div>`);
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll('#modal .pbar i').forEach(b=>b.style.width=b.dataset.w+'%')));
  burst(innerWidth/2,innerHeight*.5,12,p.c);snakeLunge();
}
function renderPowers(list){POWERS=list||[];const wrap=document.querySelector('#universe .upanels');if(!wrap)return;
  wrap.innerHTML=POWERS.map((p,i)=>`<div class="upanel reveal${i?' d'+Math.min(i,4):''}" data-p="${i}" role="button" tabindex="0"><div class="orb" style="background:radial-gradient(circle,${esc(p.c)},transparent 70%)"></div><div class="idx">${esc(p.id)}</div><div class="ut">${esc(p.n)}</div><div class="ud">${esc(p.short||'')}</div><div class="uenter">enter ↦</div></div>`).join('');
  wrap.querySelectorAll('.upanel').forEach(el=>{io.observe(el);const i=+el.dataset.p;
    el.addEventListener('click',()=>openPower(i));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();openPower(i);}});});
}

/* ===================== RELEASES (content-driven) ===================== */
function renderReleases(list){const g=document.getElementById('mgrid');if(!g)return;
  g.innerHTML=(list||[]).map((r,i)=>`<a class="rel reveal d${(i%3)+1}" data-type="${esc(r.type||'single')}" target="_blank" rel="noopener noreferrer" href="${esc(r.url)}"><div class="art"><img loading="lazy" decoding="async" src="${esc(r.img)}" alt="${esc(r.title)}"><div class="play"><i>▶</i></div></div><div class="meta"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.sub)}</div></div></a>`).join('');
  g.querySelectorAll('.rel').forEach(el=>io.observe(el));
  const onf=document.querySelector('#mfilter button.on');const f=onf?onf.dataset.f:'all';
  g.querySelectorAll('.rel').forEach(c=>c.classList.toggle('hide',f!=='all'&&c.dataset.type!==f));
}

/* ===================== APPLY CONTENT — maps the CMS model onto the page ===================== */
function applyContent(c){
  if(!c)return;window.SB=c;
  const q=s=>document.querySelector(s);
  const txt=(s,v)=>{const e=q(s);if(e&&v!=null)e.textContent=v;};
  const setHtml=(s,v)=>{const e=q(s);if(e&&v!=null)e.innerHTML=v;};
  const href=(s,v)=>{const e=q(s);if(e&&v!=null)e.setAttribute('href',v);};
  const src=(s,v)=>{const e=q(s);if(e&&v!=null)e.setAttribute('src',v);};
  const bg=(s,v)=>{const e=q(s);if(e&&v)e.style.backgroundImage=`url('${v}')`;};

  if(c.hero){const h1=q('.hero h1.glitch');if(h1&&c.hero.title){h1.textContent=c.hero.title;h1.setAttribute('data-t',c.hero.title);}setHtml('.hero .sub',c.hero.sub);bg('.herobg',c.hero.bg);}

  renderMarquee(c.marquee);

  if(c.drop){txt('#drop .kicker',c.drop.kicker);setHtml('#drop .shead h2',c.drop.heading);
    bg('#drop .dropfeat .cover',c.drop.cover);txt('#drop .dropfeat h3',c.drop.featuredTitle);txt('#drop .dropfeat .dsub',c.drop.featuredSub);
    const dl=document.querySelectorAll('#drop .dropfeat .smartlinks a');[c.drop.spotify,c.drop.apple,c.drop.youtube].forEach((u,i)=>{if(dl[i]&&u)dl[i].href=u;});
    href('#presaveBtn',c.drop.presaveUrl);
    if(c.drop.dropDate){const d=new Date(c.drop.dropDate);if(!isNaN(d.getTime()))dropDate=d;tickCountdown();}}

  if(c.music){bg('#music .pwart',c.music.playerCover);txt('#music .pwtitle',c.music.playerTitle);
    const emb=q('#music .embedwrap iframe');if(emb&&c.music.spotifyArtistId)emb.src=`https://open.spotify.com/embed/artist/${c.music.spotifyArtistId}?utm_source=generator&theme=0`;
    renderReleases(c.music.releases);}

  if(c.about){setHtml('#about .lead',c.about.lead);txt('#about .about p',c.about.text);src('#about .pic img',c.about.portrait);txt('#about .badge',c.about.badge);
    const sw=q('#about .stats');if(sw&&c.about.stats)sw.innerHTML=c.about.stats.map(s=>`<div class="stat"><div class="n">${esc(s.n)}</div><div class="l">${esc(s.l)}</div></div>`).join('');}

  if(c.universe){txt('#universe .uhint',c.universe.hint);renderPowers(c.universe.powers);}

  if(c.vault){href('#vault .shead .link',c.vault.youtube);const vg=q('#vault .vgrid');
    if(vg){vg.innerHTML=(c.vault.items||[]).map((v,i)=>`<a class="vcard reveal${i?' d'+Math.min(i,3):''}" href="${esc(v.href)}" target="_blank" rel="noopener noreferrer"><img loading="lazy" decoding="async" src="${esc(v.img)}" alt=""><div class="pico">▶</div><div class="vinfo"><div class="vt">${esc(v.title)}</div><div class="vs">${esc(v.sub)}</div></div></a>`).join('');
      vg.querySelectorAll('.vcard').forEach(card=>{io.observe(card);card.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();const img=card.querySelector('img').src,title=card.querySelector('.vt').textContent,sub=card.querySelector('.vs').textContent,h=card.getAttribute('href');openModal(`<div class="mhead wide" style="background-image:url('${img}')"></div><div class="mbody"><span class="kicker">${sub}</span><h3>${title}</h3><p>The full visual lives in the SB vault on YouTube. Tap in for the complete drop.</p><div class="mcta"><a class="bigbtn bSlime" href="${h}" target="_blank" rel="noopener noreferrer">▶ watch on youtube</a></div></div>`);});});}}

  renderVideos(c.videos);

  if(c.merch){txt('#merch .kicker',c.merch.kicker);setHtml('#merch .shead h2',c.merch.heading);txt('#merch .comingsoon p',c.merch.text);txt('#merchAlertBtn',c.merch.button);}

  renderShows(c.shows);

  if(c.contact){txt('#connect h2',c.contact.heading);
    const cl=document.querySelectorAll('#connect .clinks a');[c.contact.spotify,c.contact.apple,c.contact.youtube,c.contact.instagram,c.contact.tiktok].forEach((u,i)=>{if(cl[i]&&u)cl[i].href=u;});
    const bk=q('#connect .booking a');if(bk&&c.contact.bookingEmail){bk.href='mailto:'+c.contact.bookingEmail;bk.textContent=c.contact.bookingEmail;}
    const jt=q('.jointitle');if(jt)jt.innerHTML=`${esc(c.contact.joinTitle||'')}<span>${esc(c.contact.joinSub||'')}</span>`;}

  if(c.footer){const fb=q('.fbadges');if(fb&&c.footer.badges)fb.innerHTML=c.footer.badges.map(b=>`<span class="fbadge">${esc(b)}</span>`).join('');txt('.fcopy',c.footer.copy);}
}

/* boot: render defaults instantly, then overlay whatever's published in Supabase.
   Guarded so a missing/failed cms.js can never break the rest of the page. */
var SB_PREVIEW=/[?&]preview\b/.test(location.search);
try{ if(typeof SB_DEFAULTS!=='undefined') applyContent(SB_DEFAULTS); }catch(e){}
/* In preview the admin drives the content via postMessage, so skip the remote
   fetch — otherwise it could resolve late and clobber the live edits. */
if(!SB_PREVIEW){ try{ if(typeof sbGetContent==='function') sbGetContent().then(applyContent).catch(()=>{}); }catch(e){} }

/* ===================== LIVE PREVIEW CHANNEL =====================
   When this page is embedded in the admin's preview pane it renders edits in
   real time: the admin posts the working content, we apply it. Guarded so it
   has zero effect during normal browsing. */
addEventListener('message',function(e){const d=e.data;if(!d||d.__sb!=='preview'||!d.content)return;try{applyContent(d.content);}catch(_){}});
if(SB_PREVIEW){
  document.body.classList.add('sb-preview');
  var _l=document.getElementById('loader');if(_l)_l.classList.add('gone');
  try{ if(parent&&parent!==window) parent.postMessage({__sb:'ready'},'*'); }catch(_){}
}

/* deep-link: arriving at connect.html#join lands the visitor on the email field */
if(/join/.test(location.hash)){const g=document.getElementById('gemail');if(g)setTimeout(()=>{const c=document.getElementById('connect');if(c)c.scrollIntoView({behavior:'smooth'});g.focus();},350);}
