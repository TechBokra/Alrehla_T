-- ============================================================================
-- العميل يلغي طلبه غير المدفوع بنفسه
-- ============================================================================
-- الغرض   : الطلب بيتسجّل قبل الدفع، فأي محاولة دفع ما كملتش بتسيب طلب
--           «بانتظار الدفع» في حساب العميل. مكانش قدامه غير إنه يستنى
--           الإلغاء التلقائي (٧ أيام) أو يكلّم الدعم. دلوقتي بيلغيه فورًا.
--
-- الأثر   : دالة جديدة بس. مفيش بيانات بتتغيّر، ومفيش صلاحية بتتوسّع:
--           الدالة بتتأكد إن الطلب بتاع صاحب الجلسة وإنه لسه مش مدفوع.
--
-- ⚠️ الإلغاء مسموح فقط من `pending` و`failed` — أي طلب اتدفع أو دخل
--    التجهيز بيرجع 'not_cancellable'، والاسترجاع قرار إداري مش بضغطة
--    من العميل.
--
-- ⚠️ `admin_notes` بتتكتب لأن حارس الانتقالات بيطلب سبب لأي إلغاء،
--    والتريجر `discount_release_orders_trg` بيرجّع كود الخصم تلقائيًا.
--
-- التحقق  : select cancel_my_order('<رقم طلب مش بتاعك>');  -- not_your_order
--           select cancel_my_order('<طلب مدفوع>');          -- not_cancellable
--
-- الرجوع  : drop function if exists public.cancel_my_order(uuid);
-- ============================================================================

create or replace function public.cancel_my_order(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  -- ⚠️ الملكية بتتفحص هنا مش في الواجهة: الدالة `security definer`،
  --    يعني بتتخطّى RLS، فلازم تتأكد بنفسها.
  if v_order.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_order');
  end if;

  if v_order.status not in ('pending', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable', 'status', v_order.status);
  end if;

  update orders
     set status      = 'cancelled',
         admin_notes = 'ألغاه العميل من حسابه.',
         updated_at  = now()
   where id = p_order_id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;
