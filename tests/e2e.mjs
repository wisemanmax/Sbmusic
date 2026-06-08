/* ============================================================
   SLIME BY — end-to-end smoke + security suite
   No test runner / config: a tiny static server + Playwright.
   Run with:  npm run test:e2e
   ============================================================ */
import http from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.mp3':'audio/mpeg', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('404'); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];
const check = (name, ok, extra='') => { results.push({ name, ok: !!ok }); console.log((ok?'  ✅':'  ❌'), name, ok?'':('— '+extra)); };
const group = (n) => console.log('\n• ' + n);

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });

try {
  // ---------------------------------------------------------------
  group('sanitization + XSS');
  {
    const page = await browser.newPage();
    let xss = false;
    page.on('dialog', d => { xss = true; d.dismiss().catch(()=>{}); });
    await page.exposeFunction('__xss', () => { xss = true; });
    await page.goto(base + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(700);
    const s = await page.evaluate(() => ({
      js: safeUrl('javascript:alert(1)'), tab: safeUrl('java\tscript:alert(1)'),
      dataTxt: safeUrl('data:text/html,x'), https: safeUrl('https://x.com/a'),
      imgData: safeImg('data:image/png;base64,AAAA'), imgJs: safeImg('javascript:alert(1)'),
      htmlScript: sanitizeHtml('<b>ok</b><script>__xss()</script>'),
      htmlImg: sanitizeHtml('<img src=x onerror=__xss()>hi'),
      color: safeColor('red;background:url(x)'),
    }));
    check('safeUrl drops javascript:', s.js === '');
    check('safeUrl drops tab-smuggled javascript:', s.tab === '');
    check('safeUrl drops data:text/html', s.dataTxt === '');
    check('safeUrl keeps https', s.https === 'https://x.com/a');
    check('safeImg keeps data:image, drops javascript:', s.imgData.startsWith('data:image/') && s.imgJs === '');
    check('sanitizeHtml strips <script>, keeps <b>', !/script/i.test(s.htmlScript) && /<b>ok<\/b>/.test(s.htmlScript));
    check('sanitizeHtml strips <img onerror>', !/onerror|img/i.test(s.htmlImg) && s.htmlImg.includes('hi'));
    check('safeColor rejects CSS injection', s.color === '');
    await page.evaluate(() => applyContent({
      hero:{ title:'X', sub:'safe <b>b</b> <img src=x onerror="__xss()"><script>__xss()</script>' },
      music:{ releases:[{ title:'r', sub:'s', url:'javascript:__xss()', img:'javascript:__xss()' }] },
    }));
    await page.waitForTimeout(300);
    await page.evaluate(() => new Promise(r => { window.postMessage({ __sb:'preview', content:{ hero:{ title:'PWNED' } } }, '*'); setTimeout(r, 250); }));
    const title = await page.evaluate(() => (document.querySelector('.hero h1.glitch')||{}).textContent || '');
    check('malicious CMS + spoofed preview never execute', xss === false);
    check('spoofed preview postMessage ignored', title !== 'PWNED');
    await page.close();
  }

  // ---------------------------------------------------------------
  group('player: persists across pages, normal by default, lab = slowed');
  {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { window.__alive = 'Y'; document.getElementById('audio').__persist = 'KEEP'; });
    await page.waitForTimeout(1200);
    const home = await page.evaluate(() => ({ paused: audio.paused, t: audio.currentTime, rate: audio.playbackRate }));
    check('index: playing at normal rate (≈1.0)', !home.paused && Math.abs(home.rate-1) < 0.001, 'rate='+home.rate);
    await page.click('#nav .navlinks a[href="music.html"]');
    await page.waitForFunction(() => location.pathname.endsWith('music.html'), null, { timeout: 5000 });
    await page.waitForTimeout(1200);
    const music = await page.evaluate(() => ({ alive: window.__alive==='Y', persist: document.getElementById('audio').__persist, paused: audio.paused, t: audio.currentTime, rels: document.querySelectorAll('#mgrid .rel').length }));
    check('music: no reload (same window + audio element)', music.alive && music.persist === 'KEEP');
    check('music: audio kept playing + advanced', !music.paused && music.t > home.t, `t ${home.t.toFixed(2)}→${music.t.toFixed(2)}`);
    check('music: releases rendered', music.rels > 0);
    await page.click('#nav .navlinks a[href="lab.html"]');
    await page.waitForFunction(() => location.pathname.endsWith('lab.html'), null, { timeout: 5000 });
    await page.waitForTimeout(900);
    const lab = await page.evaluate(() => ({ rate: audio.playbackRate, paused: audio.paused }));
    check('lab: playback is slowed (< 0.95)', lab.rate < 0.95 && !lab.paused, 'rate='+lab.rate);
    await page.click('#nav .navlinks a[href="music.html"]');
    await page.waitForFunction(() => location.pathname.endsWith('music.html'), null, { timeout: 5000 });
    await page.waitForTimeout(600);
    const back = await page.evaluate(() => audio.playbackRate);
    check('leaving lab restores normal rate', Math.abs(back-1) < 0.001, 'rate='+back);
    check('player flow: no JS errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------
  group('accessibility: modal focus management');
  {
    const page = await browser.newPage();
    await page.goto(base + '/world.html', { waitUntil: 'load' });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      const o = document.querySelector('#nav .navlinks a'); o.id = o.id || '__opener'; o.focus();
      openModal('<div class="mbody"><h3>Dialog</h3><a href="https://ok.com">l</a></div>');
    });
    await page.waitForTimeout(450);
    const m = await page.evaluate(() => ({ onClose: document.activeElement && document.activeElement.id==='modalX', labelled: !!document.getElementById('modal').getAttribute('aria-labelledby') }));
    check('modal: focus moves to close button', m.onClose);
    check('modal: aria-labelledby set from heading', m.labelled);
    await page.evaluate(() => { const f = _modalFocusable(); f[f.length-1].focus(); });
    await page.keyboard.press('Tab');
    check('modal: Tab wraps (focus trapped)', await page.evaluate(() => document.activeElement && document.activeElement.id==='modalX'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    check('modal: Escape closes + restores focus to opener', await page.evaluate(() => !document.getElementById('modal').classList.contains('open') && document.activeElement && document.activeElement.id==='__opener'));
    await page.close();
  }

  // ---------------------------------------------------------------
  group('reduced motion');
  {
    const page = await browser.newPage();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + '/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(700);
    const rm = await page.evaluate(() => {
      audio.pause();
      // `embers` is a top-level binding (not on window) — read it directly so this
      // actually asserts emit() was suppressed instead of comparing 0 to 0.
      const before = embers.length;
      for (let i=0;i<50;i++) emit(100,100,1);
      return { flag: sbReduceMotion, added: embers.length - before };
    });
    check('prefers-reduced-motion detected', rm.flag === true);
    check('reduced-motion: passive cursor embers suppressed', rm.added === 0);
    await page.close();
  }

  // ---------------------------------------------------------------
  group('join form: consent gate + retry queue (no permanent PII)');
  {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    // Intercept the sign-up POST so the test never depends on (or pollutes) the real
    // Supabase backend. `mode` lets each sub-test pick the response sbSubscribe should see.
    let mode = 'offline';
    await page.route('**/rest/v1/subscribers**', route => {
      if (mode === 'offline') return route.abort();            // network failure → fetch throws
      if (mode === 'ok') return route.fulfill({ status: 201, body: '' });
      if (mode === 'dup') return route.fulfill({ status: 409, body: '' });
      return route.fulfill({ status: 500, body: 'err' });
    });
    await page.goto(base + '/connect.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    await page.fill('#gemail', 'fan@example.com');
    await page.click('#join button');
    await page.waitForTimeout(300);
    const noConsent = await page.evaluate(() => ({ note: joinnote.textContent, pending: localStorage.getItem('sb_pending') }));
    check('no consent → submission blocked, nothing stored', /tick the box/i.test(noConsent.note) && !noConsent.pending);
    await page.check('#gconsent');
    await page.click('#join button');
    await page.waitForTimeout(1500);
    const withConsent = await page.evaluate(() => ({ pending: JSON.parse(localStorage.getItem('sb_pending')||'null'), list: localStorage.getItem('sb_list'), cleared: document.getElementById('gemail').value==='' }));
    check('consent + offline → queued under sb_pending, no sb_list', Array.isArray(withConsent.pending) && withConsent.pending.length===1 && !withConsent.list);
    check('join form cleared after submit', withConsent.cleared);

    // Backend reachable → a successful insert (201) must land AND flush the queued entry,
    // leaving sb_pending empty. This is the regression guard for the ON CONFLICT + RLS bug
    // that silently queued every sign-up forever.
    mode = 'ok';
    await page.check('#gconsent');
    await page.fill('#gemail', 'fan2@example.com');
    await page.click('#join button');
    await page.waitForTimeout(1500);
    const ok = await page.evaluate(() => ({ pending: JSON.parse(localStorage.getItem('sb_pending')||'null'), note: joinnote.textContent }));
    check('success (201) → not queued, queue flushed', (!ok.pending || ok.pending.length===0) && /you in/i.test(ok.note));

    // A duplicate (409) means the address is already subscribed — treated as success, not re-queued.
    mode = 'dup';
    await page.check('#gconsent');
    await page.fill('#gemail', 'fan3@example.com');
    await page.click('#join button');
    await page.waitForTimeout(800);
    const dup = await page.evaluate(() => ({ pending: JSON.parse(localStorage.getItem('sb_pending')||'null'), note: joinnote.textContent }));
    check('duplicate (409) → treated as success, not queued', (!dup.pending || dup.pending.length===0) && /you in/i.test(dup.note));

    check('connect: no JS errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }

  // ---------------------------------------------------------------
  group('persistent music bar follows CMS');
  {
    const page = await browser.newPage();
    await page.goto(base + '/world.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      applyContent({ music: { playerTitle: 'STALE OVERRIDE', playerCover: 'assets/slime-by.jpg', releases: [] } });
      return { title: document.querySelector('#musicbar .stitle').textContent, disc: document.getElementById('disc').style.backgroundImage, track: curTrack().title };
    });
    // cover still follows CMS; the title is the LIVE track and a stale CMS playerTitle can't override it
    check('bar cover follows CMS; title stays the live track', /slime-by\.jpg/.test(r.disc) && r.title === r.track && r.title !== 'STALE OVERRIDE', JSON.stringify(r));
    await page.close();
  }

  // ---------------------------------------------------------------
  group('shows: ticket links sanitized');
  {
    const page = await browser.newPage();
    let xss = false;
    page.on('dialog', d => { xss = true; d.dismiss().catch(()=>{}); });
    await page.exposeFunction('__xss', () => { xss = true; });
    await page.goto(base + '/shows.html', { waitUntil: 'load' });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      renderShows([
        { date:'JUL 4', venue:'Bad', city:'X', url:'javascript:__xss()' },
        { date:'JUL 5', venue:'Good', city:'Y', url:'https://tickets.com/sb' },
      ]);
      const as = [...document.querySelectorAll('#showlist a.tix')];
      return { hrefs: as.map(a => a.getAttribute('href') || '') };
    });
    await page.waitForTimeout(150);
    check('shows: javascript: ticket URL dropped (renders no link)', !r.hrefs.some(h => /javascript:/i.test(h)));
    check('shows: safe ticket URL kept', r.hrefs.includes('https://tickets.com/sb'));
    check('shows: malicious ticket link never executes', xss === false);
    await page.close();
  }

  // ---------------------------------------------------------------
  group('local playlist: the uploaded catalog cycles + loops');
  {
    const page = await browser.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(base + '/music.html', { waitUntil: 'load' });
    await page.waitForTimeout(1200);
    const has = await page.evaluate(() => ({
      prev: !!document.getElementById('prevbtn'), next: !!document.getElementById('nextbtn'),
      count: Array.isArray(LOCAL_TRACKS) ? LOCAL_TRACKS.length : 0,
      first: (LOCAL_TRACKS[0]||{}).title, last: (LOCAL_TRACKS[LOCAL_TRACKS.length-1]||{}).title,
    }));
    check('playlist: skip buttons present in the music bar', has.prev && has.next);
    check('playlist: My Time catalog + Man Of My Word loaded in order', has.count === 11 && has.first === 'My Time' && has.last === 'Man Of My Word', 'count='+has.count);
    const r = await page.evaluate(async () => {
      loadTrack(0, true);
      await new Promise(s => setTimeout(s, 250));
      audio.currentTime = 5;
      bgPrev();   // >3s in → restart the current song, don't change track
      await new Promise(s => setTimeout(s, 150));
      return { mode: bgMode, t: audio.currentTime, idx: trackIdx };
    });
    check('playlist: prev mid-track restarts the current song', r.mode === 'local' && r.t < 1.5 && r.idx === 0, 't='+r.t+' idx='+r.idx);
    const nx = await page.evaluate(async () => {
      // simulate a stale published CMS title — it must NOT override the live track's name
      window.SB = window.SB || {}; window.SB.music = Object.assign({}, window.SB.music, { playerTitle: 'Man Of My Word' });
      loadTrack(0, false);
      bgNext();   // advance to track 2
      await new Promise(s => setTimeout(s, 200));
      return { idx: trackIdx, title: document.querySelector('#musicbar .stitle').textContent, src: decodeURIComponent(audio.getAttribute('src')||'') };
    });
    check('playlist: next advances + shows the track name (not a stale CMS title)', nx.idx === 1 && nx.title === 'Turn This Up' && /Turn This Up/.test(nx.src), JSON.stringify(nx));
    const wrap = await page.evaluate(() => {
      loadTrack(LOCAL_TRACKS.length, false);   // one past the end → wraps to the first
      const a = trackIdx;
      loadTrack(-1, false);                     // before the first → wraps to the last
      const b = trackIdx;
      loadTrack(0, false);
      return { a, b, last: LOCAL_TRACKS.length - 1 };
    });
    check('playlist: index wraps around both ends', wrap.a === 0 && wrap.b === wrap.last, JSON.stringify(wrap));
    const skip = await page.evaluate(async () => {
      _skipGuard = 0;
      loadTrack(3, true);   // NightTime — an empty/corrupt upload that can't decode
      await new Promise(s => setTimeout(s, 1000));
      const landed = trackIdx;
      loadTrack(0, false);  // reset for the next sub-test
      return landed;
    });
    check('playlist: a broken track is auto-skipped, not stuck', skip !== 3, 'idx='+skip);
    const duck = await page.evaluate(async () => {
      loadTrack(0, true);
      await new Promise(s => setTimeout(s, 250));
      const wasPlaying = !audio.paused;
      openModal('<div class="mbody"><h3>Clip</h3><div class="vembed"><iframe src="about:blank" title="x"></iframe></div></div>');
      await new Promise(s => setTimeout(s, 150));
      const duckedPaused = audio.paused;
      closeModal();
      await new Promise(s => setTimeout(s, 300));
      return { wasPlaying, duckedPaused, resumed: !audio.paused };
    });
    check('playlist: ducks for an embedded video, resumes on close', duck.wasPlaying && duck.duckedPaused && duck.resumed);
    check('playlist: skip controls raise no JS errors', errs.length === 0, errs.join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length) { console.log('FAILED:', failed.map(f=>f.name).join('; ')); process.exit(1); }
process.exit(0);
