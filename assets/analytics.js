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
      bar.style.cssText = [
        'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:2147483000',
        'max-width:680px', 'margin:0 auto', 'padding:14px 16px',
        'background:#0c140c', 'color:#dfeede',
        'border:1px solid #2f5d2f', 'border-radius:14px',
        'box-shadow:0 10px 40px rgba(0,0,0,.5)',
        'font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
      ].join(';');
      bar.innerHTML =
        '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
          '<div style="flex:1 1 280px;min-width:240px">' +
            '<strong style="color:#5fe05f">We use first-party analytics.</strong> ' +
            'If you accept, we record how the site is used (pages, clicks, scroll, time) ' +
            'plus your device type, browser, OS, language and timezone — so we can improve ' +
            'the site and our drops. No cross-site tracking, no selling your data. ' +
            '<a href="privacy.html" style="color:#7ef07e;text-decoration:underline">Privacy policy</a>.' +
          '</div>' +
          '<div style="display:flex;gap:8px;flex:0 0 auto">' +
            '<button type="button" id="sb-consent-no" ' +
              'style="cursor:pointer;padding:9px 14px;border-radius:10px;border:1px solid #3a3a3a;' +
              'background:transparent;color:#cfcfcf;font:inherit">Decline</button>' +
            '<button type="button" id="sb-consent-yes" ' +
              'style="cursor:pointer;padding:9px 16px;border-radius:10px;border:0;' +
              'background:#3fb53f;color:#06210a;font:inherit;font-weight:700">Accept</button>' +
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

    var visitorId = lsGet('sb_vid');
    if (!visitorId) { visitorId = rid(); lsSet('sb_vid', visitorId); }

    // a session id lives in sessionStorage; the last-activity stamp lives in
    // localStorage so a session that idles past the gap starts fresh, like GA.
    function sessionId() {
      var now = Date.now();
      var id = ssGet('sb_sid');
      var last = parseInt(lsGet('sb_sid_t') || '0', 10);
      if (!id || !last || (now - last) > SESSION_GAP) { id = rid(); ssSet('sb_sid', id); }
      lsSet('sb_sid_t', String(now));
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
    var ref = firstHit ? refHost() : '';
    record('pageview', {
      referrer: ref ? ref.slice(0, 512) : null,
      meta: {
        title: (document.title || '').slice(0, 200),
        screen: ENV.screen, lang: ENV.lang, tz: ENV.tz, conn: ENV.conn || null,
      },
    });

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
    document.addEventListener('click', function (ev) {
      var el = ev.target && ev.target.closest && ev.target.closest('a,button,[data-track],[role="button"]');
      if (!el) return;
      var label = labelFor(el);
      if (label) record('click', { target: label });
    }, true);

    /* ---- scroll depth: track the furthest % of the page reached ---- */
    var maxDepth = 0;
    addEventListener('scroll', function () {
      var h = document.documentElement;
      var denom = h.scrollHeight - h.clientHeight;
      var d = denom > 0 ? Math.round((h.scrollTop / denom) * 100) : 0;
      if (d > maxDepth) maxDepth = Math.min(100, Math.max(0, d));
    }, { passive: true });

    /* ---- exit / "where they leave off": time-on-page + how far they scrolled.
           The exit *page* is derived server-side as the last pageview of a session,
           so it's reliable even if this beacon is dropped. Fires once. ---- */
    var t0 = Date.now();
    var sent = false;
    function exit() {
      if (sent) return; sent = true;
      record('exit', { meta: { seconds: Math.round((Date.now() - t0) / 1000), depth: maxDepth } });
    }
    // visibilitychange→hidden is the most reliable end-of-visit signal (esp. mobile);
    // pagehide covers the rest. Both are guarded so we only send one exit per page load.
    addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') exit(); });
    addEventListener('pagehide', exit);
  }
})();
