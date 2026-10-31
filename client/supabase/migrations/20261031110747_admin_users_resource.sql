BEGIN;

-- Server-only user list read model. The Edge Function verifies the caller's
-- current admin profile before invoking this RPC with its service-role client.
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_actor uuid,
  p_search text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_guardian boolean DEFAULT NULL,
  p_status text DEFAULT 'not_archived',
  p_sort text DEFAULT 'created_at',
  p_order text DEFAULT 'desc',
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_total bigint;
  v_data jsonb;
  v_search text := NULLIF(btrim(p_search), '');
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;

  IF p_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles actor
    WHERE actor.id = p_actor
      AND actor.archived_at IS NULL
      AND actor.role IN ('super_admin', 'general_supervisor')
  ) THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN (
    'visitor', 'customer', 'student', 'instructor', 'publisher',
    'general_supervisor', 'super_admin', 'service_provider'
  ) THEN
    RAISE EXCEPTION 'الدور المختار غير صالح' USING ERRCODE = '22023';
  END IF;

  IF p_status IS NULL OR p_status NOT IN (
    'not_archived', 'active', 'purchase_stopped', 'fully_suspended', 'archived'
  ) THEN
    RAISE EXCEPTION 'الحالة المختارة غير صالحة' USING ERRCODE = '22023';
  END IF;

  IF p_sort IS NULL OR p_sort NOT IN ('created_at', 'full_name', 'email', 'role', 'is_guardian') THEN
    RAISE EXCEPTION 'الترتيب المختار غير صالح' USING ERRCODE = '22023';
  END IF;

  IF p_order IS NULL OR p_order NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'اتجاه الترتيب غير صالح' USING ERRCODE = '22023';
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      profile.id,
      profile.full_name,
      COALESCE(auth_user.email, email.email, '') AS email,
      profile.role::text AS role,
      EXISTS (
        SELECT 1 FROM public.child_profiles child
        WHERE child.user_profile_id = profile.id
      ) AS is_guardian,
      EXISTS (
        SELECT 1 FROM public.child_profiles child
        WHERE child.account_profile_id = profile.id::text
      ) AS is_child_account,
      profile.admin_role_id,
      profile.created_at,
      profile.suspended_at,
      profile.suspension_reason,
      profile.archived_at,
      profile.archived_by,
      auth_user.banned_until,
      CASE
        WHEN profile.archived_at IS NOT NULL THEN 'archived'
        WHEN auth_user.id IS NULL OR auth_user.banned_until > now() THEN 'fully_suspended'
        WHEN profile.suspended_at IS NOT NULL THEN 'purchase_stopped'
        ELSE 'active'
      END AS status
    FROM public.user_profiles profile
    LEFT JOIN public.user_emails email ON email.user_id = profile.id
    LEFT JOIN auth.users auth_user ON auth_user.id = profile.id
    WHERE (p_role IS NULL OR profile.role::text = p_role)
      AND (p_guardian IS NULL OR EXISTS (
        SELECT 1 FROM public.child_profiles child
        WHERE child.user_profile_id = profile.id
      ) = p_guardian)
      AND (
        v_search IS NULL
        OR strpos(lower(profile.full_name), lower(v_search)) > 0
        OR strpos(lower(COALESCE(email.email, auth_user.email, '')), lower(v_search)) > 0
      )
      AND CASE p_status
        WHEN 'not_archived' THEN profile.archived_at IS NULL
        WHEN 'archived' THEN profile.archived_at IS NOT NULL
        WHEN 'active' THEN profile.archived_at IS NULL
          AND profile.suspended_at IS NULL
          AND auth_user.id IS NOT NULL
          AND COALESCE(auth_user.banned_until <= now(), true)
        WHEN 'purchase_stopped' THEN profile.archived_at IS NULL
          AND profile.suspended_at IS NOT NULL
          AND auth_user.id IS NOT NULL
          AND COALESCE(auth_user.banned_until <= now(), true)
        WHEN 'fully_suspended' THEN profile.archived_at IS NULL
          AND (auth_user.id IS NULL OR auth_user.banned_until > now())
        ELSE false
      END
  )
  SELECT count(*) INTO v_total FROM filtered;

  WITH filtered AS MATERIALIZED (
    SELECT
      profile.id,
      profile.full_name,
      COALESCE(auth_user.email, email.email, '') AS email,
      profile.role::text AS role,
      EXISTS (
        SELECT 1 FROM public.child_profiles child
        WHERE child.user_profile_id = profile.id
      ) AS is_guardian,
      EXISTS (
        SELECT 1 FROM public.child_profiles child
        WHERE child.account_profile_id = profile.id::text
      ) AS is_child_account,
      profile.admin_role_id,
      profile.created_at,
      profile.suspended_at,
      profile.suspension_reason,
      profile.archived_at,
      profile.archived_by,
      auth_user.banned_until,
      CASE
        WHEN profile.archived_at IS NOT NULL THEN 'archived'
        WHEN auth_user.id IS NULL OR auth_user.banned_until > now() THEN 'fully_suspended'
        WHEN profile.suspended_at IS NOT NULL THEN 'purchase_stopped'
        ELSE 'active'
      END AS status
    FROM public.user_profiles profile
    LEFT JOIN public.user_emails email ON email.user_id = profile.id
    LEFT JOIN auth.users auth_user ON auth_user.id = profile.id
    WHERE (p_role IS NULL OR profile.role::text = p_role)
      AND (p_guardian IS NULL OR EXISTS (
        SELECT 1 FROM public.child_profiles child
        WHERE child.user_profile_id = profile.id
      ) = p_guardian)
      AND (
        v_search IS NULL
        OR strpos(lower(profile.full_name), lower(v_search)) > 0
        OR strpos(lower(COALESCE(email.email, auth_user.email, '')), lower(v_search)) > 0
      )
      AND CASE p_status
        WHEN 'not_archived' THEN profile.archived_at IS NULL
        WHEN 'archived' THEN profile.archived_at IS NOT NULL
        WHEN 'active' THEN profile.archived_at IS NULL
          AND profile.suspended_at IS NULL
          AND auth_user.id IS NOT NULL
          AND COALESCE(auth_user.banned_until <= now(), true)
        WHEN 'purchase_stopped' THEN profile.archived_at IS NULL
          AND profile.suspended_at IS NOT NULL
          AND auth_user.id IS NOT NULL
          AND COALESCE(auth_user.banned_until <= now(), true)
        WHEN 'fully_suspended' THEN profile.archived_at IS NULL
          AND (auth_user.id IS NULL OR auth_user.banned_until > now())
        ELSE false
      END
  )
  SELECT COALESCE(
    jsonb_agg(to_jsonb(page) ORDER BY
      CASE WHEN p_sort = 'full_name' AND p_order = 'asc' THEN lower(page.full_name) END ASC NULLS LAST,
      CASE WHEN p_sort = 'full_name' AND p_order = 'desc' THEN lower(page.full_name) END DESC NULLS LAST,
      CASE WHEN p_sort = 'email' AND p_order = 'asc' THEN lower(page.email) END ASC NULLS LAST,
      CASE WHEN p_sort = 'email' AND p_order = 'desc' THEN lower(page.email) END DESC NULLS LAST,
      CASE WHEN p_sort = 'role' AND p_order = 'asc' THEN page.role END ASC NULLS LAST,
      CASE WHEN p_sort = 'role' AND p_order = 'desc' THEN page.role END DESC NULLS LAST,
      CASE WHEN p_sort = 'is_guardian' AND p_order = 'asc' THEN page.is_guardian END ASC NULLS LAST,
      CASE WHEN p_sort = 'is_guardian' AND p_order = 'desc' THEN page.is_guardian END DESC NULLS LAST,
      CASE WHEN p_sort = 'created_at' AND p_order = 'asc' THEN page.created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'created_at' AND p_order = 'desc' THEN page.created_at END DESC NULLS LAST,
      page.id ASC
    ),
    '[]'::jsonb
  ) INTO v_data
  FROM (
    SELECT * FROM filtered
    ORDER BY
      CASE WHEN p_sort = 'full_name' AND p_order = 'asc' THEN lower(full_name) END ASC NULLS LAST,
      CASE WHEN p_sort = 'full_name' AND p_order = 'desc' THEN lower(full_name) END DESC NULLS LAST,
      CASE WHEN p_sort = 'email' AND p_order = 'asc' THEN lower(email) END ASC NULLS LAST,
      CASE WHEN p_sort = 'email' AND p_order = 'desc' THEN lower(email) END DESC NULLS LAST,
      CASE WHEN p_sort = 'role' AND p_order = 'asc' THEN role END ASC NULLS LAST,
      CASE WHEN p_sort = 'role' AND p_order = 'desc' THEN role END DESC NULLS LAST,
      CASE WHEN p_sort = 'is_guardian' AND p_order = 'asc' THEN is_guardian END ASC NULLS LAST,
      CASE WHEN p_sort = 'is_guardian' AND p_order = 'desc' THEN is_guardian END DESC NULLS LAST,
      CASE WHEN p_sort = 'created_at' AND p_order = 'asc' THEN created_at END ASC NULLS LAST,
      CASE WHEN p_sort = 'created_at' AND p_order = 'desc' THEN created_at END DESC NULLS LAST,
      id ASC
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 20), 100))
  ) page;

  RETURN jsonb_build_object('data', v_data, 'total', v_total);
END;
$function$;

-- Profile updates run in one database transaction so concurrent requests
-- cannot demote the last unarchived system administrator.
CREATE OR REPLACE FUNCTION public.admin_update_user_profile(
  p_actor uuid,
  p_user uuid,
  p_full_name text,
  p_role public.user_role_enum,
  p_admin_role_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_role public.user_role_enum;
  v_current public.user_profiles%ROWTYPE;
  v_super_admin_count bigint;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;

  SELECT actor.role INTO v_actor_role
  FROM public.user_profiles actor
  WHERE actor.id = p_actor
    AND actor.archived_at IS NULL
    AND actor.role IN ('super_admin', 'general_supervisor');
  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'إدارة المستخدمين متاحة للإداريين فقط' USING ERRCODE = '42501';
  END IF;

  IF p_full_name IS NULL OR char_length(btrim(p_full_name)) < 2 OR char_length(btrim(p_full_name)) > 120 THEN
    RAISE EXCEPTION 'اكتب الاسم كاملًا' USING ERRCODE = '22023';
  END IF;
  IF p_role IS NULL THEN
    RAISE EXCEPTION 'الدور المختار غير صالح' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('admin-users-profile-role'));
  SELECT profile.* INTO v_current
  FROM public.user_profiles profile
  WHERE profile.id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الحساب غير موجود' USING ERRCODE = 'P0002';
  END IF;
  IF v_current.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'لا يمكن تعديل حساب مؤرشف' USING ERRCODE = 'P0001';
  END IF;

  IF p_role NOT IN ('customer', 'service_provider', 'publisher', 'general_supervisor', 'super_admin')
     AND p_role IS DISTINCT FROM v_current.role THEN
    RAISE EXCEPTION 'الدور المختار غير صالح' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.child_profiles child
    WHERE child.account_profile_id = p_user::text
  ) AND p_role IS DISTINCT FROM v_current.role THEN
    RAISE EXCEPTION 'حساب الطفل تابع لولي أمره ولا يتغير دوره من هذه الصفحة' USING ERRCODE = 'P0001';
  END IF;

  IF (v_current.role IN ('super_admin', 'general_supervisor')
      OR p_role IN ('super_admin', 'general_supervisor'))
     AND v_actor_role <> 'super_admin' THEN
    RAISE EXCEPTION 'تعديل الأدوار الإدارية متاح لمدير النظام فقط' USING ERRCODE = '42501';
  END IF;

  IF v_current.role = 'super_admin' AND p_role <> 'super_admin' THEN
    IF p_actor = p_user THEN
      RAISE EXCEPTION 'لا تغيّر دور حسابك الإداري من هذه الصفحة' USING ERRCODE = 'P0001';
    END IF;
    SELECT count(*) INTO v_super_admin_count
    FROM public.user_profiles profile
    WHERE profile.role = 'super_admin'
      AND profile.archived_at IS NULL;
    IF v_super_admin_count <= 1 THEN
      RAISE EXCEPTION 'لا يمكن تغيير دور آخر مدير نظام' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_role = 'general_supervisor' AND p_admin_role_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.admin_roles admin_role WHERE admin_role.id = p_admin_role_id
  ) THEN
    RAISE EXCEPTION 'مجموعة الصلاحيات المختارة غير موجودة' USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_profiles
  SET full_name = btrim(p_full_name),
      role = p_role,
      admin_role_id = CASE WHEN p_role = 'general_supervisor' THEN p_admin_role_id ELSE NULL END,
      updated_at = pg_catalog.now()
  WHERE id = p_user;
END;
$function$;

-- Keep the activity recheck, account purge, and deletion-request closure in
-- one transaction. Auth rows are removed by the Edge Function afterwards.
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_actor uuid,
  p_user uuid,
  p_reason text
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_role public.user_role_enum;
  v_target_role public.user_role_enum;
  v_logins uuid[];
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;
  SELECT actor.role INTO v_actor_role
  FROM public.user_profiles actor
  WHERE actor.id = p_actor
    AND actor.archived_at IS NULL;
  IF v_actor_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'حذف الحسابات متاح لمدير النظام فقط' USING ERRCODE = '42501';
  END IF;
  IF p_actor = p_user THEN
    RAISE EXCEPTION 'لا يمكنك حذف حسابك' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'اكتب سبب الحذف، ثلاثة أحرف على الأقل' USING ERRCODE = '22023';
  END IF;

  SELECT profile.role INTO v_target_role
  FROM public.user_profiles profile
  WHERE profile.id = p_user
    AND profile.archived_at IS NULL
  FOR UPDATE;
  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'الحساب غير موجود أو مؤرشف' USING ERRCODE = 'P0002';
  END IF;
  IF v_target_role IN ('super_admin', 'general_supervisor') THEN
    RAISE EXCEPTION 'الحسابات الإدارية لا يمكن حذفها' USING ERRCODE = '42501';
  END IF;

  v_logins := public.admin_purge_account(p_user);
  UPDATE public.account_deletion_requests
  SET status = 'done',
      handled_at = pg_catalog.now(),
      handled_by = p_actor,
      admin_notes = 'اتمسح بالكامل (مكانش عليه حركات) — ' || btrim(p_reason)
  WHERE user_id = p_user AND status = 'pending';
  RETURN v_logins;
END;
$function$;

-- Archive the guardian and child login profiles together when history must
-- remain. The same transaction rechecks activity and closes pending requests.
CREATE OR REPLACE FUNCTION public.admin_archive_user(
  p_actor uuid,
  p_user uuid,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor_role public.user_role_enum;
  v_current public.user_profiles%ROWTYPE;
  v_activity jsonb;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'غير مصرح' USING ERRCODE = '42501';
  END IF;
  SELECT actor.role INTO v_actor_role
  FROM public.user_profiles actor
  WHERE actor.id = p_actor
    AND actor.archived_at IS NULL;
  IF v_actor_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'أرشفة الحسابات متاحة لمدير النظام فقط' USING ERRCODE = '42501';
  END IF;
  IF p_actor = p_user THEN
    RAISE EXCEPTION 'لا يمكنك أرشفة حسابك' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'اكتب سبب الحذف، ثلاثة أحرف على الأقل' USING ERRCODE = '22023';
  END IF;

  SELECT profile.* INTO v_current
  FROM public.user_profiles profile
  WHERE profile.id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'الحساب غير موجود' USING ERRCODE = 'P0002';
  END IF;
  IF v_current.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'الحساب مؤرشف بالفعل' USING ERRCODE = 'P0001';
  END IF;
  IF v_current.role IN ('super_admin', 'general_supervisor') THEN
    RAISE EXCEPTION 'الحسابات الإدارية لا يمكن أرشفتها' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.child_profiles child
    WHERE child.account_profile_id = p_user::text
  ) THEN
    RAISE EXCEPTION 'حساب الطفل يُدار من حساب ولي أمره' USING ERRCODE = 'P0001';
  END IF;

  v_activity := public.account_activity(p_user);
  IF COALESCE((v_activity->>'total')::integer, 0) <= 0 THEN
    RAISE EXCEPTION 'تغيرت حركات الحساب؛ أعد فحص الحساب قبل الحذف' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.user_profiles profile
  SET archived_at = v_now,
      archived_by = p_actor,
      suspended_at = COALESCE(profile.suspended_at, v_now),
      suspension_reason = 'حساب محذوف (مؤرشف): ' || btrim(p_reason),
      updated_at = v_now
  WHERE (profile.id = p_user
     OR profile.id::text IN (
       SELECT child.account_profile_id
       FROM public.child_profiles child
       WHERE child.user_profile_id = p_user
         AND child.account_profile_id IS NOT NULL
     ))
    AND profile.archived_at IS NULL;

  UPDATE public.account_deletion_requests
  SET status = 'done',
      handled_at = v_now,
      handled_by = p_actor,
      admin_notes = 'اتقفل واتأرشف (عليه حركات) — ' || btrim(p_reason)
  WHERE user_id = p_user AND status = 'pending';
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_users(uuid, text, text, boolean, text, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(uuid, text, text, boolean, text, text, text, integer, integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_update_user_profile(uuid, uuid, text, public.user_role_enum, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_profile(uuid, uuid, text, public.user_role_enum, uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, uuid, text)
  TO service_role;
REVOKE ALL ON FUNCTION public.admin_archive_user(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_user(uuid, uuid, text)
  TO service_role;

COMMIT;
