-- Durable private-file upload reservations and retryable storage cleanup.
-- Existing file rows and Cloudinary assets are preserved.

BEGIN;

ALTER TABLE public.private_files
  ADD COLUMN lifecycle_state text NOT NULL DEFAULT 'active',
  ADD COLUMN deletion_reason text,
  ADD COLUMN upload_intent_id uuid;

UPDATE public.private_files
   SET lifecycle_state = CASE WHEN deleted_at IS NULL THEN 'active' ELSE 'deleted' END,
       deletion_reason = CASE WHEN deleted_at IS NULL THEN NULL ELSE 'retention' END;

ALTER TABLE public.private_files
  ADD CONSTRAINT private_files_lifecycle_state_check
    CHECK (lifecycle_state IN ('active', 'delete_pending', 'deleted')),
  ADD CONSTRAINT private_files_deletion_reason_check
    CHECK (deletion_reason IS NULL OR deletion_reason IN ('user_request', 'retention', 'parent_deleted'));

CREATE TABLE public.private_file_upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind text NOT NULL CHECK (owner_kind IN ('order', 'document')),
  owner_id text NOT NULL,
  uploader_profile_id text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  file_ext text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('image', 'raw')),
  expected_bytes integer NOT NULL CHECK (expected_bytes > 0),
  max_bytes integer NOT NULL CHECK (max_bytes > 0 AND max_bytes <= 10 * 1024 * 1024),
  provider text NOT NULL DEFAULT 'cloudinary' CHECK (provider = 'cloudinary'),
  provider_locator jsonb NOT NULL,
  lifecycle_state text NOT NULL DEFAULT 'reserved'
    CHECK (lifecycle_state IN ('reserved', 'finalized', 'cleanup_pending', 'cleaned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  signing_expires_at timestamptz NOT NULL,
  finalized_at timestamptz,
  reconciled_at timestamptz,
  last_error text,
  CHECK (signing_expires_at > expires_at)
);

CREATE INDEX private_file_upload_intents_owner_idx
  ON public.private_file_upload_intents (owner_kind, owner_id, lifecycle_state);
CREATE INDEX private_file_upload_intents_expiry_idx
  ON public.private_file_upload_intents (signing_expires_at)
  WHERE lifecycle_state IN ('reserved', 'cleanup_pending');

CREATE TABLE public.private_file_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'cloudinary' CHECK (provider = 'cloudinary'),
  provider_locator jsonb NOT NULL,
  file_id uuid REFERENCES public.private_files(id) ON DELETE SET NULL,
  intent_id uuid REFERENCES public.private_file_upload_intents(id) ON DELETE SET NULL,
  deletion_reason text NOT NULL CHECK (deletion_reason IN (
    'user_request', 'retention', 'parent_deleted', 'abandoned_upload',
    'invalid_upload', 'reconcile_unexpected'
  )),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'leased', 'completed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error text,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((state = 'leased') = (lease_token IS NOT NULL AND lease_until IS NOT NULL))
);

CREATE INDEX private_file_cleanup_jobs_pending_idx
  ON public.private_file_cleanup_jobs (attempt_count, last_attempt_at, available_at)
  WHERE state <> 'completed';
CREATE UNIQUE INDEX private_file_cleanup_jobs_open_locator_idx
  ON public.private_file_cleanup_jobs (provider, provider_locator)
  WHERE state <> 'completed';

ALTER TABLE public.private_files
  ADD CONSTRAINT private_files_upload_intent_fk
    FOREIGN KEY (upload_intent_id)
    REFERENCES public.private_file_upload_intents(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX private_files_upload_intent_unique
  ON public.private_files (upload_intent_id) WHERE upload_intent_id IS NOT NULL;
CREATE INDEX private_files_lifecycle_idx
  ON public.private_files (created_at, lifecycle_state);

ALTER TABLE public.private_file_upload_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_file_cleanup_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.private_file_upload_intents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.private_file_cleanup_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.private_file_upload_intents TO service_role;
GRANT ALL ON public.private_file_cleanup_jobs TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.private_files FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.private_file_can_upload(
  p_actor_id text,
  p_owner_kind text,
  p_owner_id text
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_actor uuid;
BEGIN
  IF p_actor_id IS NULL OR p_owner_id IS NULL OR p_owner_kind IS NULL
     OR p_owner_kind NOT IN ('order', 'document') THEN
    RETURN false;
  END IF;
  BEGIN
    v_actor := p_actor_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  IF EXISTS (
    SELECT 1 FROM user_profiles up
     WHERE up.id = v_actor AND up.role::text IN ('super_admin', 'general_supervisor')
  ) THEN
    RETURN false;
  END IF;

  IF p_owner_kind = 'order' THEN
    RETURN EXISTS (
      SELECT 1
        FROM service_orders o
        JOIN standalone_services s ON s.id = o.standalone_service_id
        LEFT JOIN instructors i ON i.id = o.instructor_id
        LEFT JOIN service_providers sp ON sp.id = o.provider_id
        LEFT JOIN instructors pi ON pi.id = sp.instructor_id
       WHERE o.id = p_owner_id
         AND o.status::text IN ('paid', 'in_progress', 'delivered')
         AND s.allows_files IS TRUE
         AND (
           o.buyer_profile_id = p_actor_id
           OR i.user_id = v_actor
           OR sp.user_id = v_actor
           OR pi.user_id = v_actor
         )
    );
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM portfolio_documents d
     WHERE d.id::text = p_owner_id
       AND d.status::text IN ('draft', 'submitted')
       AND (
         d.student_id = v_actor
         OR (
           EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = v_actor AND up.role::text = 'instructor')
           AND EXISTS (
             SELECT 1
               FROM course_subscriptions cs
               JOIN instructors i ON i.user_id = v_actor
               LEFT JOIN child_profiles c ON c.id = cs.child_id
              WHERE (
                  i.id = cs.preferred_instructor_id
                  OR EXISTS (
                    SELECT 1 FROM sessions se
                     WHERE se.course_subscription_id = cs.id
                       AND se.instructor_id = i.id
                  )
                )
                AND (
                  cs.user_id = d.student_id
                  OR c.user_profile_id = d.student_id
                  OR NULLIF(btrim(coalesce(c.account_profile_id, '')), '') = d.student_id::text
                )
           )
         )
       )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_private_file_upload_intent(
  p_actor_id text,
  p_owner_kind text,
  p_owner_id text,
  p_file_name text,
  p_file_ext text,
  p_expected_bytes integer,
  p_max_bytes integer,
  p_resource_type text,
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_public_id text;
  v_upload_public_id text;
  v_folder text;
  v_tag text;
  v_count integer;
  v_limit integer;
  v_expires timestamptz := p_now + interval '15 minutes';
  v_signing_expires timestamptz := p_now + interval '1 hour';
BEGIN
  IF p_file_ext NOT IN ('pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')
     OR p_resource_type NOT IN ('image', 'raw')
     OR p_max_bytes < 1 OR p_max_bytes > 10 * 1024 * 1024
     OR p_expected_bytes < 1 OR p_expected_bytes > p_max_bytes
     OR char_length(p_file_name) NOT BETWEEN 1 AND 200
     OR p_owner_id !~ '^[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Invalid upload reservation';
  END IF;
  IF (p_resource_type = 'image') <> (p_file_ext IN ('jpg', 'jpeg', 'png', 'webp', 'heic', 'heif')) THEN
    RAISE EXCEPTION 'Invalid resource type for file extension';
  END IF;
  IF NOT public.private_file_can_upload(p_actor_id, p_owner_kind, p_owner_id) THEN
    RAISE EXCEPTION 'Upload is not authorized or the parent is not eligible';
  END IF;

  IF p_owner_kind = 'order' THEN
    PERFORM 1 FROM service_orders WHERE id = p_owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    v_limit := 20;
    v_folder := 'alrehla/private/orders/' || p_owner_id;
    SELECT count(*) INTO v_count FROM private_files
     WHERE order_id = p_owner_id AND lifecycle_state IN ('active', 'delete_pending');
    v_count := v_count + (SELECT count(*) FROM private_file_upload_intents
      WHERE owner_kind = 'order' AND owner_id = p_owner_id AND lifecycle_state = 'reserved'
        AND signing_expires_at + interval '15 minutes' > p_now);
  ELSE
    PERFORM 1 FROM portfolio_documents WHERE id::text = p_owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
    v_limit := 5;
    v_folder := 'alrehla/private/writing/' || p_owner_id;
    SELECT count(*) INTO v_count FROM private_files
     WHERE document_id::text = p_owner_id AND lifecycle_state IN ('active', 'delete_pending');
    v_count := v_count + (SELECT count(*) FROM private_file_upload_intents
      WHERE owner_kind = 'document' AND owner_id = p_owner_id AND lifecycle_state = 'reserved'
        AND signing_expires_at + interval '15 minutes' > p_now);
  END IF;
  IF NOT public.private_file_can_upload(p_actor_id, p_owner_kind, p_owner_id) THEN
    RAISE EXCEPTION 'Upload is not authorized or the parent is no longer eligible';
  END IF;
  IF v_count >= v_limit THEN RAISE EXCEPTION 'Attachment capacity reached'; END IF;

  v_upload_public_id := v_id::text ||
    CASE WHEN p_resource_type = 'raw' THEN '.' || p_file_ext ELSE '' END;
  v_public_id := v_folder || '/' || v_upload_public_id;
  v_tag := 'private-file-intent-' || v_id::text;
  INSERT INTO private_file_upload_intents (
    id, owner_kind, owner_id, uploader_profile_id, file_name, file_ext,
    resource_type, expected_bytes, max_bytes, provider_locator,
    created_at, expires_at, signing_expires_at
  ) VALUES (
    v_id, p_owner_kind, p_owner_id, p_actor_id, p_file_name, p_file_ext,
    p_resource_type, p_expected_bytes, p_max_bytes,
    jsonb_build_object('public_id', v_public_id, 'upload_public_id', v_upload_public_id, 'folder', v_folder,
                       'resource_type', p_resource_type, 'type', 'authenticated', 'tag', v_tag),
    p_now, v_expires, v_signing_expires
  );
  RETURN jsonb_build_object('intent_id', v_id, 'public_id', v_public_id,
    'upload_public_id', v_upload_public_id,
    'folder', v_folder, 'tag', v_tag, 'expires_at', v_expires,
    'signing_expires_at', v_signing_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_private_file_upload(
  p_actor_id text,
  p_intent_id uuid,
  p_metadata jsonb,
  p_is_delivery boolean DEFAULT false,
  p_now timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_intent private_file_upload_intents%ROWTYPE;
  v_file_id uuid;
  v_folder text;
  v_tag text;
  v_invalid text;
BEGIN
  SELECT * INTO v_intent FROM private_file_upload_intents WHERE id = p_intent_id;
  IF NOT FOUND OR v_intent.uploader_profile_id <> p_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Upload intent not found');
  END IF;

  IF v_intent.owner_kind = 'order' THEN
    PERFORM 1 FROM service_orders WHERE id = v_intent.owner_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM portfolio_documents WHERE id::text = v_intent.owner_id FOR UPDATE;
  END IF;
  SELECT * INTO v_intent FROM private_file_upload_intents WHERE id = p_intent_id FOR UPDATE;

  IF v_intent.lifecycle_state = 'finalized' THEN
    SELECT id INTO v_file_id FROM private_files WHERE upload_intent_id = p_intent_id;
    IF v_file_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'file_id', v_file_id, 'already_finalized', true);
    END IF;
  END IF;
  IF v_intent.lifecycle_state <> 'reserved' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Upload intent is no longer available');
  END IF;

  v_folder := v_intent.provider_locator->>'folder';
  v_tag := v_intent.provider_locator->>'tag';
  IF p_now > v_intent.expires_at THEN
    v_invalid := 'Upload intent expired';
  ELSIF NOT public.private_file_can_upload(p_actor_id, v_intent.owner_kind, v_intent.owner_id) THEN
    v_invalid := 'Parent is no longer eligible';
  ELSIF p_metadata->>'public_id' IS DISTINCT FROM v_intent.provider_locator->>'public_id'
     OR p_metadata->>'resource_type' IS DISTINCT FROM v_intent.resource_type
     OR p_metadata->>'type' IS DISTINCT FROM 'authenticated'
     OR p_metadata->>'folder' IS DISTINCT FROM v_folder
     OR NOT (
       lower(coalesce(p_metadata->>'format', '')) = v_intent.file_ext
       OR (v_intent.file_ext IN ('jpg', 'jpeg')
           AND lower(coalesce(p_metadata->>'format', '')) IN ('jpg', 'jpeg'))
     )
     OR coalesce((p_metadata->'tags') ? v_tag, false) IS NOT TRUE
     OR coalesce((p_metadata->>'bytes')::integer, 0) < 1
     OR (p_metadata->>'bytes')::integer > v_intent.max_bytes THEN
    v_invalid := 'Uploaded asset metadata did not match the reserved upload';
  END IF;

  IF v_invalid IS NOT NULL THEN
    UPDATE private_file_upload_intents SET lifecycle_state = 'cleanup_pending', last_error = v_invalid
     WHERE id = p_intent_id;
    INSERT INTO private_file_cleanup_jobs(provider, provider_locator, intent_id,
      deletion_reason, available_at)
    VALUES ('cloudinary', v_intent.provider_locator, p_intent_id, 'invalid_upload',
      greatest(p_now, v_intent.signing_expires_at + interval '15 minutes'))
    ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', false, 'error', v_invalid);
  END IF;

  INSERT INTO private_files (
    order_id, document_id, uploader_profile_id, file_name, public_id,
    resource_type, format, bytes, is_delivery, upload_intent_id,
    lifecycle_state, created_at
  ) VALUES (
    CASE WHEN v_intent.owner_kind = 'order' THEN v_intent.owner_id END,
    CASE WHEN v_intent.owner_kind = 'document' THEN v_intent.owner_id::uuid END,
    p_actor_id, v_intent.file_name, v_intent.provider_locator->>'public_id',
    v_intent.resource_type, p_metadata->>'format', (p_metadata->>'bytes')::integer,
    p_is_delivery, p_intent_id, 'active', p_now
  ) RETURNING id INTO v_file_id;

  UPDATE private_file_upload_intents
     SET lifecycle_state = 'finalized', finalized_at = p_now, last_error = NULL
   WHERE id = p_intent_id;
  RETURN jsonb_build_object('ok', true, 'file_id', v_file_id, 'already_finalized', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_private_file_upload_intent(
  p_actor_id text, p_intent_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE v_intent private_file_upload_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_intent FROM private_file_upload_intents WHERE id = p_intent_id FOR UPDATE;
  IF NOT FOUND OR v_intent.uploader_profile_id <> p_actor_id OR v_intent.lifecycle_state <> 'reserved' THEN
    RETURN false;
  END IF;
  UPDATE private_file_upload_intents SET lifecycle_state = 'cleaned'
   WHERE id = p_intent_id;
  RETURN true;
END;
$$;

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
    RETURN jsonb_build_object('ok', true, 'state', 'pending');
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

CREATE OR REPLACE FUNCTION public.claim_private_file_cleanup_jobs(
  p_now timestamptz DEFAULT now(), p_retention_days integer DEFAULT 30, p_limit integer DEFAULT 300
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_file record;
  v_intent record;
  v_queued integer := 0;
  v_inserted integer := 0;
  v_jobs jsonb;
  v_limit integer := least(greatest(p_limit, 1), 300);
BEGIN
  FOR v_file IN
    SELECT f.id, f.public_id, f.resource_type, f.upload_intent_id
      FROM private_files f
      LEFT JOIN service_orders o ON o.id = f.order_id
      LEFT JOIN portfolio_documents d ON d.id = f.document_id
     WHERE f.lifecycle_state = 'active'
       AND ((o.id IS NOT NULL AND o.status::text IN ('completed', 'cancelled', 'refunded')
             AND greatest(f.created_at, coalesce(o.completed_at, f.created_at))
                 + make_interval(days => p_retention_days) <= p_now)
         OR (d.id IS NOT NULL AND d.status::text = 'reviewed'
             AND greatest(f.created_at, d.updated_at)
                 + make_interval(days => p_retention_days) <= p_now))
     ORDER BY f.created_at
     LIMIT (v_limit - v_queued)
     FOR UPDATE OF f SKIP LOCKED
  LOOP
    UPDATE private_files SET lifecycle_state = 'delete_pending', deletion_reason = 'retention'
     WHERE id = v_file.id;
    INSERT INTO private_file_cleanup_jobs(provider, provider_locator, file_id, intent_id,
      deletion_reason, available_at)
    VALUES ('cloudinary', jsonb_build_object('public_id', v_file.public_id,
      'resource_type', v_file.resource_type, 'type', 'authenticated'),
      v_file.id, v_file.upload_intent_id, 'retention', p_now)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_queued := v_queued + v_inserted;
  END LOOP;

  FOR v_intent IN
    SELECT * FROM private_file_upload_intents
     WHERE lifecycle_state = 'reserved'
       AND signing_expires_at + interval '15 minutes' <= p_now
     ORDER BY signing_expires_at
     LIMIT (v_limit - v_queued) FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE private_file_upload_intents SET lifecycle_state = 'cleanup_pending'
     WHERE id = v_intent.id;
    INSERT INTO private_file_cleanup_jobs(provider, provider_locator, intent_id,
      deletion_reason, available_at)
    VALUES ('cloudinary', v_intent.provider_locator, v_intent.id,
      'abandoned_upload', p_now)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_queued := v_queued + v_inserted;
  END LOOP;

  FOR v_intent IN
    SELECT * FROM private_file_upload_intents
     WHERE lifecycle_state = 'finalized' AND reconciled_at IS NULL
       AND signing_expires_at + interval '15 minutes' <= p_now
       AND NOT EXISTS (
         SELECT 1 FROM private_file_cleanup_jobs j
          WHERE j.intent_id = private_file_upload_intents.id
            AND j.deletion_reason = 'reconcile_unexpected'
            AND j.state <> 'completed'
       )
     ORDER BY signing_expires_at
     LIMIT (v_limit - v_queued) FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO private_file_cleanup_jobs(provider, provider_locator, intent_id,
      deletion_reason, available_at)
    VALUES ('cloudinary', v_intent.provider_locator, v_intent.id,
      'reconcile_unexpected', p_now)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_queued := v_queued + v_inserted;
  END LOOP;

  WITH candidates AS (
    SELECT id FROM private_file_cleanup_jobs
     WHERE available_at <= p_now
       AND (state = 'pending' OR (state = 'leased' AND lease_until <= p_now))
     ORDER BY attempt_count ASC, last_attempt_at ASC NULLS FIRST, created_at ASC
     LIMIT v_limit FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE private_file_cleanup_jobs j
       SET state = 'leased', attempt_count = j.attempt_count + 1,
           last_attempt_at = p_now, lease_token = gen_random_uuid(),
           lease_until = p_now + interval '5 minutes', last_error = NULL
      FROM candidates c WHERE c.id = j.id
    RETURNING j.id, j.lease_token, j.provider, j.provider_locator,
              j.file_id, j.intent_id, j.deletion_reason
  )
  SELECT coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) INTO v_jobs FROM claimed;

  RETURN jsonb_build_object('queued_count', v_queued, 'jobs', v_jobs);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_private_file_cleanup_job(
  p_job_id uuid, p_claim_token uuid, p_success boolean, p_error text DEFAULT NULL,
  p_now timestamptz DEFAULT now()
) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE v_job private_file_cleanup_jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM private_file_cleanup_jobs
   WHERE id = p_job_id AND state = 'leased' AND lease_token = p_claim_token
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_success THEN
    UPDATE private_file_cleanup_jobs SET state = 'completed', completed_at = p_now,
      lease_token = NULL, lease_until = NULL, last_error = NULL
     WHERE id = p_job_id;
    IF v_job.file_id IS NOT NULL THEN
      UPDATE private_files SET lifecycle_state = 'deleted', deleted_at = coalesce(deleted_at, p_now)
       WHERE id = v_job.file_id AND lifecycle_state = 'delete_pending';
    END IF;
    IF v_job.intent_id IS NOT NULL THEN
      IF v_job.deletion_reason = 'reconcile_unexpected' THEN
        UPDATE private_file_upload_intents SET reconciled_at = p_now WHERE id = v_job.intent_id;
      ELSE
        UPDATE private_file_upload_intents SET lifecycle_state = 'cleaned'
         WHERE id = v_job.intent_id AND lifecycle_state = 'cleanup_pending';
      END IF;
    END IF;
  ELSE
    UPDATE private_file_cleanup_jobs SET state = 'pending', last_error = left(coalesce(p_error, 'Provider deletion failed'), 2000),
      lease_token = NULL, lease_until = NULL
     WHERE id = p_job_id;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_private_file_before_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
BEGIN
  IF OLD.lifecycle_state <> 'deleted' THEN
    INSERT INTO private_file_cleanup_jobs(provider, provider_locator, file_id, intent_id,
      deletion_reason, available_at)
    VALUES ('cloudinary', jsonb_build_object('public_id', OLD.public_id,
      'resource_type', OLD.resource_type, 'type', 'authenticated'),
      OLD.id, OLD.upload_intent_id, 'parent_deleted', now())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER private_files_queue_before_delete
  BEFORE DELETE ON public.private_files
  FOR EACH ROW EXECUTE FUNCTION public.queue_private_file_before_delete();

CREATE OR REPLACE FUNCTION public.queue_private_file_intents_before_parent_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE v_kind text; v_owner_id text; v_intent record;
BEGIN
  v_kind := CASE WHEN TG_TABLE_NAME = 'service_orders' THEN 'order' ELSE 'document' END;
  v_owner_id := OLD.id::text;
  FOR v_intent IN
    SELECT * FROM private_file_upload_intents
     WHERE owner_kind = v_kind AND owner_id = v_owner_id AND lifecycle_state = 'reserved'
     FOR UPDATE
  LOOP
    UPDATE private_file_upload_intents SET lifecycle_state = 'cleanup_pending'
     WHERE id = v_intent.id;
    INSERT INTO private_file_cleanup_jobs(provider, provider_locator, intent_id,
      deletion_reason, available_at)
    VALUES ('cloudinary', v_intent.provider_locator, v_intent.id,
      'parent_deleted', greatest(now(), v_intent.signing_expires_at + interval '15 minutes'))
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN OLD;
END;
$$;
CREATE TRIGGER service_orders_queue_file_intents_before_delete
  BEFORE DELETE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.queue_private_file_intents_before_parent_delete();
CREATE TRIGGER portfolio_documents_queue_file_intents_before_delete
  BEFORE DELETE ON public.portfolio_documents
  FOR EACH ROW EXECUTE FUNCTION public.queue_private_file_intents_before_parent_delete();

REVOKE ALL ON FUNCTION public.private_file_can_upload(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_private_file_upload_intent(text, text, text, text, text, integer, integer, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_private_file_upload(text, uuid, jsonb, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_private_file_upload_intent(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_private_file_deletion(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_private_file_cleanup_jobs(timestamptz, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_private_file_cleanup_job(uuid, uuid, boolean, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_private_file_before_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_private_file_intents_before_parent_delete() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.private_file_can_upload(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_private_file_upload_intent(text, text, text, text, text, integer, integer, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_private_file_upload(text, uuid, jsonb, boolean, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_private_file_upload_intent(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_private_file_deletion(text, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_private_file_cleanup_jobs(timestamptz, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_private_file_cleanup_job(uuid, uuid, boolean, text, timestamptz) TO service_role;

COMMIT;
