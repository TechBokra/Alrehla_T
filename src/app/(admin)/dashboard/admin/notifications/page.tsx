import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/auth';
import { hasAdminPermission, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/server';
import { NotificationsTabs } from './NotificationsTabs';

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

      {items.length === 0 ? (
        <p className="rounded-3xl border border-slate-200 bg-white p-8 text-center font-bold text-slate-500">
          مفيش إشعارات اتبعتت لحد دلوقتي.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-sm font-black text-slate-600">
              <tr>
                <th className="px-5 py-4">العنوان</th>
                <th className="px-5 py-4">المستلِم</th>
                <th className="px-5 py-4">التاريخ</th>
                <th className="px-5 py-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-bold text-slate-800">{item.title}</p>
                    {item.message && (
                      <p className="mt-1 line-clamp-1 text-slate-500">{item.message}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-600">
                    {names.get(item.recipient_profile_id) ?? '—'}
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-500">
                    {formatDate(item.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        item.is_read
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.is_read ? 'اتقرا' : 'لسه'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
