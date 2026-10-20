import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, FormActions, Select, SubmitButton } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import { getSiteSettings } from '@/data/domains/(shared)/settings/queries';
import { getAqlamAdminConfig, countPostsByCategory } from '@/data/domains/(shared)/aqlam/config';
import { labelUsers } from '@/data/domains/(shared)/aqlam/admin';
import { saveAqlamSettings } from '@/actions/aqlam';
import { AQLAM_SECTIONS } from '@/lib/aqlam/config';
import { formatDate, hasAdminPermission } from '@/lib/utils';
import { MODE_OPTIONS } from '../_shared';
import { SectionCard, ScalarSection } from './_parts';
import { BlockedWordsEditor, CategoriesEditor, FilterChoices, ReactionsEditor, ReportReasonsEditor } from './_lists';

export const dynamic = 'force-dynamic';

/** ترتيب الأقسام في الصفحة والفهرس (القوايم الخاصة بتتحط جنب القسم اللي بتتبعه). */
const INDEX: { id: string; label: string }[] = [
  { id: 'mode', label: 'وضع التشغيل' },
  { id: 'features', label: 'التشغيل والصلاحيات' },
  { id: 'limits-daily', label: 'الحدود اليومية' },
  { id: 'limits-content', label: 'حدود المحتوى' },
  { id: 'moderation', label: 'المراجعة والإشراف' },
  { id: 'blockedWords', label: 'الكلمات الممنوعة' },
  { id: 'filters', label: 'الفلاتر' },
  { id: 'categories', label: 'التصنيفات' },
  { id: 'reactions', label: 'الملصقات' },
  { id: 'reportReasons', label: 'أسباب البلاغ' },
  { id: 'featured', label: 'المختارات' },
  { id: 'texts', label: 'النصوص' },
  { id: 'admin', label: 'شاشة الإدارة' },
];

/** أقلام الرحلة ← الإعدادات: تحكم كامل في التشغيل والحدود والمراجعة والفلاتر والتصنيفات والنصوص. */
export default async function AqlamSettingsPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageContent')) return <Unauthorized />;

  const [{ aqlam }, adminResult] = await Promise.all([
    getSiteSettings(),
    getAqlamAdminConfig().then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
  ]);
  // لو ملف الـSQL الجديد لسه ما اتشغّلش في Supabase، الدالة مش موجودة.
  if (!adminResult.ok) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
        <DashboardPageHeader title="أقلام الرحلة — الإعدادات" />
        <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed font-bold text-amber-800">
          تعذّر تحميل الإعدادات. غالبًا ملف الـSQL الخاص بلوحة الضبط لسه ما اتشغّلش في Supabase — شغّله وارجع حدّث الصفحة.
        </p>
      </div>
    );
  }
  const admin = adminResult.value;
  const { config } = admin;
  const [counts, labels] = await Promise.all([
    countPostsByCategory(config.categories.map((c) => c.key)),
    labelUsers(admin.updatedBy ? [admin.updatedBy] : []),
  ]);
  const by = admin.updatedBy ? labels.get(admin.updatedBy)?.fullName : null;
  const section = (id: string) => {
    const s = AQLAM_SECTIONS.find((x) => x.id === id);
    if (!s) throw new Error(`قسم إعدادات ناقص: ${id}`);
    return s;
  };

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-6 py-12">
      <DashboardPageHeader title="أقلام الرحلة — الإعدادات" />

      <p className="text-sm font-medium text-slate-500">
        كل قسم بيتحفظ لوحده ويتطبّق فورًا في القاعدة والموقع. «رجوع للافتراضي» بيرجّع القسم ده بس.
        {admin.updatedAt && (
          <>
            {' '}
            آخر تعديل: {formatDate(admin.updatedAt)}
            {by ? ` · ${by}` : ''}.
          </>
        )}
      </p>

      <nav aria-label="أقسام الإعدادات" className="flex flex-wrap gap-2">
        {INDEX.map((i) => (
          <a
            key={i.id}
            href={`#${i.id}`}
            className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
          >
            {i.label}
          </a>
        ))}
      </nav>

      <SectionCard
        id="mode"
        title="وضع التشغيل"
        description="الإيقاف الطارئ والتجربة والإطلاق العام. قايمة التجربة بتتدار من «الحسابات»."
      >
        <ActionForm action={saveAqlamSettings} successMessage="اتحفظت الحالة." className="space-y-6">
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
      </SectionCard>

      <ScalarSection section={section('features')} config={config} />
      <ScalarSection section={section('limits-daily')} config={config} />
      <ScalarSection section={section('limits-content')} config={config} />
      <ScalarSection section={section('moderation')} config={config} />
      <BlockedWordsEditor words={admin.blockedWords} />
      <ScalarSection section={section('filters')} config={config} extra={<FilterChoices config={config} />} />
      <CategoriesEditor config={config} counts={counts} />
      <ReactionsEditor config={config} />
      <ReportReasonsEditor config={config} />
      <ScalarSection section={section('featured')} config={config} />
      <ScalarSection section={section('texts')} config={config} />
      <ScalarSection section={section('admin')} config={config} />
    </div>
  );
}
