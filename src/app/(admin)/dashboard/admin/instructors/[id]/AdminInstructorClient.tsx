'use client';

import { SITE_URL } from '@/lib/site-url';
import { accountMessage, greetByName, SIGN_IN_PATH } from '@/lib/account-message';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Instructor,
  ProfileUpdateRequest,
  InstructorCertification,
  CreativeService,
  InstructorServiceOffer,
  PricingFormulaSettings,
  WeeklySlot,
} from '@/types';
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
  MessageSquare,
  Save,
  Layers,
  Sparkles,
  FileText,
  Clock,
  User,
  LayoutDashboard,
  ShieldCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  CalendarDays,
  ArrowRight,
  Briefcase,
  KeyRound,
  Copy,
  Lock,
  Trash2,
  X,
} from 'lucide-react';
import {
  updateInstructorCertification,
  setInstructorTraining,
  setInstructorStatus,
  setInstructorPackages,
} from '@/actions/instructors';
import { deleteInstructor, resetInstructorPassword } from '@/actions/admin-instructors';
import { type PackageChoice } from '@/components/dashboard/PackagePicker';
import { PLATFORM_TIMEZONE } from '@/lib/timezone';
import { getInstructorChangeItems } from '@/lib/request-summary';
import { useAction } from '@/lib/use-action';
import { FormError, FormSuccess, FormNotice } from '@/components/ui/FormError';
import { Field, TextInput, Checkbox, BusyButton, fieldClass } from '@/components/forms/Form';
import { isoToCairoLocal } from '@/lib/promotions';
import { InstructorProfileEditor } from './InstructorProfileEditor';
import { InstructorServicesSection } from './InstructorServicesSection';
import { TransferWorkPanel } from './TransferWorkPanel';

interface AdminInstructorClientProps {
  instructor: Instructor;
  accountEmail?: string;
  updateRequests: ProfileUpdateRequest[];
  certification: InstructorCertification | null;
  packages: PackageChoice[];
  selectedPackageIds: string[];
  services: CreativeService[];
  serviceOffers: InstructorServiceOffer[];
  formula: PricingFormulaSettings;
  /** المدربون النشطون اللي ينفع ينتقل لهم الشغل. */
  transferTargets: { id: string; name: string }[];
}

const ARABIC_DAYS: Record<string, string> = {
  saturday: 'السبت',
  sunday: 'الأحد',
  monday: 'الإثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
};

const DAY_KEYS = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const TRACK_LABELS: Record<string, string> = {
  foundation: 'تأسيس',
  youth: 'يافعين',
  specialization: 'تخصص',
};

type ActiveTab = 'overview' | 'requests' | 'packages' | 'schedule' | 'profile' | 'services';

export function AdminInstructorClient({
  instructor,
  accountEmail,
  updateRequests,
  certification,
  packages,
  selectedPackageIds,
  services,
  serviceOffers,
  formula,
  transferTargets,
}: AdminInstructorClientProps) {
  const router = useRouter();

  // Requests separation
  const pendingRequests = useMemo(
    () => updateRequests.filter((r) => r.status === 'pending'),
    [updateRequests]
  );
  const pastRequests = useMemo(
    () => updateRequests.filter((r) => r.status !== 'pending'),
    [updateRequests]
  );

  // Active tab: if there are pending requests, default to requests tab so admin sees them immediately!
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    pendingRequests.length > 0 ? 'requests' : 'overview'
  );

  // Status & Certification state
  const [trainingPassed, setTrainingPassed] = useState(certification?.examPassed || false);
  const [status, setStatus] = useState(instructor.status);
  const [statusDone, setStatusDone] = useState('');
  // تأكيد الحذف — خطوتين عن قصد: الحذف مش رجوع عنه.
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Password reset & access management state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'auto' | 'custom'>('auto');
  const [customPasswordInput, setCustomPasswordInput] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  // الخطأ على خانة كلمة المرور نفسها؟ رسالته بتظهر تحتها بدل فوق.
  const [passwordErrorOnField, setPasswordErrorOnField] = useState(false);
  const [passwordResult, setPasswordResult] = useState<{
    email: string;
    tempCode: string;
    isCustom: boolean;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<'code' | 'whatsapp' | null>(null);

  const handleResetPassword = async () => {
    setPasswordError('');
    setPasswordErrorOnField(false);
    setPasswordResult(null);
    if (passwordMode === 'custom' && customPasswordInput.trim().length < 8) {
      setPasswordError('كلمة المرور يجب أن تكون 8 خانات على الأقل.');
      setPasswordErrorOnField(true);
      return;
    }
    setResettingPassword(true);
    try {
      const res = await resetInstructorPassword({
        instructorId: instructor.id,
        customPassword: passwordMode === 'custom' ? customPasswordInput.trim() : undefined,
      });
      if (!res.ok) {
        setPasswordError(res.error);
        setPasswordErrorOnField(res.field === 'customPassword' && passwordMode === 'custom');
        return;
      }
      setPasswordResult(res);
      setCustomPasswordInput('');
    } catch {
      // الأكشن بيرجّع رسالته؛ ده للانقطاع وأي حاجة غير متوقعة.
      setPasswordError('تعذّر إعادة تعيين كلمة المرور');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedKey('code');
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  const handleCopyWhatsapp = async () => {
    if (!passwordResult) return;
    const emailToUse = passwordResult.email || accountEmail || 'بريدك الإلكتروني المسجل';
    const msg = accountMessage({
      code: passwordResult.tempCode,
      email: emailToUse,
      loginUrl: `${SITE_URL}${SIGN_IN_PATH}`,
      greeting: greetByName(instructor.displayName),
      nextStep:
        'وبعد الدخول تلاقي لوحتك زي ما سيبتها: مواعيدك، جلساتك، ومهامك.',
    });
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedKey('whatsapp');
      setTimeout(() => setCopiedKey(null), 3000);
    } catch {}
  };

  // Packages state & filters
  const [pickedPackages, setPickedPackages] = useState<string[]>(selectedPackageIds);
  const [packagesDone, setPackagesDone] = useState('');
  const [packageSearch, setPackageSearch] = useState('');
  const [packageTrackFilter, setPackageTrackFilter] = useState<string>('all');

  // Schedule view state: default is "single day" as requested!
  const [scheduleViewMode, setScheduleViewMode] = useState<'single_day' | 'week_grid'>('single_day');
  const [selectedDay, setSelectedDay] = useState<string>('saturday');

  // Past requests filters & pagination (handling dense content!)
  const [pastFilterStatus, setPastFilterStatus] = useState<'all' | 'approved' | 'rejected'>('all');
  const [pastPage, setPastPage] = useState(1);
  const PAST_PAGE_SIZE = 4;

  const savePackages = useAction(setInstructorPackages, {
    onSuccess: (result) => {
      if (result.ok) {
        setPackagesDone(
          result.count === 0
            ? 'تم الحفظ. المدرب سيظهر في جميع الباقات المتاحة بالمنصة.'
            : `تم الحفظ بنجاح. المدرب سيظهر في ${result.count} باقة معتمدة.`
        );
      }
    },
    fallbackError: 'تعذّر حفظ باقات المدرب.',
  });

  const changeStatus = useAction(setInstructorStatus, {
    onSuccess: (result) => {
      if (result.ok) {
        setStatus(result.status as typeof instructor.status);
        setStatusDone(
          result.status === 'active'
            ? 'تم تفعيل المدرب، وسيظهر لأولياء الأمور في معالج الحجز.'
            : 'تم تحديث حالة المدرب بنجاح.'
        );
      }
    },
    fallbackError: 'تعذّر تغيير حالة المدرب.',
  });

  const certify = useAction(updateInstructorCertification, {
    fallbackError: 'تعذّر حفظ حالة التدريب.',
  });

  /**
   * موعد التدريب ورابطه والدرجة.
   *
   * ⚠️ منفصل عن `certify` عن قصد: ده بيحدّد الموعد، وهو بيسجّل
   *    الاجتياز. دمجهم كان معناه إن تغيير رابط بيلمس حالة الاعتماد.
   */
  const training = useAction(setInstructorTraining, {
    onSuccess: () => router.refresh(),
    fallbackError: 'تعذّر حفظ بيانات التدريب.',
  });

  /**
   * حذف المدرب — **بس لو مالوش أي سجل**.
   *
   * الحارس في القاعدة (`delete_instructor`)، مش هنا: مدرب عنده جلسات
   * أو مستحقات بيترفض برسالة فيها الأرقام والبديل («إيقاف»)، لأن
   * المفاتيح الأجنبية كانت هتمسح السجل المالي وتوهّ الجلسات.
   */
  const removeInstructor = useAction(deleteInstructor, {
    onSuccess: (result) => {
      if (!result.ok) return;
      // الصفحة دي بقت بتشاور على مدرب مش موجود — نرجّع للقايمة.
      router.push('/dashboard/admin/instructors');
    },
    fallbackError: 'تعذّر حذف المدرب.',
  });

  const handleTrainingToggle = async (checked: boolean) => {
    const previous = trainingPassed;
    setTrainingPassed(checked);
    const result = await certify.run(instructor.id, checked);
    if (result === undefined) setTrainingPassed(previous);
    else router.refresh();
  };

  const actionError = certify.error || training.error;

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

  // Filtered & paginated past requests
  const filteredPastRequests = useMemo(() => {
    return pastRequests.filter((r) => {
      if (pastFilterStatus === 'all') return true;
      return r.status === pastFilterStatus;
    });
  }, [pastRequests, pastFilterStatus]);

  const totalPastPages = Math.ceil(filteredPastRequests.length / PAST_PAGE_SIZE) || 1;
  const paginatedPastRequests = useMemo(() => {
    const start = (pastPage - 1) * PAST_PAGE_SIZE;
    return filteredPastRequests.slice(start, start + PAST_PAGE_SIZE);
  }, [filteredPastRequests, pastPage]);

  // Weekly schedule stats
  const weeklySlots = instructor.weeklySchedule || [];
  const bookedSlotsCount = weeklySlots.filter((s) => s.isBooked).length;
  const tempSlotsCount = weeklySlots.filter((s) => s.commitmentType === 'fixed_term').length;

  return (
    <div className="space-y-6">
      <FormError message={actionError} />

      {/* 1. ترويسة المدرب المدمجة + شريط المؤشرات السريعة (Instructor Header Bar) */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white font-black text-xl shadow-xs">
              {instructor.displayName ? instructor.displayName[0] : 'م'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-900">{instructor.displayName}</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    status === 'active'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : status === 'suspended'
                      ? 'bg-rose-100 text-rose-800 border border-rose-200'
                      : status === 'hidden'
                      ? 'bg-slate-200 text-slate-700 border border-slate-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status === 'active'
                        ? 'bg-emerald-600'
                        : status === 'suspended'
                          ? 'bg-rose-600'
                          : status === 'hidden'
                            ? 'bg-slate-500'
                            : 'bg-amber-600'
                    }`}
                  />
                  {status === 'active'
                    ? 'نشط بالمنصة'
                    : status === 'suspended'
                    ? 'موقوف'
                    : status === 'hidden'
                    ? 'مخفي — شغّال'
                    : 'في انتظار الاعتماد'}
                </span>
                {trainingPassed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200">
                    <CheckCircle2 className="h-3 w-3" />
                    معتمد تدريبياً
                  </span>
                )}
              </div>

              {/* شريط البيانات الأساسية */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <div>
                  <span className="font-bold text-slate-700">نظام العمل: </span>
                  <span className="font-medium text-slate-800">
                    {instructor.workModel === 'monthly'
                      ? `راتب شهري (${instructor.monthlyHoursCommitted || 60} ساعة)`
                      : `بالجلسة (${instructor.approvedPrice ? `${instructor.approvedPrice} ج.م` : 'غير محدد'})`}
                  </span>
                </div>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <div>
                  <span className="font-bold text-slate-700">الباقات: </span>
                  <span className="font-medium text-slate-800">
                    {pickedPackages.length === 0 ? 'جميع الباقات' : `${pickedPackages.length} باقة معتمدة`}
                  </span>
                </div>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <div>
                  <span className="font-bold text-slate-700">الجدول: </span>
                  <span className="font-medium text-slate-800">{weeklySlots.length} موعد أسبوعي</span>
                </div>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <div>
                  <span className="font-bold text-slate-700">الخدمات الإضافية: </span>
                  <span className="font-medium text-slate-800">
                    {serviceOffers.filter((o) => o.isActive).length} خدمة نشطة
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* تبديل الحالة السريع وإدارة الدخول */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <span className="text-xs font-bold text-slate-400 ml-1">الحالة:</span>
            {([
              { value: 'active', label: 'نشط', tone: 'bg-emerald-600 hover:bg-emerald-700' },
              { value: 'pending_approval', label: 'بانتظار الاعتماد', tone: 'bg-amber-600 hover:bg-amber-700' },
              // «مخفي» بين «نشط» و«إيقاف» عن قصد: دي درجة وسط، مش عقوبة.
              { value: 'hidden', label: 'إخفاء من الموقع', tone: 'bg-slate-600 hover:bg-slate-700' },
              { value: 'suspended', label: 'إيقاف', tone: 'bg-rose-600 hover:bg-rose-700' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setStatusDone('');
                  changeStatus.run(instructor.id, opt.value);
                }}
                disabled={changeStatus.pending || status === opt.value}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-40 ${opt.tone}`}
              >
                {status === opt.value ? `${opt.label} ✓` : opt.label}
              </button>
            ))}

            {/* الفرق بين «إخفاء» و«إيقاف» مش واضح من الاسم لوحده،
                والإداري بيختار بينهم في ثانية — فالشرح جنبهم. */}
            {(status === 'hidden' || status === 'suspended') && (
              <>
                <p className="w-full pt-1 text-[11px] font-medium text-slate-500">
                  {status === 'hidden'
                    ? 'مش ظاهر للزوار ومش قابل للحجز — ولوحته مفتوحة، وجلساته ومهامه الحالية ماشية عادي.'
                    : 'موقوف: مش ظاهر للزوار ومش قابل للحجز. مستحقاته وطلبات سحبه زيّ ما هي.'}
                </p>
                {/* الموقوف شغله لازم يروح لحد — والمخفي ممكن يكمّله
                    بنفسه، فالنقل معروض للاتنين والإدارة تقرر. */}
                <TransferWorkPanel
                  instructorId={instructor.id}
                  instructorName={instructor.displayName}
                  targets={transferTargets}
                />
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordError('');
                setPasswordErrorOnField(false);
                setPasswordResult(null);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-900 transition-colors shadow-2xs mr-auto lg:mr-2"
            >
              <KeyRound className="h-3.5 w-3.5 text-indigo-700" />
              <span>بيانات الدخول وكلمة المرور</span>
            </button>

            {/* ⚠️ **الحذف كان مش موجود خالص** (ملاحظة تامر، ١٥ أكتوبر):
                الإدارة بتعمل حساب للتجربة ومالهاش غير «إيقاف»، فالقايمة
                بتتلخبط بحسابات مش حقيقية. والحذف مشروط: الحارس في
                القاعدة بيرفض أي مدرب عنده جلسات أو طلبات أو مستحقات —
                لأن المفاتيح الأجنبية كانت هتمسح السجل المالي وتوهّ
                الجلسات في نفس اللحظة. */}
            {confirmDelete ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-rose-700">تحذف المدرب نهائيًا؟</span>
                <button
                  type="button"
                  onClick={() => removeInstructor.run(instructor.id)}
                  disabled={removeInstructor.pending}
                  className="rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  {removeInstructor.pending ? 'جارٍ الحذف…' : 'نعم، احذف'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={removeInstructor.pending}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                >
                  تراجع
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStatusDone('');
                  removeInstructor.clearError();
                  setConfirmDelete(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-1.5 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>حذف المدرب</span>
              </button>
            )}
          </div>
        </div>

        {statusDone && <FormSuccess message={statusDone} className="mt-3" />}
        {changeStatus.error && <FormError message={changeStatus.error} className="mt-3" />}
        {removeInstructor.error && <FormError message={removeInstructor.error} className="mt-3" />}
      </div>

      {/* 2. شريط التبويبات الرئيسي (Tabs Navigation for Dense Content) */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1 bg-white p-1.5 rounded-2xl shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>نظرة عامة والاعتماد</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'requests'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>طلبات التعديل</span>
          {pendingRequests.length > 0 && (
            <span className="rounded-full bg-amber-500 text-slate-950 px-2 py-0.2 text-[11px] font-black animate-pulse">
              {pendingRequests.length} معلقة
            </span>
          )}
          {pendingRequests.length === 0 && pastRequests.length > 0 && (
            <span className="rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.2 text-[10px]">
              {pastRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('packages')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'packages'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>باقات التدريب</span>
          <span className="rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.2 text-[10px]">
            {pickedPackages.length === 0 ? 'الكل' : pickedPackages.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'schedule'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>الجدول الأسبوعي</span>
          <span className="rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.2 text-[10px]">
            {weeklySlots.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'profile'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <User className="h-4 w-4" />
          <span>الملف الشخصي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('services')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 ${
            activeTab === 'services'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>الخدمات الإبداعية</span>
          <span className="rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.2 text-[10px]">
            {serviceOffers.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: نظرة عامة والاعتماد ─── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* كارت نظام العمل والمالية */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Briefcase className="h-4 w-4 text-amber-600" />
                <h3 className="font-black text-slate-800 text-sm">نظام العمل والاتفاق المالي</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">نوع التعاقد:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {instructor.workModel === 'monthly'
                      ? 'راتب شهري (تواصل مباشر مع الإدارة)'
                      : 'بالجلسة المنجزة'}
                  </span>
                </div>
                {instructor.workModel === 'monthly' ? (
                  <div>
                    <span className="text-slate-400 block mb-0.5">الحد الأدنى للساعات شهرياً:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {instructor.monthlyHoursCommitted || 60} ساعة شهرياً
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-400 block mb-0.5">السعر المعتمد للجلسة:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {instructor.approvedPrice ? `${instructor.approvedPrice} ج.م` : 'غير محدد حالياً'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
              يتم تعديل نظام العمل والتسعير عبر تقديم المدرب لطلب تعديل واعتماده من تبويبة «طلبات التعديل».
            </div>
          </div>

          {/* كارت التدريب والاختبار */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h3 className="font-black text-slate-800 text-sm">التدريب والاعتماد</h3>
              </div>
              <div className="space-y-3">
                <Checkbox
                  label="اجتاز التدريب والاختبار بنجاح"
                  checked={trainingPassed}
                  onChange={(e) => handleTrainingToggle(e.target.checked)}
                  disabled={certify.pending}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition-colors text-sm"
                />

                {/* ⚠️ **الخانات التلاتة دي ماكانش فيه حاجة بتكتبها.**
                    الأعمدة موجودة والكارت ده كان بيعرضها، والزرار فوق
                    بيكتب الاجتياز وبس — يعني الإدارة ماكانش عندها طريقة
                    تبعت رابط التدريب، والمدرب في لوحته بيستناه. */}
                <form
                  action={async (formData: FormData) => {
                    await training.run(instructor.id, {
                      meetingLink: String(formData.get('meetingLink') ?? ''),
                      completedAt: String(formData.get('completedAt') ?? ''),
                      examScore: String(formData.get('examScore') ?? ''),
                    });
                  }}
                  className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <p className="text-xs font-bold text-slate-700">موعد التدريب ونتيجته</p>

                  <label className="block text-[11px] font-bold text-slate-500">
                    رابط اللقاء (https)
                    <input
                      type="url"
                      name="meetingLink"
                      dir="ltr"
                      defaultValue={certification?.trainingMeetingLink ?? ''}
                      placeholder="https://meet.google.com/..."
                      className={fieldClass}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-500">
                    تاريخ حضور التدريب (بتوقيت القاهرة)
                    <input
                      type="datetime-local"
                      name="completedAt"
                      defaultValue={
                        certification?.trainingCompletedAt
                          ? isoToCairoLocal(certification.trainingCompletedAt)
                          : ''
                      }
                      className={fieldClass}
                    />
                  </label>

                  <label className="block text-[11px] font-bold text-slate-500">
                    درجة الاختبار (0–100)
                    <input
                      type="number"
                      name="examScore"
                      min={0}
                      max={100}
                      defaultValue={certification?.examScore ?? ''}
                      className={fieldClass}
                    />
                  </label>

                  <BusyButton type="submit" busy={training.pending} className="min-h-[44px] w-full">
                    حفظ بيانات التدريب
                  </BusyButton>
                  <p className="text-[11px] font-medium text-slate-500">
                    الرابط والتاريخ بيظهروا للمدرب في لوحته. والاجتياز بيتسجّل من المربّع فوق.
                  </p>
                </form>

                {certification && (
                  <div className="text-xs text-slate-600 space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    {certification.examScore !== undefined && (
                      <div>
                        <span className="font-bold">درجة الاختبار: </span>
                        <span>{certification.examScore}%</span>
                      </div>
                    )}
                    {certification.trainingMeetingLink && (
                      <div>
                        <span className="font-bold">رابط اللقاء: </span>
                        <a
                          href={certification.trainingMeetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline font-bold"
                        >
                          فتح الرابط
                        </a>
                      </div>
                    )}
                    {certification.certifiedAt && (
                      <div>
                        <span className="font-bold">تاريخ الاعتماد: </span>
                        <span>
                          {new Date(certification.certifiedAt).toLocaleDateString('ar-EG', {
                            timeZone: PLATFORM_TIMEZONE,
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
              {trainingPassed
                ? 'المدرب مؤهل تماماً ويمكن تنشيطه ليظهر لأولياء الأمور.'
                : 'يجب اجتياز التدريب والاختبار أولاً قبل تفعيل المدرب بالكامل.'}
            </div>
          </div>

          {/* كارت ملخص المحتوى السريع */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <h3 className="font-black text-slate-800 text-sm">ملخص المحتوى والأنشطة</h3>
              </div>
              <div className="space-y-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">طلبات التعديل المعلقة:</span>
                  <span
                    className={`font-black px-2 py-0.5 rounded-md ${
                      pendingRequests.length > 0 ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {pendingRequests.length} طلبات
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('packages')}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">الباقات المعتمدة:</span>
                  <span className="font-black text-slate-800">
                    {pickedPackages.length === 0 ? 'جميع الباقات (افتراضي)' : `${pickedPackages.length} باقة`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">مواعيد الجدول الأسبوعي:</span>
                  <span className="font-black text-slate-800">{weeklySlots.length} موعد</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('services')}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-right"
                >
                  <span className="font-bold text-slate-700">الخدمات الإبداعية:</span>
                  <span className="font-black text-slate-800">{serviceOffers.length} خدمة</span>
                </button>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 font-medium">
              اضغط على أي بند للانتقال مباشرة لتبويبه وإدارته.
            </div>
          </div>

          {/* كارت حساب الدخول وكلمة المرور (مساعدة المدرب وتزويده ببيانات الدخول) */}
          <div className="rounded-3xl border border-indigo-200 bg-white p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-indigo-100 pb-3 mb-4">
                <KeyRound className="h-4 w-4 text-indigo-600" />
                <h3 className="font-black text-slate-800 text-sm">بيانات الدخول وكلمة المرور</h3>
              </div>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">البريد الإلكتروني للدخول:</span>
                  <span className="font-bold text-slate-900 font-mono text-xs break-all block p-2 rounded-xl bg-slate-50 border border-slate-100">
                    {accountEmail || 'مرتبط بحساب المنصة'}
                  </span>
                </div>
                <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-2.5 text-indigo-900 text-[11px] leading-relaxed font-medium">
                  إذا واجه المدرب مشكلة في تسجيل الدخول أو نسي كلمة المرور، يمكنك توليد رمز مؤقت له أو تعيين كلمة مرور جديدة من هنا فوراً.
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordError('');
                  setPasswordErrorOnField(false);
                  setPasswordResult(null);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 text-xs shadow-2xs transition-colors"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>إعادة تعيين / منح كلمة مرور</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: طلبات التعديل والاعتماد (إدارة المحتوى الكثيف مع Pagination وفلترة) ─── */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* قسم الطلبات المعلقة */}
          <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-amber-200/80 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <h3 className="text-base sm:text-lg font-black text-amber-950">
                  طلبات التعديل المعلقة بانتظار قرار الإدارة ({pendingRequests.length})
                </h3>
              </div>
            </div>

            {pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-2xs">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-2" />
                <h4 className="font-black text-slate-800 text-sm">لا توجد طلبات تعديل معلقة حالياً</h4>
                <p className="text-xs text-slate-500 mt-1">
                  كل تعديلات المدرب السابقة تم اتخاذ قرار بشأنها، وسجل الطلبات متاح أدناه.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((req) => {
                  const changeItems = getInstructorChangeItems(req.requestedChanges, packages);
                  const isPackagesRequest =
                    (req.requestedChanges as any)._requestType === 'packages' ||
                    (req.requestedChanges.packageIds !== undefined &&
                      req.requestedChanges.weeklySchedule === undefined &&
                      req.requestedChanges.workModel === undefined &&
                      req.requestedChanges.requestedPrice === undefined &&
                      req.requestedChanges.bio === undefined &&
                      req.requestedChanges.specialties === undefined &&
                      req.requestedChanges.displayName === undefined);

                  return (
                    <div
                      key={req.id}
                      className="rounded-2xl border border-amber-200 bg-white p-5 shadow-xs space-y-4"
                    >
                      {/* رأس بطاقة الطلب */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl text-white font-bold text-xs ${
                              isPackagesRequest ? 'bg-indigo-600' : 'bg-amber-600'
                            }`}
                          >
                            {isPackagesRequest ? <Layers className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-slate-900 text-sm">
                                {isPackagesRequest ? 'طلب اعتماد باقات التدريب' : 'طلب تعديل الملف والجدول'}
                              </h4>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                  isPackagesRequest
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {isPackagesRequest ? 'باقات تدريب' : 'جدول ونظام عمل'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              تاريخ الإرسال: {new Date(req.createdAt).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ملخص التغييرات المشروح */}
                      <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-3.5 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-black text-amber-950 text-xs">
                          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                          <span>ما تم تغييره في هذا الطلب:</span>
                        </div>
                        {changeItems.length === 0 ? (
                          <p className="text-xs text-slate-500">لم يتم تحديد تفاصيل إضافية.</p>
                        ) : (
                          <div className="space-y-1 pt-1">
                            {changeItems.map((item, idx) => (
                              <div key={idx} className="flex flex-wrap items-baseline gap-1.5 text-xs">
                                <span className="font-bold text-amber-900">• {item.title}:</span>
                                <span className="text-slate-700 font-medium">{item.detail}</span>
                                {item.badge && (
                                  <span className="rounded bg-amber-200/80 text-amber-950 px-1.5 py-0.2 text-[10px] font-bold">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* عرض تفصيلي للباقات إن وجدت بالطلب */}
                      {req.requestedChanges.packageIds !== undefined && (
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5 space-y-2">
                          <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-indigo-600" />
                            <span>الباقات المطلوب اعتمادها ({req.requestedChanges.packageIds.length}):</span>
                          </h5>
                          {req.requestedChanges.packageIds.length === 0 ? (
                            <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
                              طلب التدريب في <strong>جميع الباقات المتاحة بالمنصة</strong>.
                            </div>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {req.requestedChanges.packageIds.map((pkgId) => {
                                const pkg = packages.find((p) => p.id === pkgId);
                                const isCurrent = (instructor.packageIds || []).includes(pkgId);
                                return (
                                  <div
                                    key={pkgId}
                                    className="flex items-center justify-between rounded-lg border border-indigo-200/80 bg-white p-2.5 text-xs"
                                  >
                                    <div>
                                      <span className="font-bold text-slate-900 block">{pkg?.name || pkgId}</span>
                                      <span className="text-[10px] text-slate-500">
                                        {pkg?.sessionsCount ? `${pkg.sessionsCount} جلسات` : ''}
                                      </span>
                                    </div>
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                        isCurrent
                                          ? 'bg-slate-100 text-slate-600'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {isCurrent ? 'معتمدة حالياً' : 'مطلوبة حديثاً'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* عرض تفصيلي للجدول إن وجد بالطلب */}
                      {req.requestedChanges.weeklySchedule !== undefined && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
                          <h5 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            <span>الجدول الأسبوعي المطلوب ({req.requestedChanges.weeklySchedule.length} موعد):</span>
                          </h5>
                          <div className="flex flex-wrap gap-1.5">
                            {req.requestedChanges.weeklySchedule.map((s, idx) => (
                              <span
                                key={idx}
                                className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1 text-xs text-emerald-950 shadow-2xs"
                              >
                                <span className="font-black mr-1 text-slate-800">
                                  {ARABIC_DAYS[s.day] || s.day}:
                                </span>
                                <span className="font-bold">{s.time}</span>
                                {s.commitmentType === 'fixed_term' && (
                                  <span className="text-[10px] block text-amber-800 font-medium">
                                    مؤقت حتى: {s.commitmentEndsAt || 'تاريخ محدد'}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ⚠️ الاعتماد والرفض بقوا في «مراجعة ملفات المدربين» —
                          مكان واحد للملف والصور. هنا عرض بس. */}
                      <div className="pt-2 border-t border-slate-100">
                        <Link
                          href="/dashboard/admin/instructors/review"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                        >
                          راجعه من «مراجعة ملفات المدربين»
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* قسم سجل الطلبات السابقة مع الفلترة والترقيم (Handling Dense Content) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-slate-600" />
                <h3 className="text-base font-black text-slate-800">
                  سجل الطلبات السابقة ({filteredPastRequests.length})
                </h3>
              </div>

              {/* فلترة سجل الطلبات */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setPastFilterStatus('all');
                    setPastPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    pastFilterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  الكل ({pastRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPastFilterStatus('approved');
                    setPastPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    pastFilterStatus === 'approved' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  المعتمدة ({pastRequests.filter((r) => r.status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPastFilterStatus('rejected');
                    setPastPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    pastFilterStatus === 'rejected' ? 'bg-white text-rose-800 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  المرفوضة ({pastRequests.filter((r) => r.status === 'rejected').length})
                </button>
              </div>
            </div>

            {paginatedPastRequests.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">لا توجد طلبات سابقة مطابقة للفلتر.</p>
            ) : (
              <div className="space-y-3">
                {paginatedPastRequests.map((req) => {
                  const pastChangeItems = getInstructorChangeItems(req.requestedChanges, packages);
                  const isPackages =
                    (req.requestedChanges as any)._requestType === 'packages' ||
                    (req.requestedChanges.packageIds !== undefined &&
                      req.requestedChanges.weeklySchedule === undefined &&
                      req.requestedChanges.workModel === undefined);

                  return (
                    <div
                      key={req.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isPackages ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {isPackages ? 'طلب باقات' : 'طلب جدول وملف'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(req.createdAt).toLocaleString('ar-EG', { timeZone: PLATFORM_TIMEZONE })}
                          </span>
                        </div>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                            req.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {req.status === 'approved' ? 'مُعتمد ✓' : 'مرفوض ✕'}
                        </span>
                      </div>

                      {/* ملخص التغييرات بالطلب السابق */}
                      {pastChangeItems.length > 0 && (
                        <div className="rounded-xl bg-white p-2.5 border border-slate-200/70 space-y-1">
                          <span className="font-bold text-slate-700 block">التغييرات المطلوبة في الطلب:</span>
                          {pastChangeItems.map((item, idx) => (
                            <div key={idx} className="flex items-baseline gap-1.5 text-slate-600">
                              <span className="font-bold text-slate-800">• {item.title}:</span>
                              <span>{item.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {req.adminFeedback && (
                        <div className="rounded-xl bg-white p-2.5 border border-slate-200 text-slate-700">
                          <span className="font-bold text-slate-900 block mb-0.5">ملاحظة الإدارة:</span>
                          <p className="italic text-slate-600">{req.adminFeedback}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ترقيم صفحات الطلبات السابقة (Pagination) */}
            {totalPastPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="text-slate-500 font-medium">
                  صفحة {pastPage} من {totalPastPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                    disabled={pastPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPastPage((p) => Math.min(totalPastPages, p + 1))}
                    disabled={pastPage === totalPastPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: باقات التدريب المعتمدة (مع شريط بحث وفلترة للمحتوى الكثيف) ─── */}
      {activeTab === 'packages' && (
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
                savePackages.run(instructor.id, pickedPackages);
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
                <strong>الوضع الحالي:</strong> المدرب يظهر في <strong>جميع الباقات المتاحة بالمنصة</strong> دون استثناء.
              </div>
              <button
                type="button"
                onClick={() => setPickedPackages(packages.map((p) => p.id))}
                className="text-xs font-bold text-amber-950 underline hover:text-amber-800 shrink-0"
              >
                تحديد باقات مخصصة
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
                إلغاء التخصيص (الظهور في كل الباقات)
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
                      {pkg.ageGroup === 'under_12' ? 'تحت ١٢ سنة' : '١٢ سنة فأكثر'}
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
      )}

      {/* ─── TAB 4: الجدول الأسبوعي والمواعيد (مع خيار اليوم المحدد كشكل افتراضي) ─── */}
      {activeTab === 'schedule' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>الجدول الأسبوعي المعتمد حالياً ({weeklySlots.length} موعد)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                استعراض المواعيد المتاحة والمحجوزة والمؤقتة للمدرب.
              </p>
            </div>

            {/* محوّل العرض: يوم محدد (افتراضي) أو الأسبوع كاملاً */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setScheduleViewMode('single_day')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  scheduleViewMode === 'single_day'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>يوم محدد (افتراضي)</span>
              </button>
              <button
                type="button"
                onClick={() => setScheduleViewMode('week_grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                  scheduleViewMode === 'week_grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>الأسبوع كاملاً</span>
              </button>
            </div>
          </div>

          {/* شريط الإحصاءات السريعة للجدول */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3 border border-slate-100 text-center">
              <span className="text-[11px] font-bold text-slate-400 block">إجمالي المواعيد</span>
              <span className="text-lg font-black text-slate-800">{weeklySlots.length}</span>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 border border-emerald-100 text-center">
              <span className="text-[11px] font-bold text-emerald-700 block">المواعيد المحجوزة</span>
              <span className="text-lg font-black text-emerald-900">{bookedSlotsCount}</span>
            </div>
            <div className="rounded-2xl bg-amber-50 p-3 border border-amber-100 text-center">
              <span className="text-[11px] font-bold text-amber-700 block">المواعيد المؤقتة</span>
              <span className="text-lg font-black text-amber-900">{tempSlotsCount}</span>
            </div>
          </div>

          {weeklySlots.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">لا يوجد جدول أسبوعي معتمد للمدرب.</div>
          ) : scheduleViewMode === 'single_day' ? (
            /* نمط العرض الأول: يوم محدد (الشكل الافتراضي الرشيق) */
            <div className="space-y-4">
              {/* شريط أزرار الأيام */}
              <div className="flex border-b border-slate-100 pb-2 overflow-x-auto gap-1.5">
                {DAY_KEYS.map((dayKey) => {
                  const daySlotsCount = weeklySlots.filter((s) => s.day === dayKey).length;
                  const isSelected = selectedDay === dayKey;
                  return (
                    <button
                      key={dayKey}
                      type="button"
                      onClick={() => setSelectedDay(dayKey)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{ARABIC_DAYS[dayKey]}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {daySlotsCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* مواعيد اليوم المحدد */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <h4 className="font-bold text-slate-800 text-sm mb-3">
                  مواعيد يوم {ARABIC_DAYS[selectedDay]}:
                </h4>
                {(() => {
                  const daySlots = weeklySlots.filter((s) => s.day === selectedDay);
                  if (daySlots.length === 0) {
                    return (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        لا توجد مواعيد معتمدة في هذا اليوم.
                      </p>
                    );
                  }
                  return (
                    <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                      {daySlots.map((s) => (
                        <div
                          key={s.time}
                          className="rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-2xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-black text-slate-900 text-sm font-mono">{s.time}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {s.isBooked && (
                              <span className="rounded bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 text-[10px] font-bold">
                                محجوز
                              </span>
                            )}
                            {s.commitmentType === 'fixed_term' && (
                              <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 text-[10px] font-bold">
                                مؤقت حتى: {s.commitmentEndsAt || 'تاريخ محدد'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            /* نمط العرض الثاني: الأسبوع كاملاً */
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DAY_KEYS.map((dayKey) => {
                const daySlots = weeklySlots.filter((s) => s.day === dayKey);
                if (daySlots.length === 0) return null;
                return (
                  <div key={dayKey} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-800 text-xs border-b border-slate-200/60 pb-1.5">
                      <span>{ARABIC_DAYS[dayKey]}</span>
                      <span className="text-slate-500 font-mono text-[11px]">{daySlots.length} موعد</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {daySlots.map((s) => (
                        <div
                          key={s.time}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs shadow-2xs"
                        >
                          <span className="font-bold text-slate-800 font-mono">{s.time}</span>
                          {s.isBooked && <span className="text-rose-600 font-bold mr-1 text-[10px]">(محجوز)</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 5: تعديل الملف الشخصي العام ─── */}
      {activeTab === 'profile' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <InstructorProfileEditor instructor={instructor} />
        </div>
      )}

      {/* ─── TAB 6: الخدمات الإبداعية وسوق العمل ─── */}
      {activeTab === 'services' && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <InstructorServicesSection
            instructorId={instructor.id}
            services={services}
            offers={serviceOffers}
            formula={formula}
          />
        </div>
      )}

      {/* ─── نافذة إدارة كلمة المرور وبيانات الدخول ─── */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  إدارة دخول المدرب: {instructor.displayName}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {accountEmail ? `البريد: ${accountEmail}` : 'حساب المدرب المعتمد في المنصة'}
                </p>
              </div>
            </div>

            {passwordError && !(passwordErrorOnField && passwordMode === 'custom') && (
              <FormError message={passwordError} className="mb-4" />
            )}

            {passwordResult ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm mb-1">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>تم إنشاء وتفعيل كلمة المرور بنجاح!</span>
                  </div>
                  <p className="text-xs text-emerald-700 font-medium leading-relaxed">
                    تم حفظ كلمة المرور في النظام، وسيُطلب من المدرب تلقائياً تعيين كلمة مروره الخاصة فور أول تسجيل دخول لحماية حسابه.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">البريد الإلكتروني للدخول:</span>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2">
                      <span className="font-mono text-xs font-bold text-slate-800">{passwordResult.email || accountEmail}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(passwordResult.email || accountEmail || '')}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span>نسخ</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">كلمة المرور المؤقتة / الرمز:</span>
                    <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 px-3.5 py-2.5">
                      <span className="font-mono text-base font-black tracking-wider text-indigo-900" dir="ltr">
                        {passwordResult.tempCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(passwordResult.tempCode)}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                      >
                        {copiedKey === 'code' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{copiedKey === 'code' ? 'تم النسخ' : 'نسخ الكلمة'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsapp}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 text-xs shadow-xs transition-colors"
                  >
                    {copiedKey === 'whatsapp' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedKey === 'whatsapp' ? 'تم نسخ رسالة الواتساب!' : 'نسخ رسالة واتساب جاهزة للمدرب'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordResult(null);
                      setShowPasswordModal(false);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    تم وإغلاق
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  اختر طريقة منح كلمة المرور للمدرب لمساعدته على تسجيل الدخول فوراً:
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPasswordMode('auto')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-right transition-all ${
                      passwordMode === 'auto'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-xs font-black text-slate-900">رمز مؤقت تلقائي</span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                      رمز آمن من 12 خانة سهل القراءة على واتساب
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPasswordMode('custom')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-right transition-all ${
                      passwordMode === 'custom'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/70'
                    }`}
                  >
                    <span className="text-xs font-black text-slate-900">كلمة مرور مخصصة</span>
                    <span className="text-[11px] text-slate-500 font-medium mt-0.5">
                      كتابة كلمة مرور تحددها الإدارة يدوياً
                    </span>
                  </button>
                </div>

                {passwordMode === 'custom' && (
                  <Field
                    label="كلمة المرور الجديدة (8 أحرف أو أرقام على الأقل)"
                    name="customPassword"
                    required
                    error={passwordErrorOnField ? passwordError : undefined}
                    className="pt-1"
                  >
                    <TextInput
                      dir="ltr"
                      placeholder="اكتب كلمة المرور هنا…"
                      className="font-mono text-sm"
                      value={customPasswordInput}
                      onChange={(e) => setCustomPasswordInput(e.target.value)}
                    />
                  </Field>
                )}

                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] text-amber-900 font-medium leading-relaxed">
                  💡 <strong>ملاحظة أمنية:</strong> في كلتا الحالتين، بمجرد أن يدخل المدرب بهذه الكلمة سيطلب منه النظام فوراً تعيين كلمة مروره الدائمة والسرية قبل الدخول إلى لوحة التحكم.
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <BusyButton busy={false} variant="secondary" onClick={() => setShowPasswordModal(false)}>
                    إلغاء
                  </BusyButton>
                  <BusyButton
                    busy={resettingPassword}
                    pendingLabel="جارٍ التعيين…"
                    onClick={handleResetPassword}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>حفظ وتوليد كلمة المرور</span>
                  </BusyButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
