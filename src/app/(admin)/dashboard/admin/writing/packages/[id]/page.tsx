import React from 'react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getWritingPackages } from '@/data/domains/writing';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { saveWritingPackage } from '@/actions/writing';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageCatalog')) {
    return <Unauthorized />;
  }

  const { id } = await params;
  const packages = await getWritingPackages();
  const target = packages.find(p => p.id === id);

  if (!target) {
    return <div className="p-8 text-center">الباقة غير موجودة</div>;
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title={`تعديل الباقة: ${target.name}`} backHref="/dashboard/admin/writing/packages" />
      
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <form action={saveWritingPackage} className="space-y-6">
          <input type="hidden" name="id" value={target.id} />
          <input type="hidden" name="slug" value={target.slug} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">اسم الباقة</label>
              <input type="text" name="name" defaultValue={target.name} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">الفئة العمرية</label>
              <select name="ageGroup" defaultValue={target.ageGroup} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="under_12">أقل من 12 سنة</option>
                <option value="12_plus">12 سنة فأكثر</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">المسار</label>
              <select name="track" defaultValue={target.track ?? ''} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">بدون مسار</option>
                <option value="foundation">مسار التأسيس</option>
                <option value="youth">مسار اليافعين والكبار</option>
                <option value="specialization">مسار التخصص</option>
              </select>
              <p className="mt-2 text-xs font-medium text-slate-500">
                المسار مستقل عن الفئة العمرية — مسارين ممكن يكونوا لنفس السن.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">الوصف القصير</label>
              <input type="text" name="shortDescription" defaultValue={target.shortDescription} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">الفئة المستهدفة</label>
              <input type="text" name="targetAudience" defaultValue={target.targetAudience} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">الوصف الكامل</label>
            <textarea name="fullDescription" defaultValue={target.fullDescription} rows={3} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"></textarea>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">السعر (ج.م)</label>
              <input type="number" name="price" defaultValue={target.price} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">عدد الجلسات</label>
              <input type="number" name="sessionsCount" defaultValue={target.sessionsCount} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">مدة الجلسة</label>
              {/* ⚠️ **كان `|| '40 دقيقة'` — والشاشة كانت بتكدب.**

                  الباقة اللي عمودها فاضي في القاعدة كانت بتفتح هنا
                  والخانة مكتوب فيها «40 دقيقة»، فالإداري يبص ويقول
                  «متظبطة» ويقفل. والقيمة ما اتحفظتش أبدًا.

                  وفي نفس الوقت صفحة الباقات العامة بتخفي المدة
                  خالص لما تكون فاضية — فالعميل **مايشوفش مدة
                  الجلسة**، والإدارة شايفاها. نفس فئة العطل بتاعة
                  «السعر النهائي 150 والمحفوظ 100».

                  دلوقتي الخانة بتفضل فاضية، و`required` بيلزم
                  الإداري يكتبها بوعي. ولوحة الإدارة أصلًا بتعدّ
                  الباقات الناقصة (`packagesMissingDuration`). */}
              <input type="text" name="sessionDuration" defaultValue={target.sessionDuration ?? ''} placeholder="مثال: 40 دقيقة" required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">مدة البرنامج الإجمالية (نص)</label>
              <input type="text" name="durationText" defaultValue={target.durationText} required className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظة المتطلبات السابقة</label>
              <input type="text" name="prerequisiteNote" defaultValue={target.prerequisiteNote} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" name="isActive" defaultChecked={target.isActive} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="isActive" className="font-bold text-slate-700">الباقة نشطة ومتاحة للحجز</label>
          </div>
          
          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button type="submit" className="rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800">
              حفظ التعديلات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
