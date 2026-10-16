'use client';

import { useState } from 'react';
import { updatePost } from '@/actions/aqlam';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, FormActions, FormSection, Select, SubmitButton, TextArea, TextInput } from '@/components/forms/Form';
import { AQLAM_CATEGORIES, AQLAM_LIMITS } from '@/lib/aqlam/post';

/**
 * تعديل نص. الاسم الظاهر ثابت (لو عايز اسم تاني: شيل وانشر من جديد).
 * `warning` بيقول بصراحة إيه اللي هيحصل للنص بعد الحفظ حسب وضعه.
 */
export function EditForm({
  post,
  ageGroup,
  warning,
}: {
  post: {
    id: string;
    title: string;
    body: string;
    category: string;
    allowIndexing: boolean;
    commentsEnabled: boolean;
    displayName: string;
  };
  ageGroup: 'under_12' | '12_plus';
  warning: string | null;
}) {
  const [body, setBody] = useState(post.body);

  return (
    <ActionForm action={updatePost} className="space-y-8">
      <input type="hidden" name="postId" value={post.id} />

      {warning && (
        <p role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {warning}
        </p>
      )}

      <FormSection>
        <Field label="العنوان" name="title" required>
          <TextInput name="title" defaultValue={post.title} maxLength={AQLAM_LIMITS.titleMax} required />
        </Field>

        <Field label="النوع" name="category" required>
          <Select name="category" defaultValue={post.category}>
            {AQLAM_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="النص"
          name="body"
          required
          hint={`${body.length.toLocaleString('ar-EG')} / ${AQLAM_LIMITS.bodyMax.toLocaleString('ar-EG')} حرف · من غير أرقام تليفون أو روابط أو حسابات تواصل.`}
        >
          <TextArea
            name="body"
            rows={14}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={AQLAM_LIMITS.bodyMax}
            required
          />
        </Field>
      </FormSection>

      <FormSection title="الخصوصية" description={`بيفضل ظاهر باسم «${post.displayName}».`}>
        <Checkbox
          name="commentsEnabled"
          defaultChecked={post.commentsEnabled}
          label="اسمح بالتعليقات"
        />
        {ageGroup === '12_plus' && (
          <Checkbox
            name="allowIndexing"
            defaultChecked={post.allowIndexing}
            label="اسمح لجوجل بإظهار النص في نتايج البحث"
          />
        )}
      </FormSection>

      <FormActions>
        <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ التعديل</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
