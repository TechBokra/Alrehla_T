-- ============================================================================
-- «تم التحويل» لازم تقفل المستحقات — نفس الفلوس كانت تتسحب أكتر من مرة
-- ============================================================================
-- العطل   : الرصيد القابل للسحب = مجموع `instructor_payouts` اللي حالتها
--           `pending` (بيتحسب في `guard_withdrawal_request`). والإدارة
--           لما تدوس «تم التحويل» في شاشة طلبات السحب، الكود بيغيّر حالة
--           **الطلب** وبس — **ومابيلمسش المستحقات خالص**.
--
--           فالمستحقات بتفضل `pending` للأبد، والرصيد مابينقصش، والمدرب
--           يرجع تاني يوم يلاقي نفس المبلغ ويطلبه تاني. وقاعدة «طلب
--           معلّق واحد» مابتوقفش ده، لأن الطلب القديم بقى `paid` مش
--           `pending`. **مفيش حد أقصى لعدد المرات.**
--
--           واتأكدت: فيه **محفّز واحد** على `withdrawal_requests` وهو
--           `BEFORE INSERT`، ومفيش ولا سطر SQL في المشروع بيحوّل
--           `instructor_payouts` لـ`paid`. الحاجة الوحيدة اللي بتعمل كده
--           أكشن منفصل (`markInstructorPayoutAsPaid`) على **شاشة تانية**
--           — فالمسار الطبيعي لشاشة السحب بيسيب الرصيد زيّ ما هو.
--
--           ونفس الكلام بالظبط على الناشرين.
--
-- ⚠️ **ده مش استغلال ولا ثغرة أمنية** — ده المسار الطبيعي للشاشة.
--    أي إداري استعمل شاشة طلبات السحب زيّ ما هي مصمَّمة وقع فيه.
--
-- الحل    : محفّز `AFTER UPDATE` على `withdrawal_requests`: أول ما الحالة
--           تبقى `paid`، المستحقات اللي الطلب اتبنى عليها بتتقفل.
--
-- ── أنهي مستحقات بالظبط؟ ────────────────────────────────────
--
-- ⚠️ **اللي اتعملوا قبل الطلب وبس** (`created_at <= الطلب`). المبلغ
--    اتحسب وقت الإدراج من الرصيد ساعتها، فمستحق اتسجّل **بعد** الطلب
--    مش داخل في الفلوس اللي اتحوّلت — وقفله كان هيضيّع على المدرب
--    شغل عمله فعلًا.
--
-- ── ليه عمود رابط، مش مجرّد تغيير حالة ──────────────────────
--
-- `withdrawal_request_id` بيخلّي السؤال «الدفعة دي غطّت إيه؟» ليه
-- إجابة. من غيره، مستحق `paid` مالوش أي أثر يربطه بالتحويل — وده
-- جدول مالي، والمراجعة فيه مش رفاهية.
--
-- ⚠️ **الأنواع متشافت، مش متخمّنة:**
--      withdrawal_requests.id      text
--      instructor_payouts.id       uuid   | instructor_id text
--      publisher_payouts.id        uuid   | publisher_id  text
--    فعمود الرابط `text` عشان يطابق مفتاح الطلب. والقاعدة دي مخلوطة
--    فعلًا — نفس الخلط ضرب الدفع و`delete_instructor` النهاردة.
--
-- الأثر   : عمودان جديدان (اختياريان، فاضيان) + محفّز واحد. مفيش صف
--           موجود بيتغيّر بالملف ده — **الإصلاح الأثري منفصل وتحت**،
--           بتقرير قراءة قبله.
--
-- التحقق  : آخر الملف، تلات كتل: تقرير الضرر، تجربة جوّه معاملة بتتلغي،
--           وبعدهم الإصلاح الأثري.
--
-- الرجوع  : drop trigger close_payouts_on_withdrawal_paid on withdrawal_requests;
--           drop function public.close_payouts_for_withdrawal();
--           alter table instructor_payouts drop column withdrawal_request_id;
--           alter table publisher_payouts  drop column withdrawal_request_id;
-- ============================================================================

alter table public.instructor_payouts
  add column if not exists withdrawal_request_id text;

alter table public.publisher_payouts
  add column if not exists withdrawal_request_id text;

create index if not exists instructor_payouts_withdrawal_idx
  on public.instructor_payouts (withdrawal_request_id)
  where withdrawal_request_id is not null;

create index if not exists publisher_payouts_withdrawal_idx
  on public.publisher_payouts (withdrawal_request_id)
  where withdrawal_request_id is not null;

comment on column public.instructor_payouts.withdrawal_request_id is
  'طلب السحب اللي قفل المستحق ده. بيتكتب من المحفّز وقت «تم التحويل».';
comment on column public.publisher_payouts.withdrawal_request_id is
  'طلب السحب اللي قفل المستحق ده. بيتكتب من المحفّز وقت «تم التحويل».';


create or replace function public.close_payouts_for_withdrawal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed integer := 0;
begin
  -- بس عند الانتقال لـ`paid`. تكرار الضغط مابيعملش حاجة تانية، و
  -- `approved` مابتقفلش حاجة (الفلوس لسه ماتحوّلتش).
  if NEW.status <> 'paid' or OLD.status = 'paid' then
    return NEW;
  end if;

  if NEW.instructor_id is not null then
    update instructor_payouts
       set status                = 'paid',
           withdrawal_request_id = NEW.id,
           updated_at            = now()
     where instructor_id::text = NEW.instructor_id::text
       and status = 'pending'
       and created_at <= NEW.created_at;
    get diagnostics v_closed = row_count;

  elsif NEW.publisher_id is not null then
    update publisher_payouts
       set status                = 'paid',
           withdrawal_request_id = NEW.id,
           updated_at            = now()
     where publisher_id::text = NEW.publisher_id::text
       and status = 'pending'
       and created_at <= NEW.created_at;
    get diagnostics v_closed = row_count;
  end if;

  -- ⚠️ **صفر هنا مش خطأ بالضرورة، فمش بنرمي.** ممكن المستحقات تكون
  --    اتقفلت بالإيد من شاشة «مستحقات المدربين» قبل كده — والرمي
  --    ساعتها كان هيمنع الإدارة إنها تسجّل تحويل حصل فعلًا.
  --
  --    وقفله في صمت مش مشكلة هنا لأن العمود الرابط بيسيب أثر: الطلب
  --    اللي مقابله صفر مستحقات بيبان في تقرير آخر الملف.
  if v_closed = 0 then
    raise notice 'طلب السحب % اتسجّل مدفوعًا ومفيش مستحقات معلّقة اتقفلت', NEW.id;
  end if;

  return NEW;
end
$$;

drop trigger if exists close_payouts_on_withdrawal_paid on public.withdrawal_requests;

create trigger close_payouts_on_withdrawal_paid
  after update of status on public.withdrawal_requests
  for each row
  execute function public.close_payouts_for_withdrawal();

comment on function public.close_payouts_for_withdrawal() is
  'أول ما طلب سحب يتسجّل «مدفوع»، بيقفل مستحقات صاحبه اللي اتعملت قبل الطلب ويختمها برقمه. من غيره الرصيد مابينقصش ونفس الفلوس تتسحب تاني.';


-- ============================================================================
-- (١) تقرير الضرر — قراءة بس، مابيغيّر ولا صف. شغّله الأول.
-- ============================================================================
-- بيقول: فيه طلبات اتسجّلت «مدفوعة» وسابت وراها رصيد مفتوح؟ وبكام؟
--
--   select
--     w.id                                   as "الطلب",
--     coalesce(i.display_name, p.name)        as "صاحبه",
--     case when w.publisher_id is not null then 'ناشر' else 'مدرب' end as "النوع",
--     w.amount                                as "المبلغ المحوَّل",
--     to_char(w.created_at, 'YYYY-MM-DD')     as "اتطلب",
--     coalesce((
--       select sum(x.amount) from instructor_payouts x
--        where x.instructor_id::text = w.instructor_id::text
--          and x.status = 'pending' and x.created_at <= w.created_at
--     ), (
--       select sum(y.amount) from publisher_payouts y
--        where y.publisher_id::text = w.publisher_id::text
--          and y.status = 'pending' and y.created_at <= w.created_at
--     ), 0)                                   as "لسه مفتوح من نفس الفلوس"
--   from withdrawal_requests w
--   left join instructors i on i.id::text = w.instructor_id::text
--   left join publishers  p on p.id::text = w.publisher_id::text
--   where w.status = 'paid'
--   order by w.created_at;
--
-- المتوقع لو الموقع سليم: العمود الأخير **صفر** في كل السطور.
-- أي رقم أكبر من صفر = الفلوس دي قابلة للسحب تاني دلوقتي.

-- ============================================================================
-- (٢) تجربة المحفّز — جوّه معاملة بتتلغي، مفيش صف بيتغيّر
-- ============================================================================
--   begin;
--   do $probe$
--   declare v_id text; v_before int; v_after int;
--   begin
--     select id into v_id from withdrawal_requests
--      where status <> 'paid' and instructor_id is not null
--      order by created_at desc limit 1;
--     if v_id is null then raise exception 'RESULT: مفيش طلب سحب غير مدفوع للتجربة'; end if;
--
--     select count(*) into v_before from instructor_payouts x
--      where x.instructor_id::text = (select instructor_id from withdrawal_requests where id = v_id)
--        and x.status = 'pending';
--
--     update withdrawal_requests set status = 'paid' where id = v_id;
--
--     select count(*) into v_after from instructor_payouts x
--      where x.instructor_id::text = (select instructor_id from withdrawal_requests where id = v_id)
--        and x.status = 'pending';
--
--     raise exception 'RESULT: الطلب=% | معلّق قبل=% | معلّق بعد=%', v_id, v_before, v_after;
--   end $probe$;
--   rollback;
--
-- المتوقع: «بعد» أقل من «قبل». لو اتساووا، المحفّز ماشتغلش.

-- ============================================================================
-- (٣) الإصلاح الأثري — **بيغيّر بيانات مالية. اقرا (١) الأول واتفق عليه.**
-- ============================================================================
-- بيقفل المستحقات اللي سابتها الطلبات المدفوعة القديمة. بيمشي من الأقدم
-- للأحدث عشان كل طلب يقفل اللي كان مفتوحًا **وقته** هو لا وقت اللي بعده.
--
--   do $backfill$
--   declare r record; v_n integer; v_total integer := 0;
--   begin
--     for r in
--       select id, instructor_id, publisher_id, created_at
--         from withdrawal_requests
--        where status = 'paid'
--        order by created_at
--     loop
--       if r.instructor_id is not null then
--         update instructor_payouts
--            set status = 'paid', withdrawal_request_id = r.id, updated_at = now()
--          where instructor_id::text = r.instructor_id::text
--            and status = 'pending' and created_at <= r.created_at;
--       else
--         update publisher_payouts
--            set status = 'paid', withdrawal_request_id = r.id, updated_at = now()
--          where publisher_id::text = r.publisher_id::text
--            and status = 'pending' and created_at <= r.created_at;
--       end if;
--       get diagnostics v_n = row_count;
--       v_total := v_total + v_n;
--     end loop;
--     raise notice 'اتقفل % مستحق', v_total;
--   end $backfill$;
--
-- وبعده شغّل (١) تاني — المفروض يرجع صفر في كل السطور.
-- ============================================================================
