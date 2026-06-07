# Supabase backend — `slime-by-cms`

Project ref **`rccwnyghfiinpoexvtwp`** (us-west-1). The public site reads content with
the publishable (anon) key in `cms.js`; every write goes through the `admin` Edge
Function.

```
supabase/
  config.toml
  migrations/        # schema + RLS, reflecting the deployed database
  functions/admin/   # the password-checked admin function (source to be added)
```

## Tables & access (verified against the live project)

| Table | anon access | notes |
|---|---|---|
| `site_content` | `SELECT` (USING true) | single row; writes via edge function only |
| `admin_config` | none (RLS on, no policy) | only the service role can read the password |
| `subscribers` | `INSERT` only | **no SELECT** → list not publicly readable |
| storage `media` | public read by URL | object **listing disabled** (see hardening migration) |

## Apply

```
supabase link --project-ref rccwnyghfiinpoexvtwp
supabase db push
supabase functions deploy admin   # once functions/admin/index.ts is added
```

## Edge-function env

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; the admin password lives in `admin_config`.

See `../SECURITY.md` for headers/CSP and the admin-token plan.
