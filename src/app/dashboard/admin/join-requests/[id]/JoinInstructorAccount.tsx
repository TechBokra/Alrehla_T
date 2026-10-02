'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CheckCircle, Loader2, UserPlus } from 'lucide-react';
import { createInstructorFromJoinRequest } from '@/actions/admin-instructors';
import { TempCodeBox } from '@/components/dashboard/TempCodeBox';
import { FormError, FormNotice } from '@/components/ui/FormError';

/**
 * طلب مدرب مقبول ← حساب برمز مؤقت، **والمدرب يكمّل ملفه بنفسه**.
 *
 * ⚠️ **المكوّن ده بيفضل في نفس مكانه في الصفحة** سواء الحساب اتعمل ولا
 *    لأ (`instructorId` بيتغيّر، المكوّن لأ). السبب: لما الحساب يتعمل
 *    الصفحة بتتحدّث، ولو كان فيه مكوّن تاني مكانه، الرمز المؤقت كان
 *    هيختفي قبل ما الإدارة تنسخه — وهو مابيظهرش تاني. نفس العطل اللي
 *    كان بيخفي زرار «كمّل» بعد القبول.
 */
export function JoinInstructorAccount({
  requestId,
  instructorId,
  manualHref,
}: {
  requestId: string;
  /** ملف المدرب لو اتعمل — `null` = لسه. */
  instructorId: string | null;
  /** شاشة المدربين بالخانات متملّية — للإدارة لو عارفة بياناته. */
  manualHref?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [created, setCreated] = useState<{
    code: string | null;
    email: string;
    name: string;
  } | null>(null);

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await createInstructorFromJoinRequest(requestId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWarning(result.warning ?? '');
      setCreated({ code: result.tempCode, email: result.email, name: result.name });
    } catch {
      setError('تعذّر إنشاء الحساب — جرّب تاني');
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return (
      <div className="w-full space-y-3">
        <FormNotice message={warning} />
        {created.code ? (
          <TempCodeBox
            code={created.code}
            email={created.email}
            role="المدرب"
            loginUrl={origin ? `${origin}/sign-in` : undefined}
            greeting={`أهلًا ${created.name}، طلب انضمامك كمدرب في الرحلة اتقبل.`}
            nextStep="بعدها هتلاقي «كمّل ملفك»: صورتك، نبذة عنك، تخصصاتك، وسنين خبرتك. ابعته للإدارة، وبعد المراجعة والتدريب حسابك بيتفعّل."
          />
        ) : (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
            الشخص كان عنده حساب بالفعل — اتحوّل لمدرب، ويدخل بكلمة مروره زي ما هي.
            أول ما يدخل هيلاقي «كمّل ملفك».
          </p>
        )}
      </div>
    );
  }

  if (instructorId) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
        <CheckCircle className="h-5 w-5" />
        الطلب مقبول وحساب المدرب اتعمل.
        <Link href={`/dashboard/admin/instructors/${instructorId}`} className="underline">
          افتح ملف المدرب
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="space-y-1">
        <p className="font-black text-amber-900">الطلب مقبول — فاضل حساب المدرب.</p>
        <p className="text-sm font-medium text-amber-800">
          الحساب هيتعمل بالاسم والبريد اللي في الطلب، وهيظهرلك رمز دخول ورسالة
          واتساب جاهزة تبعتها له. أول ما يدخل، الموقع هيلزمه يكمّل ملفه (صورته،
          نبذة، تخصصاته، سنين خبرته) ويبعته لك تراجعه. ومش هيظهر للأهالي لحد ما
          تعتمد ملفه وتفعّله بعد التدريب.
        </p>
      </div>
      <FormError message={error} />
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
        اعمل حساب المدرب وجهّز رسالة الدخول
      </button>
      {manualHref && (
        <p className="text-xs font-medium text-amber-800">
          عارف بياناته كاملة؟{' '}
          <Link href={manualHref} className="font-bold underline">
            اعمل الملف كامل بنفسك من شاشة المدربين
          </Link>
          .
        </p>
      )}
    </div>
  );
}
