import { createClient } from "jsr:@supabase/supabase-js@2";

/* ── CORS ──────────────────────────────────────────────────────────────────────
   Reflect only allow-listed origins instead of "*". Auth here is token/password
   (not cookie) based, so "*" was not instantly catastrophic, but it let any site
   script login attempts and use a stolen token from any origin. Override the list
   with the ALLOWED_ORIGINS env (comma-separated) without redeploying. */
const DEFAULT_ORIGINS = [
  "https://slimeby.com",
  "https://www.slimeby.com",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
];
function allowedOrigins(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS");
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}
function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allow = allowedOrigins();
  const ok = allow.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allow[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(obj: unknown, status = 200, cors: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* ── login rate limiting ───────────────────────────────────────────────────────
   Best-effort per-IP throttle on *password* attempts (token auth is cryptographic
   and not throttled). Edge isolates are ephemeral so this is not a hard guarantee,
   but it blunts online brute force; pair with the CORS allowlist above. */
const RL = new Map<string, { count: number; first: number; lockUntil: number }>();
const RL_MAX = 8;                       // failures before lockout
const RL_WINDOW = 15 * 60 * 1000;       // counting window
const RL_LOCK = 15 * 60 * 1000;         // lockout duration
function clientIp(req: Request): string {
  // Proxies APPEND to X-Forwarded-For, so the first entry is whatever the client chose to
  // send (a fresh random value per request would defeat the throttle). Prefer the
  // platform-set header, else the LAST hop — correct whether the proxy appends or overwrites.
  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
  if (direct) return direct.trim();
  const xf = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return xf[xf.length - 1] || "unknown";
}
function rlLocked(ip: string): boolean {
  const e = RL.get(ip);
  return !!e && e.lockUntil > Date.now();
}
function rlFail(ip: string): void {
  const now = Date.now();
  let e = RL.get(ip);
  if (!e || now - e.first > RL_WINDOW) e = { count: 0, first: now, lockUntil: 0 };
  e.count++;
  if (e.count >= RL_MAX) e.lockUntil = now + RL_LOCK;
  RL.set(ip, e);
  if (RL.size > 5000) { // crude cap so the map can't grow unbounded
    for (const [k, v] of RL) { if (v.lockUntil < now && now - v.first > RL_WINDOW) RL.delete(k); }
  }
}
function rlReset(ip: string): void { RL.delete(ip); }

/* ── short-lived admin session token ──────────────────────────────────────────
   `login` verifies the password once and returns a signed, expiring token; every
   other call presents that token instead of replaying the raw password. HMAC-signed
   with a key derived from the service-role key (already in the function env), so no
   extra secret has to be provisioned. The token embeds the current session_version,
   so a password change (which bumps that version) instantly revokes outstanding
   tokens. The raw password is still accepted as a fallback so an expired token can
   never lock the admin out. */
const enc = new TextEncoder();
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
let _key: CryptoKey | null = null;
async function signingKey(): Promise<CryptoKey> {
  if (_key) return _key;
  const secret = Deno.env.get("ADMIN_TOKEN_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const material = await crypto.subtle.digest("SHA-256", enc.encode("sb-admin-token-v1:" + secret));
  _key = await crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return _key;
}
function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function makeToken(ver: number): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS, ver })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), enc.encode(payload)));
  return payload + "." + b64url(sig);
}
async function verifyToken(token: unknown, curVer: number): Promise<boolean> {
  try {
    const [payload, sig] = String(token).split(".");
    if (!payload || !sig) return false;
    const ok = await crypto.subtle.verify("HMAC", await signingKey(), unb64url(sig), enc.encode(payload));
    if (!ok) return false;
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    if (typeof data.exp !== "number" || data.exp <= Date.now()) return false;
    return (data.ver ?? 1) === curVer;   // revoked when the password (version) changes
  } catch {
    return false;
  }
}

/* ── password hashing (PBKDF2-HMAC-SHA256 via WebCrypto, no external dep) ──────
   Stored as `pbkdf2$<iterations>$<saltB64>$<hashB64>`. Legacy plaintext rows are
   still accepted once and transparently upgraded to a hash on the next successful
   login (see handler). */
const PBKDF2_ITERS = 210000;
function b64(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)); }
function unb64(s: string): Uint8Array { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
async function pbkdf2Bits(pw: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  const km = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iters, hash: "SHA-256" }, km, 256);
  return new Uint8Array(bits);
}
async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Bits(pw, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${b64(salt)}$${b64(hash)}`;
}
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function isHashed(stored: string): boolean { return typeof stored === "string" && stored.startsWith("pbkdf2$"); }
async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (isHashed(stored)) {
    const [, iterS, saltS, hashS] = stored.split("$");
    const iters = parseInt(iterS, 10) || PBKDF2_ITERS;
    const got = await pbkdf2Bits(pw, unb64(saltS), iters);
    return timingSafeEqual(got, unb64(hashS));
  }
  // legacy plaintext — constant-time compare
  return timingSafeEqual(enc.encode(pw), enc.encode(stored));
}

/* ── upload validation ─────────────────────────────────────────────────────────
   The admin UI restricts to images client-side, but a direct API caller with a
   valid token could push arbitrary content/size into the public media bucket. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2 MB of JSON — the whole site's content model is ~50 KB
const UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};

Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const { password, token, action, payload } = body ?? {};
    const ip = clientIp(req);

    // Single read of the admin config (password hash + current session version).
    const { data: cfg } = await admin
      .from("admin_config").select("password, session_version").eq("id", 1).single();
    const curVer: number = (cfg?.session_version) ?? 1;

    // Authorize via a valid session token (preferred) or the password (login + fallback).
    let authed = false;
    if (token) authed = await verifyToken(token, curVer);
    if (!authed && password) {
      if (rlLocked(ip)) return json({ error: "too many attempts, try again later" }, 429, cors);
      const ok = await verifyPassword(password, cfg?.password);
      if (ok) {
        authed = true;
        rlReset(ip);
        // transparently upgrade a legacy plaintext password to a hash on first use
        if (cfg?.password && !isHashed(cfg.password)) {
          try { await admin.from("admin_config").update({ password: await hashPassword(password) }).eq("id", 1); } catch { /* non-fatal */ }
        }
      } else {
        rlFail(ip);
      }
    }
    if (!authed) return json({ error: "unauthorized" }, 401, cors);

    if (action === "login") {
      return json({ ok: true, token: await makeToken(curVer) }, 200, cors);
    }

    if (action === "save") {
      // the content model is one JSON object; anything else would brick the editor's
      // next load (sbMerge would return the scalar), so refuse it here
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return json({ error: "payload must be a content object" }, 400, cors);
      }
      if (JSON.stringify(payload).length > MAX_CONTENT_BYTES) return json({ error: "content too large" }, 413, cors);
      // upsert: on a fresh database the id=1 row may not exist yet, and an UPDATE that
      // matches nothing reports success while publishing nothing
      const { error } = await admin.from("site_content")
        .upsert({ id: 1, data: payload, updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) return json({ error: error.message }, 400, cors);
      return json({ ok: true }, 200, cors);
    }

    if (action === "upload") {
      const { contentType, dataB64 } = payload ?? {};
      if (!dataB64) return json({ error: "missing file" }, 400, cors);
      const ext = UPLOAD_TYPES[String(contentType)];
      if (!ext) return json({ error: "unsupported file type" }, 415, cors);
      let bytes: Uint8Array;
      try { bytes = unb64(String(dataB64)); } catch { return json({ error: "invalid file data" }, 400, cors); }
      if (bytes.byteLength === 0) return json({ error: "empty file" }, 400, cors);
      if (bytes.byteLength > MAX_UPLOAD_BYTES) return json({ error: "file too large" }, 413, cors);
      // random object key — don't trust the client filename for the storage path
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await admin.storage.from("media")
        .upload(path, bytes, { contentType: String(contentType), upsert: false });
      if (error) return json({ error: error.message }, 400, cors);
      const { data: pub } = admin.storage.from("media").getPublicUrl(path);
      return json({ ok: true, url: pub.publicUrl }, 200, cors);
    }

    if (action === "list_subs") {
      const { data, error } = await admin.from("subscribers")
        .select("id,email,phone,created_at").order("created_at", { ascending: false }).limit(5000);
      if (error) return json({ error: error.message }, 400, cors);
      return json({ ok: true, subs: data ?? [] }, 200, cors);
    }

    if (action === "analytics") {
      // First-party site analytics. Raw events are RLS-private (anon may only INSERT);
      // the aggregation runs in analytics_summary() and is granted to the service role
      // only, so this is the single read path — same boundary as list_subs above.
      const raw = Number((payload ?? {}).days ?? 30);
      const days = Math.min(Math.max(Number.isFinite(raw) ? Math.trunc(raw) : 30, 1), 365);
      const { data, error } = await admin.rpc("analytics_summary", { p_days: days });
      if (error) return json({ error: error.message }, 400, cors);
      return json({ ok: true, summary: data ?? {} }, 200, cors);
    }

    if (action === "set_password") {
      const { currentPassword, newPassword } = (payload ?? {}) as Record<string, unknown>;
      const next = String(newPassword ?? "");
      if (next.length < 6) return json({ error: "password too short" }, 400, cors);
      // A session token alone must never be enough to change the password: a leaked token
      // would otherwise lock the real owner out (it bumps session_version) and mint itself
      // a fresh one. Re-verify the CURRENT password here, throttled like a login attempt.
      if (rlLocked(ip)) return json({ error: "too many attempts, try again later" }, 429, cors);
      if (!(await verifyPassword(String(currentPassword ?? ""), cfg?.password))) {
        rlFail(ip);
        return json({ error: "current password is incorrect" }, 403, cors);
      }
      const nextVer = curVer + 1;   // revoke every existing token
      const { error, count } = await admin.from("admin_config")
        .update({ password: await hashPassword(next), session_version: nextVer }, { count: "exact" }).eq("id", 1);
      if (error) return json({ error: error.message }, 400, cors);
      if (!count) return json({ error: "admin_config row 1 is missing — seed it first" }, 500, cors);
      return json({ ok: true, token: await makeToken(nextVer) }, 200, cors);
    }

    return json({ error: "unknown action" }, 400, cors);
  } catch (e) {
    console.error("admin function error:", e);   // internal detail stays in the logs, not the response
    return json({ error: "internal error" }, 500, corsFor(req));
  }
});
