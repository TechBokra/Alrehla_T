-- The unique constraint already provides this index. Keeping the second
-- identical unique index only adds write and storage overhead.
DROP INDEX IF EXISTS public.site_settings_key_unique;
