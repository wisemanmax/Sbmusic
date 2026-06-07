import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* ── short-lived admin session token ──────────────────────────────────────────
   `login` verifies the password once and returns a signed, expiring token; every
   other call presents that token instead of replaying the raw password, so the
   browser never has to store the password itself. HMAC-signed with a key derived
   from the service-role key (already in the function env), so no extra secret has
   to be provisioned. The raw password is still accepted as a fallback, so an
   expired/short token can never lock the admin out. */
const enc = new TextEncoder();
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;   // session-length; refreshed on each boot/login
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
async function makeToken(): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await signingKey(), enc.encode(payload)));
  return payload + "." + b64url(sig);
}
async function verifyToken(token: unknown): Promise<boolean> {
  try {
    const [payload, sig] = String(token).split(".");
    if (!payload || !sig) return false;
    const ok = await crypto.subtle.verify("HMAC", await signingKey(), unb64url(sig), enc.encode(payload));
    if (!ok) return false;
    const data = JSON.parse(new TextDecoder().decode(unb64url(payload)));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const { password, token, action, payload } = body ?? {};

    // Authorize via a valid session token (preferred) or the password (login + fallback).
    let authed = false;
    if (token) authed = await verifyToken(token);
    if (!authed && password) {
      const { data: cfg, error: cfgErr } = await admin
        .from("admin_config").select("password").eq("id", 1).single();
      authed = !cfgErr && !!cfg && password === cfg.password;
    }
    if (!authed) return json({ error: "unauthorized" }, 401);

    if (action === "login") {
      // verified above (password or a still-valid token) — (re)issue a fresh token
      return json({ ok: true, token: await makeToken() });
    }

    if (action === "save") {
      const { error } = await admin.from("site_content")
        .update({ data: payload, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "upload") {
      const { filename, contentType, dataB64 } = payload ?? {};
      if (!filename || !dataB64) return json({ error: "missing file" }, 400);
      const bytes = Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0));
      const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${Date.now()}-${safe}`;
      const { error } = await admin.storage.from("media")
        .upload(path, bytes, { contentType: contentType || "application/octet-stream", upsert: true });
      if (error) return json({ error: error.message }, 400);
      const { data: pub } = admin.storage.from("media").getPublicUrl(path);
      return json({ ok: true, url: pub.publicUrl });
    }

    if (action === "list_subs") {
      const { data, error } = await admin.from("subscribers")
        .select("id,email,phone,created_at").order("created_at", { ascending: false }).limit(5000);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, subs: data ?? [] });
    }

    if (action === "set_password") {
      const next = String((payload ?? {}).newPassword ?? "");
      if (next.length < 6) return json({ error: "password too short" }, 400);
      const { error } = await admin.from("admin_config")
        .update({ password: next }).eq("id", 1);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, token: await makeToken() });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
