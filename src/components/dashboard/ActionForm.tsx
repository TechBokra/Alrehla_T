'use client';

import React, { useState, useTransition } from 'react';
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
}: {
  action: (formData: FormData) => Promise<ActionFormResult>;
  children: React.ReactNode;
  className?: string;
  onDone?: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState('');

  const submit = (formData: FormData) =>
    startTransition(async () => {
      setError('');
      const result = await action(formData);
      if (result && result.ok === false) {
        setError(result.error);
        return;
      }
      onDone?.();
    });

  return (
    <form action={submit} className={className}>
      <FormError message={error} />
      {/* ⚠️ `fieldset` بيقفل كل الخانات مرة واحدة وهو شغّال —
          من غيره المستخدم يقدر يعدّل وهو بيتحفظ فيضيع تعديله. */}
      <fieldset disabled={busy} className="contents">
        {children}
      </fieldset>
    </form>
  );
}
