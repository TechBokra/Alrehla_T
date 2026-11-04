import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageContainer } from '@/components/PageContainer';
import { Section } from '@/components/ui/Section';
import { StatusBadge } from '@/components/StatusBadge';
import { createPublicClient } from '@/lib/supabase/public';
import { joinRequestRoleLabel } from '@/lib/join-roles';
import { ApplicantThread, type ThreadMessage } from './ApplicantThread';
import { fromUrlToken } from '@/lib/join-token';

export const dynamic = 'force-dynamic';

/**
 * ⚠️ **الصفحة دي مش للفهرسة.** مفتوحة بمفتاح سري، ومحتواها نقاش بين
 *    الإدارة وشخص بعينه — ولا جوجل ولا أي زاحف المفروض يوصلها.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

const STATUS: Record<string, { label: string; type: 'success' | 'danger' | 'warning' }> = {
  approved: { label: 'مقبول', type: 'success' },
  rejected: { label: 'غير مقبول', type: 'danger' },
  pending: { label: 'قيد المراجعة', type: 'warning' },
};

/**
 * صفحة المتقدّم: يقرا رد الإدارة على طلب انضمامه ويرد — **من غير حساب**.
 *
 * ⚠️ **ليه من غير حساب؟** الطلب بيتقدّم قبل ما يبقى فيه حساب أصلًا
 *    (`join_requests` فيه اسم وبريد وتليفون وبس)، والموقع مابيبعتش
 *    إيميلات. فالرابط بمفتاحه السري هو الطريق الوحيد.
 *
 * ⚠️ **والقراءة بتمر على دالة `SECURITY DEFINER`** بالمفتاح — الجدول
 *    نفسه مقفول على الزائر تمامًا، فمفيش طريق يقرا بيها طلبًا تاني.
 */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  // ⚠️ الرابط بالشكل الآمن (من غير / و+) — بيرجع لأصله هنا. اقرا `lib/join-token`.
  const token = fromUrlToken((await params).token);
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc('join_request_thread', { p_token: token });

  if (error) {
    console.error('join_request_thread', error);
    notFound();
  }

  const thread = data as unknown as
    | {
        ok: true;
        name: string;
        role: string;
        status: string;
        createdAt: string;
        messages: ThreadMessage[];
      }
    | { ok: false; error: string }
    | null;

  // مفتاح غلط = «مش موجود». ماينفعش نقول «المفتاح غلط» — ده بيأكّد
  // لحد بيجرّب إن فيه صفحة أصلًا.
  if (!thread || !thread.ok) notFound();

  const status = STATUS[thread.status] ?? STATUS.pending;

  return (
    <PageContainer className="!py-0 !space-y-0">
      <Section containerClassName="mx-auto w-full max-w-2xl">
        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-black text-slate-900">
              أهلًا {thread.name} 🌿
            </h1>
            <StatusBadge type={status.type} label={status.label} />
          </div>
          <p className="text-sm font-medium text-slate-600">
            طلب انضمامك كـ«{joinRequestRoleLabel(thread.role)}». تقدر تقرا رسايل
            الإدارة وترد عليها من هنا.
          </p>
        </div>

        <ApplicantThread
          token={token}
          applicantName={thread.name}
          initialMessages={thread.messages}
        />
      </Section>
    </PageContainer>
  );
}
