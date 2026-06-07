-- Block public LISTING of the `media` storage bucket.
-- The bucket is public, so object read-by-URL still works without this policy.
-- No client lists the bucket with the anon key (admin uploads via the service-role
-- edge function and stores the returned public URLs), so removing it is safe and
-- closes the "public bucket allows listing" advisory.
drop policy if exists "public read media" on storage.objects;
