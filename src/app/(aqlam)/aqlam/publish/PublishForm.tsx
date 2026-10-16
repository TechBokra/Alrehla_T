'use client';

import { useState } from 'react';
import { publishPost } from '@/actions/aqlam';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, FormActions, FormSection, Select, SubmitButton, TextArea, TextInput } from '@/components/forms/Form';
import { BirthDatePicker } from '@/components/ui/BirthDatePicker';
import {
  AQLAM_CATEGORIES,
  AQLAM_LIMITS,
  NAME_MODE_LABELS,
  allowedNameModes,
  displayNameFor,
  type NameMode,
} from '@/lib/aqlam/post';
import type { AqlamAgeGroup } from '@/lib/aqlam/age';

const CONSENT_VERSION = 'v1';

export function PublishForm({
  ageGroup: statusGroup,
  needsBirthdate,
  fullName,
  initial,
}: {
  ageGroup: AqlamAgeGroup;
  needsBirthdate: boolean;
  fullName: string;
  initial: { title: string; body: string; docId: string } | null;
}) {
  // حساب مستقل جديد بيحدد الفئة من تاريخ الميلاد اللي هيكتبه (مقبول ١٢+ بس).
  const ageGroup: AqlamAgeGroup = needsBirthdate ? '12_plus' : statusGroup;
  const modes = allowedNameModes(ageGroup);
  const [nameMode, setNameMode] = useState<NameMode>(modes[0]);
  const [penName, setPenName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [body, setBody] = useState(initial?.body ?? '');

  // اللي هيظهر فعلًا — عشان الكاتب يشوف اسمه قبل ما ينشر.
  const preview = displayNameFor({ mode: nameMode, fullName, penName });
  // تاريخ الميلاد بيحدد الفئة لحساب جديد: تحت ١٢ مش هيقدر ينشر مستقل.
  // (القاعدة هي اللي بتتحقق؛ هنا بس نعرض ١٢+ كاحتمال لحد ما يتحدد.)
  const canIndex = ageGroup === '12_plus';

  return (
    <ActionForm action={publishPost} className="space-y-8">
      {initial && <input type="hidden" name="sourceDocumentId" value={initial.docId} />}
      <input type="hidden" name="consentVersion" value={CONSENT_VERSION} />

      <FormSection>
        <Field label="العنوان" name="title" required>
          <TextInput
            name="title"
            defaultValue={initial?.title ?? ''}
            maxLength={AQLAM_LIMITS.titleMax}
            required
          />
        </Field>

        <Field label="النوع" name="category" required>
          <Select name="category" defaultValue="story">
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

      <FormSection
        title="الاسم اللي هيظهر"
        description={
          ageGroup === 'under_12' ? 'بيظهر اسمك الأول بس، حمايةً لك.' : 'اختار الاسم اللي يريّحك.'
        }
      >
        <Field label="طريقة العرض" name="nameMode" required>
          <Select
            name="nameMode"
            value={nameMode}
            onChange={(e) => setNameMode(e.target.value as NameMode)}
            disabled={modes.length === 1}
          >
            {modes.map((m) => (
              <option key={m} value={m}>
                {NAME_MODE_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        {/* الخانة المقفولة مابتتبعتش في النموذج، فبنبعت القيمة بنفسنا. */}
        {modes.length === 1 && <input type="hidden" name="nameMode" value={nameMode} />}

        {nameMode === 'pen_name' && (
          <Field
            label="الاسم القلمي"
            name="penName"
            required
            hint={`من ${AQLAM_LIMITS.penNameMin.toLocaleString('ar-EG')} لـ${AQLAM_LIMITS.penNameMax.toLocaleString('ar-EG')} حرف.`}
          >
            <TextInput
              name="penName"
              value={penName}
              onChange={(e) => setPenName(e.target.value)}
              maxLength={AQLAM_LIMITS.penNameMax}
            />
          </Field>
        )}

        <p className="text-sm font-bold text-slate-600" aria-live="polite">
          هيظهر كده: <span className="text-slate-900">{preview || '—'}</span>
        </p>
      </FormSection>

      {needsBirthdate && (
        <FormSection
          title="تاريخ ميلادك"
          description="بنطلبه مرة واحدة بس، وبعدها مش هيتغيّر. بنحسب منه سنّك."
        >
          <Field label="تاريخ الميلاد" name="birthDate" required>
            <BirthDatePicker id="aqlam-birth" value={birthDate} onChange={setBirthDate} />
          </Field>
          <input type="hidden" name="birthDate" value={birthDate} />
        </FormSection>
      )}

      <FormSection title="الخصوصية">
        <Checkbox
          name="commentsEnabled"
          defaultChecked
          label="اسمح بالتعليقات"
          hint="أي حساب مسجّل عمره ١٢ سنة فأكتر يقدر يعلّق."
        />
        {canIndex && (
          <Checkbox
            name="allowIndexing"
            label="اسمح لجوجل بإظهار النص في نتايج البحث"
            hint="لو مش مفعّلة، النص بيفضل ظاهر على الموقع بس."
          />
        )}
        <Checkbox
          name="consent"
          required
          label="أوافق على نشر نصي بالاسم اللي اخترته على الموقع"
          hint="تقدر تعدّل النص أو تشيله في أي وقت من «ملفي». تعديل المستند الأصلي في مساحة الكتابة ما بيغيّرش المنشور."
        />
      </FormSection>

      <FormActions>
        <SubmitButton pendingLabel="جارٍ النشر…">
          {ageGroup === 'under_12' ? 'أرسل لولي الأمر' : 'انشر'}
        </SubmitButton>
      </FormActions>
    </ActionForm>
  );
}
