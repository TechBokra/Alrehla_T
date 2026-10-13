BEGIN;

-- The worker and server actions use the service role. Explicit policies make
-- the intended access visible to Postgres tooling while table grants still
-- deny access to anon and authenticated roles.
CREATE POLICY private_file_upload_intents_service_role_all
  ON public.private_file_upload_intents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY private_file_cleanup_jobs_service_role_all
  ON public.private_file_cleanup_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.request_private_file_deletion(
  p_actor_id text, p_file_id uuid, p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_file private_files%ROWTYPE;
  v_student uuid;
  v_allowed boolean := false;
  v_role text;
  v_job_id uuid;
  v_claim_token uuid;
BEGIN
  SELECT * INTO v_file FROM private_files WHERE id = p_file_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'File not found'); END IF;
  IF v_file.lifecycle_state = 'delete_pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'File deletion is already pending');
  ELSIF v_file.lifecycle_state = 'deleted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'File was already deleted');
  END IF;

  v_allowed := v_file.uploader_profile_id = p_actor_id;
  IF NOT v_allowed AND v_file.document_id IS NOT NULL THEN
    SELECT student_id INTO v_student FROM portfolio_documents WHERE id = v_file.document_id;
    SELECT role::text INTO v_role FROM user_profiles WHERE id::text = p_actor_id;
    v_allowed := v_role IS DISTINCT FROM 'instructor' AND EXISTS (
      SELECT 1 FROM child_profiles c
       WHERE c.user_profile_id::text = p_actor_id
         AND c.account_profile_id = v_student::text
         AND (c.birth_date IS NULL OR c.birth_date > current_date - interval '12 years')
    );
  END IF;
  IF NOT v_allowed THEN RETURN jsonb_build_object('ok', false, 'error', 'Deletion is not authorized'); END IF;

  UPDATE private_files SET lifecycle_state = 'delete_pending', deletion_reason = 'user_request'
   WHERE id = p_file_id;
  INSERT INTO private_file_cleanup_jobs(provider, provider_locator, file_id, intent_id,
    deletion_reason, available_at)
  VALUES ('cloudinary', jsonb_build_object('public_id', v_file.public_id,
    'resource_type', v_file.resource_type, 'type', 'authenticated',
    'tag', CASE WHEN v_file.upload_intent_id IS NULL THEN NULL
      ELSE 'private-file-intent-' || v_file.upload_intent_id::text END),
    v_file.id, v_file.upload_intent_id, 'user_request', p_now)
  ON CONFLICT DO NOTHING RETURNING id INTO v_job_id;
  IF v_job_id IS NOT NULL THEN
    v_claim_token := gen_random_uuid();
    UPDATE private_file_cleanup_jobs SET state = 'leased', attempt_count = attempt_count + 1,
      last_attempt_at = p_now, lease_token = v_claim_token, lease_until = p_now + interval '5 minutes'
     WHERE id = v_job_id;
    RETURN jsonb_build_object('ok', true, 'state', 'pending', 'job_id', v_job_id,
      'claim_token', v_claim_token, 'locator', jsonb_build_object('public_id', v_file.public_id,
        'resource_type', v_file.resource_type, 'type', 'authenticated',
        'tag', CASE WHEN v_file.upload_intent_id IS NULL THEN NULL
          ELSE 'private-file-intent-' || v_file.upload_intent_id::text END));
  END IF;
  RETURN jsonb_build_object('ok', true, 'state', 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.queue_private_file_before_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_private_file_intents_before_parent_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_private_file_before_delete() TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_private_file_intents_before_parent_delete() TO service_role;

COMMIT;
