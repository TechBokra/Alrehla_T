-- ═══════════════════════════════════════════════════════════════
-- بلاغات الجلسات والتصعيد
-- ═══════════════════════════════════════════════════════════════
--
-- الغرض — قرار تامر (٢٤ أكتوبر، بند ١١):
--   «زرار بلاغ + تنبيه فوري». زرار «بلّغ عن مشكلة» للمدرب (في صفحة
--   الجلسة) وللطالب وولي الأمر. درجتين: عادي، وعاجل لو فيه خطر على
--   الطفل. والإدارة عندها صفحة بالبلاغات: مين ماسكه، الحالة، القرار.
--
--   قبل كده مكانش فيه أي طريق — مدرب شاف علامة خطر على طفل، أو طالب
--   اتضايق من مدرب، كان لازم يدوّر على رقم تليفون.
--
-- ── اللي بيتضاف ──────────────────────────────────────────────
--
--   جدول `session_incidents`:
--     • `severity`  normal | urgent
--     • `category`  child_safety | conduct | session_control | technical | other
--     • `status`    open → in_progress → resolved
--     • `assigned_to` الإداري الماسك، و`resolution` القرار
--
--   ⚠️ **صاحب البلاغ بيقدر يقرا صفّه كله** (صلاحيات الصفوف مابتفرّقش
--      بين الأعمدة). الشاشة بتعرض له الحالة و`resolution` بس —
--      `admin_note` للإدارة. فاللي يتكتب في `admin_note` يتكتب على
--      أساس إنه ممكن يتقري.
--
--   ⚠️ **البلاغ مابيتمسحش ولا بيتعدّل من صاحبه.** ده سجل حماية طفل؛
--      الإدارة بس بتغيّر حالته. ومفيش صلاحية DELETE لحد.
--
--   ⚠️ **التأكد إن المُبلّغ طرف في الجلسة بيحصل في الأكشن** بجلسة
--      المستخدم (صلاحيات `sessions` بتوري الأطراف بس). هنا الشرط
--      الأدنى: البلاغ باسم صاحبه.
--
-- الأثر
--   جدول جديد + فهرسين + صلاحيات. مفيش حاجة موجودة بتتلمس.
--
-- الترتيب
--   مستقل. الكود بيرجّع «لسه بيتجهّز» لو الجدول مش موجود.
--
-- التحقق بعد التشغيل
--   1) select count(*) from session_incidents;   ← 0
--   2) من حساب مدرب: بلاغ من صفحة جلسة ← صف + إشعار للإدارة
--   3) من نفس الحساب:
--        update session_incidents set status = 'resolved';  ← 0 rows
--        delete from session_incidents;                     ← permission denied
--
-- الرجوع للخلف
--   drop table if exists public.session_incidents;
--   ⚠️ ده بيمسح البلاغات — صدّرها الأول لو فيه بلاغات حقيقية.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.session_incidents (
  id                     uuid primary key default gen_random_uuid(),
  session_id             text references public.sessions(id) on delete set null,
  course_subscription_id text references public.course_subscriptions(id) on delete set null,
  reporter_profile_id    uuid not null default auth.uid(),
  reporter_role          text not null check (reporter_role in ('instructor', 'guardian', 'student')),
  severity               text not null default 'normal' check (severity in ('normal', 'urgent')),
  category               text not null check (category in ('child_safety', 'conduct', 'session_control', 'technical', 'other')),
  description            text not null check (char_length(btrim(description)) between 10 and 4000),
  status                 text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  assigned_to            uuid,
  admin_note             text,
  resolution             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  resolved_at            timestamptz
);

comment on table public.session_incidents is
  'بلاغات الجلسات (قرار ٢٤ أكتوبر، بند ١١). سجل حماية طفل: مابيتمسحش، وصاحبه مابيعدّلوش.';

create index if not exists session_incidents_open_idx
  on public.session_incidents (severity, created_at desc)
  where status <> 'resolved';
create index if not exists session_incidents_reporter_idx
  on public.session_incidents (reporter_profile_id, created_at desc);

alter table public.session_incidents enable row level security;

drop policy if exists "reporters file incidents" on public.session_incidents;
create policy "reporters file incidents" on public.session_incidents
  for insert to authenticated
  with check (
    reporter_profile_id = auth.uid()
    and status = 'open'
    and assigned_to is null
    and admin_note is null
    and resolution is null
  );

drop policy if exists "reporters and admins read incidents" on public.session_incidents;
create policy "reporters and admins read incidents" on public.session_incidents
  for select to authenticated
  using (reporter_profile_id = auth.uid() or public.is_admin());

drop policy if exists "admins handle incidents" on public.session_incidents;
create policy "admins handle incidents" on public.session_incidents
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ⚠️ مفيش DELETE لحد عن قصد.
grant select, insert, update on public.session_incidents to authenticated;
revoke delete, truncate on public.session_incidents from authenticated, anon;
