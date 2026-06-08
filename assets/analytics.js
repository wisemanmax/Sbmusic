/* ============================================================
   SLIME BY — first-party analytics (privacy-light, no consent
   banner needed: anonymous, first-party only, no cross-site
   tracking, no PII).

   Logs pageviews, clicks, scroll depth and an exit beacon
   straight to Supabase with the publishable key — anon INSERT
   only (see migration 20260608130000_create_analytics_events).
   The admin reads aggregates through the password-checked edge
   function; raw rows are never readable with the public key.

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

  /* ---- ids: an anonymous visitor (persistent) + a session (30-min idle gap) ---- */
  var SESSION_GAP = 30 * 60 * 1000;
  function rid() {
    try { return crypto.randomUUID(); }
    catch (_) { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); }
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }

  var visitorId = lsGet('sb_vid');
  if (!visitorId) { visitorId = rid(); lsSet('sb_vid', visitorId); }

  // a session id lives in sessionStorage; the last-activity stamp lives in localStorage
  // so a session that idles past the gap (even across tab reopen) starts fresh, like GA.
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
    var e = { visitor_id: visitorId, session_id: sessionId(), type: type, page: PAGE };
    if (fields) for (var k in fields) if (fields[k] != null) e[k] = fields[k];
    queue.push(e);
    if (type === 'exit') flush(true); else schedule();
  }

  /* public hook for meaningful custom events, e.g. sbTrack('play', {track:'…'}) */
  window.sbTrack = function (name, meta) {
    if (!name) return;
    record('event', { target: String(name).slice(0, 300), meta: meta || null });
  };

  /* ---- pageview ---- */
  var ref = firstHit ? refHost() : '';
  record('pageview', {
    referrer: ref ? ref.slice(0, 512) : null,
    meta: { title: (document.title || '').slice(0, 200) },
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
})();
