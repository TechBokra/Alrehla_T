import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { fetchFamilyMembers } from '@/app/actions/family';
import { getStudentDocuments } from '@/data/domains/writing';
import { formatCairo } from '@/lib/timezone';

export const dynamic = 'force-dynamic';

/**
 * ولي الأمر بيتابع معرض أعمال ابنه.
 *
 * ── إيه اللي كان ناقص ───────────────────────────────────────
 *
 * ولي الأمر كان بيشوف **جلسات** ابنه وبس. معرض الأعمال وملاحظات
 * المدرب عليه — اللي هما بالظبط اللي بيوري التقدم — مكانوش ظاهرين
 * ليه في أي شاشة.
 *
 * ── إزاي بيشوفهم ────────────────────────────────────────────
 *
 * سياسة `Guardians read their dependents documents` (ملف SQL 89)
 * بتخلّي القراءة تعدّي، وشرطها بيمر على `guardian_of_student` اللي
 * بتتأكد إن الداخل دلوقتي **ولي أمر صاحب الحساب ده** فعلًا.
 *
 * ⚠️ **قراءة فقط عن قصد.** المعرض مساحة الطفل، وولي الأمر بيتابع
 *    مايكتبش فيها. مفيش سياسة كتابة اتضافت له.
 *
 * ── الحالة اللي بتحصل كتير ──────────────────────────────────
 *
 * طفل في المركز العائلي **بلا حساب دخول** مالوش مستندات أصلًا: اللي
 * بيكتب في المعرض هو حساب الطالب نفسه. فبدل ما الصفحة تقول «لا توجد
 * مستندات» — وهي جملة بتخلّي ولي الأمر يفتكر إن ابنه مش بيكتب —
 * بتقول السبب الحقيقي وبتوجّهه يفتح الحساب.
 */
export default async function DependentPortfolioPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;

  // القايمة دي بترجّع **أبناء الداخل دلوقتي وحدهم**، فالبحث فيها هو
  // نفسه التحقق: رقم طفل حد تاني مش هيتلاقى.
  const family = await fetchFamilyMembers();
  const child = family.find((c) => c.id === childId);
  if (!child) notFound();

  const documents = child.accountProfileId
    ? await getStudentDocuments(child.accountProfileId)
    : [];

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={`معرض أعمال ${child.fullName}`}
        backHref={`/account/family/${child.id}`}
      />

      {!child.accountProfileId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <p className="font-bold text-amber-900">
            {child.fullName} لسه مالوش حساب دخول.
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-amber-800">
            معرض الأعمال بيتكتب من حساب الطالب نفسه، فمن غير حساب مفيش نصوص
            تتعرض هنا. تقدر تفتحله حساب من{' '}
            <Link href="/account/family" className="underline underline-offset-4">
              عمود «حساب الدخول»
            </Link>{' '}
            في المركز العائلي.
          </p>
        </div>
      ) : documents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center font-medium text-slate-500">
          {child.fullName} لسه ما كتبش نصوصًا في معرضه.
        </p>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <article
              key={doc.id}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                  <FileText className="h-5 w-5 text-slate-400" />
                  {doc.title}
                </h2>
                {doc.status === 'reviewed' ? (
                  <StatusBadge type="success" label="المدرب راجعه" />
                ) : doc.status === 'submitted' ? (
                  <StatusBadge type="warning" label="مستني مراجعة المدرب" />
                ) : (
                  <StatusBadge type="neutral" label="مسودة" />
                )}
              </div>

              <p className="mt-2 text-xs font-medium text-slate-500">
                آخر تعديل: {formatCairo(doc.updatedAt)}
              </p>

              {/* النص كامل — مش مقطوع. ولي الأمر جاي يقرا شغل ابنه. */}
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {doc.content}
              </p>

              {doc.instructorFeedback && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="mb-1 text-sm font-black text-emerald-900">
                    ملاحظات المدرب
                  </h3>
                  <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-emerald-900">
                    {doc.instructorFeedback}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="text-sm font-medium text-slate-500">
        العرض هنا للمتابعة بس — الكتابة والتعديل في المعرض من حساب
        {' '}{child.fullName} نفسه.
      </p>
    </div>
  );
}
