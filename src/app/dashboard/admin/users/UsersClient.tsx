'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Copy, Eye, Plus, Search, X } from 'lucide-react';
import { SimpleDataTable } from '@/components/dashboard/SimpleDataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/dashboard/Pagination';
import { createUserDirectly, inviteUser, updateUserRole } from '@/actions/admin-users';
import { InviteLinkBox } from '@/components/dashboard/InviteLinkBox';
import type { UserProfile, UserRole } from '@/types';
import {
  roleChoices,
  roleToChoice,
  choiceToRole,
  roleDisplayName,
  type AdminRoleOption,
} from '@/lib/role-choice';
import { Field, TextInput, Select, BusyButton, fieldClass } from '@/components/forms/Form';
import { FormError } from '@/components/ui/FormError';

export const ROLE_LABELS: Record<string, string> = {
  visitor: 'زائر',
  // ⚠️ «طالب» = حساب طفل تابع لولي أمر (بيتعمل من «أفراد العائلة» بس).
  //    كان اسمه «عميل / طالب» وكان الدور الافتراضي في «إضافة مستخدم» —
  //    فأي فرد اتضاف من هنا كان بيتعمل حساب طفل من غير ولي أمر: لوحة
  //    «متدرب»، وطلباته «بتروح لولي أمره» اللي مش موجود، ومايقدرش يفتح
  //    طلباته ومدفوعاته (ملاحظة تامر).
  customer: 'حساب مستخدم (فرد / ولي أمر)',
  student: 'حساب طالب (تابع لولي أمر)',
  instructor: 'مدرب',
  service_provider: 'مقدّم خدمة',
  publisher: 'ناشر',
  // دوره الإداري بالظبط («محاسب»، «مسؤول محتوى»…) من شاشة «الصلاحيات».
  general_supervisor: 'إداري',
  super_admin: 'مدير نظام',
};

/**
 * الأدوار اللي تتحدد من الشاشة دي.
 *
 * «مدرب» مش موجود عن قصد: المدرب محتاج ملف كامل (تخصص، سعر، مواعيد)،
 * فبيتضاف من شاشة «المدربين» وحدها. ولو مستخدم دوره مدرب بالفعل، الخانة
 * بتظهر كنص ثابت مش قايمة — عشان ما يتغيّرش بالغلط.
 */
const ASSIGNABLE: UserRole[] = [
  'customer',
  'service_provider',
  'publisher',
  'general_supervisor',
  'super_admin',
];

// `state` فاضي = الحسابات الموجودة — المحذوف (المؤرشف) مابيظهرش غير لو
// اخترته (ملف 10: الحذف اللي عليه حركات بيأرشف بدل ما يمسح).
const EMPTY_FILTERS = { search: '', role: '', guardian: '', account: '', state: '' };

/** بيانات جاية من طلب انضمام مقبول — انظر `InstructorPrefill`. */
export type UserPrefill = {
  email: string;
  fullName: string;
  role: UserRole;
};

export function UsersClient({
  users,
  canInvite,
  isSuperAdmin,
  currentUserId,
  prefill,
  adminRoles = [],
}: {
  users: UserProfile[];
  canInvite: boolean;
  isSuperAdmin: boolean;
  currentUserId: string;
  prefill?: UserPrefill | null;
  /** الأدوار الإدارية بأسمائها (schema/05) — فاضية لو الجدول مش موجود. */
  adminRoles?: AdminRoleOption[];
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // جاي من قبول طلب انضمام؟ النموذج يفتح لوحده.
  const [showForm, setShowForm] = useState(Boolean(prefill));

  const set = (key: keyof typeof EMPTY_FILTERS, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const activeFilterCount = Object.values(filters).filter((v) => v !== '').length;

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !`${u.fullName} ${u.email ?? ''}`.toLowerCase().includes(q))
        return false;
      if (filters.role && u.role !== filters.role) return false;
      if (filters.guardian === 'yes' && !u.isGuardian) return false;
      if (filters.guardian === 'no' && u.isGuardian) return false;
      // «له حساب دخول» = عنده بريد مسجَّل في المصادقة.
      if (filters.account === 'with_email' && !u.email) return false;
      if (filters.account === 'no_email' && u.email) return false;
      if (filters.state === 'archived') return Boolean(u.archivedAt);
      if (u.archivedAt) return false;
      if (filters.state === 'suspended' && !u.suspendedAt) return false;
      return true;
    });
  }, [users, filters]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const formatted = pageRows.map((user) => ({
    ...user,
    fullNameDisplay: (
      <Link
        href={`/dashboard/admin/users/${user.id}`}
        className="font-bold text-blue-600 hover:underline"
      >
        {user.fullName}
        {user.archivedAt ? (
          <span className="mr-2 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">محذوف</span>
        ) : user.suspendedAt ? (
          <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">موقوف</span>
        ) : null}
      </Link>
    ),
    emailDisplay: user.email ? (
      <span dir="ltr" className="text-sm text-slate-700">
        {user.email}
      </span>
    ) : (
      <span className="text-sm text-slate-400">—</span>
    ),
    roleDisplay: (
      <RoleCell
        userId={user.id}
        role={user.role}
        adminRoleId={user.adminRoleId ?? null}
        adminRoles={adminRoles}
        editable={user.id !== currentUserId || isSuperAdmin}
        isSuperAdmin={isSuperAdmin}
      />
    ),
    guardianDisplay: user.isGuardian ? (
      <StatusBadge type="neutral" label="ولي أمر" />
    ) : (
      <span className="text-slate-400">—</span>
    ),
    actionsDisplay: (
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/admin/users/${user.id}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
          title="عرض الملف وإدارة الحساب"
        >
          <Eye className="h-3.5 w-3.5 text-slate-500" />
          <span>إدارة الحساب</span>
        </Link>
      </div>
    ),
  }));

  const columns = [
    { header: 'الاسم', accessorKey: 'fullNameDisplay' },
    { header: 'البريد الإلكتروني', accessorKey: 'emailDisplay' },
    { header: 'الدور', accessorKey: 'roleDisplay' },
    { header: 'ولي أمر', accessorKey: 'guardianDisplay' },
    { header: 'الإجراءات', accessorKey: 'actionsDisplay' },
  ];

  return (
    <div>
      {canInvite && (
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800"
          >
            {showForm ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {showForm ? 'إغلاق' : 'إضافة مستخدم'}
          </button>
        </div>
      )}

      {showForm && (
        <AddUserForm
          isSuperAdmin={isSuperAdmin}
          adminRoles={adminRoles}
          prefill={prefill}
          onDone={() => setShowForm(false)}
        />
      )}

      <div className="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="relative">
          <Search className="absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="ابحث بالاسم أو البريد الإلكتروني"
            className={`${fieldClass} pr-11`}
            placeholder="ابحث بالاسم أو البريد الإلكتروني…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="الدور">
            <Select value={filters.role} onChange={(e) => set('role', e.target.value)}>
              <option value="">كل الأدوار</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="ولي أمر">
            <Select value={filters.guardian} onChange={(e) => set('guardian', e.target.value)}>
              <option value="">الكل</option>
              <option value="yes">ولي أمر</option>
              <option value="no">ليس ولي أمر</option>
            </Select>
          </Field>
          <Field label="البريد">
            <Select value={filters.account} onChange={(e) => set('account', e.target.value)}>
              <option value="">الكل</option>
              <option value="with_email">له بريد مسجَّل</option>
              <option value="no_email">بدون بريد</option>
            </Select>
          </Field>
          <Field label="الحالة">
            <Select value={filters.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">الحسابات الموجودة</option>
              <option value="suspended">الموقوفة والمعلَّقة</option>
              <option value="archived">المحذوفة (مؤرشفة)</option>
            </Select>
          </Field>
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

/**
 * تغيير الدور من الجدول مباشرة.
 *
 * التغيير بيتحفظ فورًا — مفيش زرار حفظ منفصل عشان ما يحصلش اللبس المعتاد:
 * «غيّرت الدور وخرجت من الصفحة والتغيير ضاع».
 */
function RoleCell({
  userId,
  role,
  adminRoleId,
  adminRoles,
  editable,
  isSuperAdmin,
}: {
  userId: string;
  role: UserRole;
  adminRoleId: string | null;
  adminRoles: AdminRoleOption[];
  editable: boolean;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  // القيمة «اختيار» مش دور خام: الإداري بيتعرض باسم دوره الإداري.
  const [value, setValue] = useState<string>(roleToChoice(role, adminRoleId, adminRoles));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // دور مش في قايمة الأدوار المتاحة (مدرب مثلًا) — بيتعرض كنص ثابت.
  // لو عرضناه في قايمة ما هوش فيها، المتصفح هيختار أول عنصر وهيبان إن
  // دوره اتغيّر وهو ما اتغيّرش — وأي لمسة للقايمة كانت هتغيّره فعلًا.
  const locked = !ASSIGNABLE.includes(role);
  // غير مدير النظام مايقدرش يلمس دور إداري — فبيشوفه نص ثابت مش قايمة
  // مافيهاش قيمته (نفس سبب «مدرب» فوق).
  const adminTarget = role === 'general_supervisor' || role === 'super_admin';

  if (!editable || locked || (adminTarget && !isSuperAdmin)) {
    return (
      <div className="space-y-1">
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
          {roleDisplayName(role, adminRoleId, adminRoles, ROLE_LABELS)}
        </span>
        {locked && role === 'instructor' && (
          <p className="text-[11px] font-medium text-slate-500">يتعدّل من شاشة المدربين</p>
        )}
      </div>
    );
  }

  const change = async (next: string) => {
    const decoded = choiceToRole(next, adminRoles);
    if (!decoded) return;
    const previous = value;
    setValue(next);
    setBusy(true);
    setError('');
    try {
      const result = await updateUserRole(userId, decoded.role, decoded.adminRoleId);
      if (!result.ok) {
        setValue(previous); // الرجوع للقيمة القديمة: الشاشة ما تكدبش على المستخدم
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setValue(previous);
      setError('تعذّر تغيير الدور');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      {/* خانة جوّه صف الجدول — العنوان «الدور» فوق العمود، فالاسم للقارئ الصوتي بس. */}
      <div className="min-w-[12rem]">
        <Select
          aria-label="الدور"
          value={value}
          disabled={busy}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => change(e.target.value)}
        >
          {roleChoices(ASSIGNABLE, adminRoles, ROLE_LABELS, isSuperAdmin).map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      {error && <p className="max-w-[12rem] text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}


/**
 * إضافة مستخدم — بطريقتين.
 *
 *   • إنشاء مباشر (الافتراضي): الحساب بيتعمل بكلمة مرور وجاهز للدخول
 *     فورًا، وكلمة المرور بتظهر مرة واحدة عشان تتسلّم لصاحبها.
 *   • رابط دعوة: الشخص هو اللي بيحدد كلمة مروره، ومفيش كلمة مرور بتمر
 *     على الإدارة.
 *
 * الاتنين محتاجين مفتاح الخدمة على الخادم — والزرار أصلًا مخفي من غيره.
 */
function AddUserForm({
  isSuperAdmin,
  adminRoles,
  prefill,
  onDone,
}: {
  isSuperAdmin: boolean;
  adminRoles: AdminRoleOption[];
  prefill?: UserPrefill | null;
  onDone: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'direct' | 'invite'>('direct');
  const [form, setForm] = useState({
    email: prefill?.email ?? '',
    fullName: prefill?.fullName ?? '',
    // «اختيار» مش دور خام — الأدوار الإدارية بأسمائها (`@/lib/role-choice`).
    role: roleToChoice((prefill?.role ?? 'customer') as UserRole, null, adminRoles),
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // الخانة اللي الخادم رجّع عليها الخطأ — بتتعلّم بالأحمر والرسالة تحتها.
  const [errorField, setErrorField] = useState<string | undefined>();
  const [link, setLink] = useState('');
  const [created, setCreated] = useState<{ fullName: string; email: string; password: string } | null>(null);

  const reset = () => setForm({ email: '', fullName: '', role: 'customer', password: '' });

  const err = (f: string) => (errorField === f ? error : undefined);

  const submit = async () => {
    setBusy(true);
    setError('');
    setErrorField(undefined);
    setLink('');
    setCreated(null);
    try {
      const decoded = choiceToRole(form.role, adminRoles);
      if (!decoded) {
        setError('الدور المختار غير صالح — حدّث الصفحة وجرّب تاني');
        return;
      }
      const payload = { ...form, role: decoded.role, adminRoleId: decoded.adminRoleId };
      if (mode === 'direct') {
        const result = await createUserDirectly(payload);
        if (!result.ok) {
          setError(result.error);
          setErrorField(result.field);
          return; // الفورم ما بيتفضّاش عند الفشل: التصحيح أسهل من إعادة الكتابة
        }
        setCreated({
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          password: result.password,
        });
      } else {
        const result = await inviteUser(payload);
        if (!result.ok) {
          setError(result.error);
          setErrorField(result.field);
          return;
        }
        setLink(result.inviteLink);
      }
      reset();
      router.refresh();
    } catch {
      setError('تعذّر إنشاء الحساب — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  const tab = (value: 'direct' | 'invite', label: string) => (
    <button
      type="button"
      onClick={() => {
        setMode(value);
        setError('');
        setErrorField(undefined);
      }}
      className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-colors ${
        mode === value
          ? 'bg-slate-900 text-white'
          : 'bg-white text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-black text-slate-800">إضافة مستخدم جديد</h2>

      <div className="mb-4 inline-flex gap-1 rounded-2xl bg-slate-100 p-1">
        {tab('direct', 'إنشاء مباشر')}
        {tab('invite', 'رابط دعوة')}
      </div>

      <p className="mb-6 text-sm font-medium text-slate-500">
        {mode === 'direct'
          ? 'الحساب هيتعمل فورًا برمز مؤقت تسلّمه لصاحبه. سيب الخانة فاضية وإحنا نولّد رمزًا قويًّا. أول ما يدخل بيه، الموقع هيوقفه على شاشة يحطّ فيها كلمة مروره بنفسه — فمفيش كلمة مرور دائمة بتعرفها.'
          : 'الحساب هيتعمل وهيظهرلك رابط تبعته للشخص (واتساب مثلًا) يحدد منه كلمة مروره. مفيش كلمة مرور بتمر عليك ولا بتتخزّن في أي مكان.'}
      </p>

      {/* الخطأ اللي مش على خانة بعينها فوق؛ اللي على خانة بيظهر تحتها. */}
      <FormError message={errorField ? '' : error} className="mb-4" />
      {link && <InviteLinkBox link={link} />}
      {created && (
        <NewAccountBox
          fullName={created.fullName}
          email={created.email}
          password={created.password}
        />
      )}

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
        <Field label="الدور" name="role" required error={err('role')}>
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {roleChoices(ASSIGNABLE, adminRoles, ROLE_LABELS, isSuperAdmin).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        {mode === 'direct' && (
          <Field
            label={
              <>
                كلمة المرور <span className="font-medium text-slate-600">(اختيارية)</span>
              </>
            }
            name="password"
            error={err('password')}
          >
            <TextInput
              dir="ltr"
              className="text-left"
              placeholder="سيبها فاضية للتوليد التلقائي"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </Field>
        )}
      </div>

      <div className="mt-4 space-y-2 text-sm font-medium">
        <p className="text-amber-700">
          لإضافة <strong>مدرب</strong>، استخدم شاشة «المدربين» بدل دي — عشان يتعمل
          له ملف مدرب كامل مش مجرد حساب.
        </p>
        {form.role === 'service_provider' && (
          <p className="text-slate-500">
            بعد إنشاء الحساب، ضيفه في شاشة «مقدّمي الخدمة» وحدّد خدماته وأسعارها —
            الدور لوحده مش بيخليه يستقبل طلبات.
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl px-6 py-3 font-bold text-slate-600 hover:text-slate-900"
        >
          إغلاق
        </button>
        <BusyButton
          busy={busy}
          pendingLabel="جارٍ الإنشاء…"
          onClick={submit}
          disabled={!form.email.trim() || !form.fullName.trim()}
        >
          {mode === 'direct' ? 'إنشاء الحساب' : 'إنشاء الدعوة'}
        </BusyButton>
      </div>
    </div>
  );
}

/**
 * بيانات الدخول بعد الإنشاء المباشر — بتظهر مرة واحدة.
 *
 * كلمة المرور مش متخزّنة عندنا في أي مكان، فلو الصفحة اتقفلت من غير
 * نسخها، الحل الوحيد هو تغييرها من جديد.
 */
function NewAccountBox({
  fullName,
  email,
  password,
}: {
  fullName?: string;
  email: string;
  password: string;
}) {
  const [copiedKey, setCopiedKey] = useState<'code' | 'all' | 'whatsapp' | null>(null);

  const copy = async (what: 'code' | 'all' | 'whatsapp') => {
    try {
      if (what === 'code') {
        await navigator.clipboard.writeText(password);
      } else if (what === 'all') {
        await navigator.clipboard.writeText(`البريد: ${email}\nكلمة المرور: ${password}`);
      } else if (what === 'whatsapp') {
        const msg = `مرحباً أستاذ/ة ${fullName || 'المحترم/ة'}،\n\nإليك بيانات تسجيل الدخول الخاصة بحسابك في منصة الرحلة:\n• البريد الإلكتروني: ${email}\n• كلمة المرور المؤقتة: ${password}\n• رابط الدخول: https://alrehlat.vercel.app/login\n\n⚠️ ملاحظة هامة: فور تسجيل الدخول، سيطلب منك الموقع تعيين كلمة مرور شخصية خاصة بك لحماية بيانات حسابك.\n\nنتمنى لك تجربة ممتعة وموفقة في المنصة!`;
        await navigator.clipboard.writeText(msg);
      }
      setCopiedKey(what);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-bold text-emerald-950 text-base">تم إنشاء الحساب وجاهز للدخول فوراً ✓</p>
          <p className="mt-1 text-xs font-medium text-emerald-800 leading-relaxed">
            انسخ البيانات دي الآن — <strong>الرمز مش هيظهر تاني</strong> ومش متخزّن بنصه في أي مكان. أول ما صاحب الحساب يدخل بيه، هيطلب منه الموقع تعيين كلمة مروره الخاصة.
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-4 py-2.5">
          <span className="text-xs font-bold text-slate-500">البريد الإلكتروني:</span>
          <span dir="ltr" className="font-mono text-sm font-bold text-slate-800">
            {email}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-white px-4 py-2.5">
          <span className="text-xs font-bold text-slate-500">الرمز / كلمة المرور:</span>
          <span dir="ltr" className="font-mono text-base font-black tracking-wider text-emerald-900">
            {password}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy('code')}
          className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          {copiedKey === 'code' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span>{copiedKey === 'code' ? 'تم نسخ الرمز' : 'نسخ الرمز فقط'}</span>
        </button>

        <button
          type="button"
          onClick={() => copy('all')}
          className="flex-1 min-w-[150px] flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
        >
          {copiedKey === 'all' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span>{copiedKey === 'all' ? 'تم نسخ البيانات' : 'نسخ البريد والرمز'}</span>
        </button>

        <button
          type="button"
          onClick={() => copy('whatsapp')}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-800"
        >
          {copiedKey === 'whatsapp' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span>{copiedKey === 'whatsapp' ? 'تم نسخ رسالة الواتساب!' : 'نسخ رسالة واتساب جاهزة للشخص'}</span>
        </button>
      </div>
    </div>
  );
}
