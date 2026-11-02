/* ============================================================
   CLIP RECORDER (the Lab) — fans record a 15s vertical clip of the 3D
   visualizer with the bent (slowed / reverbed) audio, branded, ready for
   TikTok / Reels / Shorts. No library: the browser does it all.
     video: the lab renders at 720×1280 while recording; each finished frame is
            composited with a pre-drawn SB overlay onto a 2D canvas → captureStream
     audio: a MediaStreamDestination tapped off the site's own Web Audio output
            (SBPlayer.captureStream) — so it's exactly what the visitor hears
     file : MediaRecorder → mp4 where supported (Safari, recent Chrome), else webm
   Then a modal previews the clip with share (Web Share, files) + download.
   ============================================================ */
const W = 720, H = 1280, SECS = 15;

function pickMime() {
  const c = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  for (const m of c) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {} }
  return '';
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function modeLabel(L) {
  if (!L.on) return 'live from the lab';
  const parts = [];
  if (L.rate < 0.97) parts.push('slowed'); else if (L.rate > 1.03) parts.push('sped up');
  if (L.rev > 0.05) parts.push('reverb');
  return (parts.length ? parts.join(' + ') : 'original') + ' · ' + L.rate.toFixed(2) + '×';
}

/* the static branding layer, drawn once per clip */
function overlay(title, mode) {
  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const g = o.getContext('2d');
  let gr = g.createLinearGradient(0, 0, 0, 300);
  gr.addColorStop(0, 'rgba(0,0,0,.72)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, 300);
  gr = g.createLinearGradient(0, H - 220, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.75)');
  g.fillStyle = gr; g.fillRect(0, H - 220, W, 220);
  g.textAlign = 'center';
  g.fillStyle = '#ff1f2e'; g.font = "104px 'Pirata One', cursive"; g.fillText('SLIME BY', W / 2 + 3, 150);
  g.fillStyle = '#8dff2b'; g.fillText('SLIME BY', W / 2 - 3, 150);
  g.fillStyle = '#f2efe9'; g.fillText('SLIME BY', W / 2, 150);
  try { g.letterSpacing = '5px'; } catch (_) {}
  g.font = "600 30px Oswald, 'Arial Narrow', sans-serif"; g.fillStyle = '#8dff2b';
  g.fillText(String(title).toUpperCase().slice(0, 34), W / 2, 206);
  g.font = "600 22px Oswald, 'Arial Narrow', sans-serif"; g.fillStyle = '#c47bff';
  g.fillText(mode.toUpperCase(), W / 2, 244);
  g.font = "600 26px Oswald, 'Arial Narrow', sans-serif"; g.fillStyle = '#f2efe9';
  g.fillText('SLIMEBY.COM', W / 2, H - 70);
  g.font = "600 18px Oswald, 'Arial Narrow', sans-serif"; g.fillStyle = '#b9b3a8';
  g.fillText('☠ MADE IN THE LAB ☠', W / 2, H - 38);
  return o;
}

export function attachRecorder(section, lab, S) {
  if (typeof MediaRecorder === 'undefined' || typeof MediaStream === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const P0 = S.player();
  if (!P0 || !P0.captureStream) return null;
  const mime = pickMime();
  const wrap = section.querySelector('.vbtn') || section;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bigbtn bAlien vrecbtn';
  btn.textContent = '● rec a clip';
  btn.setAttribute('data-track', 'record clip');
  btn.title = 'record a 15s vertical clip of the visualizer with the track you’re bending';
  wrap.appendChild(btn);
  wrap.classList.add('has-rec');

  let rec = null, lastUrl = null;
  const site = () => S.site();
  const toast = (m) => { try { site().toast(m); } catch (_) {} };

  function tick() {
    if (!rec) return;
    const left = SECS - (performance.now() - rec.t0) / 1000;
    btn.textContent = '■ stop · ' + Math.max(0, Math.ceil(left)) + 's';
    if (left <= 0) stop();
  }
  function stop() { if (rec && rec.mr.state !== 'inactive') { try { rec.mr.stop(); } catch (_) { finish(rec); } } }

  function start() {
    const P = S.player(); if (!P) return;
    if (P.mode && P.mode() === 'yt') { toast('switch to the site player to record — youtube audio can’t be captured'); return; }
    if (!P.isPlaying()) P.start();
    const tap = P.captureStream();
    if (!tap) { toast('clip recording isn’t supported in this browser'); return; }
    const comp = document.createElement('canvas'); comp.width = W; comp.height = H;
    const g = comp.getContext('2d');
    const title = (P.title && P.title()) || 'Slime By';
    const ov = overlay(title, modeLabel(S.lab));
    const vs = comp.captureStream(30);
    const stream = new MediaStream([...vs.getVideoTracks(), ...tap.stream.getAudioTracks()]);
    let mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6, audioBitsPerSecond: 192000 } : undefined); }
    catch (_) { try { mr = new MediaRecorder(stream); } catch (e) { tap.release(); toast('clip recording isn’t supported in this browser'); return; } }
    const r = { mr, tap, vs, chunks: [], title, t0: performance.now(), timer: 0, aborted: false, type: mr.mimeType || mime || 'video/webm' };
    rec = r;
    mr.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    mr.onstop = () => finish(r);
    g.fillStyle = '#050804'; g.fillRect(0, 0, W, H);
    lab.startRecord(W, H, (src) => { g.drawImage(src, 0, 0, W, H); g.drawImage(ov, 0, 0); });
    mr.start(250);
    r.timer = setInterval(tick, 200); tick();
    section.classList.add('recording'); btn.classList.add('on');
    btn.setAttribute('aria-pressed', 'true');
  }

  function finish(r) {
    if (r.done) return; r.done = true;
    clearInterval(r.timer);
    try { r.tap.release(); } catch (_) {}
    try { r.vs.getTracks().forEach((t) => t.stop()); } catch (_) {}
    try { lab.stopRecord(); } catch (_) {}
    section.classList.remove('recording'); btn.classList.remove('on');
    btn.textContent = '● rec a clip'; btn.removeAttribute('aria-pressed');
    if (rec === r) rec = null;
    if (r.aborted || !r.chunks.length) return;
    const type = r.type.split(';')[0] || 'video/webm', ext = /mp4/.test(type) ? 'mp4' : 'webm';
    const blob = new Blob(r.chunks, { type });
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    const url = lastUrl = URL.createObjectURL(blob);
    const name = ('slime-by-' + r.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-clip.' + ext;
    let file = null; try { file = new File([blob], name, { type }); } catch (_) {}
    const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    const secs = Math.round((performance.now() - r.t0) / 1000);
    try { site().track('clip_record', { track: r.title, secs, fmt: ext }); } catch (_) {}
    site().openModal(`<div class="mbody clipbody"><span class="kicker">☠ your clip</span><h3>${esc(r.title)} <em>· the lab</em></h3>
      <video class="clipvid" src="${url}" playsinline loop muted autoplay controls></video>
      <div class="mcta clipcta">${canShare ? '<button class="bigbtn bSlime" id="clipShare" type="button">↗ share</button>' : ''}<a class="bigbtn ${canShare ? 'bBlood' : 'bSlime'}" id="clipDl" href="${url}" download="${esc(name)}">⤓ download</a></div>
      <div class="joinnote" style="text-align:left;margin-top:12px">${ext === 'mp4' ? 'vertical 9:16 mp4 — ready for tiktok, reels + shorts. tag @slimeby_sb ☠' : 'saved as webm — most apps take it; if one doesn’t, record on iPhone / Safari for mp4. tag @slimeby_sb ☠'}</div></div>`);
    const v = document.querySelector('#modal .clipvid');
    if (v) v.addEventListener('volumechange', () => { const P = S.player(); if (!v.muted && !v.paused && P && P.isPlaying()) P.toggle(); });
    const sh = document.getElementById('clipShare');
    if (sh) sh.onclick = () => {
      navigator.share({ files: [file], title: 'Slime By — ' + r.title, text: 'made in the lab · slimeby.com' })
        .then(() => { try { site().track('clip_share', { track: r.title }); } catch (_) {} })
        .catch(() => {});
    };
    const dl = document.getElementById('clipDl');
    if (dl) dl.addEventListener('click', () => { try { site().track('clip_download', { track: r.title }); } catch (_) {} });
  }

  btn.onclick = () => (rec ? stop() : start());

  return {
    dispose() {
      if (rec) { rec.aborted = true; stop(); finish(rec); }
      btn.remove(); wrap.classList.remove('has-rec');
      if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null; }
    },
  };
}
