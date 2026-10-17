import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, FormActions, Select, SubmitButton } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { saveAqlamSettings } from '@/actions/aqlam';
import { AQLAM_LIMITS } from '@/lib/aqlam/post';
import { Heading, MODE_OPTIONS } from '../_shared';
import { hasAdminPermission } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** أقلام الرحلة ← الإعدادات: وضع التشغيل (إيقاف طارئ / تجريبي / عام) والأرقام المعتمدة. */
export default async function AqlamSettingsPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;
  const { aqlam } = await getSiteSettings();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-12 px-6 py-12">
      <DashboardPageHeader title="أقلام الرحلة — الإعدادات" />

      {/* ── التشغيل ── */}
      <section aria-labelledby="mode" className="space-y-4">
        <Heading id="mode">التشغيل</Heading>
        <ActionForm action={saveAqlamSettings} successMessage="اتحفظت الإعدادات." className="space-y-6">
          <Field label="الحالة" name="mode" required>
            <Select name="mode" defaultValue={aqlam.mode}>
              {MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <FormActions>
            <SubmitButton>حفظ</SubmitButton>
          </FormActions>
        </ActionForm>
      </section>

      <section aria-labelledby="rules" className="space-y-4">
        <Heading id="rules">القواعد المعتمدة</Heading>
        <p className="text-sm font-medium text-slate-500">
          دي أرقام مثبّتة في القاعدة (مش بتتغيّر من هنا). لو محتاج تغيّر واحد منها اطلب تعديل.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ['بلاغات الإخفاء التلقائي', `${AQLAM_LIMITS.reportsToAutoHide.toLocaleString('ar-EG')} حسابات مختلفة`],
            ['مسح المشال نهائيًا', 'بعد ٧ أيام'],
            ['النصوص المثبّتة', `حتى ${AQLAM_LIMITS.maxPinned.toLocaleString('ar-EG')} نصوص`],
            ['نصوص في اليوم', `${AQLAM_LIMITS.postsPerDay.toLocaleString('ar-EG')} للكاتب`],
            ['تعليقات في اليوم', `${AQLAM_LIMITS.commentsPerDay.toLocaleString('ar-EG')} للحساب`],
            ['قفل التعليقات لابن', 'بطلب من ولي الأمر وموافقة الإدارة'],
          ].map(([k, v]) => (
            <li key={k} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="block text-xs font-bold text-slate-500">{k}</span>
              <span className="text-sm font-black text-slate-800">{v}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
