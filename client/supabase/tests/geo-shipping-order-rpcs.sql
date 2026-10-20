-- ============================================================================
-- اختبار دوال الطلب (الدول/التوصيل + أسلوب الكتابة + العروض) — يدوي، بيانات حقيقية
-- ============================================================================
-- التشغيل : SQL editor على نسخة فيها بيانات (staging أو production) — كله داخل
--           begin ... rollback فلا يبقى أثر. يطبع جدول (k, v) بالنتائج الفعلية؛
--           قارن كل صف بالمتوقع في اسمه (مثال: "expect 560+60").
-- ⚠️ المعرّفات تحت (المستخدم، المنتجات، الإضافة، الخطة) من بيانات production يوم
--    14 أكتوبر 2026 — استبدلها بمعرّفات موجودة في القاعدة التي تختبر عليها.
-- ⚠️ ما بيتأكدش من النتائج تلقائيًا: ده دليل تشغيل لا اختبار CI.
-- ============================================================================
begin;
create temp table res(k text, v text);
select set_config('request.jwt.claim.sub','a74f6922-98c3-4bb1-b1a2-db78f80123fd',true), set_config('request.jwt.claims','{"sub":"a74f6922-98c3-4bb1-b1a2-db78f80123fd","role":"authenticated"}',true);
do $t$
declare
  oid text; r record;
  c_custom text := 'c0b6b0d1-7b41-410f-94f8-50f8ce98e1fe';
  c_lib text := 'dfe1d3ff-0c90-45b0-9e9b-c20462b3e8cb';
  a_azk text := '8f4088ef-beaf-4fc1-9bfb-fb466d037cc7';
  plan3 text := 'f2fe48db-d813-4039-a6b7-e1d869538136';
begin
  -- 1 EG الإسكندرية مطبوع
  oid := create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','printed')),
     '{"governorate":"الإسكندرية","city":"وسط","recipientName":"ت","recipientPhone":"01012345678","addressLine":"x"}');
  select * into r from orders where id=oid::uuid;
  insert into res values ('1 alex printed total/ship/country', r.total_amount||'/'||r.shipping_fee||'/'||r.country_code);
  -- 2 بدون country، مكتبة، القاهرة
  oid := create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_lib,'quantity',1)),
     '{"governorate":"القاهرة","city":"القاهرة","recipientName":"ت","recipientPhone":"01012345678","addressLine":"x"}');
  select * into r from orders where id=oid::uuid;
  insert into res values ('2 no-country lib cairo', r.total_amount||'/'||r.shipping_fee||'/'||r.country_code);
  -- 3 السعودية مطبوع
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1)),
     '{"country":"SA","governorate":"x","city":"y","recipientName":"ت","recipientPhone":"01012345678","addressLine":"x"}');
    insert into res values ('3 SA printed','NOT REJECTED');
  exception when others then insert into res values ('3 SA printed', sqlerrm); end;
  -- 4 السعودية إلكتروني (غير مفعّل)
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic')),
     '{"country":"SA","deliveryEmail":"a@b.co","recipientPhone":"+966501234567"}');
    insert into res values ('4 SA electronic disabled','NOT REJECTED');
  exception when others then insert into res values ('4 SA electronic disabled', sqlerrm); end;
  -- 4b فعّل الإلكتروني للسعودية
  update countries set electronic_enabled=true where code='SA';
  oid := create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic')),
     '{"country":"sa","deliveryEmail":"a@b.co","recipientPhone":"+966501234567"}');
  select * into r from orders where id=oid::uuid;
  insert into res values ('4b SA electronic enabled total/ship/country/gov', r.total_amount||'/'||r.shipping_fee||'/'||r.country_code||'/'||coalesce(r.governorate,'null'));
  -- 4c السعودية إلكتروني + إضافة => شحن => مرفوض
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic','addon_ids',jsonb_build_array(a_azk))),
     '{"country":"SA","governorate":"x","city":"y","deliveryEmail":"a@b.co","recipientPhone":"+966501234567"}');
    insert into res values ('4c SA electronic+addon','NOT REJECTED');
  exception when others then insert into res values ('4c SA electronic+addon', sqlerrm); end;
  -- 5 دولة غير معروفة
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_lib,'quantity',1)), '{"country":"XX"}');
    insert into res values ('5 XX','NOT REJECTED');
  exception when others then insert into res values ('5 XX', sqlerrm); end;
  -- 6 إيقاف عام
  update site_settings set value = '{"paused": true, "pausedMessage": ""}'::jsonb where key='delivery';
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_lib,'quantity',1)),
     '{"governorate":"القاهرة","city":"القاهرة","recipientPhone":"01012345678"}');
    insert into res values ('6 paused printed','NOT REJECTED');
  exception when others then insert into res values ('6 paused printed', sqlerrm); end;
  oid := create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic')),
     '{"deliveryEmail":"a@b.co","recipientPhone":"01012345678"}');
  select * into r from orders where id=oid::uuid;
  insert into res values ('6b paused electronic EG total', r.total_amount::text);
  update site_settings set value = '{"paused": false, "pausedMessage": ""}'::jsonb where key='delivery';
  -- 7 منطقة مغلقة
  update shipping_rates set is_active=false where governorate='القاهرة' and city='القاهرة';
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_lib,'quantity',1)),
     '{"governorate":"القاهرة","city":"القاهرة","recipientPhone":"01012345678"}');
    insert into res values ('7 area closed','NOT REJECTED');
  exception when others then insert into res values ('7 area closed', sqlerrm); end;
  update shipping_rates set is_active=true where governorate='القاهرة' and city='القاهرة';
  -- 7b محافظة مغلقة
  update governorates set physical_enabled=false where name_ar='الجيزة';
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_lib,'quantity',1)),
     '{"governorate":"الجيزة","city":"الجيزة","recipientPhone":"01012345678"}');
    insert into res values ('7b gov closed','NOT REJECTED');
  exception when others then insert into res values ('7b gov closed', sqlerrm); end;
  update governorates set physical_enabled=true where name_ar='الجيزة';
  -- 8 عرض: سعر بيع للقصة المطبوعة 500 + خصم 20% على الإضافة (250→200)
  insert into price_promotions(target_type,target_id,kind,value,starts_at,ends_at) values
    ('product_printed',c_custom,'sale_price',500,now()-interval '1 hour',now()+interval '1 day'),
    ('addon',a_azk,'percent',20,now()-interval '1 hour',now()+interval '1 day'),
    ('box_plan',plan3,'percent',50,now()-interval '1 hour',now()+interval '1 day');
  oid := create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'addon_ids',jsonb_build_array(a_azk))),
     '{"governorate":"القاهرة","city":"القاهرة","recipientPhone":"01012345678","recipientName":"ت","addressLine":"x"}');
  select * into r from orders where id=oid::uuid;
  insert into res values ('8 promo total/ship (expect 560+60? =500+200+60=760)', r.total_amount||'/'||r.shipping_fee);
  select * into r from order_items where order_id=oid::uuid;
  insert into res values ('8b unit/list snapshot (700/800)', r.unit_price||'/'||r.list_price_snapshot);
  -- 9 أسلوب الكتابة
  oid := create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic',
     'customization_data', jsonb_build_object('writingStyle', jsonb_build_object('style','dialect','dialect','gulf','junk','x')))),
     '{"deliveryEmail":"a@b.co","recipientPhone":"01012345678"}');
  select * into r from order_items where order_id=oid::uuid;
  insert into res values ('9 dialect stored', (r.customization_data->'writingStyle')::text);
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic',
     'customization_data', jsonb_build_object('writingStyle', jsonb_build_object('style','dialect')))), '{"deliveryEmail":"a@b.co","recipientPhone":"01012345678"}');
    insert into res values ('9b dialect missing','NOT REJECTED');
  exception when others then insert into res values ('9b dialect missing', sqlerrm); end;
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic',
     'customization_data', jsonb_build_object('writingStyle', jsonb_build_object('style','slang')))), '{"deliveryEmail":"a@b.co","recipientPhone":"01012345678"}');
    insert into res values ('9c bad style','NOT REJECTED');
  exception when others then insert into res values ('9c bad style', sqlerrm); end;
  update personalized_products set writing_styles=array['fusha'] where id=c_custom::uuid;
  begin
    perform create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_custom,'quantity',1,'format','electronic',
     'customization_data', jsonb_build_object('writingStyle', jsonb_build_object('style','simple')))), '{"deliveryEmail":"a@b.co","recipientPhone":"01012345678"}');
    insert into res values ('9d style not allowed for product','NOT REJECTED');
  exception when others then insert into res values ('9d style not allowed for product', sqlerrm); end;
  oid := create_customer_order(jsonb_build_array(jsonb_build_object('product_id',c_lib,'quantity',1,
     'customization_data', jsonb_build_object('writingStyle', jsonb_build_object('style','simple')))),
     '{"governorate":"القاهرة","city":"القاهرة","recipientPhone":"01012345678","recipientName":"ت","addressLine":"x"}');
  select * into r from order_items where order_id=oid::uuid;
  insert into res values ('9e library strips style', coalesce((r.customization_data->'writingStyle')::text,'null'));
  -- 10 الصندوق
  delete from price_promotions where target_type='box_plan';
  oid := create_box_subscription_order(plan3, '{}'::jsonb, '{"governorate":"الإسكندرية","city":"وسط","recipientPhone":"01012345678","recipientName":"ت","addressLine":"x"}');
  select * into r from orders where id=oid::uuid;
  insert into res values ('10 box 3m alex (1200+300=1500)', r.total_amount||'/'||r.shipping_fee||'/'||r.country_code);
  insert into price_promotions(target_type,target_id,kind,value,starts_at,ends_at) values ('box_plan',plan3,'percent',50,now()-interval '1 hour',now()+interval '1 day');
  oid := create_box_subscription_order(plan3, '{}'::jsonb, '{"governorate":"الإسكندرية","city":"وسط","recipientPhone":"01012345678","recipientName":"ت","addressLine":"x"}');
  select * into r from orders where id=oid::uuid;
  insert into res values ('10b box promo 50% (600+300=900)', r.total_amount||'/'||(r.box_details->'plan'->>'price')||'/'||(r.box_details->'plan'->>'listPrice'));
  begin
    perform create_box_subscription_order(plan3, '{}'::jsonb, '{"country":"SA","governorate":"x","city":"y","recipientPhone":"01012345678"}');
    insert into res values ('10c box SA','NOT REJECTED');
  exception when others then insert into res values ('10c box SA', sqlerrm); end;
end $t$;
select * from res order by k;
rollback;
