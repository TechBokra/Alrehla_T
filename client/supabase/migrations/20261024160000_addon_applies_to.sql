-- ═══════════════════════════════════════════════════════════════
-- الإضافات: «بتظهر مع أنهي منتج»
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — طلب تامر (٢٤ أكتوبر): «في لوحة تحكم الإضافات يظهر اختيار
--   المنتجات، والمدير يختار هل تظهر الإضافة دي مع المنتج ده أو لأ».
--
-- اللي بيتضاف
--   ١) `addon_products.applies_to text[]` — نفس فكرة أهداف التخصيص
--      وخاناته (ملف 12) بالظبط:
--        NULL         = مع كل المنتجات (زي ما كان)
--        ['<id>', …]  = مع المنتجات دي بس
--      ومحفّز `guard_applies_to` الموجود من ملف 12 بيتأكد إن كل منتج
--      مختار موجود فعلًا، وبيحوّل القايمة الفاضية لـNULL.
--
--   ٢) حارس بنود الطلب (`guard_order_item_addons`) بيرفض إضافة مش
--      متاحة للمنتج — حتى لو اتبعتت من برّه الشاشة.
--      ⚠️ نفس دالة ترحيل 20261024140000 + فحص المنتج. الترحيل ده
--         بيعيد تعريفها كاملة، فترتيب تشغيل الاتنين مايفرقش في الحارس.
--
-- الأثر
--   • عمود فاضي على كل الإضافات = كل حاجة زي ما هي لحد ما الإدارة تختار.
--   • الطلبات القديمة مابتتلمسش.
--
-- التحقق
--   select count(*) filter (where applies_to is null) from addon_products;  ← كل الإضافات
--   select tgname from pg_trigger where tgname in ('addon_products_applies_to_trg','guard_order_item_addons');
--   ← الاتنين
--
-- الرجوع للخلف
--   drop trigger if exists addon_products_applies_to_trg on public.addon_products;
--   alter table public.addon_products drop column if exists applies_to;
--   (والحارس: شغّل ترحيل 20261024140000 تاني يرجّعه من غير فحص المنتج)
-- ═══════════════════════════════════════════════════════════════

alter table public.addon_products
  add column if not exists applies_to text[];

comment on column public.addon_products.applies_to is
  'المنتجات اللي الإضافة بتظهر معاها. NULL = كل المنتجات. (قرار ٢٤ أكتوبر)';

drop trigger if exists addon_products_applies_to_trg on public.addon_products;
create trigger addon_products_applies_to_trg
  before insert or update of applies_to on public.addon_products
  for each row execute function public.guard_applies_to();

create or replace function public.guard_order_item_addons()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_addons  jsonb;
  v_out     jsonb := '[]'::jsonb;
  v_el      jsonb;
  v_fmt     text;
  v_applies text[];
  v_found   boolean;
begin
  v_addons := new.customization_data -> 'addons';
  if v_addons is null or jsonb_typeof(v_addons) <> 'array' or jsonb_array_length(v_addons) = 0 then
    return new;
  end if;

  for v_el in select * from jsonb_array_elements(v_addons) loop
    select coalesce(ap.delivery_format, v_el ->> 'deliveryFormat', 'printed'), ap.applies_to, ap.id is not null
      into v_fmt, v_applies, v_found
      from (select 1) x
      left join addon_products ap on ap.id = v_el ->> 'id';

    -- «بيظهر فين» (٢٤ أكتوبر): الإضافة مقصورة على منتجات بعينها؟
    if v_found and v_applies is not null and not (new.product_id::text = any (v_applies)) then
      raise exception 'إضافة «%» مش متاحة مع المنتج ده. ارجع لخطوة الإضافات وشيلها.',
        coalesce(v_el ->> 'name', 'إضافة');
    end if;

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


drop trigger if exists guard_order_item_addons on public.order_items;
create trigger guard_order_item_addons
  before insert on public.order_items
  for each row execute function public.guard_order_item_addons();
