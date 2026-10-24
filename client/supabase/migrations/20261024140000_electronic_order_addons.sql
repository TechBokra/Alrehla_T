-- ═══════════════════════════════════════════════════════════════
-- الإضافات مع النسخة الإلكترونية
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — قرار تامر (٢٤ أكتوبر):
--   «لما العميل يختار طلب إلكتروني يظهر له فقط الإضافات المتاحة
--    إلكترونيًا».
--
--   • نسخة إلكترونية + إضافة **مطبوعة بس** = **مرفوض**.
--     قبل كده كان بيتقبل، والبند يتحوّل لـ«محتاج شحن» من غير ما
--     العميل ياخد باله (يدفع شحن لبوستر جنب ملف على الإيميل).
--   • نسخة إلكترونية + إضافة «الاتنين» = **مسموح، وبتوصل إلكترونية
--     بس** — والبند من غير شحن.
--
-- ── اللي بيتعمل ─────────────────────────────────────────────
--
--   ١) محفّز `guard_order_item_addons` قبل إضافة بند طلب:
--        • بيرفض الإضافة المطبوعة على بند إلكتروني برسالة عربية
--        • بيكتب على لقطة كل إضافة `deliveredAs` (إزاي هتتسلّم فعلًا)
--          عشان الفريق اللي بينفّذ يعرف يبعت إيه
--      ⚠️ محفّز على `order_items` **مش** تعديل في جسم الدالة: البند
--         بيتكتب في آخر `create_customer_order` جوّه نفس العملية،
--         فالرفض بيلغي الطلب كله — ومفيش نص دالة بيتلمس.
--      ⚠️ بيعتمد على نوع الإضافة **في الكتالوج دلوقتي**، ولو الإضافة
--         اتمسحت، على النوع المكتوب في اللقطة.
--
--   ٢) سطر واحد في `create_customer_order` (قاعدة الشحن):
--        «إضافة مش إلكترونية» ← «إضافة مطبوعة بس»
--      عشان «الاتنين» مع نسخة إلكترونية ماتطلبش شحن. تعديل نصّي
--      بيتأكد من النص الأصلي، ولو مالقاهوش بيوقف.
--
-- الأثر
--   • الطلبات القديمة **مابتتلمسش** (المحفّز على INSERT بس).
--   • سلة قديمة فيها نسخة إلكترونية + إضافة مطبوعة هتترفض عند الطلب —
--     وشاشة الدفع بقت بتقول ده وبتوديه يعدّل البند قبل ما يضغط.
--
-- الترتيب
--   **بعد** `20261023230000_addon_delivery_format` (بيعدّل سطر هو اللي كتبه).
--
-- التحقق
--   1) select exists (select 1 from pg_trigger where tgname = 'guard_order_item_addons');  ← true
--   2) select position('= ''printed''))' in pg_get_functiondef(p.oid)) > 0
--        from pg_proc p where p.proname = 'create_customer_order';                   ← true
--
-- الرجوع للخلف
--   drop trigger if exists guard_order_item_addons on public.order_items;
--   drop function if exists public.guard_order_item_addons();
--   (وسطر الشحن: نفس التعديل بالعكس)
-- ═══════════════════════════════════════════════════════════════

-- ── ١) الحارس ───────────────────────────────────────────────
create or replace function public.guard_order_item_addons()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_addons jsonb;
  v_out    jsonb := '[]'::jsonb;
  v_el     jsonb;
  v_fmt    text;
begin
  v_addons := new.customization_data -> 'addons';
  if v_addons is null or jsonb_typeof(v_addons) <> 'array' or jsonb_array_length(v_addons) = 0 then
    return new;
  end if;

  for v_el in select * from jsonb_array_elements(v_addons) loop
    select coalesce(ap.delivery_format, v_el ->> 'deliveryFormat', 'printed')
      into v_fmt
      from (select 1) x
      left join addon_products ap on ap.id = v_el ->> 'id';

    if coalesce(new.format, 'printed') = 'electronic' and v_fmt = 'printed' then
      raise exception 'إضافة «%» مطبوعة بس، ومش متاحة مع النسخة الإلكترونية. شيلها أو اختار نسخة مطبوعة.',
        coalesce(v_el ->> 'name', 'إضافة');
    end if;

    v_out := v_out || jsonb_build_array(
      v_el || jsonb_build_object(
        'deliveredAs',
        case when coalesce(new.format, 'printed') = 'electronic' then 'electronic' else v_fmt end
      )
    );
  end loop;

  new.customization_data := jsonb_set(new.customization_data, '{addons}', v_out);
  return new;
end $$;

drop trigger if exists guard_order_item_addons on public.order_items;
create trigger guard_order_item_addons
  before insert on public.order_items
  for each row execute function public.guard_order_item_addons();

-- ── ٢) قاعدة الشحن: المطبوعة بس هي اللي بتشحن البند الإلكتروني ──
do $$
declare
  v_src text;
  v_old text := 'WHERE coalesce(ap.delivery_format, ''printed'') <> ''electronic''))';
  v_new text := 'WHERE coalesce(ap.delivery_format, ''printed'') = ''printed''))';
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'create_customer_order'
     and pg_get_function_identity_arguments(p.oid) = 'p_items jsonb, p_shipping jsonb, p_discount_code text';

  if v_src is null then
    raise exception 'create_customer_order مش موجودة — راجع ترتيب الترحيلات';
  end if;

  if position(v_new in v_src) > 0 then
    raise notice 'قاعدة شحن الإضافات (المطبوعة بس) متطبّقة قبل كده — مفيش تغيير';
    return;
  end if;

  if position(v_old in v_src) = 0 then
    raise exception 'ماللقتش سطر شحن الإضافات في create_customer_order — شغّل 20261023230000 الأول أو راجع بإيدك.';
  end if;

  execute replace(v_src, v_old, v_new);
end $$;
