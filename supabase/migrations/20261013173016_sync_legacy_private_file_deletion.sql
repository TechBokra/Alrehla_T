BEGIN;

-- Keep the additive schema safe while the previous cron/action version is
-- still serving. That version records provider deletion by setting only
-- deleted_at; mirror that write into the new lifecycle columns.
CREATE OR REPLACE FUNCTION public.sync_private_file_deleted_at_lifecycle()
RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    NEW.lifecycle_state := 'deleted';
    NEW.deletion_reason := coalesce(NEW.deletion_reason, 'retention');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER private_files_sync_deleted_at_lifecycle
  BEFORE UPDATE OF deleted_at ON public.private_files
  FOR EACH ROW EXECUTE FUNCTION public.sync_private_file_deleted_at_lifecycle();

REVOKE ALL ON FUNCTION public.sync_private_file_deleted_at_lifecycle() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_private_file_deleted_at_lifecycle() TO service_role;

COMMIT;
