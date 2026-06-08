-- Token revocation support. Admin session tokens embed the current session_version;
-- the edge function rejects any token whose version no longer matches. set_password
-- bumps this, so changing the password instantly invalidates every outstanding token
-- (previously a stolen token stayed valid for its full 8h TTL after a password change).
alter table public.admin_config
  add column if not exists session_version integer not null default 1;
