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

export const dynamic = 'force-dynamic';

const field =
  'w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const labelClass = 'block text-sm font-bold text-slate-700 mb-2';

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

      <SettingsForm>
        {/* ---------- الهوية ---------- */}
        <Section
          title="هوية الموقع"
          hint="الشعار وأيقونة التبويب وصورة المشاركة بتترفع من شاشة «صور الموقع»."
        >
          <div>
            <label className={labelClass}>اسم الموقع</label>
            <input type="text" name="siteName" defaultValue={settings.siteName} className={field} />
          </div>
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
          <div>
            <label className={labelClass}>بريد التواصل</label>
            <input type="email" name="contactEmail" defaultValue={settings.contactEmail} className={field} />
          </div>
          <div>
            <label className={labelClass}>رقم التليفون</label>
            <input
              type="text"
              name="contactPhone"
              dir="ltr"
              defaultValue={settings.contactPhone}
              className={`${field} text-left`}
            />
          </div>
          <div>
            <label className={labelClass}>رقم الواتساب</label>
            <input
              type="text"
              name="whatsappNumber"
              dir="ltr"
              placeholder="201012345678"
              defaultValue={settings.whatsappNumber}
              className={`${field} text-left`}
            />
            <p className="mt-2 text-xs font-medium text-slate-500">
              بصيغة دولية بلا صفر ولا علامة زائد — كده بس الرابط بيفتح
              المحادثة مباشرة.
            </p>
          </div>
          <div>
            <label className={labelClass}>مواعيد العمل</label>
            <input
              type="text"
              name="workingHours"
              placeholder="السبت – الخميس، ١٠ص – ٦م"
              defaultValue={settings.workingHours}
              className={field}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>العنوان</label>
            <input type="text" name="address" defaultValue={settings.address} className={field} />
          </div>
          <div>
            <label className={labelClass}>رابط فيسبوك</label>
            <input type="url" name="facebookUrl" defaultValue={settings.facebookUrl} className={field} />
          </div>
          <div>
            <label className={labelClass}>رابط إنستجرام</label>
            <input type="url" name="instagramUrl" defaultValue={settings.instagramUrl} className={field} />
          </div>
        </Section>

        {/* ---------- شريط التنبيه ---------- */}
        <Section
          title="شريط التنبيه العلوي"
          hint="شريط في أعلى كل صفحات الموقع — للصيانة أو إعلان مؤقت. الزائر يقدر يقفله، وبيرجع يظهر لو غيّرت النص."
        >
          <div className="md:col-span-2">
            <label className={labelClass}>نص التنبيه</label>
            <input
              type="text"
              name="announcementText"
              maxLength={160}
              placeholder="الموقع تحت الصيانة اليوم من ١٠م لـ ١٢ص."
              defaultValue={settings.announcement.text}
              className={field}
            />
          </div>
          <div>
            <label className={labelClass}>يختفي تلقائيًا في</label>
            <input
              type="datetime-local"
              name="announcementUntil"
              defaultValue={untilValue}
              className={field}
            />
            <p className="mt-2 text-xs font-medium text-slate-500">
              سيبه فاضي لو عايزه يفضل لحد ما توقفه بنفسك.
            </p>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                name="announcementEnabled"
                defaultChecked={settings.announcement.enabled}
                className="h-5 w-5 rounded border-slate-300"
              />
              <span className="text-sm font-bold text-slate-700">شغّال دلوقتي</span>
            </label>
          </div>
        </Section>

        {/* ---------- الدفع ---------- */}
        <Section
          title="استقبال التحويلات"
          hint="الرقم ده بيظهر للعملاء في كل شاشات الدفع. راجعه كويس قبل الحفظ."
        >
          <div className="md:col-span-2">
            <label className={labelClass}>رقم المحفظة</label>
            <input
              type="text"
              name="paymentWalletNumber"
              dir="ltr"
              defaultValue={settings.paymentWalletNumber}
              className={`${field} text-left`}
            />
          </div>
          <div className="md:col-span-2">
            <PaymentQrUploader value={settings.paymentQrUrl} />
          </div>
        </Section>

        {/* ---------- الطلبات اللي مااتدفعتش ---------- */}
        <Section
          title="الطلبات اللي مااتدفعتش"
          hint="الطلب بيتسجّل قبل رفع الإيصال. لو العميل مارفعش إيصال خلال المدة دي، الطلب بيتلغي لوحده وبيوصله إشعار. صفر = مابيتلغيش."
        >
          <div className="md:col-span-2">
            <label className={labelClass} htmlFor="pendingOrderCancelDays">
              إلغاء الطلب بعد (أيام)
            </label>
            <input
              id="pendingOrderCancelDays"
              type="number"
              min={0}
              max={60}
              name="pendingOrderCancelDays"
              dir="ltr"
              defaultValue={settings.pendingOrderCancelDays}
              className={`${field} text-left`}
            />
          </div>
        </Section>

        {/* ---------- تسعير المدربين ---------- */}
        <Section
          title="تنبيه سعر المدربين"
          hint="تنبيه مش منع: المدرب يقدر يكمل فوق الرقم ده، وأنت بتراجع كل سعر قبل الاعتماد زي المعتاد."
        >
          <div className="md:col-span-2">
            <label className={labelClass}>
              نبّه لو الحصيلة المقترحة أعلى من (ج.م)
            </label>
            <input
              type="number"
              min={0}
              name="instructorPriceAlert"
              dir="ltr"
              placeholder="سيبه فاضي عشان توقف التنبيه"
              defaultValue={settings.instructorPriceAlert || ''}
              className={`${field} text-left`}
            />
          </div>
        </Section>

        <Section
          title="تسجيل الجلسات"
          hint="لمّا يكون شغّالًا، بيظهر لولي الأمر قبل الدفع إن الجلسات بتتسجّل، وموافقته بتبقى شرط لإتمام الحجز. وإطفاؤه بيوقّف التسجيل ويشيل الإفصاح من الشاشات."
        >
          <div className="md:col-span-2">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="recordingEnabled"
                defaultChecked={settings.sessionRecording.enabled}
                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-bold text-slate-700">
                سجّل جلسات «بداية الرحلة»
              </span>
            </label>
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>مدة الاحتفاظ بالتسجيل قبل الحذف</label>
            <select
              name="recordingRetentionDays"
              defaultValue={String(settings.sessionRecording.retentionDays)}
              className={field}
            >
              {RETENTION_OPTIONS.map((option) => (
                <option key={option.days} value={option.days}>
                  {option.label} ({option.days} يومًا)
                </option>
              ))}
            </select>
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
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-lg font-black text-slate-800">{title}</h2>
      {hint && <p className="mt-1 text-sm font-medium text-slate-500">{hint}</p>}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">{children}</div>
    </section>
  );
}
