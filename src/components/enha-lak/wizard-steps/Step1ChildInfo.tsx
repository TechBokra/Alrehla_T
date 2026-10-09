import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useFormContext } from 'react-hook-form';
import { User, Users, UserPlus, Check, RefreshCw } from 'lucide-react';
import { ChildProfile } from '@/types';
import { fetchFamilyMembers, getWizardUserInfo } from '@/app/actions/family';
import { BirthDatePicker } from '@/components/ui/BirthDatePicker';
import { PersonAvatar } from '@/components/ui/PersonAvatar';

/**
 * ⚠️ اختبار «إنها لك» (JKM9، قرار تامر): **مفيش إضافة طفل جديد من جوه
 *    الطلب.** الطفل بيتضاف من «المركز العائلي» الأول (بياناته كاملة هناك)،
 *    والمعالج بيختار منه بس. الرابط بيفتح في تاب جديد، وزرار «تحديث
 *    القايمة» بيجيب الطفل الجديد من غير ما اللي اتكتب يضيع.
 *    والخادم بيرفض نفس الحاجة (`resolveWizardChild`).
 */
type TargetMode = 'self' | 'family';

export function Step1ChildInfo({ onNext }: { onNext: () => void }) {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  const [members, setMembers] = useState<ChildProfile[]>([]);
  const [userInfo, setUserInfo] = useState<{ fullName?: string; isVisitor: boolean }>({ isVisitor: true });
  const [loaded, setLoaded] = useState(false);

  const familyMemberId = watch('familyMemberId');
  const currentName = watch('newChildName');

  // تحديد الوضع الحالي بناءً على القيمة المحفوظة
  const [mode, setMode] = useState<TargetMode>('self');

  const handleSelectMember = (m: ChildProfile) => {
    setValue('familyMemberId', m.id, { shouldValidate: true });
    setValue('newChildName', m.fullName, { shouldValidate: true });
    setValue('newChildBirthDate', m.birthDate || '', { shouldValidate: true });
    setValue('newChildGender', m.gender || '', { shouldValidate: true });
  };

  useEffect(() => {
    Promise.all([fetchFamilyMembers(), getWizardUserInfo()]).then(([family, user]) => {
      setMembers(family);
      setUserInfo(user);
      setLoaded(true);

      // تحديد الوضع الأنسب عند أول تحميل
      if (familyMemberId === 'self') {
        setMode('self');
      } else if (familyMemberId && family.some((m) => m.id === familyMemberId)) {
        setMode('family');
      } else if (family.length > 0 && !familyMemberId && !currentName) {
        setMode('family');
        handleSelectMember(family[0]);
      } else {
        setMode('self');
        if (!currentName && user.fullName) {
          setValue('familyMemberId', 'self', { shouldValidate: true });
          setValue('newChildName', user.fullName, { shouldValidate: true });
        }
      }
    });
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const refreshMembers = useCallback(async () => {
    setRefreshing(true);
    try {
      const family = await fetchFamilyMembers();
      setMembers(family);
      if (family.length > 0 && mode !== 'family') {
        setMode('family');
        setValue('familyMemberId', family[0].id, { shouldValidate: true });
        setValue('newChildName', family[0].fullName, { shouldValidate: true });
        setValue('newChildBirthDate', family[0].birthDate || '', { shouldValidate: true });
        setValue('newChildGender', family[0].gender || '', { shouldValidate: true });
      }
    } finally {
      setRefreshing(false);
    }
  }, [mode, setValue]);

  const handleSelectSelf = () => {
    setMode('self');
    setValue('familyMemberId', 'self', { shouldValidate: true });
    if (!currentName || members.some((m) => m.fullName === currentName)) {
      setValue('newChildName', userInfo.fullName || '', { shouldValidate: true });
    }
  };

  const handleSelectFamilyMode = () => {
    setMode('family');
    // إذا لم يكن هناك عضو محدد، نحدد أول فرد
    if (!familyMemberId || familyMemberId === 'self') {
      if (members.length > 0) {
        handleSelectMember(members[0]);
      }
    }
  };

  const handleNextStep = () => {
    if (mode === 'family') {
      if (!familyMemberId || familyMemberId === 'self') {
        if (members.length > 0) {
          handleSelectMember(members[0]);
        }
      }
    } else if (mode === 'self') {
      setValue('familyMemberId', 'self', { shouldValidate: true });
      if (!watch('newChildName')?.trim() && userInfo.fullName) {
        setValue('newChildName', userInfo.fullName, { shouldValidate: true });
      }
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-slate-800">البيانات</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">
          اختر لمن هذا الطلب وأدخل البيانات المطلوبة لتخصيص القصة أو الكتاب.
        </p>
      </div>

      {/* تنبيهات الأخطاء */}
      {(['newChildName', 'newChildGender', 'newChildBirthDate', 'familyMemberId'] as const)
        .map((f) => errors[f]?.message)
        .filter(Boolean)
        .map((msg, i) => (
          <div key={i} className="rounded-xl bg-red-50 p-4 font-bold text-red-700">
            {msg as string}
          </div>
        ))}

      {/* خيارات لمن هذا الطلب */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-700">لمن هذا الطلب؟</label>
        <div className={`grid gap-3 ${members.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {/* خيار 1: لنفسي */}
          <button
            type="button"
            onClick={handleSelectSelf}
            className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-right transition-all ${
              mode === 'self'
                ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              mode === 'self' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm">طلب لنفسي</div>
              <div className="text-xs text-slate-500">أنا صاحب هذا الطلب</div>
            </div>
          </button>

          {/* خيار 2: من المركز العائلي (إذا توفر) */}
          {members.length > 0 && (
            <button
              type="button"
              onClick={handleSelectFamilyMode}
              className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-right transition-all ${
                mode === 'family'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-900 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                mode === 'family' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold text-sm">من أفراد العائلة</div>
                <div className="text-xs text-slate-500">اختيار من المركز العائلي ({members.length})</div>
              </div>
            </button>
          )}

        </div>
      </div>

      {/* الطفل مش في القايمة؟ يتضاف من المركز العائلي (JKM9). */}
      {loaded && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          <div className="flex items-center gap-3">
            <UserPlus className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-700">
              {members.length > 0 ? 'الطفل مش في القايمة؟' : 'الطلب لطفل؟'} ضيفه الأول من{' '}
              <Link
                href="/account/family"
                target="_blank"
                rel="noopener"
                className="font-bold text-blue-700 underline underline-offset-4"
              >
                المركز العائلي
              </Link>{' '}
              (بيفتح في تاب جديد)، وبعدين ارجع هنا.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshMembers}
            disabled={refreshing}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border-2 border-slate-200 px-4 text-sm font-bold text-slate-700 hover:border-slate-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            تحديث القايمة
          </button>
        </div>
      )}

      {/* عرض الأفراد من المركز العائلي */}
      {mode === 'family' && members.length > 0 && (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50/60 p-6">
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-800 text-sm">اختر الشخص من أفراد عائلتك:</p>
            <span className="text-xs text-slate-500 font-medium">انقر لاختيار الفرد</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {members.map((m) => {
              const selected = familyMemberId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMember(m)}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all text-center ${
                    selected
                      ? 'border-blue-600 bg-white shadow-sm ring-2 ring-blue-600/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {selected && (
                    <div className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                  <PersonAvatar
                    name={m.fullName}
                    avatarUrl={m.avatarUrl}
                    size={56}
                    className="mb-2"
                  />
                  <span className="font-bold text-slate-800 text-sm">{m.fullName}</span>
                </button>
              );
            })}
          </div>

          {/* بطاقة تفاصيل الفرد المختار */}
          {(() => {
            const selectedMember = members.find((m) => m.id === familyMemberId);
            if (!selectedMember) return null;
            return (
              <div className="mt-4 rounded-2xl bg-white border border-blue-200 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <PersonAvatar
                    name={selectedMember.fullName}
                    avatarUrl={selectedMember.avatarUrl}
                    size={44}
                  />
                  <div>
                    <p className="font-bold text-slate-900">{selectedMember.fullName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedMember.birthDate ? `تاريخ الميلاد: ${selectedMember.birthDate}` : ''}
                      {selectedMember.birthDate && selectedMember.gender ? ' · ' : ''}
                      {selectedMember.gender === 'male' ? 'ذكر' : selectedMember.gender === 'female' ? 'أنثى' : ''}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full">
                  <Check className="h-3.5 w-3.5" /> تم تحديد المستفيد
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* بيانات صاحب الحساب نفسه */}
      {mode === 'self' && (
        <div className="grid gap-4 md:grid-cols-2 p-6 bg-slate-50 rounded-3xl border border-slate-200">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-bold text-slate-700">
              {mode === 'self' ? 'الاسم الظاهر في القصة / الكتاب' : 'الاسم'}
            </label>
            <input
              type="text"
              {...register('newChildName')}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
              placeholder={mode === 'self' ? 'اسمك كما تود ظهوره في القصة...' : 'اكتب الاسم هنا...'}
            />
            {mode === 'self' && (
              <p className="text-xs text-slate-500 font-medium">
                تم ملء اسمك تلقائياً ويمكنك تعديله إذا كنت تفضل لقباً أو صيغة معينة في القصة.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">
              {mode === 'self' ? 'تاريخ الميلاد (اختياري)' : 'تاريخ الميلاد'}
            </label>
            <BirthDatePicker
              value={watch('newChildBirthDate') || ''}
              onChange={(v) => setValue('newChildBirthDate', v, { shouldValidate: true })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">
              {mode === 'self' ? 'الجنس (اختياري)' : 'الجنس'}
            </label>
            <select
              {...register('newChildGender')}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800"
            >
              <option value="">اختر...</option>
              <option value="male">{mode === 'self' ? 'ذكر' : 'ولد / ذكر'}</option>
              <option value="female">{mode === 'self' ? 'أنثى' : 'بنت / أنثى'}</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-6">
        <button
          type="button"
          onClick={handleNextStep}
          className="rounded-xl bg-blue-600 px-8 py-3.5 font-bold text-white transition-colors hover:bg-blue-700 shadow-md"
        >
          الخطوة التالية
        </button>
      </div>
    </div>
  );
}
