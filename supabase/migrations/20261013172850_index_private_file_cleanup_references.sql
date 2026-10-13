BEGIN;

CREATE INDEX private_file_cleanup_jobs_file_idx
  ON public.private_file_cleanup_jobs (file_id)
  WHERE file_id IS NOT NULL;

CREATE INDEX private_file_cleanup_jobs_intent_idx
  ON public.private_file_cleanup_jobs (intent_id)
  WHERE intent_id IS NOT NULL;

COMMIT;
