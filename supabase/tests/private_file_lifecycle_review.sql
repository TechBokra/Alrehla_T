-- Run against local/staging only. Every fixture write is rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_actor uuid := gen_random_uuid();
  v_document uuid := gen_random_uuid();
  v_reviewed uuid := gen_random_uuid();
  v_ticket jsonb;
  v_result jsonb;
  v_again jsonb;
  v_intent uuid;
  v_locator jsonb;
  v_job uuid;
  v_first uuid := gen_random_uuid();
  v_old uuid := gen_random_uuid();
  v_recent uuid := gen_random_uuid();
  v_capacity_denied boolean := false;
BEGIN
  INSERT INTO public.user_profiles(id, full_name, role)
  VALUES (v_actor, 'Private-file rollback fixture', 'student');
  INSERT INTO public.portfolio_documents(id, student_id, title, content)
  VALUES (v_document, v_actor, 'Private-file rollback fixture', 'Fixture');

  -- Old/unresolved reservations must still hold all five document slots.
  FOR i IN 1..5 LOOP
    PERFORM public.create_private_file_upload_intent(v_actor::text, 'document', v_document::text,
      'fixture.pdf', 'pdf', 200, 10485760, 'raw', now() - interval '2 hours');
  END LOOP;
  UPDATE public.private_file_upload_intents SET lifecycle_state = 'cleanup_pending'
  WHERE owner_id = v_document::text;
  BEGIN
    PERFORM public.create_private_file_upload_intent(v_actor::text, 'document', v_document::text,
      'fixture.pdf', 'pdf', 200, 10485760, 'raw');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%capacity%' THEN RAISE; END IF;
    v_capacity_denied := true;
  END;
  IF NOT v_capacity_denied THEN RAISE EXCEPTION 'Unresolved upload capacity was released too early'; END IF;
  UPDATE public.private_file_upload_intents SET lifecycle_state = 'cleaned' WHERE owner_id = v_document::text;

  v_ticket := public.create_private_file_upload_intent(v_actor::text, 'document', v_document::text,
    'fixture.pdf', 'pdf', 200, 10485760, 'raw');
  v_intent := (v_ticket->>'intent_id')::uuid;
  SELECT provider_locator INTO v_locator FROM public.private_file_upload_intents WHERE id = v_intent;
  v_locator := v_locator || jsonb_build_object('format','pdf','bytes',200,'tags',jsonb_build_array(v_locator->>'tag'));
  v_result := public.finalize_private_file_upload(v_actor::text, v_intent, v_locator);
  v_again := public.finalize_private_file_upload(v_actor::text, v_intent, v_locator);
  IF v_result->>'file_id' IS NULL OR v_result->>'file_id' <> v_again->>'file_id'
     OR (SELECT count(*) FROM public.private_files WHERE upload_intent_id=v_intent) <> 1 THEN
    RAISE EXCEPTION 'Repeated finalization did not preserve one file';
  END IF;
  IF public.delete_private_file_document(gen_random_uuid()::text, v_document) THEN
    RAISE EXCEPTION 'Unrelated actor deleted the document';
  END IF;
  IF NOT public.delete_private_file_document(v_actor::text, v_document) THEN
    RAISE EXCEPTION 'Owner document deletion failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.private_file_cleanup_jobs
    WHERE intent_id=v_intent AND file_id IS NULL AND deletion_reason='parent_deleted') THEN
    RAISE EXCEPTION 'Document cascade lost its cleanup job';
  END IF;

  -- Failed jobs are ordered by age of last attempt, not number of failures.
  INSERT INTO public.private_file_cleanup_jobs(id, provider_locator, deletion_reason, attempt_count,
    available_at, last_attempt_at)
  VALUES
    (v_first, jsonb_build_object('public_id',v_first), 'abandoned_upload', 0, now()-interval '4 days', NULL),
    (v_old, jsonb_build_object('public_id',v_old), 'abandoned_upload', 5, now()-interval '4 days', now()-interval '3 days'),
    (v_recent, jsonb_build_object('public_id',v_recent), 'abandoned_upload', 1, now()-interval '4 days', now()-interval '2 days');
  v_result := public.claim_private_file_cleanup_jobs(now()-interval '1 day', 30, 1);
  IF v_result->'jobs'->0->>'id' <> v_first::text THEN RAISE EXCEPTION 'Never-attempted job was not first'; END IF;
  PERFORM public.complete_private_file_cleanup_job(v_first,
    (v_result->'jobs'->0->>'lease_token')::uuid,true);
  v_result := public.claim_private_file_cleanup_jobs(now()-interval '1 day', 30, 1);
  IF v_result->'jobs'->0->>'id' <> v_old::text THEN RAISE EXCEPTION 'Oldest failed job was not first'; END IF;
  IF public.complete_private_file_cleanup_job(v_old,gen_random_uuid(),true) THEN
    RAISE EXCEPTION 'Incorrect claim token completed a cleanup job';
  END IF;

  -- More than 300 active files must not hide a later expired target.
  INSERT INTO public.portfolio_documents(id, student_id, title, content)
  VALUES (v_document, v_actor, 'Active fixture', 'Fixture');
  INSERT INTO public.portfolio_documents(id, student_id, title, content, status, updated_at)
  VALUES (v_reviewed, v_actor, 'Expired fixture', 'Fixture', 'reviewed', now()-interval '60 days');
  INSERT INTO public.private_files(document_id,uploader_profile_id,file_name,public_id,resource_type,format,bytes,created_at)
  SELECT v_document,v_actor::text,'active.pdf',v_document::text||'/'||n,'raw','pdf',200,now()-interval '90 days'
  FROM generate_series(1,301) n;
  INSERT INTO public.private_files(document_id,uploader_profile_id,file_name,public_id,resource_type,format,bytes,created_at)
  VALUES (v_reviewed,v_actor::text,'expired.pdf',v_reviewed::text||'/expired','raw','pdf',200,now()-interval '60 days');
  PERFORM public.claim_private_file_cleanup_jobs(now(),30,300);
  IF NOT EXISTS (SELECT 1 FROM public.private_files WHERE document_id=v_reviewed AND lifecycle_state='delete_pending') THEN
    RAISE EXCEPTION 'Expired file after 301 active files was not queued';
  END IF;
END;
$$;
ROLLBACK;
SELECT true AS rollback_checks_passed;
