-- ============================================================================
-- معادلة تسعير خاصة بمقدّمي الخدمات + نقل شغل مقدّم لمقدّم
-- ============================================================================
--
-- ── ① المعادلة ──────────────────────────────────────────────
--
-- الوضع   : `pricing_formula_settings` جدول بصفوف بالاسم — فيه
--           `default` (الجلسات والمدربين) و`publisher-default`
--           (الكتب). وطلبات الخدمات كانت بتقرا من `default`، يعني
--           **نصيب المنصة من الخدمة مربوط بنصيبها من الجلسة** — تغيير
--           واحد فيهم بيغيّر التاني من غير ما حد يقصد.
--
-- الحل    : صف تالت `provider-default` بنفس الشكل.
--
-- ⚠️ **بيتزرع بقيم `default` الحالية، مش بـ(1, 0).** الصفر معناه
--    «المنصة ماتاخدش حاجة» — فلو الصف اتعمل فاضي، كل خدمة تتباع
--    بسعر المقدّم بالظبط والمنصة تطلع بصفر من غير ما حد يلاحظ. الزرع
--    من القيم الشغّالة بيخلّي اليوم الأول **مفيش فيه أي تغيير سلوك**،
--    والإدارة تفرّقهم لما تحب.
--
-- ── ② النقل ─────────────────────────────────────────────────
--
-- الحاجة  : إيقاف مقدّم خدمة كان بيسيب طلباته الجارية معلّقة عليه،
--           ومفيش أي شاشة بتغيّر `provider_id` بعد إنشاء الطلب.
--
-- ⚠️ **النقل بنفس السعر بالظبط.** `amount` و`instructor_earning`
--    مابيتحسبوش من جديد: العميل اتفق على رقم، والمقدّم الجديد سعره
--    المعتمد ممكن يكون أعلى أو أقل — ومش ذنب العميل في الحالتين.
--    فالصف بيتنقل بأرقامه زيّ ما هي، والفرق (لو فيه) على المنصة.
--
-- ⚠️ **واللي اتسجّل له مستحق مابيتنقلش** — بيرجع في `blocked`.
--    المستحق متسجّل باسم المقدّم القديم في `payouts`، ونقل الطلب
--    بعده بيخلّي الفلوس عند واحد والشغل عند التاني. نفس قاعدة
--    `transfer_instructor_work`.
--
-- ⚠️ **والمنقول له لازم يكون `active`** ولازم يكون **بيقدّم الخدمة
--    دي أصلًا** (عرض معتمد ومفعّل). نقل طلب لمقدّم مابيقدّمش الخدمة
--    بيدّي طلبًا مستحيل ينفّذ.
--
-- الأنواع : service_providers.id text | service_orders.provider_id text
--           provider_services.provider_id text | .service_id text
--
-- الأثر   : صف إعدادات واحد + دالة واحدة. مفيش سعر بيتغيّر على أي
--           طلب قائم، ومفيش صلاحية بتتوسّع.
--
-- الرجوع  : delete from pricing_formula_settings where id = 'provider-default';
--           drop function public.transfer_provider_work(text, text);
-- ============================================================================

-- ── ① ───────────────────────────────────────────────────────
insert into public.pricing_formula_settings (id, platform_multiplier, fixed_admin_fee, updated_at)
select 'provider-default', platform_multiplier, fixed_admin_fee, now()
  from public.pricing_formula_settings
 where id = 'default'
on conflict (id) do nothing;

-- لو صف `default` نفسه مش موجود (قاعدة نضيفة)، بنزرع المحايد عشان
-- القراءة ماترجعش فاضية — والقراءة في الكود بترجع لـ`default` قبل ده.
insert into public.pricing_formula_settings (id, platform_multiplier, fixed_admin_fee, updated_at)
values ('provider-default', 1, 0, now())
on conflict (id) do nothing;


-- ── ② ───────────────────────────────────────────────────────
create or replace function public.transfer_provider_work(p_from text, p_to text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_name  text;
  v_to_name    text;
  v_to_status  text;
  v_to_user    uuid;
  v_moved      integer := 0;
  v_blocked    jsonb;
  v_left       integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'denied');
  end if;

  if p_from is null or p_to is null or p_from = p_to then
    return jsonb_build_object('ok', false, 'error', 'same_provider');
  end if;

  select display_name into v_from_name
    from service_providers where id::text = p_from;
  if v_from_name is null then
    return jsonb_build_object('ok', false, 'error', 'from_not_found');
  end if;

  select display_name, status::text, user_id into v_to_name, v_to_status, v_to_user
    from service_providers where id::text = p_to;
  if v_to_name is null then
    return jsonb_build_object('ok', false, 'error', 'to_not_found');
  end if;

  if v_to_status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'to_not_active', 'status', v_to_status);
  end if;

  -- ── النقل: نفس السعر، ونفس المستحق ────────────────────────
  --
  -- ⚠️ `amount` و`instructor_earning` **مش في `set`** عن قصد.
  update service_orders o
     set provider_id = p_to,
         updated_at  = now()
   where o.provider_id::text = p_from
     and o.status::text in ('pending', 'awaiting_verification', 'paid', 'in_progress')
     -- اتسجّل له مستحق؟ يبقى لأ.
     and not exists (
       select 1 from payouts y
        where y.source_type = 'service_order' and y.source_id::text = o.id::text)
     -- المقدّم الجديد بيقدّم الخدمة دي أصلًا؟
     and exists (
       select 1 from provider_services ps
        where ps.provider_id::text = p_to
          and ps.service_id::text = o.standalone_service_id::text
          and ps.status = 'approved'
          and ps.is_active);
  get diagnostics v_moved = row_count;

  -- ── اللي اترفض، بالسبب ────────────────────────────────────
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', o.id,
           'status', o.status::text,
           'why', case
             when exists (select 1 from payouts y
                           where y.source_type = 'service_order'
                             and y.source_id::text = o.id::text)
               then 'اتسجّل له مستحق'
             else 'المقدّم الجديد مابيقدّمش الخدمة دي'
           end)), '[]'::jsonb)
    into v_blocked
    from service_orders o
   where o.provider_id::text = p_from
     and o.status::text in ('pending', 'awaiting_verification', 'paid', 'in_progress');

  -- ⚠️ **بنعدّ بعد النقل.** الشاشة بتقول الرقم ده صريح لو مش صفر —
  --    «اتنقل» من غير تأكيد هو بالظبط النجاح الكاذب اللي بنقفله.
  select count(*) into v_left
    from service_orders o
   where o.provider_id::text = p_from
     and o.status::text in ('pending', 'awaiting_verification', 'paid', 'in_progress');

  return jsonb_build_object(
    'ok', true,
    'fromName', v_from_name,
    'toName', v_to_name,
    'toUserId', v_to_user,
    'moved', v_moved,
    'blocked', v_blocked,
    'remaining', v_left
  );
end
$$;

revoke all on function public.transfer_provider_work(text, text) from public, anon;
grant execute on function public.transfer_provider_work(text, text) to authenticated;

comment on function public.transfer_provider_work(text, text) is
  'بينقل طلبات الخدمة الجارية من مقدّم لمقدّم active بيقدّم نفس الخدمة — بنفس السعر والمستحق. اللي اتسجّل له مستحق بيترفض بالسبب.';


-- ============================================================================
-- التحقق — قراءة بس
-- ============================================================================
--   -- (أ) المعادلات التلاتة موجودة؟
--   select id as "المعادلة", platform_multiplier as "المعامل",
--          fixed_admin_fee as "الرسم الثابت"
--     from pricing_formula_settings order by id;
--   -- المتوقع: default / provider-default / publisher-default
--   -- و`provider-default` بنفس قيم `default` لحد ما تغيّرها.
--
--   -- (ب) تجربة النقل — جوّه معاملة بتتلغي
--   begin;
--   do $probe$
--   declare v_from text; v_to text; r jsonb;
--   begin
--     select provider_id into v_from from service_orders
--      where provider_id is not null
--        and status::text in ('pending','awaiting_verification','paid','in_progress')
--      limit 1;
--     select id into v_to from service_providers
--      where status::text = 'active' and id::text <> coalesce(v_from,'') limit 1;
--     if v_from is null then raise exception 'RESULT: مفيش طلب خدمة جارٍ للتجربة'; end if;
--     if v_to   is null then raise exception 'RESULT: مفيش مقدّم active تاني'; end if;
--     r := public.transfer_provider_work(v_from, v_to);
--     raise exception 'RESULT: %', r;
--   end $probe$;
--   rollback;
-- ============================================================================
