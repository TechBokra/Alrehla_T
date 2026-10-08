import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/auth';
import { getSiteSettings } from '@/data/domains/content';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SettingsForm } from './SettingsForm';
import { PaymentQrUploader } from './PaymentQrUploader';
import { RETENTION_OPTIONS } from '@/lib/session-recording';
import { Checkbox, Field, FormSection, Select, TextInput } from '@/components/forms/Form';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) {
    return <Unauthorized />;
  }

  const settings = await getSiteSettings();

  // القيمة في المتصفح لازم تبقى بصيغة datetime-local (بلا ثواني ولا منطقة).
  const untilValue = settings.announcement.until
    ? settings.announcement.until.slice(0, 16)
    : '';

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <DashboardPageHeader title="الإعدادات العامة للمنصة" />

      {/* الخانات من مكوّنات النماذج الموحّدة — نفس الأسماء (`name`) بالظبط،
          فالأكشن بيستلم نفس البيانات. */}
      <SettingsForm>
        {/* ---------- الهوية ---------- */}
        <Section
          title="هوية الموقع"
          hint="الشعار وأيقونة التبويب وصورة المشاركة بتترفع من شاشة «صور الموقع»."
        >
          <Field label="اسم الموقع" name="siteName">
            <TextInput defaultValue={settings.siteName} />
          </Field>
          <div className="flex items-end">
            <Link
              href="/dashboard/admin/content/images"
              className="rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200"
            >
              رفع الشعار والأيقونة وصورة المشاركة
            </Link>
          </div>
        </Section>

        {/* ---------- بيانات التواصل ---------- */}
        <Section
          title="بيانات التواصل"
          hint="بتظهر في الفوتر وفي صفحة التواصل. الحقل اللي تسيبه فاضي بيختفي من الموقع."
        >
          <Field label="بريد التواصل" name="contactEmail">
            <TextInput type="email" dir="ltr" className="text-left" defaultValue={settings.contactEmail} />
          </Field>
          <Field label="رقم التليفون" name="contactPhone">
            <TextInput dir="ltr" className="text-left" defaultValue={settings.contactPhone} />
          </Field>
          <Field
            label="رقم الواتساب"
            name="whatsappNumber"
            hint="بصيغة دولية بلا صفر ولا علامة زائد — كده بس الرابط بيفتح المحادثة مباشرة."
          >
            <TextInput
              dir="ltr"
              className="text-left"
              placeholder="201012345678"
              defaultValue={settings.whatsappNumber}
            />
          </Field>
          <Field label="مواعيد العمل" name="workingHours">
            <TextInput placeholder="السبت – الخميس، ١٠ص – ٦م" defaultValue={settings.workingHours} />
          </Field>
          <Field label="العنوان" name="address" className="md:col-span-2">
            <TextInput defaultValue={settings.address} />
          </Field>
          <Field label="رابط فيسبوك" name="facebookUrl">
            <TextInput type="url" dir="ltr" className="text-left" defaultValue={settings.facebookUrl} />
          </Field>
          <Field label="رابط إنستجرام" name="instagramUrl">
            <TextInput type="url" dir="ltr" className="text-left" defaultValue={settings.instagramUrl} />
          </Field>
        </Section>

        {/* ---------- شريط التنبيه ---------- */}
        <Section
          title="شريط التنبيه العلوي"
          hint="شريط في أعلى كل صفحات الموقع — للصيانة أو إعلان مؤقت. الزائر يقدر يقفله، وبيرجع يظهر لو غيّرت النص."
        >
          <Field
            label="نص التنبيه"
            name="announcementText"
            hint="لحد ١٦٠ حرف. الشريط مابيظهرش من غير نص حتى لو «شغّال» متعلّمة."
            className="md:col-span-2"
          >
            <TextInput
              maxLength={160}
              placeholder="الموقع تحت الصيانة اليوم من ١٠م لـ ١٢ص."
              defaultValue={settings.announcement.text}
            />
          </Field>
          <Field
            label="يختفي تلقائيًا في"
            name="announcementUntil"
            hint="سيبه فاضي لو عايزه يفضل لحد ما توقفه بنفسك."
          >
            <TextInput type="datetime-local" defaultValue={untilValue} />
          </Field>
          <div className="flex items-center">
            <Checkbox
              name="announcementEnabled"
              label="شغّال دلوقتي"
              defaultChecked={settings.announcement.enabled}
              className="rounded-xl bg-slate-50 px-4 py-3"
            />
          </div>
        </Section>

        {/* ---------- الدفع ---------- */}
        <Section
          title="استقبال التحويلات"
          hint="الرقم ده بيظهر للعملاء في كل شاشات الدفع. راجعه كويس قبل الحفظ."
        >
          {/* الأكشن بيتجاهل الرقم الفاضي ويسيب القديم (فاضي = الرقم الافتراضي،
              وده أخطر) — فبنقولها في المساعدة بدل ما تبان إنها اتمسحت. */}
          <Field
            label="رقم المحفظة"
            name="paymentWalletNumber"
            hint="لو سبته فاضي الرقم الحالي بيفضل زي ما هو."
            className="md:col-span-2"
          >
            <TextInput dir="ltr" className="text-left" defaultValue={settings.paymentWalletNumber} />
          </Field>
          <div className="md:col-span-2">
            <PaymentQrUploader value={settings.paymentQrUrl} />
          </div>
        </Section>

        {/* ---------- الطلبات اللي مااتدفعتش ---------- */}
        <Section
          title="الطلبات اللي مااتدفعتش"
          hint="الطلب بيتسجّل قبل رفع الإيصال. لو العميل مارفعش إيصال خلال المدة دي، الطلب بيتلغي لوحده وبيوصله إشعار. صفر = مابيتلغيش."
        >
          <Field
            label="إلغاء الطلب بعد (أيام)"
            name="pendingOrderCancelDays"
            hint="من ٠ لـ ٦٠."
            className="md:col-span-2"
          >
            <TextInput
              id="pendingOrderCancelDays"
              type="number"
              min={0}
              max={60}
              dir="ltr"
              className="text-left"
              defaultValue={settings.pendingOrderCancelDays}
            />
          </Field>
        </Section>

        {/* ---------- تسعير المدربين ---------- */}
        <Section
          title="تنبيه سعر المدربين"
          hint="تنبيه مش منع: المدرب يقدر يكمل فوق الرقم ده، وأنت بتراجع كل سعر قبل الاعتماد زي المعتاد."
        >
          <Field
            label="نبّه لو الحصيلة المقترحة أعلى من (ج.م)"
            name="instructorPriceAlert"
            hint="سيبه فاضي أو صفر عشان توقف التنبيه."
            className="md:col-span-2"
          >
            <TextInput
              type="number"
              min={0}
              dir="ltr"
              className="text-left"
              placeholder="سيبه فاضي عشان توقف التنبيه"
              defaultValue={settings.instructorPriceAlert || ''}
            />
          </Field>
        </Section>

        <Section
          title="تسجيل الجلسات"
          hint="لمّا يكون شغّالًا، بيظهر لولي الأمر قبل الدفع إن الجلسات بتتسجّل، وموافقته بتبقى شرط لإتمام الحجز. وإطفاؤه بيوقّف التسجيل ويشيل الإفصاح من الشاشات."
        >
          <Checkbox
            name="recordingEnabled"
            label="سجّل جلسات «بداية الرحلة»"
            defaultChecked={settings.sessionRecording.enabled}
            className="md:col-span-2"
          />

          <div className="md:col-span-2">
            <Field label="مدة الاحتفاظ بالتسجيل قبل الحذف" name="recordingRetentionDays">
              <Select defaultValue={String(settings.sessionRecording.retentionDays)}>
                {RETENTION_OPTIONS.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label} ({option.days} يومًا)
                  </option>
                ))}
              </Select>
            </Field>
            {/* ⚠️ الرقم ده بيظهر لولي الأمر كوعد صريح — فتغييره مش
                إعداد داخلي. والسياسة **مابتتحدّثش لوحدها**: لازم
                تعدّل نص «تسجيل الجلسات» في سياسة الخصوصية كمان. */}
            <p className="mt-2 text-xs font-bold text-amber-700">
              الرقم ده بيظهر لولي الأمر في شاشة الحجز وفي سياسة الخصوصية. لو
              غيّرته، عدّل نص السياسة من «محتوى الصفحات ← سياسة الخصوصية» —
              مش بيتحدّث لوحده.
            </p>
          </div>
        </Section>

      </SettingsForm>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <FormSection title={title} description={hint} columns={2}>
        {children}
      </FormSection>
    </div>
  );
}
