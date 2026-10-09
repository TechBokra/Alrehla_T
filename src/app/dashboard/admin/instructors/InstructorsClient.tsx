'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { isProfileComplete } from '@/lib/instructor-onboarding';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/dashboard/Pagination';
import { createInstructor } from '@/actions/admin-instructors';
import { TempCodeBox } from '@/components/dashboard/TempCodeBox';
import { FormError, FormNotice, FormSuccess } from '@/components/ui/FormError';
import {
  Field,
  TextInput,
  TextArea,
  Select,
  BusyButton,
  fieldClass,
} from '@/components/forms/Form';
import type { InstructorAdminRow } from '@/data/domains/writing';

/** كل فلتر قيمته '' معناها «الكل» — عشان الشاشة تفتح بكل الصفوف. */
const EMPTY_FILTERS = {
  search: '',
  status: '',
  review: '',
  training: '',
  services: '',
  workModel: '',
};

/**
 * بيانات جاية من طلب انضمام مقبول.
 *
 * ⚠️ **بتتقرا على الخادم من `searchParams` لا من `useSearchParams`**:
 *    الخطاف بيخلّي الصفحة تحتاج حدود `Suspense`، والقيم هنا مجرد
 *    تعبئة أوّلية بيراجعها الإداري قبل ما يضغط.
 */
export type InstructorPrefill = {
  email: string;
  fullName: string;
  bio: string;
};

export function InstructorsClient({
  instructors,
  canCreate,
  prefill,
}: {
  instructors: InstructorAdminRow[];
  canCreate: boolean;
  prefill?: InstructorPrefill | null;
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // جاي من قبول طلب انضمام؟ النموذج يفتح لوحده — الإداري ما يدوّرش
  // على الزرار بعد ما اتحوّل هنا عشان يكمّل خطوة محددة.
  const [showForm, setShowForm] = useState(Boolean(prefill));

  const set = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1); // فلتر جديد = نتائج جديدة، فالرجوع للصفحة الأولى
  };

  const activeFilterCount = Object.entries(filters).filter(
    ([, v]) => v !== '',
  ).length;

  const filtered = useMemo(() => {
    const q = filters.search.trim();
    return instructors.filter((inst) => {
      if (q && !`${inst.displayName} ${inst.specialties.join(' ')}`.includes(q))
        return false;
      if (filters.status && inst.status !== filters.status) return false;
      if (filters.review === 'pending' && !inst.hasPendingReview) return false;
      if (filters.review === 'none' && inst.hasPendingReview) return false;
      if (filters.training === 'passed' && !inst.trainingPassed) return false;
      if (filters.training === 'not_passed' && inst.trainingPassed) return false;
      if (filters.services === 'subscribed' && inst.activeServicesCount === 0)
        return false;
      if (filters.services === 'none' && inst.activeServicesCount > 0) return false;
      if (filters.workModel && inst.workModel !== filters.workModel) return false;
      return true;
    });
  }, [instructors, filters]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const formatted = pageRows.map((inst) => {
    let statusDisplay = <StatusBadge type="success" label="نشط" />;
    if (inst.status === 'suspended')
      statusDisplay = <StatusBadge type="danger" label="موقوف" />;
    if (inst.status === 'pending_approval')
      statusDisplay = <StatusBadge type="warning" label="بانتظار الاعتماد" />;
    if (inst.status === 'pending_training')
      statusDisplay = <StatusBadge type="neutral" label="قيد التدريب" />;
    // جاي من طلب انضمام ولسه ماكمّلش ملفه (أو ملفه مستني مراجعتك في
    // «طلبات تعديل ملفات المدربين») — `@/lib/instructor-onboarding`.
    if (!isProfileComplete(inst))
      statusDisplay = <StatusBadge type="pending" label="ملفه لسه ناقص" />;

    return {
      ...inst,
      nameDisplay: (
        <Link
          href={`/dashboard/admin/instructors/${inst.id}`}
          className="font-bold text-blue-600 hover:underline"
        >
          {inst.displayName}
        </Link>
      ),
      statusDisplay,
      reviewDisplay: inst.hasPendingReview ? (
        <StatusBadge type="warning" label="طلب مراجعة" />
      ) : (
        <span className="text-slate-400">—</span>
      ),
      trainingDisplay: inst.trainingPassed ? (
        <StatusBadge type="success" label="اجتاز" />
      ) : (
        <StatusBadge type="neutral" label="لم يجتز" />
      ),
      servicesDisplay:
        inst.activeServicesCount > 0 ? (
          <span className="font-bold text-emerald-700">
            {inst.activeServicesCount} خدمة
          </span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      workModelDisplay: inst.workModel === 'monthly' ? 'اشتراك شهري' : 'بالجلسة',
      specialtiesDisplay: inst.specialties.join('، ') || '—',
    };
  });

  const columns = [
    { header: 'الاسم', accessorKey: 'nameDisplay' },
    { header: 'التخصص', accessorKey: 'specialtiesDisplay' },
    { header: 'نظام العمل', accessorKey: 'workModelDisplay' },
    { header: 'التدريب', accessorKey: 'trainingDisplay' },
    { header: 'الخدمات الإبداعية', accessorKey: 'servicesDisplay' },
    { header: 'المراجعة', accessorKey: 'reviewDisplay' },
    { header: 'الحساب', accessorKey: 'statusDisplay' },
  ];

  return (
    <div>
      {canCreate && (
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800"
          >
            {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {showForm ? 'إغلاق' : 'إضافة مدرب'}
          </button>
        </div>
      )}

      {showForm && (
        <AddInstructorForm prefill={prefill} onDone={() => setShowForm(false)} />
      )}

      <div className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="relative">
          <Search className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="ابحث بالاسم أو التخصص"
            className={`${fieldClass} pr-11`}
            placeholder="ابحث بالاسم أو التخصص…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="حالة الحساب"
            value={filters.status}
            onChange={(v) => set('status', v)}
            options={[
              ['active', 'فعّال'],
              ['pending_approval', 'بانتظار الاعتماد'],
              ['pending_training', 'قيد التدريب'],
              ['suspended', 'موقوف'],
            ]}
          />
          <FilterSelect
            label="طلب المراجعة"
            value={filters.review}
            onChange={(v) => set('review', v)}
            options={[
              ['pending', 'عنده طلب معلّق'],
              ['none', 'لا يوجد'],
            ]}
          />
          <FilterSelect
            label="التدريب"
            value={filters.training}
            onChange={(v) => set('training', v)}
            options={[
              ['passed', 'اجتاز'],
              ['not_passed', 'لم يجتز'],
            ]}
          />
          <FilterSelect
            label="الخدمات الإبداعية"
            value={filters.services}
            onChange={(v) => set('services', v)}
            options={[
              ['subscribed', 'مشترك'],
              ['none', 'غير مشترك'],
            ]}
          />
          <FilterSelect
            label="نظام العمل"
            value={filters.workModel}
            onChange={(v) => set('workModel', v)}
            options={[
              ['monthly', 'اشتراك شهري'],
              ['per_session', 'بالجلسة'],
            ]}
          />
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
            className="text-sm font-bold text-blue-600 hover:underline"
          >
            مسح الفلاتر ({activeFilterCount})
          </button>
        )}
      </div>

      <SimpleDataTable columns={columns} data={formatted} />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPageChange={setPage}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <Field label={label}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">الكل</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function AddInstructorForm({
  prefill,
  onDone,
}: {
  prefill?: InstructorPrefill | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: prefill?.email ?? '',
    fullName: prefill?.fullName ?? '',
    // اسم العرض بيبدأ من الاسم الكامل، والإداري يعدّله لو حب.
    displayName: prefill?.fullName ?? '',
    // رسالة المتقدّم نقطة بداية للنبذة — **مش** نبذة نهائية.
    bio: prefill?.bio ?? '',
    specialties: '',
    yearsExperience: 0,
    workModel: 'per_session' as 'monthly' | 'per_session',
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // الخانة اللي الخادم رجّع عليها الخطأ — رسالتها بتظهر تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
  const [done, setDone] = useState('');
  const [code, setCode] = useState('');
  const [codeEmail, setCodeEmail] = useState('');
  const [providerWarning, setProviderWarning] = useState('');

  const err = (f: string) => (errorField === f ? error : undefined);

  const submit = async () => {
    setBusy(true);
    setError('');
    setErrorField(undefined);
    setDone('');
    setCode('');
    try {
      const result = await createInstructor({
        ...form,
        password: form.password.trim() || undefined,
        specialties: form.specialties
          .split(/[،,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        yearsExperience: Number(form.yearsExperience) || 0,
      });
      if (!result.ok) {
        setError(result.error);
        setErrorField(result.field);
        return;
      }
      // ⚠️ التنبيه ده على عملية **تمّت**: المدرب اتعمل والرمز في إيد
      //    الإدارة، بس صف مقدّم الخدمة لأ. لونه أصفر لا أحمر عشان
      //    محدّش يعيد الإنشاء ويطلّع حسابين.
      setProviderWarning(result.providerWarning ?? '');

      if (result.tempCode) {
        setCode(result.tempCode);
        // البريد بيتمسح من النموذج بعد شوية سطور، فبنمسكه دلوقتي
        // عشان رسالة الواتساب تطلع كاملة.
        setCodeEmail(form.email.trim().toLowerCase());
      } else {
        setDone(
          'الشخص كان مسجّلاً بالفعل — اتحوّل لمدرب، وبيدخل بكلمة مروره الحالية زي ما هي.',
        );
      }
      setForm({
        email: '',
        fullName: '',
        displayName: '',
        bio: '',
        specialties: '',
        yearsExperience: 0,
        workModel: 'per_session',
        password: '',
      });
      router.refresh();
    } catch {
      // الأكشن بيرجّع رسالته؛ ده للانقطاع وأي حاجة غير متوقعة.
      setError('تعذّر إضافة المدرب');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-black text-slate-800">مدرب جديد</h2>
      <p className="mb-6 text-sm font-medium text-slate-500">
        هيظهرلك رمز مؤقت تبعته للمدرب. أول ما يدخل بيه، الموقع هيوقفه على شاشة
        يحطّ فيها كلمة مروره بنفسه. بيبدأ بحالة «قيد التدريب»، وما يظهرش
        للعملاء إلا لما تفعّله من صفحته.
      </p>

      {error && !errorField && <FormError message={error} className="mb-4" />}
      {done && <FormSuccess message={done} className="mb-4" />}

      <FormNotice message={providerWarning} className="mb-4" />
      {code && <TempCodeBox code={code} email={codeEmail} role="المدرب" />}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="البريد الإلكتروني" name="email" required error={err('email')}>
          <TextInput
            type="email"
            dir="ltr"
            className="text-left"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="الاسم الكامل" name="fullName" required error={err('fullName')}>
          <TextInput
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </Field>
        <Field label="الاسم المعروض للطلاب" help="الاسم اللي بيظهر في صفحة المدرب وفي الحجز. ممكن يختلف عن الاسم الكامل." name="displayName">
          <TextInput
            placeholder="يُترك فارغًا = نفس الاسم الكامل"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </Field>
        <Field label="سنوات الخبرة" name="yearsExperience">
          <TextInput
            type="number"
            min={0}
            value={form.yearsExperience}
            onChange={(e) =>
              setForm({ ...form, yearsExperience: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="التخصصات (مفصولة بفاصلة)" help="بتظهر كعلامات صغيرة في صفحة المدرب — مثلًا: قصة قصيرة، شعر، كتابة إبداعية." name="specialties">
          <TextInput
            placeholder="الكتابة للأطفال، بناء الشخصيات"
            value={form.specialties}
            onChange={(e) => setForm({ ...form, specialties: e.target.value })}
          />
        </Field>
        <Field label="نظام العمل" help="بالجلسة: المدرب بيحدد حصيلته من الجلسة والموقع بيضيف نسبة المنصة. راتب شهري: اتفاق ثابت بالتزام 60 ساعة في الشهر على الأقل." name="workModel">
          <Select
            value={form.workModel}
            onChange={(e) =>
              setForm({ ...form, workModel: e.target.value as 'monthly' | 'per_session' })
            }
          >
            <option value="per_session">بالجلسة</option>
            <option value="monthly">اشتراك شهري</option>
          </Select>
        </Field>
        <Field
          label="كلمة المرور الأولية (اختياري)"
          name="password"
          hint="اتركه فارغاً لتوليد رمز مؤقت آمن تلقائياً"
          error={err('password')}
          className="md:col-span-2"
        >
          <TextInput
            dir="ltr"
            placeholder="مثال: اختر كلمة مرور للمدرب (8 أحرف فأكثر) أو اتركه فارغاً"
            className="text-left font-mono"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <Field label="نبذة" name="bio" className="md:col-span-2">
          <TextArea
            className="resize-y"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </Field>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <BusyButton busy={false} variant="secondary" onClick={onDone}>
          إغلاق
        </BusyButton>
        <BusyButton
          busy={busy}
          pendingLabel="جارٍ الإضافة…"
          onClick={submit}
          disabled={!form.email.trim() || !form.fullName.trim()}
        >
          إضافة المدرب
        </BusyButton>
      </div>
    </div>
  );
}
