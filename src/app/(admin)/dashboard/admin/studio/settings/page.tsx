import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, FormActions, Select, SubmitButton } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getStudioMode } from '@/data/domains/(admin)/studio/queries';
import { saveStudioMode } from '@/actions/studio';
import { hasAdminPermission } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StudioSettingsPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageStudio')) return <Unauthorized />;
  const mode = await getStudioMode();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-6 py-12">
      <DashboardPageHeader title="إعدادات استوديو القصص" backHref="/dashboard/admin/studio" />

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
