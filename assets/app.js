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
  { href: 'quest.html', label: 'the game' },
  { href: 'vault.html', label: 'vault' }, { href: 'shows.html', label: 'shows' },
  { href: 'connect.html', label: 'tap in' }, { href: 'links.html', label: 'links' },
];
function currentPage(){ const p=(location.pathname.split('/').pop()||'').toLowerCase(); return p===''?'index.html':p; }
function buildChrome(){
  if(document.getElementById('nav')) return;            // double-run / already-present guard
  const NAV=(window.SB_NAV&&window.SB_NAV.length)?window.SB_NAV:SB_NAV_FALLBACK;
  const here=currentPage();
  const links=NAV.map(n=>`<a href="${n.href}"${n.href.toLowerCase()===here?' class="active"':''}>${n.label}</a>`).join('');
  const top=`
<a class="skip" href="#main">skip to content</a>
<div id="progress" aria-hidden="true"></div>
<div class="bgwrap"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>
<canvas id="snake"></canvas>
<div class="grain"></div><div class="scan"></div><div class="vig"></div>
<div id="rageOverlay"></div><div id="flash"></div>
<div id="rfx" aria-hidden="true"><div class="fx-heart"></div><div class="fx-fire"></div><div class="fx-static"></div><div class="fx-drip"></div></div>
<div class="cursor" id="cursor"></div>
<canvas id="trail"></canvas>
<div class="rmtag">☠ RAGE MODE ☠ click again to exit</div>
<nav id="nav">
  <a class="logo" href="index.html" aria-label="Slime By — home">
    <svg class="mk" viewBox="0 0 100 100"><path d="${SNAKE_PATH}"/></svg>
    <div class="wm">SLIME BY</div>
  </a>
  <div class="navmenu" id="navmenu">
    <div class="navlinks">${links}</div>
    <button class="btnX" type="button" id="rageBtn">☠ rage mode</button>
  </div>
  <button class="burger" id="burger" aria-label="menu" aria-expanded="false" aria-controls="navmenu"><span></span><span></span><span></span></button>
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
  <button class="mbtn" id="prevbtn" type="button" aria-label="previous track" title="previous">⏮</button>
  <button class="pbtn" id="pbtn" aria-label="play / pause">▶</button>
  <button class="mbtn" id="nextbtn" type="button" aria-label="next track" title="next">⏭</button>
</div>
<button class="totop" id="totop" aria-label="back to top">↑</button>
<button class="helpbtn" id="helpbtn" aria-label="keyboard shortcuts" title="keyboard shortcuts">?</button>
<audio id="audio" preload="auto" crossorigin="anonymous"></audio>
<div id="ytbg" aria-hidden="true"></div>
<div id="toasts" aria-live="polite"></div>
<div class="modal" id="modal" role="dialog" aria-modal="true" aria-hidden="true">
  <div class="box" id="modalBox"><button class="x" id="modalX" aria-label="close">✕</button><div id="modalContent"></div></div>
</div>
<div class="wipe" id="wipe" aria-hidden="true"><svg class="wmk" viewBox="0 0 100 100"><path d="${SNAKE_PATH}"/></svg></div>`;
  document.body.classList.add('page-'+here.replace(/\.html$/,''));
  const frag=html=>{const t=document.createElement('template');t.innerHTML=html;return t.content;};
  const main=document.querySelector('main');
  /* a host for CMS-driven content blocks (page add-ons + custom pages).
     Lives at the end of <main> so add-ons append below the built-in content. */
  if(main&&!document.getElementById('sbBlocks')){const bc=document.createElement('div');bc.id='sbBlocks';main.appendChild(bc);}
  document.body.insertBefore(frag(top),document.body.firstChild);
  if(main&&main.parentNode===document.body) main.after(frag(bottom));
  else document.body.appendChild(frag(bottom));
}
buildChrome();

/* ANALYTICS — load the first-party tracker once per page (skips the editor preview;
   the admin page never loads app.js so it's never tracked). Kept in its own file so it
   caches across pages and is easy to audit. */
(function(){ if(/[?&]preview\b/.test(location.search))return; if(document.getElementById('sb-analytics'))return;
  var s=document.createElement('script'); s.id='sb-analytics'; s.src='assets/analytics.js'; s.defer=true;
  (document.head||document.documentElement).appendChild(s); })();

/* cross-page: route visitors to the join-the-list form (connect page) */
function gotoConnectJoin(msg){
  const g=document.getElementById('gemail');
  if(g){const c=document.getElementById('connect');if(c)c.scrollIntoView({behavior:'smooth'});setTimeout(()=>g.focus(),500);if(msg)toast(msg);}
  else if(typeof sbNavigate==='function'){ sbNavigate('connect.html#join',true); if(msg)setTimeout(()=>toast(msg),700); }
  else location.href='connect.html#join';
}

/* LOADER + AUTOPLAY ON LOAD */
function hideLoader(){const l=document.getElementById('loader');if(l)l.classList.add('gone');}
/* We do NOT fire audio.play() here. Browsers block play() without a user gesture and keep the
   promise PENDING — it then resolves on the first gesture and starts the track a beat after the
   visitor's own click on the play button, which the button reads as "already playing" and pauses
   (the "won't play on first click" bug). Instead: ready the audio graph now, and let the first
   interaction start the music — armKick() does it for a tap anywhere, while a click straight on a
   transport control is handled by that control. If the visitor explicitly paused on a previous
   page (saved state, not a resume), stay paused until they ask for it. */
window.addEventListener('load',()=>{setTimeout(hideLoader,400); if(!/[?&]preview\b/.test(location.search)){ try{ensureCtx();}catch(_){} if(!_hadAudioState||_resumeWanted){try{armKick();}catch(_){}} }});
setTimeout(hideLoader,2600); /* safety: never let the loader trap the page */
(()=>{const el=document.getElementById('vcount');let n=parseInt(localStorage.getItem('sb_visits')||'0',10);if(!n||isNaN(n))n=690+Math.floor(Math.random()*9000);if(!sessionStorage.getItem('sb_counted')){n++;try{localStorage.setItem('sb_visits',n);sessionStorage.setItem('sb_counted','1');}catch(_){}}if(el)el.textContent=String(n).padStart(6,'0');})();

/* NAV */
const nav=document.getElementById('nav');
addEventListener('scroll',()=>nav.classList.toggle('scrolled',scrollY>40),{passive:true});
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
function observeReveals(){document.querySelectorAll('.reveal').forEach(el=>io.observe(el));}

/* CURSOR + EMBERS */
const cursor=document.getElementById('cursor');
let mx=innerWidth/2,my=innerHeight/2;
const hoverEls='a,button,.rel,.vcard,.upanel,.prod,.disc,.pwplay,.sbmono';
/* The native cursor is hidden (body{cursor:none}), so this ring IS the pointer.
   It used to be eased toward the mouse on its own rAF loop — but when the render
   loop got busy that rAF starved and the ring crawled (the "slow cursor"). Position
   it straight from the pointer event with a GPU transform so it tracks 1:1 and never
   depends on frame budget. */
function placeCursor(x,y){ if(cursor) cursor.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%)'; }
placeCursor(mx,my);
/* Keep this handler featherweight: update the shared pointer + place the ring (a GPU
   transform) synchronously so the cursor tracks the mouse 1:1, but defer the heavier work
   — ember spawn + hero parallax style writes — to the capped render loop. Doing all of it
   on every raw mousemove flooded the main thread on high-rate mice/monitors and was a big
   part of the "sluggish cursor" on desktop. */
let _mouseMoved=false,heroInnerEl=null;
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;placeCursor(mx,my);_mouseMoved=true;},{passive:true});
document.addEventListener('mouseover',e=>{if(e.target.closest(hoverEls))cursor.classList.add('big')});
document.addEventListener('mouseout',e=>{if(e.target.closest(hoverEls))cursor.classList.remove('big')});
const tcv=document.getElementById('trail'),tctx=tcv.getContext('2d');
let embers=[];const emberC=['#ff1f2e','#8dff2b','#9b3cff','#b6ff5a'];
/* honor the OS "reduce motion" setting: no passive cursor-trail embers, calmer loops */
const sbReduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* coarse-pointer / small-screen = phone or tablet. Used to trim the heaviest audio + render
   work (e.g. the lab reverb impulse) so the lab and visualizers stay smooth on mobile. */
const sbIsMobile=matchMedia('(pointer:coarse)').matches||innerWidth<700;
function emit(x,y,n){if(sbReduceMotion)return;for(let i=0;i<n;i++){if(Math.random()<.5)embers.push({x,y,vx:(Math.random()-.5)*.6,vy:-Math.random()*1.2-.3,life:1,c:emberC[Math.floor(Math.random()*emberC.length)],s:Math.random()*2.4+.8})}if(embers.length>180)embers.splice(0,embers.length-180);}
function burst(x,y,n,c){for(let i=0;i<n;i++){const a=Math.random()*7,sp=Math.random()*4+1;embers.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,life:1,c:c||emberC[Math.floor(Math.random()*emberC.length)],s:Math.random()*3+1})}}
function sizeTrail(){tcv.width=innerWidth;tcv.height=innerHeight;}sizeTrail();

/* AUDIO GRAPH */
const audio=document.getElementById('audio');audio.volume=.55;
/* ── LOCAL PLAYLIST ──
   The player spins Slime By's own catalog: the "My Time" tracks in order, then the signature
   "Man Of My Word", then it loops. Prev/next cycle these; a track that fails to load (e.g. a
   bad upload) is skipped so it never stalls the queue. Titles come from the filenames so the
   bar shows the real song name. Reverb / the lab / the visualizer all run off this one
   <audio> element, so they keep working on whatever is playing. */
/* Each track carries its own streaming links so the tracklist can offer "open in Spotify /
   Apple Music" per song. The "My Time" cuts all live on the My Time album (a couple are also
   their own singles); Apple Music only exposes an artist page, so that's the best deep link we
   have there — swap in exact track URLs whenever they exist. "Man Of My Word" is a PREVIEW of
   the next album: it plays here but isn't released anywhere yet, so it carries no store links
   and is flagged so the UI can badge it. */
const MYTIME_SPOTIFY='https://open.spotify.com/album/5RickWrPNRszADHSzJJYUc';
const SB_APPLE='https://music.apple.com/us/artist/slime-by/1542729349';
const LOCAL_TRACKS=[
  {src:'assets/mp3 my time/1) My Time.mp3',                  title:'My Time',                    spotify:MYTIME_SPOTIFY, apple:SB_APPLE},
  {src:'assets/mp3 my time/2) Turn This Up.mp3',             title:'Turn This Up',               spotify:'https://open.spotify.com/album/2yiGZO9RmY8ql8h1OtManp', apple:SB_APPLE},
  {src:'assets/mp3 my time/3) Blowing Up ft SmokesAlot.mp3', title:'Blowing Up (ft. SmokesAlot)',spotify:MYTIME_SPOTIFY, apple:SB_APPLE},
  {src:'assets/mp3 my time/5) Money like this .mp3',         title:'Money Like This',            spotify:MYTIME_SPOTIFY, apple:SB_APPLE},
  {src:'assets/mp3 my time/5)Flip .mp3',                     title:'Flip',                       spotify:'https://open.spotify.com/album/5zZBRNMJqFr6hBpB6cjfyI', apple:SB_APPLE},
  {src:'assets/mp3 my time/7) High As It Gets .mp3',         title:'High As It Gets',            spotify:MYTIME_SPOTIFY, apple:SB_APPLE},
  {src:'assets/mp3 my time/8)Blitz FT junad.mp3',            title:'Blitz (ft. Junad)',          spotify:MYTIME_SPOTIFY, apple:SB_APPLE},
  {src:'assets/mp3 my time/9) BlackOut .mp3',                title:'BlackOut',                   spotify:MYTIME_SPOTIFY, apple:SB_APPLE},
  {src:'assets/mp3 my time/10) Loosing Me .mp3',             title:'Loosing Me',                 spotify:MYTIME_SPOTIFY, apple:SB_APPLE},
  {src:'assets/man-of-my-word.mp3',                          title:'Man Of My Word',             preview:true},
];
let trackIdx=0;
function curTrack(){return LOCAL_TRACKS[trackIdx]||LOCAL_TRACKS[0];}
function trackUrl(t){return encodeURI(t.src);}   // paths contain spaces → encode for the <audio src>
const pbtn=document.getElementById('pbtn'),disc=document.getElementById('disc'),musicbar=document.getElementById('musicbar');
let pwplay=null;   // music.html transport button — re-queried on every (client-side) page change
let actx,analyser,srcNode,mix,shaper,dry,conv,wet,freq,graphReady=false,playing=false,noiseBuf;
/* The always-on site player runs the track NORMALLY (full speed, no reverb). */
let userRate=1.0,revAmt=0,roomP=0.40;
/* The Lab is a SEPARATE slowed + reverb sandbox. It keeps its own bend for the
   session so it can be re-applied on the lab page, but it never becomes the site
   default — every other page plays the song normally. */
let labRate=0.80,labRev=0.30,labRoom=0.55;
/* ── audio continuity ──
   Page-to-page moves are client-side (no reload), so the <audio> element is never
   destroyed and playback simply continues across pages. We still persist transport
   (position / volume / play state) so a hard reload picks up where it left off. */
const SB_AUDIO_KEY='sb_audio',SB_LAB_KEY='sb_lab';let _seekTo=null,_resumeWanted=false,_hadAudioState=false;
try{const s=JSON.parse(sessionStorage.getItem(SB_AUDIO_KEY)||'null');if(s){_hadAudioState=true;if(typeof s.vol==='number')audio.volume=s.vol;if(typeof s.t==='number'&&isFinite(s.t))_seekTo=s.t;_resumeWanted=!!s.playing;if(typeof s.idx==='number')trackIdx=s.idx;}}catch(_){}
trackIdx=Math.max(0,Math.min(trackIdx|0,LOCAL_TRACKS.length-1));   // keep a restored index in range
try{audio.src=trackUrl(curTrack());}catch(_){}                      // engage the current track (markup has no src now)
try{const l=JSON.parse(sessionStorage.getItem(SB_LAB_KEY)||'null');if(l){if(typeof l.rate==='number')labRate=l.rate;if(typeof l.rev==='number')labRev=l.rev;if(typeof l.room==='number')labRoom=l.room;}}catch(_){}
function saveAudioState(){try{sessionStorage.setItem(SB_AUDIO_KEY,JSON.stringify({t:audio.currentTime||0,vol:audio.volume,playing:!audio.paused,idx:trackIdx}));}catch(_){}}
function saveLabState(){try{sessionStorage.setItem(SB_LAB_KEY,JSON.stringify({rate:labRate,rev:labRev,room:labRoom}));}catch(_){}}
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
/* Reverb tail. The convolution runs in real time, so a long stereo impulse is costly on
   phones — cap it on mobile (still a full, roomy tail) so the lab reverb doesn't stutter. */
function rebuildImpulse(){if(!actx||!conv)return;const sec=Math.min(sbIsMobile?2.0:4.0,0.4+roomP*3.6),rate=actx.sampleRate,len=Math.max(1,Math.floor(sec*rate));const buf=actx.createBuffer(2,len,rate);for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.5);}conv.buffer=buf;}
/* Rage mode distorts + drives the track but no longer changes its SPEED — the playback
   rate always follows userRate (1.0 everywhere, the lab's slow on lab.html). */
function applyAudioFx(){if(!actx)return;const t=actx.currentTime;
  if(dry)dry.gain.setTargetAtTime((rageOn?0.72:1)*(1-revAmt*0.35),t,0.03);
  if(wet)wet.gain.setTargetAtTime(revAmt*0.9,t,0.03);
  if(shaper)shaper.curve=(rageOn&&rageFlags().distortAudio)?distc(7):null;
  try{audio.preservesPitch=false;audio.mozPreservesPitch=false;audio.webkitPreservesPitch=false;}catch(_){}
  audio.playbackRate=userRate;}
/* Switch the live track between the two players. The site plays normal everywhere;
   only the lab page swaps in its slowed + reverb bend. */
function applyNormalFx(){userRate=1.0;revAmt=0;try{audio.playbackRate=1.0;}catch(_){}applyAudioFx();}
function applyLabFx(){userRate=labRate;revAmt=labRev;roomP=labRoom;try{audio.playbackRate=userRate;}catch(_){}if(actx)rebuildImpulse();applyAudioFx();}
function connectMedia(){if(graphReady)return;ensureCtx();try{srcNode=actx.createMediaElementSource(audio);srcNode.connect(mix);graphReady=true;}catch(e){}}
function startAudio(){if(bgMode==='yt'&&ytPlayer&&ytReady){try{ytPlayer.pauseVideo();}catch(_){}}bgMode='local';connectMedia();ensureCtx();applyAudioFx();armKick();audio.play().then(()=>setUI(true)).catch(()=>{});updateBgTitle();}
function setUI(on){playing=on;const ic=on?'❚❚':'▶';if(pbtn)pbtn.textContent=ic;if(pwplay)pwplay.textContent=ic;if(disc)disc.classList.toggle('spin',on);if(musicbar)musicbar.classList.toggle('open',on);const sp=document.getElementById('srPlay');if(sp)sp.textContent=on?'❚❚ pause':'▶ play';const sa=document.getElementById('srArt');if(sa)sa.classList.toggle('spin',on);const pw=document.querySelector('.playerwin');if(pw)pw.classList.toggle('live',on);updateNowPlaying();}
function toggle(){if(bgMode==='yt'){if(ytIsPlaying())ytPause();else ytPlay();return;}if(audio.paused)startAudio();else{audio.pause();setUI(false);}}
if(pbtn)pbtn.onclick=toggle;if(disc)disc.onclick=toggle;
audio.addEventListener('play',()=>{if(bgMode==='local')setUI(true);});audio.addEventListener('pause',()=>{if(bgMode==='local')setUI(false);});
/* the <audio> is no longer loop-attributed: advance the playlist when a track finishes. */
audio.addEventListener('ended',()=>{if(bgMode==='local')bgNext();});
/* a track that won't load (e.g. a corrupt/empty upload) is skipped so it never stalls the
   queue — guarded so an all-bad list can't spin forever; the guard resets on a good load. */
let _skipGuard=0;
audio.addEventListener('error',()=>{if(bgMode!=='local')return;if(_skipGuard++>=LOCAL_TRACKS.length)return;loadTrack(trackIdx+1,playing||_resumeWanted);});
audio.addEventListener('canplay',()=>{_skipGuard=0;});

/* ===================== CONTENT PROTECTION =====================
   The catalog streams from the site but shouldn't be casually downloadable. There's no
   visible <audio controls> (so no native "save audio" item already), and on top of that we
   block the right-click "Save…" menu and drag-to-save on the player + artwork, strip any
   download intent, and refuse Ctrl/Cmd+S. The MP3 is also served Content-Disposition: inline
   + X-Robots-Tag: noindex (see _headers / vercel.json) so hosts that honor it don't offer it
   as a download or index it. NOTE: anything that plays in a browser is, by nature, reachable
   to a determined user via devtools/network — this raises the bar against casual saving, it
   is not DRM. */
const PROTECT_SEL='img,audio,video,canvas,picture,.cover,.art,.pwart,.srart,.disc,.playerwin,.srwrap,.musicbar,.mhead,.dropfeat .cover';
addEventListener('contextmenu',e=>{if(e.target.closest(PROTECT_SEL)){e.preventDefault();toast('☠ downloads are disabled');}});
addEventListener('dragstart',e=>{if(e.target.closest(PROTECT_SEL))e.preventDefault();});
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==='s'||e.key==='S')){e.preventDefault();toast('☠ downloads are disabled');}},{capture:true});
try{audio.removeAttribute('controls');audio.setAttribute('controlsList','nodownload noplaybackrate noremoteplayback');audio.disableRemotePlayback=true;}catch(_){}

/* ── BACKGROUND RADIO (local track + YouTube playlist) ──
   The signature MP3 is track #1 and powers all the Web Audio fx (visualizer, lab,
   rage). Past it the visitor skips (⏭) into a YouTube playlist played through a
   hidden IFrame player. Only one source is ever audible at a time; the YouTube API
   is loaded lazily on the first skip so it never slows the initial page. */
let bgMode='local',ytPlayer=null,ytReady=false,ytWantPlay=false,_ytApiLoading=false;
const BG_PLAYLIST=(()=>{try{return(window.SB_DEFAULTS&&SB_DEFAULTS.music&&SB_DEFAULTS.music.bgPlaylist)||'';}catch(_){return'';}})();
/* The player is a live tracklist now, so the now-playing label ALWAYS reflects the track that's
   actually loaded — no fixed CMS override (that legacy "playerTitle" forced every page to read
   "Man Of My Word" regardless of what was spinning). */
function localTitle(){try{return curTrack().title;}catch(_){return'';}}
function ytIsPlaying(){try{return!!(ytPlayer&&ytReady&&ytPlayer.getPlayerState&&ytPlayer.getPlayerState()===1);}catch(_){return false;}}
function bgIsPlaying(){return bgMode==='yt'?ytIsPlaying():!audio.paused;}
function updateBgTitle(){const title=localTitle();document.querySelectorAll('#musicbar .stitle').forEach(el=>el.textContent=title);const pwt=document.querySelector('#music .pwtitle');if(pwt)pwt.textContent=title;const sr=document.getElementById('srTitle');if(sr)sr.textContent=title;/* the lab's "now bending" title */updateNowPlaying();}
/* Sync the music-page player chrome to the live track: preview badge, the per-song Spotify /
   Apple buttons, and which tracklist row is lit. No-ops on pages without the player. */
function updateNowPlaying(){
  const t=curTrack();
  const badge=document.getElementById('pwbadge');if(badge)badge.hidden=!t.preview;
  const links=document.getElementById('pwlinks'),sp=document.getElementById('pwSpotify'),ap=document.getElementById('pwApple');
  if(links){
    if(t.preview){links.hidden=true;}
    else{let any=false;
      if(sp){if(t.spotify){sp.href=t.spotify;sp.hidden=false;any=true;}else sp.hidden=true;}
      if(ap){if(t.apple){ap.href=t.apple;ap.hidden=false;any=true;}else ap.hidden=true;}
      links.hidden=!any;
    }
  }
  /* light the active row in every track list on the page (music tracklist + the lab picker) */
  document.querySelectorAll('.trk[data-i]').forEach(r=>{const on=(+r.dataset.i===trackIdx);r.classList.toggle('active',on);r.classList.toggle('playing',on&&playing);});
  const pw=document.querySelector('.playerwin');if(pw)pw.classList.toggle('is-preview',!!t.preview);
  const srw=document.querySelector('.srwrap');if(srw)srw.classList.toggle('is-preview',!!t.preview);
}
function loadYTApi(){if(window.YT&&window.YT.Player){initYT();return;}if(_ytApiLoading)return;_ytApiLoading=true;const prev=window.onYouTubeIframeAPIReady;window.onYouTubeIframeAPIReady=function(){try{if(prev)prev();}catch(_){}initYT();};const s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);}
function initYT(){if(ytPlayer||!BG_PLAYLIST||!document.getElementById('ytbg'))return;try{ytPlayer=new YT.Player('ytbg',{width:'200',height:'120',host:'https://www.youtube-nocookie.com',playerVars:{listType:'playlist',list:BG_PLAYLIST,autoplay:0,controls:0,disablekb:1,fs:0,modestbranding:1,playsinline:1,rel:0,loop:1},events:{onReady:()=>{ytReady=true;try{ytPlayer.setVolume(Math.round(audio.volume*100));}catch(_){}if(ytWantPlay){ytWantPlay=false;ytPlay();}},onStateChange:onYTState}});}catch(_){}}
function onYTState(e){const Y=window.YT&&YT.PlayerState;if(!Y)return;if(e.data===Y.PLAYING){if(bgMode!=='yt'){bgMode='yt';try{audio.pause();}catch(_){}}setUI(true);updateBgTitle();}else if(e.data===Y.PAUSED){if(bgMode==='yt')setUI(false);}}
function ytPlay(){if(!BG_PLAYLIST)return;if(!ytPlayer){ytWantPlay=true;loadYTApi();return;}if(!ytReady){ytWantPlay=true;return;}try{audio.pause();}catch(_){}bgMode='yt';try{ytPlayer.setVolume(Math.round(audio.volume*100));ytPlayer.playVideo();}catch(_){}setUI(true);updateBgTitle();}
function ytPause(){if(ytPlayer&&ytReady){try{ytPlayer.pauseVideo();}catch(_){}}setUI(false);}
/* Move through the LOCAL playlist (wraps both ends). The signature track + the "My Time"
   catalog ARE the radio now — the prev/next buttons cycle the songs the artist uploaded. */
function loadTrack(i,autoplay){
  const n=LOCAL_TRACKS.length;trackIdx=((i%n)+n)%n;
  const wantPlay=(autoplay==null)?(playing||!audio.paused):autoplay;
  try{audio.src=trackUrl(curTrack());audio.load();}catch(_){}
  updateBgTitle();saveAudioState();
  if(wantPlay)startAudio();else setUI(false);
}
function bgNext(){loadTrack(trackIdx+1,true);}
/* prev restarts the current song if you're more than 3s in (the usual transport feel),
   otherwise it steps back a track. */
function bgPrev(){if(audio.currentTime>3){try{audio.currentTime=0;}catch(_){}return;}loadTrack(trackIdx-1,true);}
{const pv=document.getElementById('prevbtn'),nx=document.getElementById('nextbtn');if(pv)pv.onclick=bgPrev;if(nx)nx.onclick=bgNext;}
/* ── TRACK LISTS ──
   The live playlist renders as a selectable list (music.html tracklist + the lab's "load a
   track" picker). Selecting a row loads + plays that song — keeping the page's audio character
   (normal on the music page, slowed + reverb in the lab) — and surfaces its store links via
   updateNowPlaying(). The preview cut is flagged so it reads as the next-album teaser. */
function trackRowHTML(t,i){return `<li class="trk${t.preview?' preview':''}" data-i="${i}" role="button" tabindex="0" aria-label="play ${esc(t.title)}">`+
    `<span class="tnum">${String(i+1).padStart(2,'0')}</span>`+
    `<span class="teq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`+
    `<span class="tname">${esc(t.title)}</span>`+
    (t.preview?'<span class="tbadge">✦ preview</span>':'')+
    `<span class="tdur">${esc(t.dur||'')}</span>`+
    `<span class="tgo" aria-hidden="true">▶</span>`+
  `</li>`;}
function pickTrack(r){if(!r)return;const i=+r.dataset.i;
  if(i===trackIdx&&bgMode==='local'){if(audio.paused)startAudio();else{audio.pause();setUI(false);}}   // current row → resume / pause
  else loadTrack(i,true);}                                                                            // any other row → load + play
function wireTrackList(list){
  if(!list)return;
  list.innerHTML=LOCAL_TRACKS.map(trackRowHTML).join('');
  list.onclick=e=>pickTrack(e.target.closest('.trk'));
  list.onkeydown=e=>{if(e.key==='Enter'||e.code==='Space'){const r=e.target.closest('.trk');if(r){e.preventDefault();pickTrack(r);}}};
  loadTrackDurations();updateNowPlaying();
}
function wireTracklist(){wireTrackList(document.getElementById('tracklist'));}   // music.html
function wireLabTracks(){wireTrackList(document.getElementById('srTracks'));}     // lab.html — load a track to bend
/* Fill in each track's runtime lazily + once. A single muted probe element walks the list one
   file at a time (metadata only) so we never fire a dozen parallel requests; results cache on
   the track so re-renders (client-side nav, or the lab + music lists) are instant. Updates every
   list on the page (music tracklist and the lab picker can both be showing the same songs). */
let _durBusy=false;
function loadTrackDurations(){
  if(!document.querySelector('.trk[data-i]'))return;   // no track list on this page
  const fill=(i,v)=>document.querySelectorAll('.trk[data-i="'+i+'"] .tdur').forEach(c=>{c.textContent=v;});
  LOCAL_TRACKS.forEach((t,i)=>{if(t.dur)fill(i,t.dur);});
  if(_durBusy||LOCAL_TRACKS.every(t=>t.dur))return;
  _durBusy=true;const probe=new Audio();probe.preload='metadata';probe.muted=true;let i=0;
  (function step(){
    while(i<LOCAL_TRACKS.length&&LOCAL_TRACKS[i].dur)i++;
    if(i>=LOCAL_TRACKS.length){_durBusy=false;return;}
    const idx=i;
    probe.onloadedmetadata=()=>{if(isFinite(probe.duration)&&probe.duration>0){LOCAL_TRACKS[idx].dur=fmt(probe.duration);fill(idx,LOCAL_TRACKS[idx].dur);}i++;step();};
    probe.onerror=()=>{i++;step();};
    try{probe.src=trackUrl(LOCAL_TRACKS[idx]);}catch(_){i++;step();}
  })();
}
function listenNow(){startAudio();const v=document.getElementById('visualizer');if(v)v.scrollIntoView({behavior:'smooth'});}
/* Always arm a first-interaction fallback: the very first tap / key starts the track (browsers
   block autoplay-with-sound until a real gesture) and resumes the audio context. */
let kicked=false,armed=false;
/* The explicit play / pause / transport controls. If the FIRST interaction lands on one of
   these, its own click handler is about to run and decide play vs pause — so the kick must NOT
   also start playback, or the two cancel out: kick starts it, then the control's click sees
   "already playing" and pauses it, and the music never starts. (This was the "player won't play
   on the first click" bug.) The kick still readies the audio context. */
const SB_TRANSPORT_SEL='.pwplay,.pwnav,.pbtn,.mbtn,.disc,.srplay,.trk';
/* Only DISCRETE gestures (tap / key) arm the ambient start: scroll + wheel don't grant audio
   user-activation in browsers (so their play() just gets blocked), and worse, a scroll fired as
   the page settles — or as a transport click scrolls the button into view — would start the
   track a beat before the click, which the click then reads as "playing" and pauses. */
function armKick(){if(kicked||armed)return;armed=true;const evs=['pointerdown','touchstart','keydown'];function kick(e){if(kicked)return;kicked=true;evs.forEach(ev=>removeEventListener(ev,kick));ensureCtx();const tgt=e&&e.target;if(tgt&&tgt.closest&&tgt.closest(SB_TRANSPORT_SEL))return;/* a transport control's own click is about to fire — let it start playback so the two don't cancel out */if(audio.paused)startAudio();else setUI(true);}evs.forEach(e=>addEventListener(e,kick,{once:true,passive:true}));}
function fmt(s){if(!isFinite(s))return'0:00';const m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+String(x).padStart(2,'0');}
/* progress / time labels are looked up by id each tick so they always target the
   current page's player (the player UI lives inside <main>, which is swapped on nav). */
audio.addEventListener('loadedmetadata',()=>{const d=fmt(audio.duration);const pwdur=document.getElementById('pwdur');if(pwdur)pwdur.textContent=d;const sd=document.getElementById('srDur');if(sd)sd.textContent=d;if(_seekTo!=null&&isFinite(audio.duration)){try{audio.currentTime=Math.max(0,Math.min(_seekTo,audio.duration-0.25));}catch(_){}_seekTo=null;}});
audio.addEventListener('timeupdate',()=>{const c=fmt(audio.currentTime),pct=(audio.currentTime/audio.duration*100||0)+'%';const pwcur=document.getElementById('pwcur'),pwfill=document.getElementById('pwprogfill');if(pwcur)pwcur.textContent=c;if(pwfill)pwfill.style.width=pct;const sc=document.getElementById('srCur'),sf=document.getElementById('srProgFill');if(sc)sc.textContent=c;if(sf)sf.style.width=pct;});
/* BACK TO TOP */
const totop=document.getElementById('totop');totop.onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>totop.classList.toggle('show',scrollY>600),{passive:true});
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
/* the hero / contact splash marks live inside <main> → wired in sbInitPage() */

/* scroll progress (used by the snake pit + the top progress bar) */
function scrollProg(){const m=document.documentElement.scrollHeight-innerHeight;return m>0?Math.min(1,Math.max(0,scrollY/m)):0;}

/* =====================================================================
   INTERACTIVE BACKGROUND SNAKES — photoreal procedural WebGL pit.
   Renders into the full-page #snake canvas. Exposes the same hooks the
   rest of the site already calls (sizeSnake / buildSnakes / drawSnakes /
   snakeLunge) so it's a drop-in for the old 2D pit. It reacts to the
   shared cursor (mx,my), RAGE MODE (rageOn) and audio energy. Falls back
   to a soft 2D render where WebGL is unavailable.
   ===================================================================== */
let sizeSnake,buildSnakes,drawSnakes,snakeLunge;
(function(){
"use strict";
const canvas=document.getElementById('snake');
const glOpts={antialias:true,premultipliedAlpha:false,alpha:true};
let gl=canvas.getContext('webgl',glOpts)||canvas.getContext('experimental-webgl',glOpts);

const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile=matchMedia('(pointer:coarse)').matches||innerWidth<700;
const lowPower=reduceMotion;

let W=0,H=0,DPR=1;
const SEG=isMobile?40:64;
const startT=performance.now();
let lastT=performance.now();
let gEnergy=0,rageMix=0;
function snoise(x){return Math.sin(x)*0.5+Math.sin(x*2.13+1.7)*0.25+Math.sin(x*4.31+0.3)*0.15+Math.sin(x*0.51+2.9)*0.10;}

/* ----------------------- Snake factory ----------------------- */
function makeSnake(o){
  const s={
    spine:[],head:{x:0,y:0,a:0,speed:0},
    tN:Math.random()*1000,slowPhase:Math.random()*10,
    tongueT:0,flickTimer:Math.random()*2000,nextFlick:1800+Math.random()*2200,
    slime:[],mInf:0,lastSlimeX:0,lastSlimeY:0,
    sizeMul:o.sizeMul,speedMul:o.speedMul,mouseAmt:o.mouseAmt,
    dim:o.dim,hueShift:o.hueShift||0,seed:Math.random()*100,
    mesh:new Float32Array((SEG-1)*6*6)
  };
  for(let i=0;i<SEG;i++)s.spine.push({x:0,y:0});
  return s;
}
let snakes=[];
function spawn(){
  snakes=[
    makeSnake({sizeMul:0.55,speedMul:1.35,mouseAmt:0.0,dim:0.55,hueShift:0.15}),
    makeSnake({sizeMul:0.78,speedMul:1.05,mouseAmt:0.25,dim:0.78,hueShift:0.0}),
    makeSnake({sizeMul:1.15,speedMul:0.82,mouseAmt:0.6,dim:1.0,hueShift:-0.05}),
  ];
  for(const s of snakes){
    const sx=W*(0.25+Math.random()*0.5),sy=H*(0.25+Math.random()*0.5);
    for(let i=0;i<SEG;i++){s.spine[i].x=sx;s.spine[i].y=sy;}
    s.head.x=sx;s.head.y=sy;s.head.a=Math.random()*6.28;
    s.lastSlimeX=sx;s.lastSlimeY=sy;
  }
  lastT=performance.now();
}
/* rescale all positions to a new viewport (smooth, no jump) */
function repositionSnakes(rx,ry){
  for(const s of snakes){
    for(let i=0;i<SEG;i++){s.spine[i].x*=rx;s.spine[i].y*=ry;}
    s.head.x*=rx;s.head.y*=ry;s.lastSlimeX*=rx;s.lastSlimeY*=ry;
    for(const sl of s.slime){sl.x*=rx;sl.y*=ry;}
  }
}

const mouse={x:0,y:0,active:false};
function segLen(s){return Math.max(8,Math.min(W,H)*0.018*s.sizeMul);}
function radiusAt(s,i){
  const t=i/(SEG-1),base=Math.min(W,H)*s.sizeMul;
  const maxR=base*0.030,headR=base*0.034;
  if(t<0.06)return headR;
  const b=(t-0.06)/0.94;
  const swell=Math.sin(Math.min(b*1.15,1)*Math.PI*0.5);
  const taper=Math.pow(1-b,0.85);
  return maxR*(0.55+0.45*swell)*(0.22+0.78*taper);
}
function pad(){return Math.min(W,H)*0.10;}
function steer(p,tx,ty){let d=Math.atan2(ty-p.y,tx-p.x)-p.a;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;return d*0.35;}

function updateHead(s,dt){
  const h=s.head;
  const boost=(1+gEnergy*0.6)*(1+rageMix*0.7);   // audio + RAGE drive speed
  s.tN+=dt*0.00045*s.speedMul*boost;
  const wander=snoise(s.tN+s.seed)*1.4+snoise(s.tN*0.37+10+s.seed)*0.9;
  s.slowPhase+=dt*0.0007;
  const slow=(Math.sin(s.slowPhase)+Math.sin(s.slowPhase*0.6+2))*0.5;
  const coil=Math.max(0,slow);
  const targetSpeed=(0.92-coil*0.62)*Math.min(W,H)*0.0016*s.speedMul*boost;
  let turn=wander*0.9+coil*Math.sin(s.tN*3.0)*1.6;
  if(s.mouseAmt>0){
    s.mInf+=((mouse.active?1:0)-s.mInf)*0.02;
    if(s.mInf>0.001){
      let d=Math.atan2(mouse.y-h.y,mouse.x-h.x)-h.a;
      while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;
      turn+=Math.max(-1,Math.min(1,d))*s.mInf*s.mouseAmt*0.7;
    }
  }
  const m=pad();
  if(h.x<m)   turn+=steer(h,m,h.y);
  if(h.x>W-m) turn+=steer(h,W-m,h.y);
  if(h.y<m)   turn+=steer(h,h.x,m);
  if(h.y>H-m) turn+=steer(h,h.x,H-m);
  h.a+=turn*dt*0.0016;
  h.speed+=(targetSpeed-h.speed)*0.04;
  h.x+=Math.cos(h.a)*h.speed*dt;
  h.y+=Math.sin(h.a)*h.speed*dt;
  h.x=Math.max(m*0.5,Math.min(W-m*0.5,h.x));
  h.y=Math.max(m*0.5,Math.min(H-m*0.5,h.y));
  s.spine[0].x=h.x;s.spine[0].y=h.y;
}
function updateBody(s){
  const len=segLen(s);
  for(let i=1;i<SEG;i++){const p=s.spine[i],l=s.spine[i-1];
    let dx=l.x-p.x,dy=l.y-p.y;const d=Math.hypot(dx,dy)||1e-4;
    const k=(d-len)/d;p.x+=dx*k;p.y+=dy*k;}
}
/* throttle slime by tail travel distance, not per-frame */
function pushSlime(s){
  const t=s.spine[SEG-1];
  const dx=t.x-s.lastSlimeX,dy=t.y-s.lastSlimeY;
  if(dx*dx+dy*dy<100)return;             // ~10px threshold
  s.lastSlimeX=t.x;s.lastSlimeY=t.y;
  s.slime.push({x:t.x,y:t.y,r:radiusAt(s,SEG-1)*2.4,life:1});
  if(s.slime.length>60)s.slime.shift();
}
function tickTongue(s,dt){
  s.flickTimer+=dt;
  if(s.tongueT>0){s.tongueT-=dt*0.0016;if(s.tongueT<0)s.tongueT=0;}
  else if(s.flickTimer>s.nextFlick*(1-Math.min(0.6,gEnergy))){s.tongueT=1;s.flickTimer=0;s.nextFlick=1800+Math.random()*2600;}
}

/* ----------------------------- WEBGL ----------------------------- */
let prog,fogProg,buf,fogBuf,fogArr;
let aPos,aUV,aRad,aSeg,uRes,uLight,uTime,uScale,uDim,uHue,uRage;
let fAPos,fAUV,fAA,fAHue,fURes,fURage;

function compile(src,type){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){console.error(gl.getShaderInfoLog(sh),src);return null;}return sh;}
function glink(vs,fs){const p=gl.createProgram();const a=compile(vs,gl.VERTEX_SHADER),b=compile(fs,gl.FRAGMENT_SHADER);
  if(!a||!b)return null;gl.attachShader(p,a);gl.attachShader(p,b);gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(p));return null;}return p;}

const VS=`precision highp float;
attribute vec2 aPos; attribute vec2 aUV; attribute float aRad; attribute float aSeg;
uniform vec2 uRes; varying vec2 vUV; varying float vRad; varying float vSeg;
void main(){ vUV=aUV; vRad=aRad; vSeg=aSeg;
  vec2 c=(aPos/uRes)*2.0-1.0; c.y=-c.y; gl_Position=vec4(c,0.0,1.0); }`;

const FS=`precision highp float;
varying vec2 vUV; varying float vRad; varying float vSeg;
uniform vec3 uLight; uniform float uTime; uniform float uScale; uniform float uDim; uniform float uHue; uniform float uRage;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){
  float across=clamp(vUV.x,-1.0,1.0);
  float nz=sqrt(max(0.0,1.0-across*across));
  vec3 N=normalize(vec3(across,0.0,nz));
  float along=vUV.y;
  float rows=42.0*uScale;
  float cols=7.0*uScale;
  float row=along*rows;
  float stagger=mod(floor(row),2.0)*0.5;
  vec2 cell=vec2((across*0.5+0.5)*cols+stagger,row);
  vec2 g=fract(cell)-0.5;
  float d=length(g*vec2(1.0,0.78));
  float bump=smoothstep(0.5,0.12,d);
  vec2 grad=g/(d+1e-3)*bump;
  vec3 sN=normalize(vec3(grad*0.9,1.0));
  float breathe=0.85+0.15*sin(uTime*6.0+along*8.0);
  float scaleMask=smoothstep(0.0,0.06,vSeg)*(1.0-smoothstep(0.85,1.0,vSeg))*(1.0-smoothstep(0.7,1.0,abs(across)));
  N=normalize(mix(N,normalize(N+vec3(sN.xy,0.0)*1.3*breathe),scaleMask*0.85));
  N.xy+=(vnoise(vUV*vec2(120.0,420.0))-0.5)*0.06; N=normalize(N);
  vec3 V=vec3(0.0,0.0,1.0); vec3 L=normalize(uLight);
  float diff=max(dot(N,L),0.0);
  vec3 Hh=normalize(L+V);
  float spec=pow(max(dot(N,Hh),0.0),60.0);
  float coat=pow(max(dot(N,Hh),0.0),220.0);
  float fres=pow(1.0-max(dot(N,V),0.0),3.0);
  float bellyGreen=smoothstep(0.55,0.0,abs(across));
  float lengthGreen=smoothstep(0.05,0.25,vSeg)*(1.0-smoothstep(0.7,0.95,vSeg));
  vec3 black=vec3(0.012,0.02,0.016);
  vec3 green=vec3(0.02,0.22,0.13)+vec3(uHue,-uHue*0.3,uHue*0.5);
  vec3 albedo=mix(black,green,bellyGreen*lengthGreen*0.9);
  float groove=smoothstep(0.5,0.46,d);
  albedo*=mix(1.0,0.45,groove*scaleMask);
  float ao=mix(0.35,1.0,nz);
  float tailDark=mix(1.0,0.5,smoothstep(0.6,1.0,vSeg));
  vec3 col=vec3(0.0);
  col+=albedo*(0.18+0.82*diff)*ao*tailDark;
  col+=vec3(0.10,0.45,0.30)*spec*1.4*scaleMask;
  col+=vec3(0.8,1.0,0.92)*coat*1.2;
  col+=vec3(0.0,0.96,0.62)*fres*0.5*tailDark;
  col*=uDim;
  float edge=smoothstep(1.0,0.92,abs(across));
  col=col/(col+0.6); col=pow(col,vec3(0.85));
  vec3 rageC=vec3(max(max(col.r,col.g),col.b)*1.55+0.16, col.g*0.16+0.015, col.b*0.10);
  col=mix(col,rageC,uRage);   // RAGE MODE bleeds the venom red
  gl_FragColor=vec4(col,edge);
}`;

const FOG_VS=`precision highp float; attribute vec2 aPos; attribute vec2 aUV; attribute float aA; attribute float aHue;
uniform vec2 uRes; varying vec2 vUV; varying float vA; varying float vHue;
void main(){ vUV=aUV; vA=aA; vHue=aHue; vec2 c=(aPos/uRes)*2.0-1.0; c.y=-c.y; gl_Position=vec4(c,0.0,1.0);}`;
const FOG_FS=`precision highp float; varying vec2 vUV; varying float vA; varying float vHue; uniform float uRage;
void main(){ float d=length(vUV-0.5)*2.0; float f=smoothstep(1.0,0.0,d);
  vec3 g=mix(vec3(0.0,0.96,0.63),vec3(0.0,0.85,0.96),vHue);
  g=mix(g,vec3(1.0,0.14,0.10),uRage);
  gl_FragColor=vec4(g*f*vA, 1.0); }`;

const puffs=[];
function initPuffs(){ puffs.length=0;
  for(let i=0;i<(isMobile?10:16);i++) puffs.push({x:Math.random()*W,y:Math.random()*H,r:140+Math.random()*300,
    dx:(Math.random()-0.5)*0.05,dy:(Math.random()-0.5)*0.035,a:0.05+Math.random()*0.07,hue:Math.random()<0.5?0:1});
  fogArr=new Float32Array(puffs.length*6*6);
}

function setupGL(){
  prog=glink(VS,FS); if(!prog) return false;
  aPos=gl.getAttribLocation(prog,'aPos'); aUV=gl.getAttribLocation(prog,'aUV');
  aRad=gl.getAttribLocation(prog,'aRad'); aSeg=gl.getAttribLocation(prog,'aSeg');
  uRes=gl.getUniformLocation(prog,'uRes'); uLight=gl.getUniformLocation(prog,'uLight'); uTime=gl.getUniformLocation(prog,'uTime');
  uScale=gl.getUniformLocation(prog,'uScale'); uDim=gl.getUniformLocation(prog,'uDim'); uHue=gl.getUniformLocation(prog,'uHue');
  uRage=gl.getUniformLocation(prog,'uRage');
  buf=gl.createBuffer();
  fogProg=glink(FOG_VS,FOG_FS); if(!fogProg) return false;
  fAPos=gl.getAttribLocation(fogProg,'aPos'); fAUV=gl.getAttribLocation(fogProg,'aUV');
  fAA=gl.getAttribLocation(fogProg,'aA'); fAHue=gl.getAttribLocation(fogProg,'aHue');
  fURes=gl.getUniformLocation(fogProg,'uRes'); fURage=gl.getUniformLocation(fogProg,'uRage'); fogBuf=gl.createBuffer();
  gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
  return true;
}
const stride=6;
function buildMesh(s){
  const out=s.mesh; let o=0;
  const lx=new Float64Array(SEG),ly=new Float64Array(SEG),rx=new Float64Array(SEG),ry=new Float64Array(SEG),sg=new Float64Array(SEG);
  for(let i=0;i<SEG;i++){ const p=s.spine[i]; let tx,ty;
    if(i<SEG-1){tx=s.spine[i+1].x-p.x;ty=s.spine[i+1].y-p.y;} else {tx=p.x-s.spine[i-1].x;ty=p.y-s.spine[i-1].y;}
    const tl=Math.hypot(tx,ty)||1e-4;tx/=tl;ty/=tl; const nx=-ty,ny=tx,r=radiusAt(s,i);
    lx[i]=p.x+nx*r; ly[i]=p.y+ny*r; rx[i]=p.x-nx*r; ry[i]=p.y-ny*r; sg[i]=i/(SEG-1);
  }
  for(let i=0;i<SEG-1;i++){
    o=put(out,o,lx[i],ly[i],1,sg[i]); o=put(out,o,rx[i],ry[i],-1,sg[i]); o=put(out,o,lx[i+1],ly[i+1],1,sg[i+1]);
    o=put(out,o,rx[i],ry[i],-1,sg[i]); o=put(out,o,rx[i+1],ry[i+1],-1,sg[i+1]); o=put(out,o,lx[i+1],ly[i+1],1,sg[i+1]);
  }
  return o/stride;
}
function put(a,o,x,y,u,v){ a[o]=x;a[o+1]=y;a[o+2]=u;a[o+3]=v;a[o+4]=0;a[o+5]=v; return o+6; }

function buildFog(){
  const a=fogArr; let o=0;
  for(const p of puffs){ p.x+=p.dx*16; p.y+=p.dy*16;
    if(p.x<-p.r)p.x=W+p.r; if(p.x>W+p.r)p.x=-p.r; if(p.y<-p.r)p.y=H+p.r; if(p.y>H+p.r)p.y=-p.r;
    const x0=p.x-p.r,x1=p.x+p.r,y0=p.y-p.r,y1=p.y+p.r;
    o=putF(a,o,x0,y0,0,0,p.a,p.hue); o=putF(a,o,x1,y0,1,0,p.a,p.hue); o=putF(a,o,x1,y1,1,1,p.a,p.hue);
    o=putF(a,o,x0,y0,0,0,p.a,p.hue); o=putF(a,o,x1,y1,1,1,p.a,p.hue); o=putF(a,o,x0,y1,0,1,p.a,p.hue);
  }
  return o/6;
}
function putF(a,o,x,y,u,v,al,hue){ a[o]=x;a[o+1]=y;a[o+2]=u;a[o+3]=v;a[o+4]=al;a[o+5]=hue; return o+6; }

function bindSnakeAttribs(){ const s=stride*4;
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,s,0);
  gl.enableVertexAttribArray(aUV);  gl.vertexAttribPointer(aUV,2,gl.FLOAT,false,s,8);
  gl.enableVertexAttribArray(aRad); gl.vertexAttribPointer(aRad,1,gl.FLOAT,false,s,16);
  gl.enableVertexAttribArray(aSeg); gl.vertexAttribPointer(aSeg,1,gl.FLOAT,false,s,20);
}
function renderGL(){
  gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
  // fog (additive)
  gl.useProgram(fogProg); gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
  const fcount=buildFog(); gl.bindBuffer(gl.ARRAY_BUFFER,fogBuf);
  gl.bufferData(gl.ARRAY_BUFFER,fogArr,gl.DYNAMIC_DRAW);
  const fs=6*4;
  gl.enableVertexAttribArray(fAPos); gl.vertexAttribPointer(fAPos,2,gl.FLOAT,false,fs,0);
  gl.enableVertexAttribArray(fAUV);  gl.vertexAttribPointer(fAUV,2,gl.FLOAT,false,fs,8);
  gl.enableVertexAttribArray(fAA);   gl.vertexAttribPointer(fAA,1,gl.FLOAT,false,fs,16);
  gl.enableVertexAttribArray(fAHue); gl.vertexAttribPointer(fAHue,1,gl.FLOAT,false,fs,20);
  gl.uniform2f(fURes,W,H); gl.uniform1f(fURage,rageMix);
  gl.drawArrays(gl.TRIANGLES,0,fcount);
  // snakes back->front
  gl.useProgram(prog); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform2f(uRes,W,H);
  const tt=lowPower?0.0:(performance.now()-startT)*0.0004;
  gl.uniform3f(uLight,Math.cos(tt)*0.5,0.45+Math.sin(tt*0.7)*0.2,0.75);
  gl.uniform1f(uTime,tt); gl.uniform1f(uRage,rageMix);
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  for(const s of snakes){
    const vc=buildMesh(s);
    gl.bufferData(gl.ARRAY_BUFFER,s.mesh,gl.DYNAMIC_DRAW);
    bindSnakeAttribs();
    gl.uniform1f(uScale,s.sizeMul); gl.uniform1f(uDim,s.dim*(1+gEnergy*0.5)); gl.uniform1f(uHue,s.hueShift);
    gl.drawArrays(gl.TRIANGLES,0,vc);
  }
  drawOverlay();
}

/* eyes / tongue / slime overlay (its own full-page 2D canvas) */
const ov=document.createElement('canvas');
ov.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none';
ov.setAttribute('aria-hidden','true');
let octx;
function setupOverlay(){ document.body.appendChild(ov); octx=ov.getContext('2d'); }
function sizeOverlay(){ ov.width=W*DPR; ov.height=H*DPR; ov.style.width=W+'px'; ov.style.height=H+'px'; octx.setTransform(DPR,0,0,DPR,0,0); }
function drawSnakeDetails(s){
  octx.save(); octx.globalCompositeOperation='lighter';
  for(const sl of s.slime){ if(!lowPower) sl.life-=0.012; if(sl.life<=0)continue;
    const g=octx.createRadialGradient(sl.x,sl.y,0,sl.x,sl.y,sl.r);
    g.addColorStop(0,`rgba(0,245,160,${0.08*sl.life*s.dim})`); g.addColorStop(0.5,`rgba(0,120,90,${0.035*sl.life*s.dim})`); g.addColorStop(1,'rgba(0,0,0,0)');
    octx.fillStyle=g; octx.beginPath(); octx.arc(sl.x,sl.y,sl.r,0,6.283); octx.fill(); }
  while(s.slime.length&&s.slime[0].life<=0) s.slime.shift();
  octx.restore();
  const h=s.spine[0],n=s.spine[1];
  let tx=h.x-n.x,ty=h.y-n.y; const tl=Math.hypot(tx,ty)||1; tx/=tl; ty/=tl;
  const nx=-ty,ny=tx,r=radiusAt(s,0),a=Math.atan2(ty,tx);
  const ex=h.x-tx*r*0.1, ey=h.y-ty*r*0.1;
  octx.globalAlpha=s.dim;
  for(const side of [1,-1]){
    const px=ex+nx*r*0.6*side, py=ey+ny*r*0.6*side;
    octx.fillStyle='rgba(0,0,0,0.85)'; octx.beginPath(); octx.arc(px,py,r*0.33,0,6.283); octx.fill();
    const eg=octx.createRadialGradient(px,py,0.5,px,py,r*0.29);
    eg.addColorStop(0,'rgba(190,255,150,0.97)'); eg.addColorStop(0.4,'rgba(50,200,120,0.92)'); eg.addColorStop(1,'rgba(5,28,18,1)');
    octx.fillStyle=eg; octx.beginPath(); octx.arc(px,py,r*0.25,0,6.283); octx.fill();
    octx.save(); octx.translate(px,py); octx.rotate(a);
    octx.fillStyle='rgba(0,0,0,0.96)'; octx.beginPath(); octx.ellipse(0,0,r*0.05,r*0.19,0,0,6.283); octx.fill(); octx.restore();
    octx.fillStyle='rgba(255,255,255,0.9)'; octx.beginPath();
    octx.arc(px-nx*r*0.08*side-tx*r*0.05,py-ny*r*0.08*side-ty*r*0.05,r*0.055,0,6.283); octx.fill();
  }
  if(s.tongueT>0){
    const reach=Math.sin(s.tongueT*Math.PI)*r*2.4;
    const bx=h.x+tx*r*1.0, by=h.y+ty*r*1.0, fx=bx+tx*reach, fy=by+ty*reach;
    octx.strokeStyle='rgba(255,40,80,0.92)'; octx.lineWidth=Math.max(1.2,r*0.07); octx.lineCap='round';
    octx.beginPath(); octx.moveTo(bx,by); octx.lineTo(fx,fy); octx.stroke();
    const fk=r*0.5, wob=Math.sin(s.tongueT*20)*r*0.15;
    octx.beginPath();
    octx.moveTo(fx,fy); octx.lineTo(fx+tx*fk+nx*(fk*0.5+wob),fy+ty*fk+ny*(fk*0.5+wob));
    octx.moveTo(fx,fy); octx.lineTo(fx+tx*fk-nx*(fk*0.5-wob),fy+ty*fk-ny*(fk*0.5-wob));
    octx.stroke();
  }
  octx.globalAlpha=1;
}
function drawOverlay(){ octx.clearRect(0,0,W,H); for(const s of snakes) drawSnakeDetails(s); }

/* ----------------------------- 2D FALLBACK ----------------------------- */
let useFallback=false,f2d,fcv;
function setupFallback(){ useFallback=true;
  fcv=document.createElement('canvas');
  fcv.style.cssText='position:fixed;inset:0;z-index:-1;pointer-events:none';
  fcv.setAttribute('aria-hidden','true');
  document.body.appendChild(fcv); f2d=fcv.getContext('2d'); }
function sizeFallbackCanvas(){ fcv.width=W*DPR; fcv.height=H*DPR; fcv.style.width=W+'px'; fcv.style.height=H+'px'; f2d.setTransform(DPR,0,0,DPR,0,0); }
function outline(s){ const L=[],R=[];
  for(let i=0;i<SEG;i++){ const p=s.spine[i]; let tx,ty;
    if(i<SEG-1){tx=s.spine[i+1].x-p.x;ty=s.spine[i+1].y-p.y;} else {tx=p.x-s.spine[i-1].x;ty=p.y-s.spine[i-1].y;}
    const tl=Math.hypot(tx,ty)||1;tx/=tl;ty/=tl; const nx=-ty,ny=tx,r=radiusAt(s,i);
    L.push({x:p.x+nx*r,y:p.y+ny*r}); R.push({x:p.x-nx*r,y:p.y-ny*r}); } return {L,R}; }
function bpath(c,L,R){ c.beginPath(); c.moveTo(L[0].x,L[0].y); for(let i=1;i<L.length;i++)c.lineTo(L[i].x,L[i].y);
  for(let i=R.length-1;i>=0;i--)c.lineTo(R[i].x,R[i].y); c.closePath(); }
function renderFallback(){
  f2d.clearRect(0,0,W,H);
  for(const s of snakes){
    f2d.globalAlpha=s.dim; const {L,R}=outline(s);
    f2d.save(); f2d.translate(0,Math.min(W,H)*0.02); f2d.filter='blur(8px)'; bpath(f2d,L,R); f2d.fillStyle='rgba(0,0,0,0.55)'; f2d.fill(); f2d.restore();
    const mid=s.spine[Math.floor(SEG*0.35)]; const nxt=s.spine[Math.floor(SEG*0.35)+1];
    let tx=nxt.x-mid.x,ty=nxt.y-mid.y; const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l; const nx=-ty,ny=tx,rr=radiusAt(s,Math.floor(SEG*0.35));
    const g=f2d.createLinearGradient(mid.x+nx*rr,mid.y+ny*rr,mid.x-nx*rr,mid.y-ny*rr);
    if(rageMix>0.5){ g.addColorStop(0,'#2a0606');g.addColorStop(.5,'#7a0a0a');g.addColorStop(1,'#150000'); }
    else { g.addColorStop(0,'#0c1410');g.addColorStop(.32,'#04130d');g.addColorStop(.5,'#0a3322');g.addColorStop(.62,'#021109');g.addColorStop(1,'#000402'); }
    bpath(f2d,L,R); f2d.fillStyle=g; f2d.fill();
    bpath(f2d,L,R); f2d.lineWidth=1.4; f2d.strokeStyle=rageMix>0.5?'rgba(255,60,60,0.22)':'rgba(0,245,160,0.22)'; f2d.stroke();
    f2d.globalAlpha=1;
    const real=octx; octx=f2d; drawSnakeDetails(s); octx=real;
  }
}

/* ----------------------------- SIZE / BOOT ----------------------------- */
function doSize(){
  const ow=W||innerWidth, oh=H||innerHeight;
  W=innerWidth; H=innerHeight;
  // The snake pit is a soft, blurred full-page background — rendering it at the
  // display's full DPR (2 on most laptops/desktops) just burns GPU for no visible
  // gain. Cap it, and taper harder on big monitors, so a full-screen shader stops
  // saturating the compositor (which showed up as desktop lag + a sluggish cursor).
  const cap=(W*H>2200*1300)?1.25:1.5;
  DPR=Math.max(1,Math.min(window.devicePixelRatio||1,cap));
  canvas.width=Math.floor(W*DPR); canvas.height=Math.floor(H*DPR);
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  if(gl) gl.viewport(0,0,canvas.width,canvas.height);
  const rx=ow?W/ow:1, ry=oh?H/oh:1;
  if(snakes.length&&(Math.abs(rx-1)>1e-4||Math.abs(ry-1)>1e-4)) repositionSnakes(rx,ry);
  if(octx) sizeOverlay();
  if(useFallback&&f2d) sizeFallbackCanvas();
  if(gl&&!useFallback) initPuffs();
}

/* WebGL context-loss recovery */
canvas.addEventListener('webglcontextlost',(e)=>{ e.preventDefault(); },false);
canvas.addEventListener('webglcontextrestored',()=>{
  gl=canvas.getContext('webgl',glOpts)||canvas.getContext('experimental-webgl',glOpts);
  if(gl&&setupGL()){ doSize(); }
},false);

/* ---- public hooks (drop-in for the old 2D pit) ---- */
sizeSnake=function(){ doSize(); };
buildSnakes=function(){ if(!snakes.length) spawn(); };   // resize keeps the snakes; doSize repositions them
snakeLunge=function(){ for(const s of snakes){ s.tongueT=1; s.mInf=Math.min(1,s.mInf+0.6); } };
drawSnakes=function(t,energy){
  gEnergy=energy||0;
  rageMix+=((rageOn?1:0)-rageMix)*0.05;
  let now=performance.now(),dt=now-lastT; lastT=now; if(dt>50)dt=50; if(dt<0)dt=0;
  mouse.x=mx; mouse.y=my; mouse.active=true;        // follow the shared cursor
  for(const s of snakes){ updateHead(s,dt); updateBody(s); pushSlime(s); tickTongue(s,dt); }
  if(useFallback) renderFallback(); else renderGL();
};

/* boot */
setupOverlay();
if(gl && setupGL()){ doSize(); spawn(); }
else { gl=null; setupFallback(); doSize(); spawn(); }
})();

/* ---------- VISUALIZER CANVAS ---------- */
function fit(cv){if(!cv)return{};const dpr=Math.min(devicePixelRatio||1,2);const r=cv.getBoundingClientRect();cv.width=r.width*dpr;cv.height=r.height*dpr;const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);return{x,w:r.width,h:r.height};}
let heroCv,vizCv,conCv,eqCv,srWaveCv;
let H={},V={},C={},E={},SRW={};
/* the visualizer canvases live inside <main>; re-grab them whenever it changes */
function resizeAll(){heroCv=document.getElementById('heroCanvas');vizCv=document.getElementById('vizCanvas');conCv=document.getElementById('contactCanvas');eqCv=document.getElementById('pweq');srWaveCv=document.getElementById('srWave');H=fit(heroCv);V=fit(vizCv);C=fit(conCv);E=fit(eqCv);SRW=fit(srWaveCv);}

/* ---------- VISIBILITY CULLING — only paint canvases that are on-screen ---------- */
let heroIn=true,vizIn=false,conIn=false,labIn=false,musicIn=true,_cullOb=null;
function setupCulling(){
  if(_cullOb)_cullOb.disconnect();
  heroIn=true;vizIn=false;conIn=false;labIn=false;musicIn=true;
  const set={hero:v=>heroIn=v,viz:v=>vizIn=v,con:v=>conIn=v,lab:v=>labIn=v,music:v=>musicIn=v};
  _cullOb=new IntersectionObserver(es=>es.forEach(e=>{const k=e.target.getAttribute('data-vk');if(set[k])set[k](e.isIntersecting);}),{threshold:0,rootMargin:'120px'});
  [['#top','hero'],['#visualizer','viz'],['#connect','con'],['#lab','lab'],['#music','music']].forEach(([sel,k])=>{const el=document.querySelector(sel);if(el){el.setAttribute('data-vk',k);_cullOb.observe(el);}});
}

/* ---------- ONE debounced resize handler for every canvas + the snake pit ---------- */
let _rzT;addEventListener('resize',()=>{clearTimeout(_rzT);_rzT=setTimeout(()=>{sizeTrail();sizeSnake();buildSnakes();resizeAll();},150);});
function rg(ctx,w){const g=ctx.createLinearGradient(0,0,w,0);g.addColorStop(0,'#ff1f2e');g.addColorStop(.5,'#9b3cff');g.addColorStop(1,'#8dff2b');return g;}
let levels=new Array(64).fill(0);
function updateLevels(t){if(graphReady&&playing&&analyser&&bgMode==='local'){analyser.getByteFrequencyData(freq);for(let i=0;i<levels.length;i++)levels[i]+=(freq[i%freq.length]/255-levels[i])*.4;}else{for(let i=0;i<levels.length;i++){const b=.14+.12*Math.sin(t*.0013+i*.35)+.09*Math.sin(t*.0026+i*.7);levels[i]+=(Math.max(0,b)-levels[i])*.08;}}}
function snakeWave(ctx,w,h,t,amp,thick,yc){ctx.save();ctx.lineCap='round';ctx.shadowColor='#ff1f2e';ctx.shadowBlur=18;const seg=70;for(let pass=0;pass<2;pass++){ctx.beginPath();for(let i=0;i<=seg;i++){const p=i/seg,x=p*w;const lv=levels[Math.floor(p*(levels.length-1))]||0;const wob=Math.sin(p*7+t*.0022+pass*1.6)*amp*(.4+lv*1.6)+Math.sin(p*3-t*.0015)*amp*.4;const y=yc+wob;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.strokeStyle=pass===0?rg(ctx,w):'rgba(255,255,255,.45)';ctx.globalAlpha=pass===0?.95:.3;ctx.lineWidth=thick*(pass===0?1:.4);ctx.stroke();}ctx.restore();}
/* ── PLAYER VISUALIZER (music.html #pweq) ──
   The "cool graphic" that comes alive while a track plays: a mirrored neon spectrum (slime →
   alien → blood across the band), a white-hot core, a reactive wave threading the bars, plus a
   beat-gated bloom + spark burst so drops feel physical. All additive ('lighter') so it glows.
   Driven entirely by the shared `levels` band data, so it reacts to whatever song is loaded. */
const _PVN=40;let _pvCols=null;
function _hx(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
function lerpColor(a,b,t){t=t<0?0:t>1?1:t;const A=_hx(a),B=_hx(b);return'rgb('+(A[0]+(B[0]-A[0])*t|0)+','+(A[1]+(B[1]-A[1])*t|0)+','+(A[2]+(B[2]-A[2])*t|0)+')';}
function _pvColors(){if(_pvCols)return _pvCols;_pvCols=[];for(let i=0;i<_PVN;i++){const p=i/(_PVN-1);_pvCols.push(p<0.5?lerpColor('#8dff2b','#9b3cff',p*2):lerpColor('#9b3cff','#ff1f2e',(p-0.5)*2));}return _pvCols;}
let _pvParts=[],_pvBeatT=-1e9,_pvAvg=0,_pvBloom=0;
function drawPlayerViz(ctx,w,h,t){
  ctx.clearRect(0,0,w,h);
  const mid=h*0.52,cols=_pvColors();
  const energy=levels.reduce((a,b)=>a+b,0)/levels.length;
  /* lightweight beat gate: a spike above the rolling average (with a short refractory window)
     blooms the core + throws sparks — no heavy onset detector needed. */
  _pvAvg+=(energy-_pvAvg)*0.06;
  if(playing&&energy>0.11&&energy>_pvAvg*1.32&&t-_pvBeatT>170){_pvBeatT=t;_pvBloom=1;
    for(let k=0,kn=sbIsMobile?7:12;k<kn;k++)_pvParts.push({x:w*0.5+(Math.random()-0.5)*w*0.3,y:mid,vx:(Math.random()-0.5)*3.2,vy:(Math.random()-0.5)*2.6-0.6,life:1,c:cols[(Math.random()*_PVN)|0],s:Math.random()*2+0.8});
    if(_pvParts.length>90)_pvParts.splice(0,_pvParts.length-90);
  }
  _pvBloom*=0.9;
  if(_pvBloom>0.02){const r=Math.max(w,h)*0.6,g=ctx.createRadialGradient(w*0.5,mid,0,w*0.5,mid,r);g.addColorStop(0,'rgba(141,255,43,'+(0.16*_pvBloom).toFixed(3)+')');g.addColorStop(0.6,'rgba(155,60,255,'+(0.06*_pvBloom).toFixed(3)+')');g.addColorStop(1,'rgba(141,255,43,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);}
  ctx.save();ctx.globalCompositeOperation='lighter';
  const bw=w/_PVN;
  for(let i=0;i<_PVN;i++){
    const lv=levels[((i*1.6)|0)%levels.length];
    const bh=Math.max(1.5,lv*h*0.5),x=i*bw+bw*0.5,ww=Math.max(1.5,bw*0.44);
    ctx.fillStyle=cols[i];ctx.shadowColor=cols[i];ctx.shadowBlur=sbIsMobile?5:9;
    ctx.fillRect(x-ww/2,mid-bh,ww,bh*2);
    ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,'+(0.22+lv*0.5).toFixed(3)+')';   // hot core
    ctx.fillRect(x-ww*0.22,mid-bh*0.5,ww*0.44,bh);
  }
  ctx.restore();
  ctx.save();ctx.globalCompositeOperation='lighter';ctx.beginPath();                    // reactive wave
  for(let i=0;i<=_PVN;i++){const p=i/_PVN,x=p*w,lv=levels[((p*(levels.length-1))|0)]||0;const y=mid+Math.sin(p*9+t*0.004)*(4+lv*16);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.strokeStyle='rgba(141,255,43,0.85)';ctx.lineWidth=2;ctx.shadowColor='#8dff2b';ctx.shadowBlur=7;ctx.stroke();ctx.restore();
  if(_pvParts.length){ctx.save();ctx.globalCompositeOperation='lighter';for(const p of _pvParts){p.life*=0.93;p.x+=p.vx;p.y+=p.vy;p.vy+=0.04;ctx.globalAlpha=p.life;ctx.fillStyle=p.c;ctx.shadowColor=p.c;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(p.x,p.y,p.s*p.life+0.4,0,7);ctx.fill();}ctx.globalAlpha=1;ctx.restore();_pvParts=_pvParts.filter(p=>p.life>0.06);}
}
/* ── FREQUENCY VISUALIZER (lab.html / the "slowed" page · #vizCanvas) ──
   The full-bleed moving backdrop behind the FREQUENCY wordmark, rebuilt as one
   cohesive composition instead of stacked, clashing primitives: a circular
   spectrum analyser haloing the title, a mirrored neon spectrum grounded along
   the bottom, a reactive wave threading it, drifting embers for depth, and a
   beat-gated bloom + spark burst on drops. Everything is additive ('lighter')
   so it reads as glow rather than clutter, and it runs off the shared `levels`
   band data so it reacts to whatever track is loaded. */
let _fvParts=[],_fvBeatT=-1e9,_fvAvg=0,_fvBloom=0,_fvRot=0;
function drawFreqViz(ctx,w,h,t,energy){
  ctx.clearRect(0,0,w,h);
  const cols=_pvColors(),nLv=levels.length,cx=w*0.5,cy=h*0.46;
  if(_fvParts.length===0){const n=sbIsMobile?16:30;for(let i=0;i<n;i++)_fvParts.push({x:Math.random(),y:Math.random(),s:Math.random()*2+0.6,v:Math.random()*0.00018+0.00006,c:cols[(Math.random()*_PVN)|0]});}
  /* beat gate — a spike above the rolling average blooms the halo + throws sparks */
  _fvAvg+=(energy-_fvAvg)*0.06;
  if(playing&&energy>0.11&&energy>_fvAvg*1.3&&t-_fvBeatT>180){_fvBeatT=t;_fvBloom=1;
    for(let k=0,kn=sbIsMobile?8:16;k<kn&&_fvParts.length<150;k++){const a=Math.random()*6.283,sp=Math.random()*3+1.2;_fvParts.push({x:cx/w,y:cy/h,s:Math.random()*2+0.8,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,c:cols[(Math.random()*_PVN)|0],spark:1});}
  }
  _fvBloom*=0.92;
  ctx.save();ctx.globalCompositeOperation='lighter';
  /* (1) drifting embers — ambient depth */
  for(const p of _fvParts){if(p.spark)continue;p.y-=p.v*(1+energy*4);if(p.y<-0.03)p.y=1.03;ctx.globalAlpha=0.16+energy*0.4;ctx.fillStyle=p.c;ctx.beginPath();ctx.arc(p.x*w,p.y*h,p.s,0,7);ctx.fill();}
  ctx.globalAlpha=1;
  /* (2) soft bloom behind the wordmark */
  const bloom=0.12+_fvBloom*0.5+energy*0.22,rg2=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*0.42);
  rg2.addColorStop(0,'rgba(141,255,43,'+(0.06*bloom).toFixed(3)+')');rg2.addColorStop(0.45,'rgba(155,60,255,'+(0.04*bloom).toFixed(3)+')');rg2.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=rg2;ctx.fillRect(0,0,w,h);
  /* (3) circular spectrum halo around the title */
  _fvRot+=0.0009+energy*0.0016;
  const R=Math.min(w,h)*0.20,RING=64,lw=Math.max(1.5,w/720);
  for(let i=0;i<RING;i++){const a=(i/RING)*6.2832+_fvRot,lv=levels[(i*2)%nLv],len=R*0.12+lv*R*0.72,c=cols[((i/RING)*_PVN)|0];
    ctx.strokeStyle=c;ctx.lineWidth=lw;ctx.lineCap='round';ctx.shadowColor=c;ctx.shadowBlur=sbIsMobile?4:9;ctx.globalAlpha=0.9;
    ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*R,cy+Math.sin(a)*R);ctx.lineTo(cx+Math.cos(a)*(R+len),cy+Math.sin(a)*(R+len));ctx.stroke();}
  ctx.shadowBlur=0;ctx.globalAlpha=1;
  /* (4) mirrored neon spectrum grounded at the bottom */
  const N=sbIsMobile?28:48,bw=w/N,base=h-Math.min(h*0.05,34);
  for(let i=0;i<N;i++){const lv=levels[((i*1.5)|0)%nLv],bh=Math.max(2,lv*h*0.30),x=i*bw+bw*0.5,ww=Math.max(2,bw*0.5),c=cols[((i/N)*_PVN)|0];
    ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=sbIsMobile?5:11;ctx.fillRect(x-ww/2,base-bh,ww,bh);
    ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,'+(0.16+lv*0.5).toFixed(3)+')';ctx.fillRect(x-ww*0.2,base-bh*0.5,ww*0.4,bh*0.5);}
  /* (5) reactive wave threading above the spectrum */
  ctx.beginPath();
  for(let i=0;i<=N;i++){const p=i/N,x=p*w,lv=levels[((p*(nLv-1))|0)]||0,y=base-h*0.13+Math.sin(p*7+t*0.0035)*(6+lv*22);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
  ctx.strokeStyle='rgba(141,255,43,0.7)';ctx.lineWidth=2;ctx.shadowColor='#8dff2b';ctx.shadowBlur=8;ctx.stroke();ctx.shadowBlur=0;
  /* (6) beat sparks */
  for(const p of _fvParts){if(!p.spark)continue;p.life*=0.92;p.x+=p.vx/w;p.y+=p.vy/h;p.vy+=0.03;ctx.globalAlpha=p.life;ctx.fillStyle=p.c;ctx.shadowColor=p.c;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(p.x*w,p.y*h,p.s*p.life+0.4,0,7);ctx.fill();}
  ctx.globalAlpha=1;ctx.restore();
  _fvParts=_fvParts.filter(p=>!p.spark||p.life>0.06);
}
let parts=[];for(let i=0;i<34;i++)parts.push({x:Math.random(),y:Math.random(),s:Math.random()*2+.5,v:Math.random()*.0004+.0001,c:emberC[Math.floor(Math.random()*4)]});

/* The snake pit (full-page WebGL + a 2D overlay) is the heavy part of this loop.
   Cap it to ~30fps and skip it entirely inside the admin preview iframe. It's a soft,
   blurred, slow-drifting background, so 30fps is imperceptible but meaningfully cheaper —
   which frees the main thread/GPU on desktop and the audio thread on mobile. */
let _snakeLast=-1e9; const SNAKE_DT=1000/30;
/* Master loop cap (~60fps). High-refresh desktop monitors (120/144/165Hz) fire rAF at the
   panel's rate, so every heavy frame (WebGL pit + canvas visualizers) ran 2–3× more often
   than needed and saturated the main thread — which delayed pointer/scroll events into the
   "sluggish cursor + navigation" on desktop. 60Hz displays are unaffected; phones (≤60/120,
   browser-throttled) stay smooth. */
let _frameLast=-1e9; const FRAME_DT=14;
function frame(t){
  requestAnimationFrame(frame);
  if(t-_frameLast<FRAME_DT)return;        // throttle high-refresh displays to ~60fps
  _frameLast=t;
  // deferred pointer work — kept off the raw mousemove so the cursor itself tracks 1:1
  if(_mouseMoved){_mouseMoved=false;
    emit(mx,my,1);
    if(heroIn){const hi=heroInnerEl||(heroInnerEl=document.getElementById('heroinner'));
      if(hi){hi.style.setProperty('--px',((mx/innerWidth-.5)*16)+'px');hi.style.setProperty('--py',((my/innerHeight-.5)*12)+'px');}}
  }
  updateLevels(t);const energy=levels.reduce((a,b)=>a+b,0)/levels.length+(rageOn?0.35:0);
  // SNAKE PIT (full page) — throttled; runs much slower under reduced-motion
  const snakeDt=sbReduceMotion?100:SNAKE_DT;
  if(!SB_PREVIEW && (t-_snakeLast)>=snakeDt){ _snakeLast=t; drawSnakes(t,energy); }
  // Visualizers: under reduced-motion, only animate while audio is actually playing
  const drawViz=!sbReduceMotion||playing;
  if(drawViz){
  if(H.w&&heroIn){const{x,w,h}=H;x.clearRect(0,0,w,h);x.save();parts.forEach(p=>{p.y-=p.v*(1+energy*3);if(p.y<0)p.y=1;x.globalAlpha=.3+energy*.5;x.fillStyle=p.c;x.beginPath();x.arc(p.x*w,p.y*h,p.s,0,7);x.fill();});x.restore();snakeWave(x,w,h,t,9+energy*8,3.5+energy*4,h*.62);}
  if(V.w&&vizIn){drawFreqViz(V.x,V.w,V.h,t,energy);}
  if(C.w&&conIn){const{x,w,h}=C;x.clearRect(0,0,w,h);snakeWave(x,w,h,t*.7,9+energy*6,3+energy*4,h*.5);}
  if(E.w&&musicIn)drawPlayerViz(E.x,E.w,E.h,t);
  if(SRW.w&&labIn){const{x,w,h}=SRW;x.clearRect(0,0,w,h);snakeWave(x,w,h,t*.6,7+energy*9,3+energy*4,h*.5);}
  }
  // spark rain — a steady drizzle of sparks from the top. On by default (calm); rage pours it on.
  if(!sbReduceMotion&&rageFlags().sparkRain&&Math.random()<(rageOn?0.45:0.16)){
    embers.push({x:Math.random()*innerWidth,y:-4,vx:(Math.random()-.5)*1.4,vy:Math.random()*3+2.5,life:1,c:Math.random()<.5?'#ff7b1f':'#ff1f2e',s:Math.random()*2+1});
  }
  if(embers.length||bolts.length){tctx.clearRect(0,0,tcv.width,tcv.height);tctx.globalCompositeOperation='lighter';
    for(const p of embers){p.life*=.95;p.x+=p.vx;p.y+=p.vy;p.vy+=.02;const s=p.s*p.life+.4;tctx.globalAlpha=p.life;tctx.fillStyle=p.c;tctx.shadowColor=p.c;tctx.shadowBlur=8;tctx.beginPath();tctx.arc(p.x,p.y,s,0,7);tctx.fill();}
    tctx.globalAlpha=1;tctx.shadowBlur=0;embers=embers.filter(p=>p.life>.05);
    if(bolts.length)drawBolts();
    if(!embers.length&&!bolts.length)tctx.clearRect(0,0,tcv.width,tcv.height);}
}
requestAnimationFrame(frame);   // next frame is scheduled at the top of frame()
/* coming back to the tab: resize the canvases and, on mobile especially, resume the audio
   context iOS suspends on background/interruption so the lab + player keep their sound. */
document.addEventListener('visibilitychange',()=>{if(!document.hidden){resizeAll();sizeSnake();if(actx&&actx.state==='suspended'&&playing){actx.resume().catch(()=>{});}}});

/* RAGE MODE — distorted audio, red snake pit, and a configurable stack of effects.
   Which effects fire is content-driven (SB.rageFx, edited in the admin) so the artist
   can dial the intensity up or down without touching code. A subset (snake strikes,
   ember bursts, lightning, spark rain, heartbeat vignette) is part of the base vibe and
   runs even with rage off; the rest only ignite while rage is engaged. */
const flashEl=document.getElementById('flash');
function flash(c){if(!flashEl)return;flashEl.style.background=c||'var(--slime)';flashEl.style.transition='none';flashEl.style.opacity='.45';requestAnimationFrame(()=>{flashEl.style.transition='opacity .55s ease';flashEl.style.opacity='0';});}
/* merged effect flags: built-in defaults overlaid with whatever's published */
function rageFlags(){const d=(window.SB_DEFAULTS&&SB_DEFAULTS.rageFx)||{};const c=(window.SB&&SB.rageFx)||{};return Object.assign({},d,c);}
/* toggle the CSS-driven effect classes on <body> to match the flags (ambient ones stay on
   even with rage off; the rest only while rage is engaged) */
const RFX_CLASS={shake:'rfx-shake',redOverlay:'rfx-overlay',glitch:'rfx-glitch',heartbeat:'rfx-heart',fire:'rfx-fire',static:'rfx-static',bloodDrip:'rfx-drip'};
/* CSS effects that belong to the base vibe — they stay on (when flagged) even with rage off */
const RFX_AMBIENT={heartbeat:1};
function applyRageClasses(){const f=rageFlags(),b=document.body.classList;for(const k in RFX_CLASS)b.toggle(RFX_CLASS[k],!!f[k]&&(RFX_AMBIENT[k]||rageOn));}

/* ---- lightning — jagged bolts drawn on the shared trail canvas ---- */
let bolts=[];
function strikeLightning(){
  const x0=Math.random()*innerWidth,segs=11+Math.floor(Math.random()*8),dy=innerHeight/segs;
  const pts=[{x:x0,y:0}];let x=x0,y=0;
  for(let i=0;i<segs;i++){x+=(Math.random()-.5)*100;y+=dy;pts.push({x,y});}
  bolts.push({pts,life:1});
  flash('rgba(190,215,255,0.85)');   // cold electric flash to sell the strike
}
function drawBolts(){
  tctx.globalCompositeOperation='lighter';tctx.lineCap='round';tctx.lineJoin='round';
  for(const b of bolts){b.life*=.84;tctx.globalAlpha=Math.min(1,b.life);tctx.strokeStyle='#dfecff';tctx.shadowColor='#9fc0ff';tctx.shadowBlur=18;tctx.lineWidth=1.5+b.life*2.5;
    tctx.beginPath();b.pts.forEach((p,i)=>i?tctx.lineTo(p.x,p.y):tctx.moveTo(p.x,p.y));tctx.stroke();}
  tctx.globalAlpha=1;tctx.shadowBlur=0;bolts=bolts.filter(b=>b.life>.06);
}

let rageOn=false,rageTimer=null;
function enterRage(){
  rageOn=!rageOn;document.body.classList.toggle('rage',rageOn);applyRageClasses();ensureCtx();
  if(rageOn){
    startAudio();applyAudioFx();
    const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
    const f=rageFlags();
    if(f.emberBursts)burst(innerWidth/2,innerHeight*0.5,40,'#ff1f2e');
    if(f.snakeLunge)snakeLunge();
    if(f.lightning&&!reduce)strikeLightning();
    toast('☠ RAGE MODE ☠','blood');
    clearInterval(rageTimer);
    rageTimer=setInterval(()=>{
      if(!rageOn)return;
      const g=rageFlags();
      if(g.emberBursts)burst(Math.random()*innerWidth,innerHeight*(0.55+Math.random()*0.45),14,'#ff1f2e');
      if(g.strobe&&!reduce&&Math.random()<0.5)flash('rgba(255,31,46,0.9)');
      if(g.snakeLunge&&Math.random()<0.4)snakeLunge();
      if(g.lightning&&!reduce&&Math.random()<0.55)strikeLightning();
    },820);
  }else{
    clearInterval(rageTimer);rageTimer=null;bolts=[];applyAudioFx();toast('rage off — back to the slime');
  }
}
const _rageBtn=document.getElementById('rageBtn');if(_rageBtn)_rageBtn.onclick=()=>{enterRage();setMenu(false);};

/* AMBIENT EFFECT LOOP — snake strikes, ember bursts and lightning fire even with rage off,
   at a calmer cadence, so they read as part of the base vibe (the heartbeat vignette + spark
   rain run continuously elsewhere). Each stays gated by its flag + reduce-motion; while rage
   is ON its own faster interval (above) takes over so the two never stack. */
setInterval(()=>{
  if(rageOn||sbReduceMotion||document.hidden)return;
  const g=rageFlags();
  if(g.emberBursts)burst(Math.random()*innerWidth,innerHeight*(0.5+Math.random()*0.5),8);
  if(g.snakeLunge&&Math.random()<0.5)snakeLunge();
  if(g.lightning&&Math.random()<0.12)strikeLightning();
},2600);

/* GUESTBOOK + easter egg */
function storeLocal(key,val){try{const a=JSON.parse(localStorage.getItem(key)||'[]');if(!a.includes(val)){a.push(val);localStorage.setItem(key,JSON.stringify(a));}}catch(_){}}
/* JOIN THE SLIME — sends the sign-up to the backend (Supabase). Personal data is NOT
   kept in a permanent localStorage list anymore; if the backend write fails we queue
   the entry under sb_pending and retry, clearing it once it lands, so PII isn't
   retained longer than needed. Requires an explicit consent opt-in. */
function pendingGet(){try{return JSON.parse(localStorage.getItem('sb_pending')||'[]');}catch(_){return[];}}
function pendingSet(a){try{if(a.length)localStorage.setItem('sb_pending',JSON.stringify(a.slice(-50)));else localStorage.removeItem('sb_pending');}catch(_){}}
async function flushPending(){if(typeof sbSubscribe!=='function')return;const a=pendingGet();if(!a.length)return;const keep=[];for(const x of a){let ok=false;try{ok=await sbSubscribe(x.email,x.phone||'');}catch(_){ok=false;}if(!ok)keep.push(x);}pendingSet(keep);}
async function signbook(){
  const e=document.getElementById('gemail'),p=document.getElementById('gphone'),note=document.getElementById('joinnote'),consent=document.getElementById('gconsent');
  if(!e||!p||!note)return;
  const ev=e.value.trim(),pv=p.value.trim(),digits=pv.replace(/[^\d]/g,'');
  const emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ev);
  const phoneOk=pv===''||digits.length>=10;
  if(!emailOk){note.textContent='✗ enter a valid email';note.classList.add('bad');e.focus();return;}
  if(!phoneOk){note.textContent='✗ enter a valid phone, or leave it blank';note.classList.add('bad');p.focus();return;}
  if(consent&&!consent.checked){note.textContent='✗ tick the box to opt in first';note.classList.add('bad');consent.focus();return;}
  const gotPhone=digits.length>=10;
  note.classList.remove('bad');note.textContent='… adding you to the slime';
  /* report the REAL outcome instead of always claiming success */
  let ok=false;
  try{ if(typeof sbSubscribe==='function') ok=await sbSubscribe(ev,gotPhone?digits:''); }catch(_){ ok=false; }
  e.value='';p.value='';if(consent)consent.checked=false;
  if(ok){
    note.textContent=gotPhone?'✓ you in — email + SMS. welcome to the slime ☠':'✓ you in — welcome to the slime ☠';
    toast('☠ welcome to the slime');flushPending();
  }else{
    /* queue for retry rather than keeping a permanent PII list */
    const q=pendingGet();q.push({email:ev,phone:gotPhone?digits:'',t:Date.now()});pendingSet(q);
    note.textContent='✓ saved — we’ll add you when the connection’s back ☠';
    toast('saved — sync pending');
  }
  burst(innerWidth/2,innerHeight*.7,20,'#8dff2b');snakeLunge();
}

/* ===================== JOIN POPUP — first-visit email capture =====================
   A one-time, dismissible modal that asks new visitors onto the slime list to pull in more
   sign-ups. Reuses the accessible modal (focus trap + Esc) and the SAME Supabase sign-up
   path as the connect page — including the queue-on-failure fallback, so a missed write is
   retried, never dropped, and no permanent PII list is kept. Shown once per visitor; skipped
   for the admin preview and for automation/crawlers. */
function openJoinPopup(){
  try{localStorage.setItem('sb_joinpop','1');}catch(_){}     // remember we showed it (once per visitor)
  openModal(`<div class="mbody joinpop">
    <span class="kicker">✦ join the slime</span>
    <h3>get on the <em>list</em> ☠</h3>
    <p>first access to drops, merch &amp; shows — straight to your inbox. no spam, ever.</p>
    <div class="joinrow joinrow-col" style="margin-top:16px">
      <input id="jpEmail" type="email" autocomplete="email" inputmode="email" placeholder="your@email.com" aria-label="your email">
      <input id="jpPhone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+1 phone — optional, for SMS drops" aria-label="your phone (optional)">
      <button type="button" id="jpGo">join ☠</button>
    </div>
    <div class="joinnote" id="jpNote" style="text-align:left">drops, merch &amp; shows — email + optional SMS · unsubscribe anytime · we never sell your info</div>
    <button type="button" class="jpskip" id="jpSkip">maybe later</button>
  </div>`);
  const email=document.getElementById('jpEmail'),phone=document.getElementById('jpPhone'),go=document.getElementById('jpGo'),note=document.getElementById('jpNote'),skip=document.getElementById('jpSkip');
  if(skip)skip.onclick=closeModal;
  if(go&&email&&note){
    const submit=async()=>{
      const ev=email.value.trim(),pv=phone?phone.value.trim():'',digits=pv.replace(/[^\d]/g,''),gotPhone=digits.length>=10;
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ev)){note.textContent='✗ enter a valid email';note.classList.add('bad');email.focus();return;}
      if(pv!==''&&digits.length<10){note.textContent='✗ enter a valid phone, or leave it blank';note.classList.add('bad');phone.focus();return;}
      note.classList.remove('bad');note.textContent='… adding you to the slime';go.disabled=true;
      let ok=false;try{ if(typeof sbSubscribe==='function') ok=await sbSubscribe(ev,gotPhone?digits:''); }catch(_){ ok=false; }
      if(!ok){ const q=pendingGet();q.push({email:ev,phone:gotPhone?digits:'',t:Date.now()});pendingSet(q); }   // queue + retry, same as the form
      try{localStorage.setItem('sb_joined','1');}catch(_){}
      note.textContent=gotPhone?'✓ you in — email + SMS. welcome to the slime ☠':'✓ you in — welcome to the slime ☠';
      try{burst(innerWidth/2,innerHeight*.5,18,'#8dff2b');snakeLunge();}catch(_){}
      toast('☠ welcome to the slime');
      setTimeout(closeModal,1100);
    };
    go.onclick=submit;
    email.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
    if(phone)phone.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submit();}});
  }
}
function maybeJoinPopup(){
  try{
    if(SB_PREVIEW||navigator.webdriver)return;                 // never in the admin preview or under automation/crawlers
    if(localStorage.getItem('sb_joinpop')||localStorage.getItem('sb_joined'))return;   // once per visitor; not if already in
    if(pendingGet().length)return;                             // they already tried to join (queued)
    const arm=()=>setTimeout(()=>{ if(!modal.classList.contains('open')) openJoinPopup(); },1400);
    if(document.readyState==='complete')arm(); else addEventListener('load',arm,{once:true});
  }catch(_){}
}

let seq='';addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey||isTyping())return;seq=(seq+e.key.toLowerCase()).slice(-5);if(seq==='slime'){for(let i=0;i<60;i++)setTimeout(()=>burst(innerWidth*Math.random(),innerHeight,8,'#8dff2b'),i*20);stab();snakeLunge();toast('☠ SLIME UNLOCKED ☠');}});

/* ===================== FLESH-OUT FEATURES ===================== */
/* TOASTS */
function toast(msg,type){const wrap=document.getElementById('toasts');const el=document.createElement('div');el.className='toast'+(type?' '+type:'');el.textContent=msg;wrap.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));setTimeout(()=>{el.classList.remove('show');setTimeout(()=>el.remove(),350);},2600);}

/* MODAL — accessible dialog: moves focus in, traps Tab, restores focus on close */
const modal=document.getElementById('modal'),modalContent=document.getElementById('modalContent');
let _modalOpener=null,_duckedRadio=false;
const _focSel='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function _modalFocusable(){return Array.from(modal.querySelectorAll(_focSel)).filter(el=>el.offsetWidth||el.offsetHeight||el===document.activeElement);}
function openModal(html){
  _modalOpener=document.activeElement;
  modalContent.innerHTML=html;
  const h=modalContent.querySelector('h2,h3');                 // label the dialog from its heading
  if(h){if(!h.id)h.id='sbModalTitle';modal.setAttribute('aria-labelledby',h.id);}else modal.removeAttribute('aria-labelledby');
  /* If this modal embeds a video (vault clip), duck the background radio so the two
     don't play over each other; remember it so we can resume on close. */
  _duckedRadio=false;
  if(modalContent.querySelector('iframe')&&bgIsPlaying()){_duckedRadio=true;if(bgMode==='yt')ytPause();else{audio.pause();setUI(false);}}
  modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  /* the dialog fades in (visibility transition), so the close button isn't focusable
     for a few frames — focus it the moment it actually becomes visible */
  let _ft=0;(function focusIn(){const mx=document.getElementById('modalX');
    if(mx&&getComputedStyle(mx).visibility!=='hidden'){mx.focus();return;}
    if(_ft++<40)requestAnimationFrame(focusIn);})();
}
function closeModal(){
  modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
  if(_modalOpener&&_modalOpener.focus){try{_modalOpener.focus();}catch(_){}}
  _modalOpener=null;
  /* resume whatever the radio was playing before we ducked it for a video */
  if(_duckedRadio){_duckedRadio=false;if(bgMode==='yt')ytPlay();else startAudio();}
}
document.getElementById('modalX').onclick=closeModal;
modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeModal();});
modal.addEventListener('keydown',e=>{                          // trap Tab within the dialog
  if(e.key!=='Tab'||!modal.classList.contains('open'))return;
  const f=_modalFocusable();if(!f.length)return;
  const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});

/* MUSIC FILTER */
function wireMfilter(){document.querySelectorAll('#mfilter button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#mfilter button').forEach(x=>x.classList.remove('on'));b.classList.add('on');const f=b.dataset.f;document.querySelectorAll('#mgrid .rel').forEach(c=>c.classList.toggle('hide',f!=='all'&&c.dataset.type!==f));});}

/* LANDING INFO — extra home-page bands (intro/bio, stat strip, tap-in CTA).
   Each band hides itself when its `show` flag is off or it has no content. */
function renderLanding(L){
  if(!L)return;
  const q=s=>document.querySelector(s);
  const setHtml=(s,v)=>{const e=q(s);if(e&&v!=null)e.innerHTML=sanitizeHtml(v);};
  // intro / bio band
  const intro=L.intro||{},isec=q('#lintro');
  if(isec){
    const on=intro.show!==false && (intro.heading||intro.text);
    isec.style.display=on?'':'none';
    if(on){
      const k=q('#lintro .lkicker');if(k&&intro.kicker!=null)k.textContent=intro.kicker;
      setHtml('#lintro .lhead',intro.heading);
      const t=q('#lintro .lbody');if(t&&intro.text!=null)t.textContent=intro.text;
      const img=q('#lintro .lpic img');if(img){const u=safeImg(intro.image);if(u)img.src=u;img.parentElement.style.display=intro.image?'':'none';}
      const b=q('#lintro .lbtn');if(b){if(intro.buttonLabel){b.textContent=intro.buttonLabel;const u=safeUrl(intro.buttonUrl);if(u)b.href=u;b.style.display='';}else b.style.display='none';}
    }
  }
  // stat strip
  const ssec=q('#lstats'),sg=q('#lstatgrid');
  if(ssec&&sg){
    const stats=L.stats||[];
    ssec.style.display=stats.length?'':'none';
    if(stats.length)sg.innerHTML=stats.map(s=>`<div class="lstat"><div class="ln">${esc(s.n)}</div><div class="ll">${esc(s.l)}</div></div>`).join('');
  }
  // tap-in CTA band
  const cta=L.cta||{},csec=q('#lcta');
  if(csec){
    const on=cta.show!==false && (cta.heading||cta.text);
    csec.style.display=on?'':'none';
    if(on){
      const k=q('#lcta .lkicker');if(k&&cta.kicker!=null)k.textContent=cta.kicker;
      setHtml('#lcta .lctahead',cta.heading);
      const t=q('#lcta .lctatext');if(t&&cta.text!=null)t.textContent=cta.text;
      const b=q('#lcta .lctabtn');if(b){if(cta.buttonLabel){b.textContent=cta.buttonLabel;const u=safeUrl(cta.buttonUrl);if(u)b.href=u;b.style.display='';}else b.style.display='none';}
    }
  }
}

/* MERCH — coming soon, route to the slime list */
function wireMerchAlert(){const merchAlertBtn=document.getElementById('merchAlertBtn');if(merchAlertBtn)merchAlertBtn.onclick=()=>{burst(innerWidth/2,innerHeight*.6,16,'#8dff2b');gotoConnectJoin('☠ drop your email — first access to the slime shop');};}

/* VAULT — lightbox (static markup; the CMS rebuild rebinds its own cards) */
function wireVault(){document.querySelectorAll('#vault .vcard').forEach(card=>card.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();const img=card.querySelector('img').src,title=card.querySelector('.vt').textContent,sub=card.querySelector('.vs').textContent,href=card.getAttribute('href');openModal(`<div class="mhead wide" style="background-image:url('${img}')"></div><div class="mbody"><span class="kicker">${sub}</span><h3>${title}</h3><p>The full visual lives in the SB vault on YouTube. Tap in for the complete drop.</p><div class="mcta"><a class="bigbtn bSlime" href="${href}" target="_blank" rel="noopener noreferrer">▶ watch on youtube</a></div></div>`);}));}

/* SHOWS — content-driven (edit in the admin page) */
function renderShows(SHOWS){SHOWS=SHOWS||[];const list=document.getElementById('showlist'),empty=document.getElementById('showsEmpty');if(!list||!empty)return;if(!SHOWS.length){list.style.display='none';empty.style.display='';return;}empty.style.display='none';list.style.display='';list.innerHTML=SHOWS.map(s=>{const u=safeUrl(s.url);/* sanitize CMS ticket links — escaping alone still allows javascript: schemes */return `<div class="showrow"><div class="date">${esc(s.date)}</div><div class="venue"><div class="v1">${esc(s.venue)}</div><div class="v2">${esc(s.city)}</div></div>${u?`<a class="tix" href="${esc(u)}" target="_blank" rel="noopener noreferrer">tickets</a>`:'<span class="tix" style="opacity:.5">soon</span>'}</div>`;}).join('');}
function wireTour(){const _tourBtn=document.getElementById('tourAlertBtn');if(_tourBtn)_tourBtn.onclick=()=>gotoConnectJoin('drop your email below for tour alerts ☠');}

/* SHORTCUTS HELP */
const SHORTCUTS=[['Space','play / pause'],['Esc','close popups'],['slime','secret burst'],['?','this menu']];
function openHelp(){openModal(`<div class="mbody" style="padding-top:26px"><span class="kicker">controls</span><h3>shortcuts</h3><p>the whole site plays. tap the mark for a slime splash, follow the snake.</p><div class="klist">${SHORTCUTS.map(s=>`<div class="krow"><kbd>${s[0]}</kbd><span>${s[1]}</span></div>`).join('')}</div></div>`);}
document.getElementById('helpbtn').onclick=openHelp;
addEventListener('keydown',e=>{if(e.key==='?'&&!isTyping()&&!modal.classList.contains('open'))openHelp();});

/* SHARE */
function wireShare(){const _shareBtn=document.getElementById('shareBtn');if(_shareBtn)_shareBtn.onclick=async()=>{const data={title:'SLIME BY — official',text:'Delaware rap — green pressure, venom, motion.',url:location.href};try{if(navigator.share){await navigator.share(data);}else{await navigator.clipboard.writeText(location.href);toast('link copied to clipboard ☑');}}catch(_){}};}

/* ===================== FEATURED DROP ===================== */
function previewFeatured(){startAudio();toast('▶ now spinning — '+localTitle());}
function notifyDrop(){gotoConnectJoin('☠ drop your email — first to know');}
/* drop date is set from CMS content (drop.dropDate); counts down, then reads OUT NOW.
   Use an explicit offset so every visitor counts down to the same instant (else a
   bare 'YYYY-MM-DDTHH:MM' is parsed in each visitor's own timezone). */
let dropDate=new Date('2026-07-04T00:00:00-04:00');
function tickCountdown(){const el=document.getElementById('cd');if(!el)return;const d=dropDate-Date.now();if(isNaN(d)||d<=0){el.innerHTML='<span class="cdlive">OUT NOW ☠</span>';return;}const u=(n,l)=>`<div class="cdu"><b>${String(n).padStart(2,'0')}</b><span>${l}</span></div>`;el.innerHTML=u(Math.floor(d/864e5),'days')+u(Math.floor(d/36e5)%24,'hrs')+u(Math.floor(d/6e4)%60,'min')+u(Math.floor(d/1e3)%60,'sec');}
tickCountdown();setInterval(tickCountdown,1000);

/* ===================== VIDEOS (content-driven) ===================== */
let VIDEOS=[];
/* YouTube auto-thumbnail: whenever a clip has a YouTube id we pull its still straight
   from YouTube (hqdefault always exists). A custom image is only a fallback for clips
   with no id (e.g. ones that just link out). */
function ytThumb(id){return id?'https://i.ytimg.com/vi/'+encodeURIComponent(id)+'/hqdefault.jpg':'';}
function videoThumb(v){const id=ytId(v&&v.id);return id?ytThumb(id):((v&&v.img)?safeImg(v.img):'');}
function renderVideos(list){VIDEOS=list||[];const g=document.getElementById('vidgrid');if(!g)return;
  g.innerHTML=VIDEOS.map((v,i)=>`<div class="vid reveal${i%3?' d'+(i%3):''}" data-i="${i}"><img loading="lazy" decoding="async" src="${esc(videoThumb(v))}" alt="${esc(v.t)}"><div class="pp">▶</div><div class="vmeta"><div class="vmt">${esc(v.t)}</div><div class="vms">${esc(v.s)}</div></div></div>`).join('');
  g.querySelectorAll('.vid').forEach(c=>{io.observe(c);c.onclick=()=>{const v=VIDEOS[+c.dataset.i];const vid=ytId(v.id);burst(innerWidth/2,innerHeight*.5,10,'#8dff2b');
    if(vid){openModal(`<div class="mbody"><span class="kicker">${esc(v.s)}</span><h3>${esc(v.t)}</h3><div class="vembed"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0" title="${esc(v.t)}" allow="autoplay;encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe></div></div>`);}
    else{openModal(`<div class="mbody"><span class="kicker">${esc(v.s)}</span><h3>${esc(v.t)}</h3><p>Add this clip's YouTube video ID in the admin page to play it right here. For now, catch the full vault on YouTube.</p><div class="mcta"><a class="bigbtn bSlime" href="${esc(safeUrl((window.SB&&SB.vault&&SB.vault.youtube)||'')||'https://youtube.com/@slimeby_')}" target="_blank" rel="noopener noreferrer">▶ watch on youtube</a></div></div>`);}};});
}

/* ===================== THE LAB — a SEPARATE slowed + reverb sandbox =====================
   The lab lives on lab.html. It bends the LIVE track only while you're on that page;
   every other page (and a fresh load of the site) plays the song normally. The bend is
   remembered for the session (labRate/labRev/labRoom) but never becomes the site default. */
let srSpeed,srSpeedV,srReverb,srReverbV,srRoom,srRoomV,srPlayBtn,srProgEl,srModeEl;
function roomLabel(p){return p<0.34?'small room':p<0.7?'medium hall':'cavern';}
function srModeText(){if(rageOn)return'rage';const slow=userRate<0.97,fast=userRate>1.03,rev=revAmt>0.05;
  if(fast)return rev?'nightcore + reverb':'nightcore';
  if(slow&&rev)return'slowed + reverb';if(slow)return'slowed';if(rev)return'reverb';return'original';}
function srSync(){if(srModeEl)srModeEl.textContent=srModeText();}
function setSpeed(v){userRate=Math.max(.5,Math.min(1.25,v/100));labRate=userRate;if(srSpeedV)srSpeedV.textContent=userRate.toFixed(2)+'×';audio.playbackRate=userRate;saveLabState();srSync();}
function setReverb(v){revAmt=Math.max(0,Math.min(1,v/100));labRev=revAmt;if(srReverbV)srReverbV.textContent=Math.round(revAmt*100)+'%';applyAudioFx();saveLabState();srSync();}
function setRoom(v){roomP=Math.max(0,Math.min(1,v/100));labRoom=roomP;if(srRoomV)srRoomV.textContent=roomLabel(roomP);saveLabState();}
const SR_PRESETS={slowrev:[80,30,55],deep:[70,58,80],night:[118,8,26],clean:[100,0,40]};
function markPreset(name){document.querySelectorAll('.srpresets button').forEach(b=>b.classList.toggle('on',!!name&&b.dataset.preset===name));}
function applyPreset(name){const p=SR_PRESETS[name];if(!p)return;if(srSpeed)srSpeed.value=p[0];if(srReverb)srReverb.value=p[1];if(srRoom)srRoom.value=p[2];setSpeed(p[0]);setReverb(p[1]);setRoom(p[2]);rebuildImpulse();markPreset(name);}
/* which preset (if any) matches the current speed/reverb/room state */
function matchPreset(){const cur=[Math.round(userRate*100),Math.round(revAmt*100),Math.round(roomP*100)];for(const k in SR_PRESETS){const p=SR_PRESETS[k];if(p[0]===cur[0]&&p[1]===cur[1]&&p[2]===cur[2])return k;}return null;}
/* push the lab's remembered bend onto its sliders + labels and engage it on the live track */
function syncLab(){userRate=labRate;revAmt=labRev;roomP=labRoom;
  if(srSpeed)srSpeed.value=Math.round(labRate*100);if(srReverb)srReverb.value=Math.round(labRev*100);if(srRoom)srRoom.value=Math.round(labRoom*100);
  if(srSpeedV)srSpeedV.textContent=labRate.toFixed(2)+'×';if(srReverbV)srReverbV.textContent=Math.round(labRev*100)+'%';if(srRoomV)srRoomV.textContent=roomLabel(labRoom);
  audio.playbackRate=userRate;if(actx)rebuildImpulse();applyAudioFx();markPreset(matchPreset());srSync();}
/* wire the lab controls + engage the bend — called from sbInitPage() on lab.html only */
function wireLab(){
  srSpeed=document.getElementById('srSpeed');srSpeedV=document.getElementById('srSpeedV');
  srReverb=document.getElementById('srReverb');srReverbV=document.getElementById('srReverbV');
  srRoom=document.getElementById('srRoom');srRoomV=document.getElementById('srRoomV');
  srPlayBtn=document.getElementById('srPlay');srProgEl=document.getElementById('srProg');srModeEl=document.getElementById('srMode');
  if(!srSpeed&&!srReverb&&!srPlayBtn)return false;   // not the lab page
  /* ensureCtx() on each knob: a touch-drag is a user gesture, so this creates/resumes the
     audio context on mobile (where it starts suspended) and the reverb actually engages. */
  if(srSpeed)srSpeed.oninput=()=>{ensureCtx();setSpeed(+srSpeed.value);markPreset(null);};
  if(srReverb)srReverb.oninput=()=>{ensureCtx();setReverb(+srReverb.value);markPreset(null);};
  if(srRoom){srRoom.oninput=()=>{ensureCtx();setRoom(+srRoom.value);markPreset(null);};srRoom.onchange=()=>rebuildImpulse();}
  document.querySelectorAll('.srpresets button').forEach(b=>b.onclick=()=>{ensureCtx();applyPreset(b.dataset.preset);if(audio.paused)startAudio();});
  if(srPlayBtn)srPlayBtn.onclick=toggle;
  if(srProgEl)srProgEl.onclick=e=>{if(!isFinite(audio.duration))return;const r=srProgEl.getBoundingClientRect();audio.currentTime=(e.clientX-r.left)/r.width*audio.duration;};
  wireLabTracks();   // the "load a track" picker — pick any catalog song to bend
  syncLab();
  return true;
}

/* ===================== SB UNIVERSE — five powers map (content-driven) ===================== */
let POWERS=[];
function openPower(i){const p=POWERS[i];if(!p)return;
  const meters=(p.stats||[]).map(s=>`<div class="pmeter"><span class="pml">${esc(s[0])}</span><div class="pbar"><i data-w="${esc(s[1])}"></i></div><span class="pmv">${esc(s[1])}</span></div>`).join('');
  openModal(`<div class="mbody pcard" style="--c:${esc(safeColor(p.c))}"><div class="ptag">force ${esc(p.id)} · ${esc(p.tag)}</div><h3>${esc(p.n)}</h3><p>${esc(p.lore)}</p><div class="pmeters">${meters}</div></div>`);
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll('#modal .pbar i').forEach(b=>b.style.width=(parseFloat(b.dataset.w)||0)+'%')));
  burst(innerWidth/2,innerHeight*.5,12,safeColor(p.c)||'#8dff2b');snakeLunge();
}
function renderPowers(list){POWERS=list||[];const wrap=document.querySelector('#universe .upanels');if(!wrap)return;
  wrap.innerHTML=POWERS.map((p,i)=>`<div class="upanel reveal${i?' d'+Math.min(i,4):''}" data-p="${i}" role="button" tabindex="0"><div class="orb" style="background:radial-gradient(circle,${esc(safeColor(p.c)||'#8dff2b')},transparent 70%)"></div><div class="idx">${esc(p.id)}</div><div class="ut">${esc(p.n)}</div><div class="ud">${esc(p.short||'')}</div><div class="uenter">enter ↦</div></div>`).join('');
  wrap.querySelectorAll('.upanel').forEach(el=>{io.observe(el);const i=+el.dataset.p;
    el.addEventListener('click',()=>openPower(i));
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();openPower(i);}});});
}

/* ===================== RELEASES (content-driven) ===================== */
function renderReleases(list){const g=document.getElementById('mgrid');if(!g)return;
  g.innerHTML=(list||[]).map((r,i)=>`<a class="rel reveal d${(i%3)+1}" data-type="${esc(r.type||'single')}" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(r.url))}"><div class="art"><img loading="lazy" decoding="async" src="${esc(safeImg(r.img))}" alt="${esc(r.title)}"><div class="play"><i>▶</i></div></div><div class="meta"><div class="t">${esc(r.title)}</div><div class="s">${esc(r.sub)}</div></div></a>`).join('');
  g.querySelectorAll('.rel').forEach(el=>io.observe(el));
  const onf=document.querySelector('#mfilter button.on');const f=onf?onf.dataset.f:'all';
  g.querySelectorAll('.rel').forEach(c=>c.classList.toggle('hide',f!=='all'&&c.dataset.type!==f));
}

/* ===================== APPLY CONTENT — maps the CMS model onto the page ===================== */
/* ===================== CMS PAGES + ADD-ON BLOCKS =====================
   Lets the admin add freeform content blocks to existing pages, and create
   brand-new pages (page.html?p=<slug>) that show up in the nav — all driven
   by the published content, no code edits. */
const SB_BUILTIN_KEY={'index.html':'home','music.html':'music','lab.html':'lab','world.html':'world','vault.html':'vault','shows.html':'shows','connect.html':'connect'};
function currentSlug(){try{return new URLSearchParams(location.search).get('p')||'';}catch(_){return'';}}
function pageKey(){const pg=currentPage();return pg==='page.html'?('@'+currentSlug()):(SB_BUILTIN_KEY[pg]||'');}
/* pull a YouTube video id out of a link or accept a bare id */
function ytId(v){if(!v)return'';v=String(v).trim();const m=v.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);return m?m[1]:(/^[A-Za-z0-9_-]{11}$/.test(v)?v:'');}
/* ===================== SANITIZATION HELPERS =====================
   Every CMS-authored URL and every rich-HTML field is sanitized before it touches
   the DOM. esc() handles text/attribute escaping; these reject dangerous URL schemes
   (javascript:, data:text, …) and strip unknown tags/attributes from rich HTML. */
function cleanUrl(u,media){
  u=String(u==null?'':u).split('').filter(function(ch){var c=ch.charCodeAt(0);return c>31&&c!==127;}).join('').trim();   // strip tab/newline scheme-smuggling
  if(!u)return'';
  const m=u.match(/^([a-z][a-z0-9+.-]*):/i);
  if(m){const s=m[1].toLowerCase();
    if(s==='http'||s==='https')return u;
    if(!media&&(s==='mailto'||s==='tel'))return u;
    if(media&&s==='data'&&/^data:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml);/i.test(u))return u;  // inline images only
    return '';   // javascript:, vbscript:, data:text, file:, … → drop
  }
  if(/^\/\//.test(u))return u;        // protocol-relative
  if(/^[#/]/.test(u))return u;        // anchor / root-relative
  if(/^[\w.@~%+-]/.test(u))return u;  // plain relative path
  return '';
}
function safeUrl(u){return cleanUrl(u,false);}   // links / iframes
function safeImg(u){return cleanUrl(u,true);}    // images / media / backgrounds
/* safe value for a CSS url('…') — percent-encode anything that could break out of it */
function cssUrl(u){u=safeImg(u);return u?"url('"+u.replace(/['"()\\\s]/g,c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0'))+"')":'';}
/* allow only obviously-safe CSS color tokens (hex / named / rgb / hsl) */
function safeColor(c){c=String(c==null?'':c).trim();return /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d.,%\s/]+\)|hsla?\([\d.,%\s/]+\))$/i.test(c)?c:'';}
/* strict allowlist HTML sanitizer for the handful of rich-text CMS fields */
const SB_ALLOWED_TAGS={B:1,I:1,EM:1,STRONG:1,BR:1,SPAN:1,SMALL:1,U:1,A:1};
function sanitizeHtml(s){
  if(s==null)return'';
  const dirty=document.createElement('template');dirty.innerHTML=String(s);
  const out=document.createElement('template');
  (function clean(srcN,dstN){srcN.childNodes.forEach(n=>{
    if(n.nodeType===3){dstN.appendChild(document.createTextNode(n.nodeValue));return;}   // text
    if(n.nodeType!==1)return;                          // drop comments / others
    const tag=n.tagName;
    if(SB_ALLOWED_TAGS[tag]){
      const el=document.createElement(tag);            // fresh node ⇒ no attributes carried over
      if(tag==='A'){const u=safeUrl(n.getAttribute('href'));if(u){el.setAttribute('href',u);el.setAttribute('rel','noopener noreferrer');el.setAttribute('target','_blank');}}
      clean(n,el);dstN.appendChild(el);
    } else { clean(n,dstN); }                           // unknown tag → keep its sanitized children only
  });})(dirty.content,out.content);
  return out.innerHTML;
}
function blockHTML(b){
  if(!b)return'';
  const style=(b.style||'centered'),yt=ytId(b.youtube);
  let inner='';
  if(b.kicker)inner+=`<span class="kicker">${esc(b.kicker)}</span>`;
  if(b.heading)inner+=`<h2 class="sbblock-h">${esc(b.heading)}</h2>`;
  if(b.image&&style!=='full'){const cu=cssUrl(b.image);if(cu)inner+=`<div class="sbblock-img" style="background-image:${cu}"></div>`;}
  if(b.text)inner+=`<p class="sbblock-text">${esc(b.text)}</p>`;
  if(yt)inner+=`<div class="sbblock-video"><iframe src="https://www.youtube.com/embed/${esc(yt)}" title="" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  if(b.buttonLabel){const u=safeUrl(b.buttonUrl),ext=/^https?:/i.test(u);inner+=`<div class="sbblock-cta"><a class="bigbtn bSlime" href="${esc(u||'#')}"${ext?' target="_blank" rel="noopener noreferrer"':''}>${esc(b.buttonLabel)}</a></div>`;}
  const bg=(style==='full'&&b.image&&cssUrl(b.image))?` style="background-image:${cssUrl(b.image)}"`:'';
  return `<section class="sbblock sb-${esc(style)} reveal"${bg}><div class="sbblock-in">${inner}</div></section>`;
}
function blocksForPage(c){
  const k=pageKey();if(!k)return[];
  if(k[0]==='@'){const p=(c.pages||[]).find(x=>x&&x.slug===k.slice(1));return p&&Array.isArray(p.blocks)?p.blocks:[];}
  return (c.extras||[]).filter(b=>b&&(b.page||'home')===k);
}
function renderBlocks(c){
  const host=document.getElementById('sbBlocks');if(!host)return;
  host.innerHTML=(blocksForPage(c)||[]).map(blockHTML).join('');
  host.querySelectorAll('.reveal').forEach(el=>io.observe(el));
}
/* append custom-page links to the shared nav (built once, after content loads) */
function refreshNav(c){
  const wrap=document.querySelector('#nav .navlinks');if(!wrap)return;
  wrap.querySelectorAll('a[data-cp]').forEach(a=>a.remove());
  const here=pageKey();
  (c.pages||[]).forEach(p=>{if(!p||!p.slug||p.nav===false)return;
    const a=document.createElement('a');a.href='page.html?p='+encodeURIComponent(p.slug);a.textContent=p.label||p.slug;a.setAttribute('data-cp','1');
    if(here==='@'+p.slug)a.className='active';
    a.addEventListener('click',()=>{try{setMenu(false);}catch(_){}});
    wrap.appendChild(a);
  });
}
/* fill the header of a custom page (page.html) from its content entry */
function renderCustomPageHead(c){
  if(currentPage()!=='page.html')return;
  const head=document.getElementById('customHead');if(!head)return;
  const p=(c.pages||[]).find(x=>x&&x.slug===currentSlug());
  const h1=head.querySelector('h1'),kic=head.querySelector('.kicker'),sub=head.querySelector('.psub');
  if(p){document.title=(p.label||'SLIME BY')+' — SLIME BY';
    if(kic)kic.textContent=p.kicker||'SB';
    if(h1){h1.textContent=p.label||'';h1.setAttribute('data-t',(p.label||'').toUpperCase());}
    if(sub)sub.textContent=p.intro||'';
  }else{
    if(kic)kic.textContent='404';
    if(h1){h1.textContent='not found';h1.setAttribute('data-t','NOT FOUND');}
    if(sub)sub.innerHTML='this page doesn’t exist — <a href="index.html">back to home</a>';
  }
}

/* ===================== SMART LINKS (link-in-bio) =====================
   Short URLs for music: each link lives at slimeby.com/<slug> (served via
   404.html routing) and at link.html?l=<slug>, landing on a themed card with a
   button per platform. They all collect on the /links portal. All data-driven
   from the CMS `links` array — created/edited in the admin, no code edits. */
function currentLinkSlug(){try{return new URLSearchParams(location.search).get('l')||'';}catch(_){return'';}}
function linkBySlug(c,slug){slug=String(slug||'').toLowerCase();return ((c&&c.links)||[]).find(x=>x&&String(x.slug||'').toLowerCase()===slug)||null;}
function platMeta(p){const M=window.SB_PLATFORMS||{};return M[p]||M.custom||{name:'Link',cls:'bAlien'};}
/* true once the published content has arrived (or we're in the admin preview), so
   a real link slug doesn't flash "not found" while defaults render first. */
function contentSettled(){return !!window.__sbContentLoaded||SB_PREVIEW;}
/* forward incoming tracking params (utm_*, fbclid, igshid …) onto each outbound
   button so campaign attribution flows through the smart link. */
function trackingQS(){
  const out=new URLSearchParams();
  try{new URLSearchParams(location.search).forEach((v,k)=>{ if(/^utm_/i.test(k)||/^(fbclid|gclid|igshid|igsh|ttclid|ref|src|mc_cid|mc_eid|si)$/i.test(k))out.append(k,v); });}catch(_){}
  return out.toString();
}
function withTracking(url){const t=trackingQS();return t?url+(url.indexOf('?')>=0?'&':'?')+t:url;}
function serviceBtnHTML(s){
  if(!s)return'';const u=safeUrl(s.url);if(!u)return'';
  const meta=platMeta(s.platform||'custom'),label=esc(s.label||meta.name);
  return `<a class="sl-btn bigbtn ${meta.cls}" href="${esc(withTracking(u))}" target="_blank" rel="noopener noreferrer"><span class="sl-btn-l">${label}</span><span class="sl-btn-go">↗</span></a>`;
}
function shareUrlFor(slug){const base=(location.origin&&location.origin!=='null')?location.origin:'';return base+'/'+encodeURIComponent(slug||'');}
function smartCardHTML(link){
  const art=cssUrl(link.artwork);
  const btns=(link.services||[]).map(serviceBtnHTML).join('');
  return `<div class="sl-card reveal">
    ${art?`<div class="sl-art" style="background-image:${art}"></div>`:`<div class="sl-art sl-art-blank"><svg viewBox="0 0 100 100"><path d="${SNAKE_PATH}"/></svg></div>`}
    <div class="sl-meta"><span class="kicker">slime by</span><h1 class="sl-title" data-t="${esc((link.title||'').toUpperCase())}">${esc(link.title||'')}</h1>${link.subtitle?`<p class="sl-sub">${esc(link.subtitle)}</p>`:''}</div>
    <div class="sl-btns">${btns||'<p class="sl-empty">links dropping soon ☠</p>'}</div>
    <div class="sl-share"><button class="btnX" type="button" data-share="${esc(shareUrlFor(link.slug))}">⤴ share</button></div>
  </div>`;
}
function smartLoadingHTML(){return `<div class="sl-card"><div class="sl-art sl-art-blank"><svg viewBox="0 0 100 100"><path d="${SNAKE_PATH}"/></svg></div><div class="sl-meta"><span class="kicker">slime by</span><h1 class="sl-title">loading…</h1></div></div>`;}
function smartNotFoundHTML(){return `<div class="sl-card reveal"><div class="sl-art sl-art-blank"><svg viewBox="0 0 100 100"><path d="${SNAKE_PATH}"/></svg></div>
  <div class="sl-meta"><span class="kicker">404</span><h1 class="sl-title" data-t="NOT FOUND">link not found</h1><p class="sl-sub">this slime link doesn’t exist (yet).</p></div>
  <div class="sl-btns"><a class="sl-btn bigbtn bSlime" href="links.html"><span class="sl-btn-l">all links</span><span class="sl-btn-go">↗</span></a><a class="sl-btn bigbtn bAlien" href="index.html"><span class="sl-btn-l">home</span><span class="sl-btn-go">↗</span></a></div></div>`;}
function wireSmartShare(host){host.querySelectorAll('[data-share]').forEach(b=>{b.onclick=async()=>{const url=b.getAttribute('data-share')||location.href;try{if(navigator.share){await navigator.share({title:document.title,url});}else{await navigator.clipboard.writeText(url);toast('link copied ☑');}}catch(_){}};});}
function paintSmart(host,link){
  host.innerHTML=link?smartCardHTML(link):(contentSettled()?smartNotFoundHTML():smartLoadingHTML());
  if(link)document.title=(link.title||'SLIME BY')+' — SLIME BY';
  host.querySelectorAll('.reveal').forEach(el=>io.observe(el));wireSmartShare(host);wireMagnetic();
}
/* link.html?l=<slug> */
function renderSmartLink(c){const host=document.getElementById('smartlink');if(!host)return;paintSmart(host,linkBySlug(c,currentLinkSlug()));}
/* 404.html — clean-URL router: slimeby.com/<slug> → smart link, else custom page, else 404 */
function renderRoute(c){
  const host=document.getElementById('routeZone');if(!host)return;
  let slug='';try{slug=decodeURIComponent((location.pathname.split('/').filter(Boolean).pop()||'').toLowerCase().replace(/\.html?$/,''));}catch(_){slug='';}
  const link=linkBySlug(c,slug);
  if(link){paintSmart(host,link);return;}
  const pg=(c.pages||[]).find(p=>p&&String(p.slug||'').toLowerCase()===slug);
  if(pg){location.replace('page.html?p='+encodeURIComponent(pg.slug)+(location.search||'')+(location.hash||''));return;}
  paintSmart(host,null);
}
/* links.html — the link-in-bio portal hub */
function renderPortal(c){
  const host=document.getElementById('portal');if(!host)return;
  const ct=c.contact||{};
  const socials=[['spotify',ct.spotify],['apple',ct.apple],['youtube',ct.youtube],['instagram',ct.instagram],['tiktok',ct.tiktok]]
    .filter(x=>x[1]).map(([p,u])=>{const meta=platMeta(p),su=safeUrl(u);return su?`<a class="sl-btn bigbtn ${meta.cls}" href="${esc(su)}" target="_blank" rel="noopener noreferrer"><span class="sl-btn-l">${esc(meta.name)}</span><span class="sl-btn-go">↗</span></a>`:'';}).join('');
  const items=(c.links||[]).filter(l=>l&&l.slug&&l.portal!==false).map(l=>{
    const art=cssUrl(l.artwork);
    return `<a class="pt-item reveal" href="link.html?l=${encodeURIComponent(l.slug)}">${art?`<span class="pt-art" style="background-image:${art}"></span>`:`<span class="pt-art pt-art-blank">♫</span>`}<span class="pt-meta"><span class="pt-t">${esc(l.title||l.slug)}</span>${l.subtitle?`<span class="pt-s">${esc(l.subtitle)}</span>`:''}</span><span class="pt-go">↗</span></a>`;
  }).join('');
  host.innerHTML=`<div class="pt-wrap reveal">
    <svg class="sbmono" viewBox="0 0 100 100"><path d="${SNAKE_PATH}"/></svg>
    <span class="kicker" style="justify-content:center">all my links</span>
    <h1 class="pt-name glitch" data-t="SLIME BY">SLIME BY</h1>
    <p class="pt-sub">stream the catalog · drops · the world ☠</p>
    ${items?`<div class="pt-list">${items}</div>`:`<p class="sl-empty" style="text-align:center">links dropping soon ☠</p>`}
    ${socials?`<div class="pt-social"><span class="pt-label">follow</span><div class="sl-btns">${socials}</div></div>`:''}
    <div class="pt-join"><a class="bigbtn bSlime" href="connect.html#join">☠ join the slime list</a></div>
  </div>`;
  host.querySelectorAll('.reveal').forEach(el=>io.observe(el));wireMagnetic();
}

function applyContent(c){
  if(!c)return;window.SB=c;
  const q=s=>document.querySelector(s);
  const txt=(s,v)=>{const e=q(s);if(e&&v!=null)e.textContent=v;};
  const setHtml=(s,v)=>{const e=q(s);if(e&&v!=null)e.innerHTML=sanitizeHtml(v);};   // allowlist-sanitized rich text
  const href=(s,v)=>{const e=q(s);if(e&&v!=null){const u=safeUrl(v);if(u)e.setAttribute('href',u);else e.removeAttribute('href');}};
  const src=(s,v)=>{const e=q(s);if(e&&v!=null){const u=safeImg(v);if(u)e.setAttribute('src',u);}};
  const bg=(s,v)=>{const e=q(s);if(e&&v){const u=cssUrl(v);if(u)e.style.backgroundImage=u;}};

  if(c.hero){const h1=q('.hero h1.glitch');if(h1&&c.hero.title){h1.textContent=c.hero.title;h1.setAttribute('data-t',c.hero.title);}setHtml('.hero .sub',c.hero.sub);bg('.herobg',c.hero.bg);}

  renderMarquee(c.marquee);

  if(c.drop){txt('#drop .kicker',c.drop.kicker);setHtml('#drop .shead h2',c.drop.heading);
    bg('#drop .dropfeat .cover',c.drop.cover);txt('#drop .dropfeat h3',c.drop.featuredTitle);txt('#drop .dropfeat .dsub',c.drop.featuredSub);
    const dl=document.querySelectorAll('#drop .dropfeat .smartlinks a');[c.drop.spotify,c.drop.apple,c.drop.youtube].forEach((u,i)=>{if(dl[i]&&u){const su=safeUrl(u);if(su)dl[i].href=su;}});
    href('#presaveBtn',c.drop.presaveUrl);
    if(c.drop.dropDate){const d=new Date(c.drop.dropDate);if(!isNaN(d.getTime()))dropDate=d;tickCountdown();}}

  if(c.music){bg('#music .pwart',c.music.playerCover);
    /* keep the persistent bottom player bar (shown on every page) in sync with the CMS
       cover; the title always comes from the live playlist track that's loaded. */
    bg('#disc',c.music.playerCover);
    const emb=q('#music .embedwrap iframe');if(emb&&c.music.spotifyArtistId)emb.src=`https://open.spotify.com/embed/artist/${encodeURIComponent(c.music.spotifyArtistId)}?utm_source=generator&theme=0`;
    renderReleases(c.music.releases);
    if(typeof updateBgTitle==='function')updateBgTitle();}  /* reflect the current track title (or a CMS override) */

  if(c.about){setHtml('#about .lead',c.about.lead);txt('#about .about p',c.about.text);src('#about .pic img',c.about.portrait);txt('#about .badge',c.about.badge);
    const sw=q('#about .stats');if(sw&&c.about.stats)sw.innerHTML=c.about.stats.map(s=>`<div class="stat"><div class="n">${esc(s.n)}</div><div class="l">${esc(s.l)}</div></div>`).join('');}

  if(c.universe){txt('#universe .uhint',c.universe.hint);renderPowers(c.universe.powers);}

  if(c.vault){href('#vault .shead .link',c.vault.youtube);const vg=q('#vault .vgrid');
    if(vg){vg.innerHTML=(c.vault.items||[]).map((v,i)=>`<a class="vcard reveal${i?' d'+Math.min(i,3):''}" href="${esc(safeUrl(v.href))}" target="_blank" rel="noopener noreferrer"><img loading="lazy" decoding="async" src="${esc(safeImg(v.img))}" alt=""><div class="pico">▶</div><div class="vinfo"><div class="vt">${esc(v.title)}</div><div class="vs">${esc(v.sub)}</div></div></a>`).join('');
      vg.querySelectorAll('.vcard').forEach(card=>{io.observe(card);card.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey)return;e.preventDefault();const img=card.querySelector('img').src,title=card.querySelector('.vt').textContent,sub=card.querySelector('.vs').textContent,h=card.getAttribute('href');openModal(`<div class="mhead wide" style="background-image:url('${img}')"></div><div class="mbody"><span class="kicker">${sub}</span><h3>${title}</h3><p>The full visual lives in the SB vault on YouTube. Tap in for the complete drop.</p><div class="mcta"><a class="bigbtn bSlime" href="${h}" target="_blank" rel="noopener noreferrer">▶ watch on youtube</a></div></div>`);});});}}

  renderVideos(c.videos);

  renderLanding(c.landing);
  applyRageClasses();   // re-sync rage effects if the CMS changed the flags mid-rage

  if(c.merch){txt('#merch .kicker',c.merch.kicker);setHtml('#merch .shead h2',c.merch.heading);txt('#merch .msub',c.merch.text);txt('#merchAlertBtn',c.merch.button);}

  renderShows(c.shows);

  if(c.contact){txt('#connect h2',c.contact.heading);
    const cl=document.querySelectorAll('#connect .clinks a');[c.contact.spotify,c.contact.apple,c.contact.youtube,c.contact.instagram,c.contact.tiktok].forEach((u,i)=>{if(cl[i]&&u){const su=safeUrl(u);if(su)cl[i].href=su;}});
    const bk=q('#connect .booking a');if(bk&&c.contact.bookingEmail){const mu=safeUrl('mailto:'+c.contact.bookingEmail);if(mu){bk.href=mu;bk.textContent=c.contact.bookingEmail;}}
    const jt=q('.jointitle');if(jt)jt.innerHTML=`${esc(c.contact.joinTitle||'')}<span>${esc(c.contact.joinSub||'')}</span>`;}

  if(c.footer){const fb=q('.fbadges');if(fb&&c.footer.badges)fb.innerHTML=c.footer.badges.map(b=>`<span class="fbadge">${esc(b)}</span>`).join('');txt('.fcopy',c.footer.copy);}

  renderCustomPageHead(c);   // custom-page title/intro (page.html only)
  refreshNav(c);             // surface custom pages in the nav
  renderBlocks(c);           // add-on blocks for this page
  renderSmartLink(c);        // link.html?l=<slug>
  renderPortal(c);           // links.html portal hub
  renderRoute(c);            // 404.html clean-URL routing (slimeby.com/<slug>)
}

/* ===================== INTERACTION LAYER =====================
   Eye-candy + motion that work across every page: slime page-wipe
   transitions, a scroll-progress bar, pointer 3D tilt on cards,
   magnetic buttons, and the interactive merch grid. All disabled
   for reduced-motion / touch where it would hurt more than help. */
const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)').matches;
const finePointer=matchMedia('(hover:hover) and (pointer:fine)').matches;

/* ---- slime page-wipe between pages ---- */
const wipeEl=document.getElementById('wipe');
/* EXIT: slime panel slides up to cover the page, then we navigate */
function playWipeOut(done){ if(!wipeEl||reducedMotion){done&&done();return;} wipeEl.classList.add('in'); let f=false; const go=()=>{if(f)return;f=true;done&&done();}; wipeEl.addEventListener('transitionend',go,{once:true}); setTimeout(go,650); }
/* ENTER: the new page paints already covered (html.wipe-armed::before, armed in the
   page <head> before first paint → no flash). CSS slides it away; we just clean up. */
function clearWipeArmed(){ const h=document.documentElement; if(reducedMotion)h.classList.remove('wipe-armed'); else setTimeout(()=>h.classList.remove('wipe-armed'),650); }
/* ENTER (client-side): the cover is up after the swap; slide it off the top to reveal. */
function pjaxReveal(){ if(!wipeEl||reducedMotion)return;
  wipeEl.style.transition='transform .5s cubic-bezier(.76,0,.24,1)';
  requestAnimationFrame(()=>{ wipeEl.style.transform='translateY(-100%)'; });
  const done=()=>{ wipeEl.removeEventListener('transitionend',done); wipeEl.classList.remove('in'); wipeEl.style.transition=''; wipeEl.style.transform=''; };
  wipeEl.addEventListener('transitionend',done); setTimeout(done,700);
}

/* ===================== CLIENT-SIDE ROUTER =====================
   The whole point: the music never stops between pages. The <audio> element and the
   rest of the page chrome live OUTSIDE <main>, so we navigate by fetching the target
   page and swapping ONLY its <main> — no full reload, the audio graph keeps playing.
   Falls back to a normal hard navigation if anything looks off. */
function pageFromUrl(u){const p=(u.split('#')[0].split('?')[0].split('/').pop()||'').toLowerCase();return p===''?'index.html':p;}
function navKey(u){const p=pageFromUrl(u);let s='';const q=new URLSearchParams(u.split('#')[0].split('?')[1]||'');if(p==='page.html')s=q.get('p')||'';else if(p==='link.html')s=q.get('l')||'';return p+'|'+s;}
function setActiveNav(){const here=currentPage(),slug=currentSlug();
  document.querySelectorAll('#nav .navlinks a').forEach(a=>{const h=a.getAttribute('href')||'';let on=pageFromUrl(h)===here;
    if(on&&pageFromUrl(h)==='page.html'){const q=new URLSearchParams(h.split('#')[0].split('?')[1]||'');on=(q.get('p')||'')===slug;}
    a.classList.toggle('active',on);});}
let _navBusy=false,_curKey=navKey(location.href);
async function sbNavigate(url,push){
  if(_navBusy)return; _navBusy=true;
  let html;
  try{const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw 0;html=await r.text();}
  catch(_){location.href=url;return;}
  let doc;try{doc=new DOMParser().parseFromString(html,'text/html');}catch(_){location.href=url;return;}
  const newMain=doc.getElementById('main')||doc.querySelector('main');
  const curMain=document.getElementById('main')||document.querySelector('main');
  if(!newMain||!curMain){location.href=url;return;}
  const swap=()=>{
    try{document.adoptNode(newMain);}catch(_){}
    curMain.replaceWith(newMain);
    if(!document.getElementById('sbBlocks')){const bc=document.createElement('div');bc.id='sbBlocks';newMain.appendChild(bc);}
    if(doc.title)document.title=doc.title;
    if(push){try{history.pushState({sb:1},'',url);}catch(_){}}
    _curKey=navKey(location.href);
    document.body.className=document.body.className.replace(/\bpage-\S+/g,'').trim();
    document.body.classList.add('page-'+currentPage().replace(/\.html$/,''));
    setActiveNav();
    try{scrollTo(0,0);}catch(_){}
    sbInitPage();
    _navBusy=false;
    pjaxReveal();
  };
  if(reducedMotion)swap(); else playWipeOut(swap);
}
/* intercept internal page links → client-side navigate (no reload, music keeps playing) */
document.addEventListener('click',e=>{
  if(SB_PREVIEW)return;   // the admin preview iframe drives navigation itself
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest('a[href]'); if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
  const href=a.getAttribute('href'); if(!href||/^(https?:|mailto:|tel:|#)/i.test(href)||!/\.html(\?|#|$)/i.test(href))return;
  const tgt=href.split('#')[0].split('?')[0].toLowerCase();
  // "same page" also has to match the custom-page slug — two page.html links
  // with different ?p= slugs are different pages and must still navigate.
  let same=tgt===currentPage();
  if(same&&tgt==='page.html'){ const q=new URLSearchParams(href.split('#')[0].split('?')[1]||''); same=(q.get('p')||'')===currentSlug(); }
  if(same&&tgt==='link.html'){ const q=new URLSearchParams(href.split('#')[0].split('?')[1]||''); same=(q.get('l')||'')===currentLinkSlug(); }
  if(same){ if(!href.includes('#')){ e.preventDefault(); try{scrollTo({top:0,behavior:'smooth'});}catch(_){} } return; }
  e.preventDefault(); sbNavigate(href,true);
});
/* back / forward — re-render the target page in place (skip pure #hash changes) */
addEventListener('popstate',()=>{ if(navKey(location.href)===_curKey)return; sbNavigate(location.href,false); });

/* ---- scroll-progress bar ---- */
const progressEl=document.getElementById('progress');
function updateProgress(){ if(progressEl)progressEl.style.transform='scaleX('+scrollProg()+')'; }
addEventListener('scroll',updateProgress,{passive:true}); updateProgress();

/* ---- pointer 3D tilt on display cards ---- */
if(finePointer&&!reducedMotion){
  const TILT='.rel,.vcard,.vid,.upanel,.dropfeat,.dropcard,.prod';
  let cur=null;
  const reset=el=>{ if(el){el.style.transform='';el.classList.remove('tilting');} };
  document.addEventListener('pointermove',e=>{
    const card=e.target.closest(TILT);
    if(card!==cur){ reset(cur); cur=card; if(card&&!(card.classList.contains('reveal')&&!card.classList.contains('in')))card.classList.add('tilting'); }
    if(!card||!card.classList.contains('tilting'))return;
    const r=card.getBoundingClientRect(); if(!r.width)return;
    const px=(e.clientX-r.left)/r.width-.5, py=(e.clientY-r.top)/r.height-.5, max=7;
    card.style.transform=`perspective(820px) rotateX(${(-py*max).toFixed(2)}deg) rotateY(${(px*max).toFixed(2)}deg) translateY(-6px)`;
  },{passive:true});
  document.addEventListener('pointerleave',()=>{reset(cur);cur=null;});
}
/* ---- magnetic primary buttons (re-bound per page since most live in <main>) ---- */
function wireMagnetic(){ if(!(finePointer&&!reducedMotion))return;
  document.querySelectorAll('.bigbtn,.btnX').forEach(b=>{
    b.onpointermove=e=>{const r=b.getBoundingClientRect();b.style.transform=`translate(${((e.clientX-r.left)/r.width-.5)*10}px,${((e.clientY-r.top)/r.height-.5)*10}px)`;};
    b.onpointerleave=()=>{b.style.transform='';};
  });
}

/* ---- interactive merch (uses the product grid on shows.html) ---- */
function watchList(){ try{return JSON.parse(localStorage.getItem('sb_watch')||'[]');}catch(_){return[];} }
function isWatched(n){ return watchList().indexOf(n)>=0; }
function setWatched(n){ try{const a=watchList();if(a.indexOf(n)<0){a.push(n);localStorage.setItem('sb_watch',JSON.stringify(a));}}catch(_){} }
function markWatchedCards(){ document.querySelectorAll('#pgrid .prod').forEach(c=>c.classList.toggle('watched',isWatched(c.dataset.name))); }
const SIZES=['XS','S','M','L','XL','XXL'];
function openMerch(card){
  const name=card.dataset.name||'SB drop', type=card.dataset.type||'', desc=card.dataset.desc||'';
  openModal(`<div class="mbody"><span class="kicker">slime shop · coming soon</span><h3>${esc(name)}</h3><div class="dtag">${esc(type)}</div><p>${esc(desc)}</p>
    <div class="mlabel">pick your size</div>
    <div class="sizes">${SIZES.map(s=>`<button type="button">${s}</button>`).join('')}</div>
    <div class="mcta"><button class="bigbtn bSlime" id="merchNotify" type="button">${isWatched(name)?'✓ on the list ☠':'☠ notify me when it drops'}</button></div>
    <div class="joinnote" style="text-align:left;margin-top:14px">🐍 prices drop when the shop opens — get watching for first access + a launch discount.</div></div>`);
  const box=document.getElementById('modalContent');
  box.querySelectorAll('.sizes button').forEach(b=>b.onclick=()=>{box.querySelectorAll('.sizes button').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');try{hat(false);}catch(_){}});
  const nb=document.getElementById('merchNotify');
  if(nb)nb.onclick=()=>{ const was=isWatched(name); setWatched(name); markWatchedCards(); nb.textContent='✓ on the list ☠'; nb.disabled=true; burst(innerWidth/2,innerHeight*.5,14,'#8dff2b'); toast(was?('already watching '+name):('☠ watching '+name+' — first access when it drops')); };
}
function initMerch(){ const pg=document.getElementById('pgrid'); if(!pg)return;
  pg.querySelectorAll('.prod').forEach(c=>{ io.observe(c); c.tabIndex=0; c.setAttribute('role','button'); c.setAttribute('aria-label',(c.dataset.name||'product')+' — coming soon');
    c.onclick=()=>openMerch(c);
    c.onkeydown=e=>{if(e.key==='Enter'||e.code==='Space'){e.preventDefault();openMerch(c);}}; });
  markWatchedCards();
}

/* boot content: render defaults instantly, then overlay whatever's published in Supabase.
   Guarded so a missing/failed cms.js can never break the rest of the page. */
var SB_PREVIEW=/[?&]preview\b/.test(location.search);
/* Cache the resolved (defaults + published) content for the session so client-side
   navigation re-renders from memory instead of refetching Supabase on every click.
   First load (or after the TTL) still fetches fresh. */
let _cmsCache=null,_cmsCacheAt=0; const CMS_TTL=5*60*1000;
function loadContent(){
  try{ if(typeof SB_DEFAULTS!=='undefined') applyContent(SB_DEFAULTS); }catch(e){}
  /* In preview the admin drives the content via postMessage, so skip the remote
     fetch — otherwise it could resolve late and clobber the live edits. */
  if(SB_PREVIEW)return;
  if(_cmsCache && (Date.now()-_cmsCacheAt)<CMS_TTL){ try{applyContent(_cmsCache);}catch(_){} window.__sbContentLoaded=true; return; }
  try{ if(typeof sbGetContent==='function') sbGetContent().then(c=>{_cmsCache=c;_cmsCacheAt=Date.now();window.__sbContentLoaded=true;applyContent(c);}).catch(()=>{window.__sbContentLoaded=true;}); }catch(e){}
}

/* ===================== LIVE PREVIEW CHANNEL =====================
   When this page is embedded in the admin's preview pane it renders edits in real
   time: the admin posts the working content, we apply it. Locked down so it has zero
   effect during normal browsing — only the admin pane that embeds this page (same
   origin, our parent window) can drive it. Without these gates any site could open
   this page in a frame/popup and inject DOM via the CMS render path. */
addEventListener('message',function(e){
  if(!SB_PREVIEW)return;                               // only the preview iframe consumes these
  if(e.source!==window.parent||e.source===window)return;  // must come from the embedding admin window
  if(e.origin!==location.origin)return;                // same-origin admin only
  const d=e.data;if(!d||d.__sb!=='preview'||!d.content)return;
  try{applyContent(d.content);}catch(_){}
});
if(SB_PREVIEW){
  document.body.classList.add('sb-preview');
  var _l=document.getElementById('loader');if(_l)_l.classList.add('gone');
  try{ if(parent&&parent!==window) parent.postMessage({__sb:'ready'},location.origin); }catch(_){}
}

/* deep-link: arriving at connect.html#join lands the visitor on the email field */
function deepLinkJoin(){ if(/join/.test(location.hash)){const g=document.getElementById('gemail');if(g)setTimeout(()=>{const c=document.getElementById('connect');if(c)c.scrollIntoView({behavior:'smooth'});g.focus();},350);} }

/* ===================== QUEST GAME BRIDGE =====================
   "Slime the Game" (quest.html + assets/quest.js) rides the site's real player so
   the quest's beat visuals, BEAT JUMP window and boss-crown timing all react to
   whatever Slime By track is actually spinning. This exposes a tiny, read-mostly
   surface: the game taps the SAME AnalyserNode the site visualizer uses, reads the
   play state, and can start the music as its soundtrack. Nothing here changes site
   behaviour for any other page. */
window.SBPlayer = {
  ensureCtx(){ try{ ensureCtx(); }catch(_){} },
  start(){ try{ if(bgMode==='yt') ytPlay(); else startAudio(); }catch(_){} },
  toggle(){ try{ toggle(); }catch(_){} },
  isPlaying(){ try{ return bgMode==='yt' ? ytIsPlaying() : (!!audio && !audio.paused); }catch(_){ return false; } },
  analyser(){ return analyser||null; },          // the live AnalyserNode (null until ensureCtx)
  audio(){ return audio; },
  title(){ try{ return localTitle(); }catch(_){ return ''; } },
};
/* Mount the quest engine when its page is on screen. The module is loaded on demand
   (the client-side router never executes scripts inside a swapped-in <main>, and the
   game is dead weight on every other page), then mounted against the freshly-swapped
   DOM. The game's own loop self-unmounts the moment its canvas leaves the document, so
   navigating away never leaves a stray rAF / key listeners behind. */
function sbEnsureQuest(){
  if(currentPage()!=='quest.html') return;
  const r=document.getElementById('qRoot'); if(!r) return;
  if(window.SBQuest){ try{ window.SBQuest.mount(r); }catch(_){} return; }
  if(sbEnsureQuest._loading) return; sbEnsureQuest._loading=true;
  const s=document.createElement('script'); s.src='assets/quest.js'; s.async=true;
  s.onload=()=>{ sbEnsureQuest._loading=false; const root=document.getElementById('qRoot'); if(window.SBQuest&&root){ try{ window.SBQuest.mount(root); }catch(_){} } };
  s.onerror=()=>{ sbEnsureQuest._loading=false; };
  document.head.appendChild(s);
}

/* ===================== PER-PAGE INIT =====================
   Runs on first load AND after every client-side navigation. Re-wires everything that
   lives inside <main> against the freshly-swapped DOM, and engages the right audio
   character: the lab is slowed + reverb, everywhere else the song plays normally. The
   one-time chrome / audio graph / snake pit / global listeners set up above are never
   re-run here, so nothing double-binds and the music keeps playing. */
function sbInitPage(){
  heroInnerEl=null;       // <main> was swapped — drop the cached hero-parallax node
  resizeAll();            // re-grab + size this page's visualizer canvases
  setupCulling();         // re-observe on-screen sections for render culling
  observeReveals();       // reveal-on-scroll for the new content
  pwplay=document.getElementById('pwplay'); if(pwplay)pwplay.onclick=toggle;
  const pwprog=document.getElementById('pwprog'); if(pwprog)pwprog.onclick=e=>{if(!isFinite(audio.duration))return;const r=pwprog.getBoundingClientRect();audio.currentTime=(e.clientX-r.left)/r.width*audio.duration;};
  const pwvol=document.getElementById('pwvol'); if(pwvol){pwvol.value=Math.round(audio.volume*100);pwvol.oninput=()=>{audio.volume=pwvol.value/100;if(ytPlayer&&ytReady){try{ytPlayer.setVolume(+pwvol.value);}catch(_){}}};}
  const pwprev=document.getElementById('pwprev'); if(pwprev)pwprev.onclick=bgPrev;
  const pwnext=document.getElementById('pwnext'); if(pwnext)pwnext.onclick=bgNext;
  wireTracklist();
  const hm=document.getElementById('heroMono'); if(hm)hm.onclick=e=>slimeSplash(e.clientX,e.clientY);
  const cm=document.getElementById('contactMono'); if(cm)cm.onclick=e=>slimeSplash(e.clientX,e.clientY);
  wireMfilter(); wireMerchAlert(); wireVault(); wireTour(); wireShare(); initMerch(); wireMagnetic();
  tickCountdown();
  if(currentPage()==='lab.html') wireLab(); else applyNormalFx();   // lab = slowed+reverb, else normal
  loadContent();          // apply CMS defaults + fetch published content for this page
  deepLinkJoin();
  setUI(bgIsPlaying());   // reflect play state on the new page's transport UI
  updateBgTitle();        // keep the now-playing title in sync (local track or YouTube)
  sbEnsureQuest();        // mount "Slime the Game" when its page is on screen (no-op elsewhere)
}

/* legacy full-load wipe cleanup (kept for hard navigations / no-JS-router fallbacks) */
try{ if(sessionStorage.getItem('sb_wipe')){ sessionStorage.removeItem('sb_wipe'); clearWipeArmed(); } else { document.documentElement.classList.remove('wipe-armed'); } }catch(_){}

/* wire the page we landed on */
sbInitPage();

/* retry any sign-ups that were queued while the backend was unreachable, then forget them */
if(!SB_PREVIEW){try{flushPending();}catch(_){}}

/* first-visit: invite new visitors onto the slime list (once per visitor) */
maybeJoinPopup();
