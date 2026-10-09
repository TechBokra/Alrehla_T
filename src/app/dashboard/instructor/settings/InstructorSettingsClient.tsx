'use client';

import React, { useState } from 'react';
import { useAction } from '@/lib/use-action';
import { FormError, FormSuccess } from '@/components/ui/FormError';
import { Instructor, WeeklySlot, PricingFormulaSettings } from '@/types';
import { Info, CheckCircle2, Save, Layers, Calendar, Clock, AlertTriangle, KeyRound, Lock } from 'lucide-react';
import { calculateFinalSessionPrice } from '@/lib/utils';
import { submitInstructorProfileUpdate, submitInstructorPackageUpdateRequest } from '@/actions/instructors';
import { setMyPassword } from '@/actions/set-password';
import { PackagePicker, type PackageChoice } from '@/components/dashboard/PackagePicker';
import { WeeklySchedulePicker } from '@/components/dashboard/WeeklySchedulePicker';
import { Field, TextInput, Select, BusyButton } from '@/components/forms/Form';

interface InstructorSettingsClientProps {
  instructor: Instructor;
  /**
   * بتُستخدم عشان نوري المدرب **سعر العميل** جنب حصيلته.
   * المعادلة نفسها مش معروضة — تسعير داخلي.
   */
  formulaSettings: PricingFormulaSettings;
  /** فوق الرقم ده بيظهر تنبيه — والمدرب يقدر يكمل. صفر = مفيش تنبيه. */
  priceAlert?: number;
  /** الباقات المفعّلة اللي المدرب يقدر يختار منها. */
  packages: PackageChoice[];
  /** اللي هو مسجَّل عليها دلوقتي — فاضية = كل الباقات (ملف SQL 102). */
  selectedPackageIds: string[];
}

export function InstructorSettingsClient({
  instructor,
  formulaSettings,
  priceAlert = 0,
  packages,
  selectedPackageIds,
}: InstructorSettingsClientProps) {
  const [workModel, setWorkModel] = useState(instructor.workModel || 'per_session');
  const [monthlyHours, setMonthlyHours] = useState(instructor.monthlyHoursCommitted || 60);
  const [requestedPrice, setRequestedPrice] = useState(instructor.requestedPrice || 100);
  const [schedule, setSchedule] = useState<WeeklySlot[]>(instructor.weeklySchedule || []);
  const [isSaved, setIsSaved] = useState(false);

  // إدارة باقات التدريب في طلب مستقل ومنفصل
  const [pickedPackages, setPickedPackages] = useState<string[]>(selectedPackageIds);
  const [isPackageSaved, setIsPackageSaved] = useState(false);

  // إدارة كلمة المرور الشخصية للمدرب
  // ⚠️ **الكلمة الحالية مطلوبة.** الجلسة وحدها مش إثبات كفاية:
  //    أي حد يلاقي الجهاز مفتوح كان يقدر يغيّرها ويقفل المدرب برّه
  //    حسابه. والشرط متطبَّق في الأكشن كمان (قاعدة «ع»).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 8) {
      setPasswordError('كلمة المرور يجب أن تكون 8 أحرف أو أرقام على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمتا المرور غير متطابقتين.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await setMyPassword(newPassword, currentPassword);
      if (!res.ok) {
        setPasswordError(res.error);
      } else {
        setPasswordSuccess('تم تحديث كلمة المرور الخاصة بك بنجاح!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 5000);
      }
    } catch {
      setPasswordError('تعذّر تحديث كلمة المرور.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const saveProfile = useAction(submitInstructorProfileUpdate, {
    onSuccess: () => {
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 4000);
    },
    fallbackError: 'تعذّر إرسال التعديلات للإدارة.',
  });

  const savePackages = useAction(submitInstructorPackageUpdateRequest, {
    onSuccess: () => {
      setIsPackageSaved(true);
      setTimeout(() => setIsPackageSaved(false), 4000);
    },
    fallbackError: 'تعذّر إرسال طلب تعديل الباقات للإدارة.',
  });

  // رسالة الخادم تحت الخانة اللي هي عليها (`field` في النتيجة).
  const fieldError = (name: string) =>
    saveProfile.errorField === name ? saveProfile.error : undefined;

  // حفظ الملف الشخصي والجدول (طلب مستقل)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(false);
    await saveProfile.run(instructor.id, {
      workModel: workModel as any,
      monthlyHoursCommitted: workModel === 'monthly' ? monthlyHours : undefined,
      // في نظام الراتب الشهري لا توجد قيمة للراتب المقترح بل يتم التواصل المباشر مع الإدارة
      requestedPrice: workModel === 'monthly' ? undefined : Number(requestedPrice),
      weeklySchedule: schedule,
    });
  };

  // حفظ الباقات (طلب منفصل ومستقل تماماً يذهب للإدارة)
  const handleSavePackages = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPackageSaved(false);
    await savePackages.run(instructor.id, pickedPackages);
  };

  // سعر العميل من حصيلة المدرب مباشرة
  const finalPrice =
    Number(requestedPrice) > 0
      ? calculateFinalSessionPrice(Number(requestedPrice), formulaSettings)
      : 0;

  // هل توجد تغييرات معلقة في الباقات لم تُرسل بعد؟
  const packagesChanged =
    pickedPackages.length !== selectedPackageIds.length ||
    pickedPackages.some((id) => !selectedPackageIds.includes(id));

  return (
    <div className="space-y-10">
      {/* تنبيه مراجعة الإدارة العام */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 flex gap-3 text-blue-900 shadow-2xs">
        <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
        <div className="text-sm">
          <p className="font-bold">آلية مراجعة واعتماد الطلبات من الإدارة</p>
          <p className="text-xs text-blue-800 mt-0.5 leading-relaxed font-medium">
            تخضع كافة تعديلات الجدول ونظام العمل أو باقات التدريب لمراجعة الإدارة. عند تقديم أي طلب، يتم إشعار الإدارة فوراً بملخص دقيق وموجز للتغييرات التي قمت بها لاعتمادها.
          </p>
        </div>
      </div>

      {/* ── النموذج 1: تعديل نظام العمل، التسعير، والجدول الأسبوعي ────────────────── */}
      <form onSubmit={handleSaveProfile} className="space-y-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white font-black shadow-xs">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">نموذج العمل والتسعير</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                اختر ما بين العمل بالجلسة مع تحديد حصيلتك، أو العمل براتب شهري مع التزام ساعات.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <Field label="نظام العمل" help="بالجلسة: إنت بتحدد حصيلتك من كل جلسة والموقع بيضيف نسبة المنصة على سعر العميل. راتب شهري: اتفاق ثابت مع الإدارة بالتزام 60 ساعة في الشهر على الأقل." name="workModel" required>
              <Select value={workModel} onChange={(e) => setWorkModel(e.target.value as any)}>
                <option value="per_session">بالجلسة (تحديد حصيلة لكل جلسة)</option>
                <option value="monthly">راتب شهري (يتطلب 60 ساعة التزام على الأقل)</option>
              </Select>
            </Field>

            {workModel === 'monthly' && (
              <div className="space-y-4">
                <Field
                  label="عدد الساعات الملتزم بها شهرياً (الحد الأدنى 60 ساعة)"
                  name="monthlyHoursCommitted"
                  required
                  error={fieldError('monthlyHoursCommitted')}
                >
                  <TextInput
                    type="number"
                    min={60}
                    value={monthlyHours}
                    onChange={(e) => setMonthlyHours(parseInt(e.target.value))}
                  />
                </Field>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Info className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>التواصل المباشر مع الإدارة لتحديد الراتب</span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    في نظام الراتب الشهري، لا يتم تحديد راتب مقترح هنا ولا يوجد حقل مالي، بل يكون التنسيق والتواصل المباشر مع إدارة المنصة للاتفاق على قيمة الراتب الشهري والشروط التعاقدية المناسبة.
                  </p>
                </div>
              </div>
            )}

            {workModel === 'per_session' && (
              <div className="space-y-2">
                <Field
                  label="حصيلتك من الجلسة الواحدة (ج.م)"
                  name="requestedPrice"
                  required
                  error={fieldError('requestedPrice')}
                >
                  <TextInput
                    type="number"
                    min={1}
                    value={requestedPrice}
                    onChange={(e) => setRequestedPrice(Number(e.target.value))}
                    placeholder="اكتب الحصيلة المناسبة لك"
                  />
                </Field>

                {finalPrice > 0 && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 font-medium">
                    <span className="font-bold text-slate-900">حصيلتك المعتمدة:</span> {requestedPrice} ج.م —{' '}
                    <span className="font-bold text-slate-900">السعر الذي يظهر لولي الأمر:</span> {finalPrice} ج.م
                  </div>
                )}

                {priceAlert > 0 && Number(requestedPrice) > priceAlert && (
                  <p className="mt-2 rounded-xl bg-amber-100/80 border border-amber-200 p-2.5 text-xs font-bold text-amber-900">
                    الرقم أعلى من المعتاد ({priceAlert} ج.م). سيتم إرساله للإدارة لمراجعته مع باقي طلبك.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* الجدول الأسبوعي (7 أيام بداخلها الساعات) */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-800">الجدول الأسبوعي المتاح (7 أيام)</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              اختر أوقات وساعات عملك مقسمة على مدار الأيام السبعة. يمكنك تحديد مواعيد دائمة مستمرة، أو مواعيد مؤقتة تنتهي بتاريخ محدد باليوم.
            </p>
          </div>

          <WeeklySchedulePicker
            schedule={schedule}
            onChange={setSchedule}
            disabled={saveProfile.pending}
          />
        </div>

        {/* خطأ على خانة بعينها بيظهر تحتها؛ الباقي هنا. */}
        {/* ⚠️ خطأ على خانة مش في الصفحة دي (من «ملفي وصوري» مثلًا) كان
            بيتخبّى خالص — فالزرار بيتداس ومفيش أي رد (#ARWL). */}
        {(!saveProfile.errorField ||
          !['monthlyHoursCommitted', 'requestedPrice'].includes(saveProfile.errorField)) && (
          <FormError message={saveProfile.error} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          {isSaved ? (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              <span>تم إرسال طلب تعديل الجدول ونموذج العمل للإدارة بنجاح</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-medium">
              يتضمن هذا الطلب تعديلات الجدول ونموذج العمل والتسعير.
            </span>
          )}

          <BusyButton
            type="submit"
            busy={saveProfile.pending}
            pendingLabel="جارٍ الإرسال للإدارة…"
            className="px-8"
          >
            <Save className="h-5 w-5" />
            حفظ وإرسال تعديلات الجدول والملف
          </BusyButton>
        </div>
      </form>

      {/* ── النموذج 2: الباقات اللي تقدر تدرّبها (طلب منفصل ومستقل للإدارة) ─────── */}
      <form onSubmit={handleSavePackages} className="rounded-3xl border-2 border-indigo-100 bg-indigo-50/20 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-indigo-100/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white font-black shadow-xs">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-slate-900">الباقات اللي تقدر تدرّبها</h3>
                <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-0.5 text-xs font-bold border border-indigo-200">
                  طلب منفصل للإدارة
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">
                تعديل الباقات يذهب في <strong>طلب مستقل ومنفصل تماماً</strong> للإدارة للموافقة عليه أو رفضه، دون التأثير على جدولك أو ملفك الشخصي.
              </p>
            </div>
          </div>

          {packagesChanged && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              تعديل باقات غير مرسل بعد
            </span>
          )}
        </div>

        <PackagePicker
          packages={packages}
          selected={pickedPackages}
          onChange={setPickedPackages}
          disabled={savePackages.pending}
        />

        <FormError message={savePackages.error} />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-indigo-100">
          {isPackageSaved ? (
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              <span>تم إرسال طلب اعتماد الباقات للإدارة في طلب منفصل بنجاح</span>
            </div>
          ) : (
            <span className="text-xs text-slate-500 font-medium">
              سيتم إشعار الإدارة بقائمة الباقات التي طلبت اعتمادها لمراجعتها والبت فيها.
            </span>
          )}

          <BusyButton
            type="submit"
            busy={savePackages.pending}
            pendingLabel="جارٍ إرسال طلب الباقات…"
            className="bg-indigo-600 px-8 hover:bg-indigo-700"
          >
            <Save className="h-5 w-5" />
            حفظ وإرسال طلب اعتماد الباقات للإدارة
          </BusyButton>
        </div>
      </form>

      {/* 3. قسم أمان الحساب وتغيير كلمة المرور */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-6"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">أمان الحساب وتغيير كلمة المرور</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              يمكنك تحديث كلمة المرور الخاصة بحسابك في أي وقت لحماية خصوصيتك وبيانات تدريبك.
            </p>
          </div>
        </div>

        {passwordError && <FormError message={passwordError} />}
        {passwordSuccess && <FormSuccess message={passwordSuccess} />}

        <Field
          label="كلمة المرور الحالية"
          name="currentPassword"
          required
          hint={
            <>
              بنطلبها عشان حد يلاقي جهازك مفتوح ما يقدرش يغيّر كلمة مرورك.
              نسيتها؟{' '}
              <a href="/forgot-password" className="font-bold text-slate-800 underline">
                اطلب رابط استرجاع
              </a>
              .
            </>
          }
        >
          <TextInput
            type="password"
            dir="ltr"
            autoComplete="current-password"
            placeholder="كلمة مرورك دلوقتي"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="font-mono text-sm"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="كلمة المرور الجديدة" name="newPassword" required>
            <TextInput
              type="password"
              dir="ltr"
              minLength={8}
              placeholder="8 أحرف أو أرقام على الأقل"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="font-mono text-sm"
            />
          </Field>

          <Field label="تأكيد كلمة المرور الجديدة" name="confirmPassword" required>
            <TextInput
              type="password"
              dir="ltr"
              minLength={8}
              placeholder="أعد إدخال كلمة المرور"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="font-mono text-sm"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-500 font-medium">
            💡 كلمة المرور يجب ألا تقل عن 8 خانات، وتأكد من حفظها في مكان آمن.
          </span>
          <BusyButton
            type="submit"
            busy={isChangingPassword}
            disabled={!currentPassword || !newPassword}
            className="text-sm"
          >
            <Lock className="h-4 w-4" />
            <span>تحديث كلمة المرور</span>
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
