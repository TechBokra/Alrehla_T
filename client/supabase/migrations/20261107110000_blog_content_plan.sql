-- =====================================================================
-- 20261107110000 — خطة محتوى المدونة
-- =====================================================================
--
-- الغرض:
--   المقال المخطّط بقى له مكان ومسار: «الكتابة ← المراجعة ← النشر»، وكل
--   مرحلة مهمة في «مهامي» لمسؤولها (من «سير العمل والتوزيع» ← المدونة).
--   لما المقال المربوط بالخطة يتنشر في المدونة، البند بيخلص لوحده.
--
-- الأثر:
--   • جدول جديد blog_plan_items (للإدارة بس — صلاحية «إدارة المحتوى»).
--   • محفّز على blog_plan_items بيفتح/ينقل/يقفل مهمة المسار «blog».
--   • محفّز على blog_posts: النشر بيقفل بند الخطة المربوط.
--   لا تعديل على بيانات موجودة.
--
-- الترتيب: بعد 20261107100000 (محتاج مسار «blog» في القيود).
--
-- التحقق بعد التشغيل:
--   select count(*) from blog_plan_items;  -- 0
--   select tgname from pg_trigger where tgname like 'blog_plan%';
--
-- الرجوع: drop table blog_plan_items cascade; drop function للدوال الجديدة.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.blog_plan_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  notes        text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  planned_for  date,
  status       text NOT NULL DEFAULT 'writing'
               CHECK (status IN ('writing', 'review', 'publishing', 'done', 'dropped')),
  post_id      uuid REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  done_at      timestamptz
);

CREATE INDEX IF NOT EXISTS blog_plan_items_open_idx
  ON public.blog_plan_items (planned_for) WHERE status IN ('writing', 'review', 'publishing');

ALTER TABLE public.blog_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blog_plan_items_admin ON public.blog_plan_items;
CREATE POLICY blog_plan_items_admin ON public.blog_plan_items
  FOR ALL TO authenticated
  USING (public.admin_has_permission('canManageContent'))
  WITH CHECK (public.admin_has_permission('canManageContent'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_plan_items TO authenticated;

COMMENT ON TABLE public.blog_plan_items IS
  'خطة محتوى المدونة: كل بند بيمشي الكتابة ← المراجعة ← النشر، وكل مرحلة مهمة في «مهامي» (المسار blog).';

-- المهمة تتبع حالة البند.
CREATE OR REPLACE FUNCTION public.blog_plan_task_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status and old.title is not distinct from new.title then
    return new;
  end if;
  begin
    if new.status in ('writing', 'review', 'publishing') then
      perform public.work_task_open('blog', 'fulfilment', new.id::text,
        case when new.planned_for is not null then 'النشر ' || to_char(new.planned_for, 'YYYY-MM-DD') end,
        'مقال — ' || left(new.title, 80),
        '/dashboard/admin/content/blog/plan', true, new.status);
      if tg_op = 'UPDATE' and old.title is distinct from new.title then
        update work_tasks set title = 'مقال — ' || left(new.title, 80)
         where line = 'blog' and stage = 'fulfilment' and source_id = new.id::text;
      end if;
    else
      perform public.work_task_close('blog', 'fulfilment', new.id::text);
    end if;
  exception when others then
    raise warning 'blog_plan_task_fn: item % — %', new.id, sqlerrm;
  end;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS blog_plan_task_trg ON public.blog_plan_items;
CREATE TRIGGER blog_plan_task_trg
  AFTER INSERT OR UPDATE OF status, title ON public.blog_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.blog_plan_task_fn();

CREATE OR REPLACE FUNCTION public.blog_plan_touch_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
begin
  new.updated_at := now();
  if new.status in ('done', 'dropped') and old.status not in ('done', 'dropped') then
    new.done_at := now();
  elsif new.status not in ('done', 'dropped') then
    new.done_at := null;
  end if;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS blog_plan_touch_trg ON public.blog_plan_items;
CREATE TRIGGER blog_plan_touch_trg
  BEFORE UPDATE ON public.blog_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.blog_plan_touch_fn();

-- نشر المقال المربوط = البند خلص.
CREATE OR REPLACE FUNCTION public.blog_plan_on_publish_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
begin
  if new.is_draft = false and (tg_op = 'INSERT' or old.is_draft is distinct from false) then
    update blog_plan_items set status = 'done'
     where post_id = new.id and status in ('writing', 'review', 'publishing');
  end if;
  return new;
exception when others then
  raise warning 'blog_plan_on_publish_fn: post % — %', new.id, sqlerrm;
  return new;
end;
$fn$;

DROP TRIGGER IF EXISTS blog_plan_on_publish_trg ON public.blog_posts;
CREATE TRIGGER blog_plan_on_publish_trg
  AFTER INSERT OR UPDATE OF is_draft ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.blog_plan_on_publish_fn();
