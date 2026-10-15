import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, FormActions, Select, SubmitButton } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { STUDIO_ROLE_NAMES, getStudioReadiness } from '@/data/domains/(admin)/studio/queries';
import { backfillStudioProjects, saveStudioMode } from '@/actions/studio';
import { hasAdminPermission } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StudioSettingsPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageStudio')) return <Unauthorized />;
  const ready = await getStudioReadiness();
  const mode = ready.mode;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-6 py-12">
      <DashboardPageHeader title="إعدادات استوديو القصص" backHref="/dashboard/admin/studio" />

      {/* ── حالة التجهيز: إيه اتطبّق وإيه لسه ── */}
      <section aria-labelledby="ready" className="space-y-4">
        <h2 id="ready" className="text-xl font-black text-slate-800">
          حالة التجهيز
        </h2>
        <ul className="space-y-2">
          {[
            {
              ok: ready.tablesReady,
              label: 'جداول الاستوديو في قاعدة البيانات',
              todo: 'طبّق migration استوديو القصص (staging ثم production) — من غيرها مفيش حاجة بتشتغل.',
            },
            {
              ok: ready.rolesFound.length === STUDIO_ROLE_NAMES.length,
              label: `الأدوار الجاهزة (${ready.rolesFound.length.toLocaleString('ar-EG')} من ${STUDIO_ROLE_NAMES.length.toLocaleString('ar-EG')})`,
              todo: 'بتتضاف مع الـ migration. ينفع تتعدّل من صفحة الصلاحيات.',
            },
            {
              ok: ready.staffCount > 0,
              label: `موظفون على أدوار الاستوديو (${ready.staffCount.toLocaleString('ar-EG')})`,
              todo: 'عيّن محررًا ومشرفًا فنيًا ومسؤول إنتاج من إدارة المستخدمين.',
            },
            {
              ok: mode === 'on',
              label: 'الاستوديو شغّال',
              todo: 'شغّله من القايمة فوق بعد ما تخلّص الخطوات اللي قبل.',
            },
            {
              ok: ready.backfillPending === 0,
              label: `طلبات مدفوعة من غير مشروع (${ready.backfillPending.toLocaleString('ar-EG')})`,
              todo: 'استوردها بالزرار تحت — الطلبات اللي اتسلّمت أو اتلغت مابتتستوردش.',
            },
            {
              ok: ready.projectCount > 0,
              label: `مشاريع اتفتحت (${ready.projectCount.toLocaleString('ar-EG')})`,
              todo: 'هتتفتح تلقائيًا مع أول طلب مخصّص مدفوع، أو يدويًا من صفحة الطلب.',
            },
          ].map((c) => (
            <li
              key={c.label}
              className={`rounded-2xl p-4 text-sm font-medium ${c.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}
            >
              <p className="font-black">
                {c.ok ? '✓' : '○'} {c.label}
              </p>
              {!c.ok && <p className="mt-1 text-xs">{c.todo}</p>}
            </li>
          ))}
        </ul>
      </section>

      {ready.tablesReady && ready.backfillPending > 0 && (
        <section aria-labelledby="backfill" className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
          <h2 id="backfill" className="text-lg font-black text-slate-800">
            استيراد الطلبات الحالية
          </h2>
          <p className="text-sm leading-relaxed font-medium text-slate-600">
            فيه {ready.backfillPending.toLocaleString('ar-EG')} بند مخصّص في طلبات مدفوعة (مدفوع / بيتجهّز / اتشحن)
            من غير مشروع. الاستيراد بيفتح مشروعًا لكل بند ويرسل المهمة لمسؤول الإنتاج، ومايكرّرش اللي موجود.
          </p>
          <ActionForm action={backfillStudioProjects} successMessage="تم الاستيراد." className="flex justify-end">
            <SubmitButton pendingLabel="جارٍ الاستيراد…">استيراد الآن</SubmitButton>
          </ActionForm>
        </section>
      )}

      <section aria-labelledby="later" className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
        <h2 id="later" className="text-lg font-black text-slate-800">
          لسه مش مبني (المرحلة الجاية)
        </h2>
        <ul className="list-disc space-y-2 pr-5 text-sm leading-relaxed font-medium text-slate-700">
          <li>صفحة «قصتي» للعميل: يشوف النص ويوافق أو يطلب تعديلًا بنفسه (حاليًا الفريق بيسجّل موافقته بملاحظة).</li>
          <li>حقول الدفع: موافقة ولي الأمر على الصورة واختيار وضع الوجه (حاليًا بيتحدّدوا من الفريق).</li>
          <li>رفع الصور والملفات من الاستوديو (حاليًا روابط https، ويفضّل Cloudinary).</li>
                    <li>قوالب القصص ومكتبة الشخصيات وسجل مهام الذكاء الاصطناعي.</li>
                  </ul>
      </section>

      <section aria-labelledby="mode" className="space-y-4">
        <h2 id="mode" className="text-xl font-black text-slate-800">
          التشغيل
        </h2>
        <p className="text-sm leading-relaxed font-medium text-slate-600">
          لما الاستوديو يبقى <strong>مقفول</strong> مفيش مشروع بيتفتح تلقائيًا عند الدفع، ولا بيتفتح يدويًا. المشاريع
          الموجودة بتفضل ظاهرة للفريق. الاستوديو كله جوّه لوحة الإدارة — تشغيله أو إيقافه مابيغيّرش أي صفحة في الموقع
          العام ولا بيبطّئها.
        </p>
        <ActionForm action={saveStudioMode} successMessage="اتحفظت الإعدادات." className="space-y-6">
          <Field label="الحالة" name="mode" required>
            <Select name="mode" defaultValue={mode}>
              <option value="off">مقفول (الافتراضي)</option>
              <option value="on">شغّال — يفتح مشروعًا تلقائيًا لكل طلب مخصّص مدفوع</option>
            </Select>
          </Field>
          <FormActions>
            <SubmitButton>حفظ</SubmitButton>
          </FormActions>
        </ActionForm>
      </section>

      <section aria-labelledby="how" className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 id="how" className="text-lg font-black text-slate-800">
          إزاي بيشتغل الفريق
        </h2>
        <ul className="list-disc space-y-2 pr-5 text-sm leading-relaxed font-medium text-slate-700">
          <li>
            <strong>محرر قصص:</strong> بيكتب النص ويعتمده ويسجّل موافقة العميل — على المشاريع المعيّن عليها بس.
          </li>
          <li>
            <strong>مشرف فني:</strong> بيعتمد مرجع الشخصية ويجهّز الصفحات ويراجعها — على مشاريعه بس.
          </li>
          <li>
            <strong>مسؤول إنتاج القصص:</strong> بيوزّع المشاريع ويعمل الفحص النهائي والتسليم والإيقاف والإلغاء، وبيشوف
            التكلفة.
          </li>
          <li>الأدوار دي بتتضاف من صفحة الصلاحيات، والمستخدم بيتعيّن عليها من إدارة المستخدمين.</li>
        </ul>
      </section>
    </div>
  );
}
