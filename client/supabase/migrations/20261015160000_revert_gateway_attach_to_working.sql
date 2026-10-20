-- ============================================================================
-- رجوع: الدفع يرجع يشتغل زيّ الصبح
-- ============================================================================
-- العطل   : الدفع في «إنها لك» واقف من بعد 20261015140000
--           (ALR-000042-2F و ALR-000043-QG). سجلّ الخادم قال:
--             تعذّر ربط جلسة الدفع — 42883
--             operator does not exist: text = uuid
--
-- السبب   : **تعديلي كشف عطلًا أقدم مستخبي.**
--           قبل التعديل، `guard_order_fields` كان بيرجّع
--           `payment_provider` و`payment_session_id` لقيمتهم القديمة —
--           يعني تحديث `attach_payment_session` ماكانش بيغيّر ولا عمود
--           فعليًّا (غير `updated_at`). العلامة اللي ضفتها
--           (`app.gateway_attach`) خلّت القيم **تتغيّر بجد** لأول مرة،
--           فاتفتح في محفّز تاني مسار ماكانش بيتنفّذ أبدًا، وفيه مقارنة
--           بين `text` و`uuid` بترمي.
--
--           يعني العطل ده موجود في القاعدة من قبل النهاردة، وتعديلي هو
--           اللي شغّله.
--
-- القرار  : **الرجوع أولًا.** مكسب التعديل كان تخزين رقم جلسة الدفع
--           للتتبّع — وده **مش مطلوب لإتمام الدفع** أصلًا: الويبهوك
--           بيكتب المزوّد والجلسة والنيّة بمفتاح الخدمة بعد الدفع.
--           فمينفعش يفضل الدفع واقف عشانه. المحفّز المكسور يتلاقى
--           ويتصلّح بعيد عن الإنتاج، وبعدين نرجّع التحسين.
--
-- الأثر   : دالتين بيرجعوا حرفيًّا لنسخة الصبح الشغّالة:
--             • `guard_order_fields`     من 20261015071231
--             • `attach_payment_session` من 20261015060000
--           إلغاء العميل لطلبه **مابيتأثرش** — `app.customer_cancel`
--           جوّه النسخة دي زيّ ما هي.
--           ودوال «بداية الرحلة» (`_cw`) مابتتلمسش هنا.
--
-- التحقق  : الدفع يشتغل. وبعدها الاستعلام اللي آخر الملف بيلاقي
--           المحفّز اللي فيه المقارنة المكسورة.
-- ============================================================================

create or replace function public.guard_order_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- الاستثناءان الوحيدان للعميل:
  --   ١) «حوّلت» + الإيصال.
  --   ٢) إلغاء طلبه هو وهو لسه مادفعش — والعلامة بتتحط من
  --      `cancel_my_order` وحدها وبتعيش جوه المعاملة بس.
  IF (OLD.status = 'pending' AND NEW.status = 'awaiting_verification')
     OR (coalesce(current_setting('app.customer_cancel', true), '') = 'on'
         AND OLD.status IN ('pending', 'failed')
         AND NEW.status = 'cancelled') THEN
    NULL;
  ELSE
    NEW.status              := OLD.status;
    NEW.payment_method      := OLD.payment_method;
    NEW.payment_receipt_url := OLD.payment_receipt_url;
  END IF;

  NEW.id                    := OLD.id;
  NEW.user_id               := OLD.user_id;
  NEW.total_amount          := OLD.total_amount;
  NEW.shipping_fee          := OLD.shipping_fee;
  NEW.created_at            := OLD.created_at;
  NEW.payment_reference     := OLD.payment_reference;
  NEW.transaction_reference := OLD.transaction_reference;
  NEW.country_code          := OLD.country_code;
  NEW.payment_provider      := OLD.payment_provider;
  NEW.payment_session_id    := OLD.payment_session_id;
  NEW.payment_intent_id     := OLD.payment_intent_id;
  NEW.paid_at               := OLD.paid_at;
  NEW.shipped_at            := OLD.shipped_at;
  NEW.delivered_at          := OLD.delivered_at;
  NEW.tracking_reference    := OLD.tracking_reference;
  -- سبب الإلغاء لازم يتكتب مع الإلغاء؛ وغير كده الملاحظات للإدارة وحدها.
  IF coalesce(current_setting('app.customer_cancel', true), '') <> 'on' THEN
    NEW.admin_notes         := OLD.admin_notes;
  END IF;
  NEW.electronic_sent_at    := OLD.electronic_sent_at;
  NEW.box_plan_id           := OLD.box_plan_id;
  NEW.box_details           := OLD.box_details;

  RETURN NEW;
END
$function$;

create or replace function public.attach_payment_session(
  p_order_id uuid,
  p_session_id text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order record;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'unauthenticated');
  end if;
  if nullif(btrim(coalesce(p_session_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'error', 'missing_session');
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_order.user_id <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_your_order');
  end if;
  if v_order.status not in ('pending', 'failed') then
    return jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v_order.status);
  end if;

  update orders
     set payment_provider   = 'xpay',
         payment_session_id = btrim(p_session_id),
         updated_at         = now()
   where id = p_order_id;

  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.attach_payment_session(uuid, text) from public, anon;
grant execute on function public.attach_payment_session(uuid, text) to authenticated;

-- ============================================================================
-- للتشخيص بعدين — قراءة بس: مين فيه مقارنة text/uuid؟
-- ============================================================================
--   select p.proname
--     from pg_trigger t
--     join pg_class c  on c.oid = t.tgrelid
--     join pg_proc p   on p.oid = t.tgfoid
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relname = 'orders' and not t.tgisinternal;
--
--   select table_name, column_name, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and column_name in ('source_id', 'entity_id', 'reference_id')
--    order by table_name;
-- ============================================================================
