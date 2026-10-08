'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFormState } from './FormContext';

/**
 * زرار قرار («اعتماد» / «رفض») جوّه `ActionForm`.
 *
 * ⚠️ **ليه مش `SubmitButton`:** شاشات المراجعة فيها زرارين بنفس الحالة
 *    (`busy` من `ActionForm`)، و`SubmitButton` بيكتب «جارٍ…» على كل
 *    الأزرار مرة واحدة — فالإداري اللي داس «رفض» بيشوف «جارٍ الاعتماد…».
 *    هنا الزرار بيفتكر إنه هو اللي اتداس، وهو بس اللي بيكتب الحالة.
 *    (القفل نفسه بيحصل للكل من `fieldset` في `ActionForm`.)
 */
export function DecisionButton({
  pendingLabel = 'جارٍ الحفظ…',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'type' | 'pending' | 'pendingText' | 'onClick'> & {
  pendingLabel?: string;
}) {
  const { busy } = useFormState();
  const [clicked, setClicked] = useState(false);

  // النموذج خلص — الضغطة الجاية تبدأ من الأول.
  useEffect(() => {
    if (!busy) setClicked(false);
  }, [busy]);

  return (
    <Button
      {...props}
      type="submit"
      onClick={() => setClicked(true)}
      pending={busy && clicked}
      pendingText={pendingLabel}
    />
  );
}
