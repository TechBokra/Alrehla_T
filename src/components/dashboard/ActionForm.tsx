'use client';

import React, { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FormError } from '@/components/ui/FormError';

export type ActionFormResult = { ok: true } | { ok: false; error: string } | void;

/**
 * نموذج بينادي أكشن خادم **وبيعرض رسالته**.
 *
 * ── ليه ده موجود ────────────────────────────────────────────
 *
 * `<form action={serverAction}>` في صفحة خادم شكله أبسط حاجة —
 * لكنه **مالوش مكان يعرض فيه خطأ**. والأكشن اللي بيرمي بتوصل
 * رسالته للإنتاج ممسوحة (قاعدة «هـ»)، فالمستخدم بيتنقل لصفحة خطأ
 * عامة **وبيطلع برّه الشاشة اللي كان بيملاها**.
 *
 * ⚠️ **وده مش الزرّ الصامت، ده أوحش منه**: الزرّ الصامت بيسيبك
 *    مكانك؛ ده بيضيّع اللي كتبته.
 *
 * المكوّن ده بيلفّ النموذج في مكوّن عميل صغير: بينادي الأكشن،
 * وبيعرض `error` فوق النموذج، وبيقفل الزرّ وهو شغّال — **والصفحة
 * تفضل صفحة خادم** وبتبعت الأكشن كخاصية.
 */
export function ActionForm({
  action,
  children,
  className,
  /** بيتنادى بعد النجاح — تحديث القايمة مثلًا. */
  onDone,
  /** بعد النجاح يروح هنا — «إضافة منتج» يرجع لـ«منتجاتي». */
  successHref,
  /** رسالة نجاح تفضل ظاهرة فوق النموذج (لو مفيش `successHref`). */
  successMessage,
}: {
  action: (formData: FormData) => Promise<ActionFormResult>;
  children: React.ReactNode;
  className?: string;
  onDone?: () => void;
  successHref?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // ⚠️ **قفل فوري ضد الضغطتين.** `busy` و`fieldset disabled` بيتطبّقوا
  //    مع الرسم الجاي — وضغطة سريعة تانية (أو Enter مرتين) كانت بتلحق
  //    قبله فتتبعت مرتين. ده كان سبب «المنتج اتضاف ومع ذلك طلع خطأ»:
  //    الأولى بتضيفه، والتانية بتترفض لأن رابطه بقى متاخد.
  const inFlight = useRef(false);

  const submit = (formData: FormData) => {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      setError('');
      setNotice('');
      try {
        const result = await action(formData);
        if (result && result.ok === false) {
          setError(result.error);
          return;
        }
        onDone?.();
        if (successHref) {
          router.push(successHref);
          router.refresh();
        } else if (successMessage) {
          setNotice(successMessage);
        }
      } catch (e) {
        // تحويلات Next (`redirect`) بتيجي كاستثناء — لازم تعدّي.
        if ((e as { digest?: string } | null)?.digest?.startsWith('NEXT_')) throw e;
        setError('حصل خطأ غير متوقع — راجع القايمة قبل ما تعيد المحاولة.');
      } finally {
        inFlight.current = false;
      }
    });
  };

  // ⚠️ **الزرار اللي اتداس لازم يوصل مع النموذج.** شاشات المراجعة فيها
  //    زرارين «اعتماد» و«رفض» بنفس الاسم (`decision`) وقيمتين مختلفتين.
  //    `<form action={fn}>` كان بيبعت النموذج **من غير قيمة الزرار**،
  //    فالأكشن كان بيرجّع «القرار غير معروف» على كل ضغطة اعتماد. هنا
  //    بنبني البيانات بنفسنا ومعاها الزرار اللي اتداس.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    // بنضيف الزرار بإيدنا بدل `new FormData(form, submitter)`: المتصفحات
    // القديمة بتتجاهل التاني في صمت — وده بالظبط نوع العطل اللي بنصلّحه.
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    if (
      submitter instanceof HTMLButtonElement &&
      submitter.name &&
      !formData.has(submitter.name)
    ) {
      formData.append(submitter.name, submitter.value);
    }
    submit(formData);
  };

  return (
    <form onSubmit={onSubmit} className={className}>
      <FormError message={error} />
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"
        >
          {notice}
        </p>
      )}
      {/* ⚠️ `fieldset` بيقفل كل الخانات مرة واحدة وهو شغّال —
          من غيره المستخدم يقدر يعدّل وهو بيتحفظ فيضيع تعديله. */}
      <fieldset disabled={busy} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
