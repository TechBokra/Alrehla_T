BEGIN;

-- The browser reports File.size when it requests a ticket. Bind finalization
-- to that reservation so a caller cannot under-report a larger uploaded file.
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

REVOKE ALL ON FUNCTION public.finalize_private_file_upload(text, uuid, jsonb, boolean, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_private_file_upload(text, uuid, jsonb, boolean, timestamptz)
  TO service_role;

COMMIT;
