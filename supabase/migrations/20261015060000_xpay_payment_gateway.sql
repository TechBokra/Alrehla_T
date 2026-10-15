-- ============================================================================
-- بوابة الدفع XPay — الطبقة اللي في القاعدة
-- ============================================================================
-- الغرض   : الدفع بالفيزا/فوري/فاليو/المحافظ عن طريق XPay، مع إبقاء التحويل
--           اليدوي (إنستاباي/فودافون كاش) شغّالًا كما هو كبديل فوري.
--
-- الأثر   : أعمدة جديدة على orders بقيم افتراضية (الطلبات القديمة تبقى
--           `manual` زي ما هي، ومفيش أي تغيير في قيمها)، جدول جديد
--           payment_events، دالة RPC للويبهوك، وصف إعدادات 'payments'
--           **بالبوابة مقفولة افتراضيًا** — يعني تطبيق الملف ده لوحده
--           لا يغيّر أي شيء يشوفه العميل. الفتح من لوحة الإدارة.
--
-- الترتيب : قبل نشر الكود أو بعده — الكود الجديد بيقرا الإعداد وبيتصرّف،
--           والكود القديم ما بيعرفش الأعمدة دي أصلًا فما بيتأثرش.
--
-- التحقق  : supabase/tests/xpay-payment.sql (begin/rollback، لا يغيّر بيانات).
--
-- ⚠️ المبدأ الحاكم: **الدفع لا يتأكّد إلا بمرجع من البوابة**. رجوع العميل
--    لصفحة النجاح في المتصفح ليس دليلًا — أي شخص يقدر يفتح الرابط ده.
--    عشان كده `pending → paid` للطلب المدفوع بالبوابة ممنوع في القاعدة
--    نفسها إلا لو `payment_intent_id` موجود، وده بيتكتب من الويبهوك فقط.
--
-- الرجوع  : في آخر الملف.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- ١) أعمدة البوابة على الطلب
-- ─────────────────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists payment_provider   text not null default 'manual',
  add column if not exists payment_session_id text,
  add column if not exists payment_intent_id  text,
  add column if not exists paid_at            timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_provider_check') then
    alter table public.orders
      add constraint orders_payment_provider_check
      check (payment_provider in ('manual', 'xpay'));
  end if;
end $$;

comment on column public.orders.payment_provider is
  'manual = تحويل بنكي بإيصال يراجعه الأدمن · xpay = بوابة دفع.';
comment on column public.orders.payment_intent_id is
  'مرجع الدفعة من XPay. وجوده هو الدليل الوحيد المقبول لتأكيد دفع البوابة، ولا يُكتب إلا من الويبهوك.';

-- مرجع البوابة فريد: نفس الدفعة ما تتسجّلش على طلبين.
create unique index if not exists orders_payment_intent_unique
  on public.orders (payment_intent_id) where payment_intent_id is not null;

-- وسائل الدفع: القديمة + وسائل البوابة.
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (
    payment_method is null
    or payment_method in ('instapay', 'vodafone_cash', 'card', 'fawry', 'valu', 'wallet')
  );


-- ─────────────────────────────────────────────────────────────────────────
-- ٢) سجلّ أحداث الويبهوك — منع التكرار والتدقيق
-- ─────────────────────────────────────────────────────────────────────────
-- XPay بتعيد إرسال الحدث لو ردّينا بخطأ أو اتأخرنا، وبتسمح بإعادة الإرسال
-- يدويًا من لوحتها. من غير الجدول ده، الحدث الواحد ممكن يتعالج مرتين.
create table if not exists public.payment_events (
  id            text primary key,
  event_type    text not null,
  order_id      uuid references public.orders(id) on delete set null,
  outcome       text not null,
  amount_minor  bigint,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

comment on table public.payment_events is
  'كل حدث ويبهوك وصل من بوابة الدفع ونتيجته. المفتاح هو رقم الحدث عند البوابة، فإعادة الإرسال لا تُعالَج مرتين.';

alter table public.payment_events enable row level security;

-- القراءة للأدمن فقط (للتشخيص من اللوحة). الكتابة من الدالة أدناه فقط.
drop policy if exists "Admins read payment events" on public.payment_events;
create policy "Admins read payment events" on public.payment_events
  for select using (public.is_admin());

create index if not exists payment_events_order_idx on public.payment_events (order_id, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────
-- ٣) قواعد الانتقال: الطلب المدفوع بالبوابة لا يحتاج إيصالًا، بل مرجعًا
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.validate_order_state_transition()
returns trigger language plpgsql set search_path to 'public' as $function$
DECLARE
  v_transition_allowed boolean := false;
  v_payment_proof_valid boolean := false;
  v_has_electronic_item boolean := false;
  v_gateway boolean := NEW.payment_provider = 'xpay';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_transition_allowed := CASE OLD.status
      WHEN 'pending' THEN
        -- ⭐ البوابة بتأكّد الدفع في خطوة واحدة (مفيش إيصال يتراجع)، وبتقدر
        --    كمان تقول إن الدفع فشل. التحويل اليدوي زي ما هو بالظبط.
        NEW.status IN ('awaiting_verification', 'cancelled')
        OR (v_gateway AND NEW.status IN ('paid', 'failed'))
      WHEN 'awaiting_verification' THEN
        NEW.status IN ('paid', 'cancelled')
      WHEN 'failed' THEN
        -- محاولة جديدة بعد فشل الدفع: العميل يقدر يدفع تاني.
        NEW.status = 'cancelled' OR (v_gateway AND NEW.status = 'paid')
      WHEN 'paid' THEN
        NEW.status IN ('preparing', 'shipped', 'cancelled', 'refunded')
      WHEN 'preparing' THEN
        NEW.status IN ('shipped', 'cancelled')
      WHEN 'shipped' THEN
        NEW.status IN ('delivered', 'cancelled')
      ELSE false
    END;

    IF NOT coalesce(v_transition_allowed, false) THEN
      RAISE EXCEPTION 'Invalid order status transition: % -> %', OLD.status, NEW.status
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- A submitted payment must include a supported method and a receipt from
  -- our private receipt folder, or a legacy Cloudinary receipt URL.
  IF OLD.status = 'pending' AND NEW.status = 'awaiting_verification' THEN
    v_payment_proof_valid :=
      NEW.payment_method IN ('instapay', 'vodafone_cash')
      AND nullif(btrim(NEW.payment_receipt_url), '') IS NOT NULL
      AND (
        (
          NEW.payment_receipt_url ~ '^private:[A-Za-z0-9]{2,5}:alrehla/private/receipts/.+$'
          AND position('..' IN NEW.payment_receipt_url) = 0
        )
        OR NEW.payment_receipt_url ~ '^https://res\.cloudinary\.com/[^/]+/image/upload/'
      );

    IF NOT coalesce(v_payment_proof_valid, false) THEN
      RAISE EXCEPTION 'A supported payment method and valid receipt are required before payment review'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- ⚠️ الدليل على الدفع يختلف حسب الوسيلة:
  --    البوابة  → مرجع دفعة من XPay (`payment_intent_id`) — يكتبه الويبهوك.
  --    التحويل  → صورة إيصال في مجلّدنا الخاص (كما كان).
  IF NEW.status IN ('paid', 'preparing', 'shipped', 'delivered')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_gateway THEN
      v_payment_proof_valid :=
        nullif(btrim(NEW.payment_intent_id), '') IS NOT NULL
        AND NEW.payment_method IN ('card', 'fawry', 'valu', 'wallet');
    ELSE
      v_payment_proof_valid :=
        NEW.payment_method IN ('instapay', 'vodafone_cash')
        AND nullif(btrim(NEW.payment_receipt_url), '') IS NOT NULL
        AND (
          (
            NEW.payment_receipt_url ~ '^private:[A-Za-z0-9]{2,5}:alrehla/private/receipts/.+$'
            AND position('..' IN NEW.payment_receipt_url) = 0
          )
          OR NEW.payment_receipt_url ~ '^https://res\.cloudinary\.com/[^/]+/image/upload/'
        );
    END IF;

    IF NOT coalesce(v_payment_proof_valid, false) THEN
      RAISE EXCEPTION 'Valid payment proof is required before confirming or fulfilling an order'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- الدليل ما يتغيّرش بعد التأكيد — للاتنين.
  IF OLD.status IN ('paid', 'preparing', 'shipped', 'delivered')
     AND (
       NEW.payment_method IS DISTINCT FROM OLD.payment_method
       OR NEW.payment_receipt_url IS DISTINCT FROM OLD.payment_receipt_url
       OR NEW.payment_intent_id IS DISTINCT FROM OLD.payment_intent_id
       OR NEW.payment_provider IS DISTINCT FROM OLD.payment_provider
     ) THEN
    RAISE EXCEPTION 'Payment proof cannot be changed after payment is confirmed'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND nullif(btrim(NEW.admin_notes), '') IS NULL THEN
    RAISE EXCEPTION 'A cancellation reason is required'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'shipped' AND NEW.shipped_at IS NULL THEN
    RAISE EXCEPTION 'A shipped order must have a shipped timestamp'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'delivered'
     AND (NEW.shipped_at IS NULL OR NEW.delivered_at IS NULL) THEN
    RAISE EXCEPTION 'A delivered order must have shipped and delivered timestamps'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.electronic_sent_at IS NOT NULL
     AND NEW.electronic_sent_at IS DISTINCT FROM OLD.electronic_sent_at THEN
    RAISE EXCEPTION 'Electronic delivery confirmation cannot be changed after it is recorded'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.electronic_sent_at IS NULL AND NEW.electronic_sent_at IS NOT NULL THEN
    IF OLD.status NOT IN ('paid', 'preparing', 'shipped', 'delivered') THEN
      RAISE EXCEPTION 'Electronic delivery can only be recorded for a paid order'
        USING ERRCODE = '23514';
    END IF;

    IF nullif(btrim(NEW.delivery_email), '') IS NULL THEN
      RAISE EXCEPTION 'A delivery email is required for electronic delivery'
        USING ERRCODE = '23514';
    END IF;

    SELECT EXISTS (
      SELECT 1
        FROM public.order_items AS item
       WHERE item.order_id = OLD.id
         AND item.format IN ('electronic', 'both')
    ) INTO v_has_electronic_item;

    IF NOT v_has_electronic_item THEN
      RAISE EXCEPTION 'Only an order with an electronic item can be marked as sent'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;


-- ─────────────────────────────────────────────────────────────────────────
-- ٤) العميل لا يلمس حقول البوابة
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_order_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- الاستثناء الوحيد: العميل يقول «حوّلت» ويسيب وسيلة الدفع والإيصال.
  IF OLD.status = 'pending'
     AND NEW.status = 'awaiting_verification' THEN
    NULL;
  ELSE
    NEW.status              := OLD.status;
    NEW.payment_method      := OLD.payment_method;
    NEW.payment_receipt_url := OLD.payment_receipt_url;
  END IF;

  -- الفلوس والملكية والرقم المرجعي: العميل ما بيلمسهمش أبدًا.
  NEW.id                    := OLD.id;
  NEW.user_id               := OLD.user_id;
  NEW.total_amount          := OLD.total_amount;
  NEW.shipping_fee          := OLD.shipping_fee;
  NEW.created_at            := OLD.created_at;
  NEW.payment_reference     := OLD.payment_reference;
  NEW.transaction_reference := OLD.transaction_reference;
  -- الدولة محسوب عليها الشحن وقت الطلب، فتتقفل مع السعر.
  NEW.country_code          := OLD.country_code;

  -- ⚠️ حقول البوابة: الويبهوك وحده بيكتبها (عبر دالة SECURITY DEFINER).
  --    من غير السطور دي، العميل يقدر يكتب `payment_intent_id` بنفسه
  --    ويخلّي الطلب مستوفيًا «دليل الدفع» من غير ما يدفع.
  NEW.payment_provider   := OLD.payment_provider;
  NEW.payment_session_id := OLD.payment_session_id;
  NEW.payment_intent_id  := OLD.payment_intent_id;
  NEW.paid_at            := OLD.paid_at;

  -- التنفيذ والشحن: الإدارة وحدها.
  NEW.shipped_at         := OLD.shipped_at;
  NEW.delivered_at       := OLD.delivered_at;
  NEW.tracking_reference := OLD.tracking_reference;
  NEW.admin_notes        := OLD.admin_notes;
  NEW.electronic_sent_at := OLD.electronic_sent_at;
  NEW.box_plan_id        := OLD.box_plan_id;
  NEW.box_details        := OLD.box_details;

  -- عنوان الشحن وإيميل الاستلام مفتوحين عن قصد: العميل يصحّحهم قبل التنفيذ.

  RETURN NEW;
END
$function$;


-- ─────────────────────────────────────────────────────────────────────────
-- ٥) ربط جلسة دفع بالطلب (قبل تحويل العميل للبوابة)
-- ─────────────────────────────────────────────────────────────────────────
-- بيتنادى من الخادم بجلسة العميل. بيتأكد إن الطلب بتاعه وإنه لسه مش مدفوع.
-- مش بيأكّد أي دفع — بيسجّل رقم الجلسة عشان نربط الويبهوك بالطلب.
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


-- ─────────────────────────────────────────────────────────────────────────
-- ٦) تسجيل نتيجة الدفع من الويبهوك
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️ دي الدالة اللي بتحوّل الطلب لـ«مدفوع»، وبتتنادى من الخادم بمفتاح
--    service_role بعد التحقق من توقيع الويبهوك. مابتثقش في المبلغ الجاي:
--    بتقارنه بإجمالي الطلب، ولو اختلف **مابتأكّدش الدفع** وبتسجّل السبب.
create or replace function public.record_gateway_payment(
  p_event_id     text,
  p_event_type   text,
  p_order_id     uuid,
  p_session_id   text,
  p_intent_id    text,
  p_amount_minor bigint,
  p_method       text,
  p_payload      jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order   record;
  v_outcome text;
  v_method  text := lower(btrim(coalesce(p_method, '')));
  v_expected_minor bigint;
begin
  if nullif(btrim(coalesce(p_event_id, '')), '') is null then
    return jsonb_build_object('ok', false, 'outcome', 'missing_event_id');
  end if;

  -- منع التكرار: أول إدخال للحدث هو اللي بيعالج. إعادة الإرسال بتتجاهَل.
  insert into payment_events (id, event_type, order_id, outcome, amount_minor, payload)
  values (p_event_id, coalesce(p_event_type, 'unknown'), p_order_id, 'processing', p_amount_minor, p_payload)
  on conflict (id) do nothing;

  if not found then
    return jsonb_build_object('ok', true, 'outcome', 'duplicate');
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    update payment_events set outcome = 'order_not_found' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'order_not_found');
  end if;

  -- الدفع الفاشل: الطلب يرجع قابلًا لمحاولة جديدة، ومفيش أي تأكيد.
  if p_event_type is distinct from 'checkout.session.completed' then
    if v_order.status = 'pending' and p_event_type in ('checkout.session.expired', 'payment_intent.payment_failed') then
      -- ⚠️ `payment_provider` لازم يتكتب في نفس التحديث: حارس الانتقالات
      --    بيقرا القيمة الجديدة، ومن غيرها الطلب يفضل 'manual' والانتقال
      --    pending → failed يترفض (اتكشف في التجربة قبل التطبيق).
      update orders
         set status = 'failed', payment_provider = 'xpay', updated_at = now()
       where id = v_order.id;
      v_outcome := 'marked_failed';
    else
      v_outcome := 'ignored';
    end if;
    update payment_events set outcome = v_outcome where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', v_outcome);
  end if;

  if v_order.status in ('paid', 'preparing', 'shipped', 'delivered') then
    update payment_events set outcome = 'already_paid' where id = p_event_id;
    return jsonb_build_object('ok', true, 'outcome', 'already_paid');
  end if;

  -- ⚠️ المبلغ: إجمالي الطلب بالجنيه الصحيح، والبوابة بتبعت بالقرش.
  --    الاختلاف معناه إما خطأ في الربط أو تلاعب — والاتنين يوقفوا التأكيد.
  v_expected_minor := v_order.total_amount::bigint * 100;
  if p_amount_minor is null or p_amount_minor <> v_expected_minor then
    update payment_events set outcome = 'amount_mismatch' where id = p_event_id;
    return jsonb_build_object(
      'ok', false, 'outcome', 'amount_mismatch',
      'expected_minor', v_expected_minor, 'received_minor', p_amount_minor);
  end if;

  if nullif(btrim(coalesce(p_intent_id, '')), '') is null then
    update payment_events set outcome = 'missing_intent' where id = p_event_id;
    return jsonb_build_object('ok', false, 'outcome', 'missing_intent');
  end if;

  if v_method not in ('card', 'fawry', 'valu', 'wallet') then
    v_method := 'card';
  end if;

  update orders
     set status             = 'paid',
         payment_provider   = 'xpay',
         payment_method     = v_method,
         payment_intent_id  = btrim(p_intent_id),
         payment_session_id = coalesce(nullif(btrim(coalesce(p_session_id, '')), ''), payment_session_id),
         paid_at            = now(),
         updated_at         = now()
   where id = v_order.id;

  update payment_events set outcome = 'paid' where id = p_event_id;
  return jsonb_build_object('ok', true, 'outcome', 'paid', 'order_id', v_order.id);
end $$;

-- الويبهوك بينادي الدالة بمفتاح service_role فقط.
revoke all on function public.record_gateway_payment(text, text, uuid, text, text, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_gateway_payment(text, text, uuid, text, text, bigint, text, jsonb)
  to service_role;


-- ─────────────────────────────────────────────────────────────────────────
-- ٧) إعدادات الدفع — **البوابة مقفولة افتراضيًا**
-- ─────────────────────────────────────────────────────────────────────────
-- تطبيق هذا الملف لا يغيّر شيئًا يراه العميل. الفتح من:
--   لوحة الإدارة ← الإعدادات ← الدفع.
insert into public.site_settings (key, value)
select 'payments', jsonb_build_object(
  'provider', 'manual',
  'methods', jsonb_build_array('card', 'fawry', 'valu', 'wallet'),
  'feesPassThrough', false,
  'gatewayDownMessage', ''
)
where not exists (select 1 from public.site_settings where key = 'payments');


-- ============================================================================
-- الرجوع (بالترتيب العكسي):
--   update public.site_settings set value = jsonb_set(value, '{provider}', '"manual"') where key = 'payments';
--   -- ⚠️ وقف البوابة من اللوحة أولًا وتأكد أن لا طلبات قيد الدفع.
--   drop function if exists public.record_gateway_payment(text, text, uuid, text, text, bigint, text, jsonb);
--   drop function if exists public.attach_payment_session(uuid, text);
--   -- (أعد validate_order_state_transition و guard_order_fields من الـmigration السابق لهما)
--   drop table if exists public.payment_events;
--   alter table public.orders drop constraint if exists orders_payment_provider_check;
--   drop index if exists public.orders_payment_intent_unique;
--   alter table public.orders
--     drop column if exists paid_at, drop column if exists payment_intent_id,
--     drop column if exists payment_session_id, drop column if exists payment_provider;
-- ⚠️ لا رجوع بعد تسجيل طلبات مدفوعة بالبوابة: ستفقد مراجع الدفع.
-- ============================================================================
