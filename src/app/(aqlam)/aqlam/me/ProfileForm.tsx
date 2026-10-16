'use client';

import Link from 'next/link';
import { saveWriterProfile } from '@/actions/aqlam';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, FormActions, FormSection, SubmitButton, TextArea, TextInput } from '@/components/forms/Form';
import { AQLAM_LIMITS } from '@/lib/aqlam/post';

/**
 * ملف الكاتب: اسم القلم والنبذة، وخيار «صفحتي العامة» (مقفول افتراضيًا).
 *
 * الصفحة العامة اختيارية ومن ١٢ سنة فأكبر. لو اتفعّلت، كل نصوصك المنشورة
 * (١٢+) بتتجمّع تحت رابط عشوائي — مش رقم حسابك.
 */
export function ProfileForm({
  initial,
  publicAllowed,
  publicBlockedReason,
}: {
  initial: { penName: string; bio: string; isPublic: boolean; slug: string | null };
  publicAllowed: boolean;
  publicBlockedReason: string;
}) {
  return (
    <ActionForm action={saveWriterProfile} successMessage="اتحفظ ملفك." className="space-y-8">
      <FormSection title="اسم القلم والنبذة" description="اسم القلم بتقدر تختاره عند النشر. النبذة سطرين عنك للقرّاء لو فعّلت صفحتك.">
        <Field
          label="اسم القلم"
          name="penName"
          hint={`اختياري · من ${AQLAM_LIMITS.penNameMin.toLocaleString('ar-EG')} لـ${AQLAM_LIMITS.penNameMax.toLocaleString('ar-EG')} حرف. النصوص المنشورة قبل كده بتفضل باسمها.`}
        >
          <TextInput name="penName" defaultValue={initial.penName} maxLength={AQLAM_LIMITS.penNameMax} />
        </Field>
        <Field
          label="نبذة عنك"
          name="bio"
          hint={`اختياري · حتى ${AQLAM_LIMITS.bioMax.toLocaleString('ar-EG')} حرف · من غير أرقام تليفون أو روابط أو حسابات تواصل.`}
        >
          <TextArea name="bio" rows={4} defaultValue={initial.bio} maxLength={AQLAM_LIMITS.bioMax} />
        </Field>
      </FormSection>

      <FormSection title="صفحتي العامة" description="اختيارية. مقفولة لحد ما تفعّلها، وتقدر تقفلها في أي وقت.">
        {publicAllowed ? (
          <Checkbox
            name="isPublic"
            defaultChecked={initial.isPublic}
            label="اعرض صفحة عامة بنصوصي"
            hint="محتاجة اسم قلم فوق. بتتجمّع فيها النصوص اللي ظاهرة بنفس اسم القلم ده بس (النصوص باسم تاني ما بتتربطش بيه)، تحت رابط خاص بيك من غير رقم حسابك. لو غيّرت اسم القلم، النصوص القديمة بالاسم القديم بتخرج من الصفحة."
          />
        ) : (
          <p className="rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">{publicBlockedReason}</p>
        )}
        {initial.isPublic && initial.slug && (
          <p className="text-sm font-bold text-slate-600">
            صفحتك:{' '}
            <Link href={`/aqlam/w/${initial.slug}`} className="text-slate-900 underline underline-offset-4">
              افتحها
            </Link>
          </p>
        )}
      </FormSection>

      <FormActions>
        <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
