# `admin` edge function

The admin UI (`admin.html`) talks to a single password-checked Edge Function named
**`admin`** via `sbAdmin(password, action, payload)` in `cms.js`.

Actions: `login` · `save` · `upload` · `list_subs` · `set_password`.

It runs with the **service role** and is the only writer to `site_content` /
`admin_config` and the only reader of the `subscribers` list — i.e. it is the real
security boundary for the whole CMS.

> The function source is **not in this repo yet.** Export it from the project and add
> it here as `index.ts` so the boundary is reviewable/reproducible:
>
> ```
> supabase functions download admin
> ```

## Recommended hardening (review #4 — admin session token)

Today the admin keeps the raw password in `sessionStorage` and replays it on every
call. Instead:

1. `login` returns a short-lived **signed token** (e.g. JWT, ~30–60 min) — ideally set
   as an `HttpOnly; Secure; SameSite=Strict` cookie so page JS can't read it.
2. `save` / `upload` / `list_subs` / `set_password` validate that token server-side
   rather than re-checking a replayed password.
3. Add basic rate-limiting / lockout on `login`.

## Phone-merge for subscribers (review #6)

Anon has INSERT-only on `subscribers` (no UPDATE), so a later "email + phone" sign-up
can't update an earlier email-only row from the client. Do the upsert/merge **inside
this function** (service role) keyed on `email`.
