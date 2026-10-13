BEGIN;

-- Unresolved reservations hold their capacity until cleanup is confirmed.
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
  v_service_max integer;
  v_service_kinds text[];
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
    SELECT s.file_max_mb * 1024 * 1024, s.file_kinds
      INTO v_service_max, v_service_kinds
      FROM standalone_services s JOIN service_orders o ON o.standalone_service_id = s.id
     WHERE o.id = p_owner_id FOR SHARE OF s;
    IF p_expected_bytes > v_service_max OR NOT (
      CASE WHEN p_file_ext = 'pdf' THEN 'pdf'
           WHEN p_file_ext IN ('doc', 'docx') THEN 'word' ELSE 'image' END
      = ANY(v_service_kinds)
    ) THEN RAISE EXCEPTION 'File does not match the current service upload rules'; END IF;
    p_max_bytes := least(p_max_bytes, v_service_max);
    v_limit := 20;
    v_folder := 'alrehla/private/orders/' || p_owner_id;
    SELECT count(*) INTO v_count FROM private_files
     WHERE order_id = p_owner_id AND lifecycle_state IN ('active', 'delete_pending');
    v_count := v_count + (SELECT count(*) FROM private_file_upload_intents
      WHERE owner_kind = 'order' AND owner_id = p_owner_id AND lifecycle_state IN ('reserved', 'cleanup_pending'));
  ELSE
    PERFORM 1 FROM portfolio_documents WHERE id::text = p_owner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found'; END IF;
    v_limit := 5;
    v_folder := 'alrehla/private/writing/' || p_owner_id;
    SELECT count(*) INTO v_count FROM private_files
     WHERE document_id::text = p_owner_id AND lifecycle_state IN ('active', 'delete_pending');
    v_count := v_count + (SELECT count(*) FROM private_file_upload_intents
      WHERE owner_kind = 'document' AND owner_id = p_owner_id AND lifecycle_state IN ('reserved', 'cleanup_pending'));
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
  v_service_max integer := 10 * 1024 * 1024;
  v_service_kinds text[] := ARRAY['pdf', 'word', 'image'];
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

  IF v_intent.owner_kind = 'order' THEN
    SELECT s.file_max_mb * 1024 * 1024, s.file_kinds
      INTO v_service_max, v_service_kinds
      FROM standalone_services s JOIN service_orders o ON o.standalone_service_id = s.id
     WHERE o.id = v_intent.owner_id FOR SHARE OF s;
  END IF;
  v_folder := v_intent.provider_locator->>'folder';
  v_tag := v_intent.provider_locator->>'tag';
  IF p_now > v_intent.expires_at THEN
    v_invalid := 'Upload intent expired';
  ELSIF NOT public.private_file_can_upload(p_actor_id, v_intent.owner_kind, v_intent.owner_id) THEN
    v_invalid := 'Parent is no longer eligible';
  ELSIF v_intent.expected_bytes > v_service_max OR NOT (
    CASE WHEN v_intent.file_ext = 'pdf' THEN 'pdf'
         WHEN v_intent.file_ext IN ('doc', 'docx') THEN 'word' ELSE 'image' END
    = ANY(v_service_kinds)
  ) THEN
    v_invalid := 'File does not match the current service upload rules';
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
     OR coalesce((p_metadata->>'bytes')::integer, 0) <> v_intent.expected_bytes
     OR coalesce((p_metadata->>'bytes')::integer, 0) > v_intent.max_bytes THEN
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
     ORDER BY CASE WHEN attempt_count = 0 THEN 0 ELSE 1 END,
              last_attempt_at ASC NULLS FIRST, created_at ASC
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

CREATE OR REPLACE FUNCTION public.private_file_can_manage_document(p_actor_id text, p_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles u
     WHERE u.id::text = p_actor_id AND u.role::text <> 'instructor'
       AND (u.id = p_student_id OR EXISTS (
         SELECT 1 FROM child_profiles c
          WHERE c.user_profile_id = u.id AND c.account_profile_id = p_student_id::text
            AND (c.birth_date IS NULL OR c.birth_date > current_date - interval '12 years')
       ))
  );
$$;

CREATE OR REPLACE FUNCTION public.delete_private_file_document(p_actor_id text, p_document_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $$
DECLARE v_student uuid;
BEGIN
  SELECT student_id INTO v_student FROM portfolio_documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR NOT public.private_file_can_manage_document(p_actor_id, v_student) THEN
    RETURN false;
  END IF;
  -- Existing BEFORE DELETE triggers retain cleanup jobs in this same transaction.
  DELETE FROM portfolio_documents WHERE id = p_document_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.private_file_can_manage_document(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_private_file_document(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.private_file_can_manage_document(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_private_file_document(text, uuid) TO service_role;

COMMIT;
