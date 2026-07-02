/* ============================================================
   SLIME BY — first-party analytics (consent-gated, in-depth).

   On first visit it shows a consent banner. NOTHING is tracked
   until the visitor presses "Accept": no visitor id is written,
   no events are sent, no device details are read. On accept it
   records first-party pageviews, clicks, scroll depth, an exit
   beacon AND the visitor's device class (mobile/tablet/desktop),
   browser + OS family, screen-size bucket, language and timezone
   — straight to Supabase with the publishable key (anon INSERT
   only, see migration 20260608140000_analytics_consent_dimensions).
   On decline it stores the choice and stays silent.

   The DEEP layer (same consent, same first-party boundary):
   • listen depth   — which track is playing and how far it gets
                      (25/50/75/95% milestones via the site player)
   • outbound       — which platform a fan leaves to (Spotify /
                      Apple / YouTube / IG / TikTok / other host)
   • campaigns      — utm_* params + ad-click ids present on the
                      ENTRY url of a session (first-touch)
   • new/returning  — whether this visitor id was just created
   • web vitals     — LCP / CLS / TTFB / load time + whether the
                      perf governor's lite mode is on (real-user
                      performance, e.g. "is Chrome lagging?")
   • js errors      — first 3 errors per page (message + file:line)
   • perf_lite      — the adaptive governor flipping lite mid-visit

   We deliberately do NOT fingerprint, do NOT persist IP addresses
   from the client, and do NOT track across sites — so this stays
   first-party and honest. The admin reads aggregates through the
   password-checked edge function; raw rows are never readable with
   the public key.

   Auto-injected by assets/app.js on every public page. It never
   runs on the admin page or inside the editor preview.
   ============================================================ */
(function () {
  'use strict';
  if (window.__sbAnalytics) return;            // double-include guard
  window.__sbAnalytics = true;

  var CFG = window.SB_CFG;
  if (!CFG || !CFG.url || !CFG.key) return;                 // no backend configured
  if (/[?&]preview\b/.test(location.search)) return;        // editor preview — don't log
  if (/(^|\/)admin\.html$/i.test(location.pathname)) return; // never track the admin
  // skip local dev / CI / the test server so internal traffic never pollutes the data
  if (/^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(location.hostname)) return;

  var ENDPOINT = CFG.url + '/rest/v1/analytics_events';
  var HEADERS = {
    'Content-Type': 'application/json',
    apikey: CFG.key,
    Authorization: 'Bearer ' + CFG.key,
    Prefer: 'return=minimal',
  };

  /* ---- storage helpers ---- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  function rid() {
    try { return crypto.randomUUID(); }
    catch (_) { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }
  }

  /* ============================================================
     CONSENT GATE — the whole tracker is dormant until the visitor
     opts in. 'granted' → track; 'denied' → stay silent; null → ask.
     ============================================================ */
  var CONSENT_KEY = 'sb_consent';
  var consent = lsGet(CONSENT_KEY);            // 'granted' | 'denied' | null

  if (consent === 'granted') {
    start();
  } else if (consent !== 'denied') {
    showBanner();                              // first visit: ask, track nothing yet
  }

  function showBanner() {
    if (document.getElementById('sb-consent')) return;
    function build() {
      if (document.getElementById('sb-consent')) return;
      var bar = document.createElement('div');
      bar.id = 'sb-consent';
      bar.setAttribute('role', 'dialog');
      bar.setAttribute('aria-live', 'polite');
      bar.setAttribute('aria-label', 'Privacy & analytics consent');
      /* styled to match the site (dark panel, slime accent) instead of the old generic grey */
      bar.style.cssText = [
        'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:2147483000',
        'max-width:680px', 'margin:0 auto', 'padding:16px 18px',
        'background:rgba(10,8,6,.96)', 'color:#e8f3e2',
        'border:1px solid rgba(141,255,43,.45)', 'border-radius:4px',
        'box-shadow:0 16px 50px rgba(0,0,0,.65), 0 0 28px rgba(141,255,43,.12)',
        "font:14px/1.5 'Oswald',system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
        'letter-spacing:.2px'
      ].join(';');
      bar.innerHTML =
        '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
          '<div style="flex:1 1 280px;min-width:240px">' +
            '<strong style="color:#8dff2b;letter-spacing:1px">☠ FIRST-PARTY ANALYTICS.</strong> ' +
            'If you accept, we record how the site is used (pages, clicks, scroll, time, which tracks ' +
            'get played &amp; which platforms you tap out to) plus your device type, browser, OS, language, ' +
            'timezone and anonymous performance/error reports — so we can improve the site and our drops. ' +
            'No cross-site tracking, no selling your data. ' +
            '<a href="privacy.html" style="color:#b6ff5a;text-decoration:underline">Privacy policy</a>.' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex:0 0 auto">' +
            '<button type="button" id="sb-consent-no" ' +
              'style="cursor:pointer;padding:10px 16px;border:1px solid rgba(255,255,255,.28);' +
              'background:transparent;color:#cfcfc6;font:inherit;font-weight:600;letter-spacing:1px;text-transform:uppercase;font-size:12px">Decline</button>' +
            '<button type="button" id="sb-consent-yes" ' +
              'style="cursor:pointer;padding:10px 18px;border:1px solid #8dff2b;' +
              'background:#8dff2b;color:#08120a;font:inherit;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-size:12px;' +
              'box-shadow:0 0 18px rgba(141,255,43,.35)">Accept ☠</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(bar);
      document.getElementById('sb-consent-yes').addEventListener('click', function () {
        lsSet(CONSENT_KEY, 'granted'); removeBanner(); start();
      });
      document.getElementById('sb-consent-no').addEventListener('click', function () {
        lsSet(CONSENT_KEY, 'denied'); removeBanner();
      });
    }
    if (document.body) build();
    else addEventListener('DOMContentLoaded', build);
  }
  function removeBanner() {
    var b = document.getElementById('sb-consent');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  /* Public hook so a footer "privacy settings" link can re-open the choice. */
  window.sbConsent = function (choice) {
    if (choice === 'granted' || choice === 'denied') {
      lsSet(CONSENT_KEY, choice); removeBanner();
      if (choice === 'granted' && !window.__sbStarted) start();
    } else if (choice === 'reset') {
      try { localStorage.removeItem(CONSENT_KEY); } catch (_) {}
      showBanner();
    }
    return lsGet(CONSENT_KEY);
  };

  /* ============================================================
     TRACKER — only runs after consent === 'granted'.
     ============================================================ */
  function start() {
    if (window.__sbStarted) return;
    window.__sbStarted = true;

    var SESSION_GAP = 30 * 60 * 1000;

    var isNewVisitor = false;
    var visitorId = lsGet('sb_vid');
    if (!visitorId) { visitorId = rid(); lsSet('sb_vid', visitorId); isNewVisitor = true; }

    // a session id lives in sessionStorage; the last-activity stamp lives in
    // localStorage so a session that idles past the gap starts fresh, like GA.
    var _sidStamped = 0;
    function sessionId() {
      var now = Date.now();
      var id = ssGet('sb_sid');
      var last = parseInt(lsGet('sb_sid_t') || '0', 10);
      if (!id || !last || (now - last) > SESSION_GAP) { id = rid(); ssSet('sb_sid', id); }
      // refresh the last-activity stamp at most every 15s — sessionId() runs on EVERY
      // recorded event, and a synchronous localStorage write per click/scroll-milestone
      // is main-thread work the 30-minute session gap doesn't need.
      if (now - _sidStamped > 15000) { _sidStamped = now; lsSet('sb_sid_t', String(now)); }
      return id;
    }

    var PAGE = (location.pathname + location.search).slice(0, 256);
    function refHost() {
      try { return document.referrer ? new URL(document.referrer).host : ''; }
      catch (_) { return ''; }
    }
    // attribute a referrer only on the entry hit of a session (GA-style)
    var firstHit = !ssGet('sb_ref_done');
    ssSet('sb_ref_done', '1');

    /* ---- campaign attribution: utm_* params + ad-click ids on the ENTRY url.
           First-touch per session (stored once), so a campaign visit keeps its
           attribution across in-app navigation without re-parsing every page. ---- */
    function utmData() {
      try {
        var cached = ssGet('sb_utm');
        if (cached != null) return cached === '' ? null : JSON.parse(cached);
        var q = new URLSearchParams(location.search), o = {}, has = false;
        ['source', 'medium', 'campaign', 'term', 'content'].forEach(function (k) {
          var v = q.get('utm_' + k);
          if (v) { o[k] = String(v).slice(0, 80); has = true; }
        });
        ['fbclid', 'gclid', 'ttclid', 'igshid', 'igsh'].forEach(function (k) {
          if (q.get(k) && !o.ad) { o.ad = k; has = true; }   // presence only, never the id value
        });
        ssSet('sb_utm', has ? JSON.stringify(o) : '');
        return has ? o : null;
      } catch (_) { return null; }
    }

    /* ---- device / browser / os / context (parsed from the UA + a couple of
            safe client hints; coarse on purpose — buckets, not fingerprints) ---- */
    var ENV = detectEnv();
    function detectEnv() {
      var ua = navigator.userAgent || '';
      var uaData = navigator.userAgentData || null;
      // device class: prefer the client-hint mobile flag, fall back to the UA
      var device = 'desktop';
      if (uaData && typeof uaData.mobile === 'boolean') {
        device = uaData.mobile ? 'mobile' : 'desktop';
      } else if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
        device = 'tablet';
      } else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) {
        device = 'mobile';
      }
      // iPadOS reports a desktop Safari UA; the touch-point check catches it
      if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) device = 'tablet';
      // os family
      var os = 'Other';
      if (/Windows/i.test(ua)) os = 'Windows';
      else if (/Android/i.test(ua)) os = 'Android';
      else if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) os = 'iOS';
      else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
      else if (/CrOS/i.test(ua)) os = 'ChromeOS';
      else if (/Linux/i.test(ua)) os = 'Linux';
      // browser family (order matters — check the UA spoofers first)
      var browser = 'Other';
      if (/Edg\//i.test(ua)) browser = 'Edge';
      else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
      else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung';
      else if (/Firefox\/|FxiOS/i.test(ua)) browser = 'Firefox';
      else if (/Chrome\/|CriOS/i.test(ua)) browser = 'Chrome';
      else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = 'Safari';
      // coarse screen bucket (no exact pixel size stored)
      var w = (window.screen && screen.width) || 0;
      var screenBucket = w >= 1920 ? '1920+' : w >= 1280 ? '1280-1919'
        : w >= 768 ? '768-1279' : w >= 480 ? '480-767' : '<480';
      var lang = (navigator.language || '').slice(0, 12);
      var tz = '';
      try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 40); } catch (_) {}
      var conn = (navigator.connection && navigator.connection.effectiveType) || '';
      return { device: device, os: os, browser: browser,
               screen: screenBucket, lang: lang, tz: tz, conn: conn };
    }

    /* ---- queue + flush (keepalive fetch so the unload beacon still sends) ---- */
    var queue = [];
    var timer = null;
    function flush(keepalive) {
      if (!queue.length) return;
      var batch = queue.splice(0, queue.length);
      try {
        fetch(ENDPOINT, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(batch),
          keepalive: !!keepalive,
          mode: 'cors',
          credentials: 'omit',
        }).catch(function () {});
      } catch (_) {}
    }
    function schedule() {
      if (timer) return;
      timer = setTimeout(function () { timer = null; flush(false); }, 1500);
    }
    function record(type, fields) {
      var e = {
        visitor_id: visitorId, session_id: sessionId(), type: type, page: PAGE,
        device: ENV.device, browser: ENV.browser, os: ENV.os,
      };
      if (fields) for (var k in fields) if (fields[k] != null) e[k] = fields[k];
      queue.push(e);
      if (type === 'exit') flush(true); else schedule();
    }

    /* public hook for meaningful custom events, e.g. sbTrack('play', {track:'…'}) */
    window.sbTrack = function (name, meta) {
      if (!name) return;
      record('event', { target: String(name).slice(0, 300), meta: meta || null });
    };

    /* ---- pageview (carries the visit context in meta) ---- */
    function pageviewMeta() {
      var m = {
        title: (document.title || '').slice(0, 200),
        screen: ENV.screen, lang: ENV.lang, tz: ENV.tz, conn: ENV.conn || null,
      };
      if (isNewVisitor) { m.nv = 1; isNewVisitor = false; }   // flag the very first pageview only
      var utm = utmData(); if (utm) m.utm = utm;              // first-touch campaign for this session
      return m;
    }
    var ref = firstHit ? refHost() : '';
    record('pageview', { referrer: ref ? ref.slice(0, 512) : null, meta: pageviewMeta() });

    /* ---- click tracking (delegated; captures a human label for what was clicked) ---- */
    function labelFor(el) {
      var t = el.getAttribute('data-track')
           || el.getAttribute('aria-label')
           || (el.textContent || '').trim()
           || el.getAttribute('title')
           || (el.tagName === 'A' ? el.getAttribute('href') : '')
           || el.tagName.toLowerCase();
      return String(t).replace(/\s+/g, ' ').trim().slice(0, 120);
    }
    /* which platform an outbound host belongs to — the question an artist actually asks
       ("where do my fans tap out to?"), kept coarse on purpose */
    function platformOf(host) {
      host = String(host || '').toLowerCase();
      if (/spotify\./.test(host)) return 'spotify';
      if (/music\.apple|itunes\.apple/.test(host)) return 'apple music';
      if (/youtube\.|youtu\.be/.test(host)) return 'youtube';
      if (/instagram\./.test(host)) return 'instagram';
      if (/tiktok\./.test(host)) return 'tiktok';
      if (/soundcloud\./.test(host)) return 'soundcloud';
      if (/twitter\.|x\.com$/.test(host)) return 'x';
      if (/facebook\./.test(host)) return 'facebook';
      return 'other';
    }
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest && ev.target.closest('a,button,[data-track],[role="button"]');
      if (!el) return;
      var label = labelFor(el);
      if (label) record('click', { target: label });
      // outbound: a real external link → log the destination platform + host
      try {
        var a = el.tagName === 'A' ? el : (el.closest && el.closest('a[href]'));
        if (a && a.host && a.host !== location.host && /^https?:$/.test(a.protocol)) {
          record('event', { target: 'outbound', meta: {
            platform: platformOf(a.host), host: String(a.host).slice(0, 120), label: label.slice(0, 80) || null,
          } });
        }
      } catch (_) {}
    }, true);

    /* ---- scroll depth: track the furthest % of the page reached.
           scrollHeight/clientHeight are cached and re-measured off the hot path (they
           force a synchronous layout when read inside a scroll handler) — depth is a
           coarse percentage, so a slightly stale denominator is fine. ---- */
    var maxDepth = 0, _sdDenom = 0, _sdAt = 0;
    addEventListener('scroll', function () {
      var now = Date.now();
      if (now - _sdAt > 4000) {   // re-measure at most every 4s (resize / content growth)
        _sdAt = now;
        var h = document.documentElement;
        _sdDenom = h.scrollHeight - h.clientHeight;
      }
      var d = _sdDenom > 0 ? Math.round((window.scrollY / _sdDenom) * 100) : 0;
      if (d > maxDepth) maxDepth = Math.min(100, Math.max(0, d));
    }, { passive: true });

    /* ---- listen depth: how far each track ACTUALLY gets played.
           Binds to the site's persistent <audio> element (it lives outside <main>, so one
           binding survives all client-side navigation). Milestones fire once per loaded
           source; the title comes from the player bridge so it names the real track. ---- */
    (function bindListen() {
      var a = document.getElementById('audio');
      if (!a) { addEventListener('DOMContentLoaded', bindListen, { once: true }); return; }
      if (a.__sbListen) return; a.__sbListen = 1;
      var MS = [25, 50, 75, 95], hit = {};
      function title() {
        try { return ((window.SBPlayer && window.SBPlayer.title()) || '').slice(0, 80); }
        catch (_) { return ''; }
      }
      a.addEventListener('loadstart', function () { hit = {}; });
      a.addEventListener('timeupdate', function () {
        if (!a.duration || !isFinite(a.duration)) return;
        var pct = (a.currentTime / a.duration) * 100;
        for (var i = 0; i < MS.length; i++) {
          if (pct >= MS[i] && !hit[MS[i]]) {
            hit[MS[i]] = 1;
            record('event', { target: 'listen', meta: { track: title() || null, pct: MS[i] } });
          }
        }
      });
    })();

    /* ---- real-user performance: LCP / CLS / TTFB / load — plus whether the adaptive
           perf governor is in lite mode. This is how "the site lags in <browser>" stops
           being a guess: slice web_vitals by browser in the dashboard. Sent once. ---- */
    var _lcp = 0, _cls = 0;
    try {
      new PerformanceObserver(function (l) {
        var es = l.getEntries(); if (es.length) _lcp = es[es.length - 1].startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_) {}
    try {
      new PerformanceObserver(function (l) {
        l.getEntries().forEach(function (e) { if (!e.hadRecentInput) _cls += e.value; });
      }).observe({ type: 'layout-shift', buffered: true });
    } catch (_) {}
    var vitalsSent = false;
    function sendVitals() {
      if (vitalsSent) return; vitalsSent = true;
      try {
        var nav = (performance.getEntriesByType('navigation') || [])[0] || {};
        record('event', { target: 'web_vitals', meta: {
          lcp: Math.round(_lcp) || null,
          cls: Math.round(_cls * 1000) / 1000,
          ttfb: Math.round(nav.responseStart || 0) || null,
          load: Math.round(nav.loadEventEnd || 0) || null,
          lite: document.documentElement.classList.contains('sb-lite') ? 1 : 0,
        } });
      } catch (_) {}
    }
    if (document.readyState === 'complete') setTimeout(sendVitals, 3500);
    else addEventListener('load', function () { setTimeout(sendVitals, 3500); });

    /* ---- the adaptive perf governor flipping lite MID-VISIT (frame-rate watchdog) ---- */
    document.addEventListener('sb:lite', function (e) {
      var d = (e && e.detail) || {};
      if (!d.on) return;
      record('event', { target: 'perf_lite', meta: { avg_ms: d.avg_ms || null } });
    });

    /* ---- JS errors: the first few per page, so breakage in the field is visible ---- */
    var errN = 0;
    addEventListener('error', function (e) {
      if (errN >= 3 || !e) return; errN++;
      var src = (e.filename ? String(e.filename).split('/').pop() : '') + ':' + (e.lineno || 0);
      record('event', { target: 'js_error', meta: {
        msg: String(e.message || 'error').slice(0, 180), src: src.slice(0, 120),
      } });
    });
    addEventListener('unhandledrejection', function (e) {
      if (errN >= 3) return; errN++;
      var m = ''; try { m = String((e && e.reason && (e.reason.message || e.reason)) || ''); } catch (_) {}
      record('event', { target: 'js_error', meta: { msg: ('unhandled: ' + m).slice(0, 180) } });
    });

    /* ---- exit / "where they leave off": time-on-page + how far they scrolled.
           The exit *page* is derived server-side as the last pageview of a session,
           so it's reliable even if this beacon is dropped. Fires once. ---- */
    var t0 = Date.now();
    var sent = false;
    function exit() {
      if (sent) return; sent = true;
      sendVitals();   // make sure the perf sample isn't lost on a fast bounce
      record('exit', { meta: { seconds: Math.round((Date.now() - t0) / 1000), depth: maxDepth } });
    }
    // visibilitychange→hidden is the most reliable end-of-visit signal (esp. mobile);
    // pagehide covers the rest. Both are guarded so we only send one exit per page load.
    addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') exit(); });
    addEventListener('pagehide', exit);

    /* SPA hook: app.js swaps pages client-side without a full reload, so without this only
       the entry page is ever logged — every in-app navigation, its scroll depth and its
       time-on-page would be mis-attributed to that first page. app.js calls this on each
       client-side navigation: close out the page being left (time + depth), reset the
       per-page counters, then log the new pageview (no referrer — it's an internal hop). */
    window.sbPageview = function () {
      record('exit', { meta: { seconds: Math.round((Date.now() - t0) / 1000), depth: maxDepth } });
      PAGE = (location.pathname + location.search).slice(0, 256);
      maxDepth = 0; _sdAt = 0; t0 = Date.now(); sent = false;   // new page → re-measure depth denominator
      record('pageview', { meta: pageviewMeta() });
    };
  }
})();
