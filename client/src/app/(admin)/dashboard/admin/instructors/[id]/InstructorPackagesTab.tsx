'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { AgeGroup } from '@/types';
import type { PackageChoice } from '@/components/dashboard/PackagePicker';
import { AGE_GROUP_LABEL, TRACK_SHORT } from '@/lib/package-labels';
import { setInstructorPackages } from '@/actions/instructors';
import { useAction } from '@/lib/use-action';
import { FormError, FormSuccess } from '@/components/ui/FormError';
import { BusyButton, fieldClass } from '@/components/forms/Form';
import { Layers, Save, Search } from 'lucide-react';

const TRACK_LABELS: Record<string, string> = TRACK_SHORT;

/**
 * تبويب «الباقات» في صفحة المدرب — اتفصل من `AdminInstructorClient`.
 *
 * الاختيار نفسه (`pickedPackages`) فاضل في الأب لأن تبويب النظرة العامة
 * بيعرض عدده؛ البحث والفلترة والحفظ هنا.
 *
 * ⚠️ الفاضي معناه «ولا باقة» (٣ نوفمبر).
 */
export function InstructorPackagesTab({
  instructorId,
  packages,
  pickedPackages,
  setPickedPackages,
}: {
  instructorId: string;
  packages: PackageChoice[];
  pickedPackages: string[];
  setPickedPackages: Dispatch<SetStateAction<string[]>>;
}) {
  const [packagesDone, setPackagesDone] = useState('');
  const [packageSearch, setPackageSearch] = useState('');
  const [packageTrackFilter, setPackageTrackFilter] = useState<string>('all');

  const savePackages = useAction(setInstructorPackages, {
    onSuccess: (result) => {
      if (result.ok) {
        setPackagesDone(
          result.count === 0
            ? 'تم الحفظ. المدرب مش هيظهر في أي باقة لحد ما تحدّد له باقات.'
            : `تم الحفظ بنجاح. المدرب سيظهر في ${result.count} باقة معتمدة.`
        );
      }
    },
    fallbackError: 'تعذّر حفظ باقات المدرب.',
  });

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      if (packageTrackFilter !== 'all' && pkg.track !== packageTrackFilter) return false;
      if (
        packageSearch.trim() &&
        !pkg.name.toLowerCase().includes(packageSearch.toLowerCase()) &&
        !pkg.ageGroup.toLowerCase().includes(packageSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [packages, packageSearch, packageTrackFilter]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <span>إدارة باقات التدريب المعتمدة للمدرب</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            تحديد الباقات التي يظهر فيها المدرب لأولياء الأمور أثناء حجز الجلسات.
          </p>
        </div>

        {/* زر الحفظ */}
        <BusyButton
          busy={savePackages.pending}
          pendingLabel="جارٍ الحفظ..."
          onClick={() => {
            setPackagesDone('');
            savePackages.run(instructorId, pickedPackages);
          }}
          className="shrink-0 text-sm"
        >
          <Save className="h-4 w-4" />
          <span>حفظ الباقات المعتمدة</span>
        </BusyButton>
      </div>

      <FormSuccess message={packagesDone} />
      <FormError message={savePackages.error} />

      {/* حالة الباقات المعتمدة وتنبيه الظهور */}
      {pickedPackages.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 flex items-center justify-between gap-3">
          <div>
            <strong>الوضع الحالي:</strong> المدرب <strong>مش ظاهر في أي باقة</strong> — حدّد الباقات اللي بيدرّبها.
          </div>
          <button
            type="button"
            onClick={() => setPickedPackages(packages.map((p) => p.id))}
            className="text-xs font-bold text-amber-950 underline hover:text-amber-800 shrink-0"
          >
            تحديد كل الباقات
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <div>
            <strong>الوضع الحالي:</strong> المدرب يظهر في <strong>{pickedPackages.length}</strong> باقة معتمدة من أصل {packages.length}.
          </div>
          <button
            type="button"
            onClick={() => setPickedPackages([])}
            className="text-xs font-bold text-rose-700 underline hover:text-rose-900 shrink-0"
          >
            إلغاء التخصيص (إخفاؤه من كل الباقات)
          </button>
        </div>
      )}

      {/* أدوات البحث والفلترة للمحتوى الكثيف */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="ابحث عن باقة بالاسم أو الفئة"
            value={packageSearch}
            onChange={(e) => setPackageSearch(e.target.value)}
            placeholder="ابحث عن باقة بالاسم أو الفئة..."
            className={`${fieldClass} pr-9 text-sm`}
          />
        </div>

        {/* فلتر المسار */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setPackageTrackFilter('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              packageTrackFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            كل المسارات
          </button>
          <button
            type="button"
            onClick={() => setPackageTrackFilter('foundation')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              packageTrackFilter === 'foundation' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            تأسيس
          </button>
          <button
            type="button"
            onClick={() => setPackageTrackFilter('youth')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              packageTrackFilter === 'youth' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            يافعين
          </button>
          <button
            type="button"
            onClick={() => setPackageTrackFilter('specialization')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              packageTrackFilter === 'specialization' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
            }`}
          >
            تخصص
          </button>
        </div>
      </div>

      {/* شبكة الباقات */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPackages.map((pkg) => {
          const checked = pickedPackages.includes(pkg.id);
          return (
            <label
              key={pkg.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3.5 transition-all ${
                checked
                  ? 'border-indigo-500 bg-indigo-50/40 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  setPickedPackages((prev) =>
                    prev.includes(pkg.id) ? prev.filter((id) => id !== pkg.id) : [...prev, pkg.id]
                  );
                  setPackagesDone('');
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="min-w-0">
                <span className="block text-xs font-bold text-slate-900 truncate">{pkg.name}</span>
                <span className="block text-[11px] text-slate-500 mt-0.5">
                  {TRACK_LABELS[pkg.track ?? ''] ?? pkg.track ?? 'مسار عام'}
                  {' · '}
                  {AGE_GROUP_LABEL[pkg.ageGroup as AgeGroup] ?? pkg.ageGroup}
                  {pkg.sessionsCount ? ` · ${pkg.sessionsCount} جلسات` : ''}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {filteredPackages.length === 0 && (
        <p className="text-center py-6 text-xs text-slate-400">لا توجد باقات مطابقة للبحث.</p>
      )}
    </div>
  );
}
