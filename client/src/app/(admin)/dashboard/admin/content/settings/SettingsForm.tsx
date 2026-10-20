'use client';

import React, { useState } from 'react';
import { updateSiteSettings } from '@/actions/content';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { FormActions, SubmitButton } from '@/components/forms/Form';

/**
 * الفورم بيقول حصل إيه.
 *
 * قبل كده كان بينادي دالة الحفظ ومبيعرضش أي نتيجة: لا نجاح ولا فشل.
 * فلو القاعدة رفضت الكتابة، الشاشة كانت بتتحدّث والقيم ترجع زي ما هي،
 * ومحدش يعرف السبب.
 *
 * دلوقتي جوّه `ActionForm` الموحّد: الخطأ بيظهر فوق النموذج (مش جنب
 * الزرار تحت صفحة طويلة)، والخانات بتتقفل وهو بيحفظ، والضغطة التانية
 * مابتتبعتش. الأكشن نفسه زي ما هو — بنبعتله `null` مكان الحالة القديمة
 * اللي كان `useActionState` بيبعتها، وهو أصلًا مابيستعملهاش.
 */
export function SettingsForm({ children }: { children: React.ReactNode }) {
  // «اتحفظ» جنب الزرار مش فوق: الصفحة طويلة والإداري بيبقى تحت عند
  // الزرار، فرسالة نجاح فوق ماحدش هيشوفها. وبتختفي أول ما يبعت تاني
  // أو يعدّل أي خانة — عشان ماتفضلش «اتحفظ» قدام تعديل لسه ماتحفظش.
  const [saved, setSaved] = useState(false);

  return (
    <div onSubmitCapture={() => setSaved(false)} onInputCapture={() => setSaved(false)}>
      <ActionForm
        action={(formData) => updateSiteSettings(null, formData)}
        onDone={() => setSaved(true)}
        className="space-y-6"
      >
        {children}

        <FormActions>
          {saved && (
            <p role="status" className="text-sm font-bold text-emerald-600">
              اتحفظ ✓
            </p>
          )}
          <SubmitButton>حفظ الإعدادات</SubmitButton>
        </FormActions>
      </ActionForm>
    </div>
  );
}
