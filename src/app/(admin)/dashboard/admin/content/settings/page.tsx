import React from 'react';
import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { hasAdminPermission } from '@/lib/utils';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { SettingsForm } from './SettingsForm';
import { WatermarkFields } from './WatermarkFields';
import { MAX_CLEANUP_DAYS, MIN_CLEANUP_DAYS } from '@/lib/media-cleanup';
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

        {/* ---------- العلامة المائية ---------- */}
        <Section
          title="العلامة المائية"
          hint="بطاقة صغيرة على صور الموقع والمنتجات، بتفضل ظاهرة لو حد حفظ الصورة أو شاركها. التغيير بيطلع على كل الصور مرة واحدة بعد الحفظ."
        >
          <WatermarkFields
            initial={settings.watermark}
            sampleUrl={
              settings.images.homeHero ??
              settings.images.homeReading ??
              settings.images.homeFamily ??
              null
            }
          />
        </Section>

        {/* ---------- تنظيف الصور ---------- */}
        <Section
          title="تنظيف الصور المتسابة"
          hint="كل يوم الموقع بيدوّر على الصور اللي مش مستخدمة في أي مكان. الصورة اللي تفضل متسابة المدة دي كلها بتتمسح من Cloudinary لوحدها، ولو رجعت تتستخدم قبلها العدّاد بيتصفّر. المسح بيتسجّل في سجل التدقيق وبيوصلك إشعار."
        >
          <Checkbox
            name="mediaCleanupEnabled"
            label="امسح الصور المتسابة تلقائيًا"
            defaultChecked={settings.mediaCleanup.enabled}
            className="md:col-span-2"
          />
          <Field
            label="بعد كام يوم متسابة"
            name="mediaCleanupDays"
            hint={`من ${MIN_CLEANUP_DAYS} لـ ${MAX_CLEANUP_DAYS} يوم. المسح نهائي، فمتقصّرش المدة أوي.`}
            className="md:col-span-2"
          >
            <TextInput
              type="number"
              min={MIN_CLEANUP_DAYS}
              max={MAX_CLEANUP_DAYS}
              dir="ltr"
              className="text-left"
              defaultValue={settings.mediaCleanup.days}
            />
          </Field>
          <p className="text-xs font-bold text-slate-500 md:col-span-2">
            المسح التلقائي بيقف لوحده لو أكتر من نص الصور متسابة، أو لو فحص الجداول
            ماكملش — ساعتها راجع من «مكتبة الوسائط».
          </p>
        </Section>

        {/* ---------- ملفات الطلبات ومساحة الكتابة (ملف 20) ---------- */}
        <Section
          title="ملفات الطلبات ومساحة الكتابة"
          hint="الملفات اللي العملاء والمدربين بيرفعوها على طلبات الخدمات وفي مساحة الكتابة. بتتمسح من السيرفر لوحدها بعد المدة دي من قفل الطلب (أو مراجعة المستند)، والعميل بيشوف التنبيه ده قبل ما يرفع."
        >
          <Field
            label="تتمسح بعد كام يوم"
            name="fileRetentionDays"
            hint="من ٧ لـ ٣٦٥ يوم. المسح نهائي."
            className="md:col-span-2"
          >
            <TextInput
              type="number"
              min={7}
              max={365}
              dir="ltr"
              className="text-left"
              defaultValue={settings.fileRetentionDays}
            />
          </Field>
        </Section>

        {/* ---------- صور الأطفال في الطلبات المخصصة ---------- */}
        <Section
          title="صور الأطفال في الطلبات المخصصة"
          hint="الصور اللي ولي الأمر بيرفعها عشان ترتسم في القصة. بتتمسح من السيرفر لوحدها بعد المدة دي من انتهاء الطلب. والطلب اللي لسه بيتنفّذ مابيتلمسش مهما طال — الاستوديو محتاج الصورة."
        >
          <Field
            label="تتمسح بعد كام يوم من انتهاء الطلب"
            name="childPhotoRetentionDays"
            hint="من ١ لـ ٩٠ يوم. المسح نهائي ومفيش رجوع. والطلب اللي اتترك بلا دفع صوره بتتمسح بعد ٣٠ يوم من الطلب."
            className="md:col-span-2"
          >
            <TextInput
              type="number"
              min={1}
              max={90}
              dir="ltr"
              className="text-left"
              defaultValue={settings.childPhotoRetentionDays}
            />
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

        {/* ⚠️ «استقبال التحويلات» (رقم المحفظة وكود QR) اتنقل لصفحة
            «إعدادات الدفع» بصلاحية `canManagePayments` الخاصة بيه: الرقم
            ده بتتحوّل عليه فلوس العملاء، وماكانش ينفع يفضل تحت صلاحية
            المحتوى الواسعة. */}

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
