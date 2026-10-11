import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { NotificationsTabs } from './NotificationsTabs';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

/**
 * سجل الإشعارات.
 *
 * الفايدة العملية: لما حد يقول «مجانيش إشعار»، بدل ما نخمّن، بنشوف هنا
 * هل اتبعت أصلًا وامتى واتقرا ولا لأ.
 *
 * بيعرض آخر ٢٠٠ إشعار — السجل بيكبر بسرعة والشاشة مش مكان أرشيف.
 */
export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('notifications')
    .select('id, title, message, link, is_read, created_at, recipient_profile_id')
    .order('created_at', { ascending: false })
    .limit(200);

  const items = rows ?? [];

  // أسماء المستلمين في استعلام واحد بدل استعلام لكل صف.
  const ids = [...new Set(items.map((i) => i.recipient_profile_id))];
  const { data: people } = ids.length
    ? await supabase.from('user_profiles').select('id, full_name').in('id', ids)
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const unread = items.filter((i) => !i.is_read).length;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الإشعارات" />
      <NotificationsTabs />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="آخر إشعارات" value={items.length} />
        <Stat label="لسه مش متقروءة" value={unread} />
        <Stat label="مستلمين مختلفين" value={ids.length} />
      </div>

      {/* ══ 🔴 الجدول ده كان بيتمرّر أفقيًّا على الموبايل ══
          كان `<table>` خام جوّه `overflow-hidden`: أربعة أعمدة على
          شاشة 375 بكسل يعني الحالة والتاريخ بره الشاشة، **ومن غير
          أي علامة إنهم موجودين**.

          و`SimpleDataTable` المشترك فيه **عرض بطاقات للموبايل جاهز**
          (وبحث وترقيم كمان) — فالإصلاح إننا نستعمله لا إننا نكتب
          عرضًا تانيًا.

          ⚠️ **وكان بيرسم شارة حالته بنفسه** (`bg-amber-100`) بدل
             `StatusBadge` المشتركة — يعني «لسه» في الشاشة دي شكلها
             غير «بانتظار الدفع» في شاشة الطلبات، وهما نفس المعنى.
             و«لسه» حالة **انتظار** لا تحذير. */}
      {items.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">
          مفيش إشعارات اتبعتت لحد دلوقتي.
        </p>
      ) : (
        <SimpleDataTable
          searchPlaceholder="ابحث بعنوان الإشعار أو اسم المستلِم…"
          emptyMessage="مفيش إشعار مطابق."
          columns={[
            { header: 'العنوان', accessorKey: 'titleDisplay' },
            { header: 'المستلِم', accessorKey: 'recipient' },
            { header: 'التاريخ', accessorKey: 'date' },
            { header: 'الحالة', accessorKey: 'statusDisplay' },
          ]}
          data={items.map((item) => ({
            // ⚠️ النصّ الخام موجود جنب العنصر المرسوم عشان **البحث
            //    يلاقيه**: `SimpleDataTable` بيتخطّى القيم اللي هي
            //    عناصر React، فالعمود المرسوم وحده مابيتبحتش فيه.
            title: item.title,
            message: item.message ?? '',
            titleDisplay: (
              <div>
                <p className="font-bold text-slate-800">{item.title}</p>
                {item.message && (
                  <p className="mt-1 line-clamp-1 text-slate-500">{item.message}</p>
                )}
              </div>
            ),
            recipient: names.get(item.recipient_profile_id) ?? '—',
            date: formatDate(item.created_at),
            statusDisplay: (
              <StatusBadge
                label={item.is_read ? 'اتقرا' : 'لسه'}
                type={item.is_read ? 'neutral' : 'pending'}
              />
            ),
          }))}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-800">{value}</p>
    </div>
  );
}
