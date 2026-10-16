import Link from 'next/link';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Field, FormActions, Select, SubmitButton } from '@/components/forms/Form';
import { Unauthorized } from '@/components/admin/Unauthorized';
import { getCurrentUser } from '@/data/domains/(shared)/auth/queries';
import {
  STUDIO_ROLE_NAMES,
  getStudioCustomProducts,
  getStudioProductRoutes,
  getStudioReadiness,
  getStudioStages,
} from '@/data/domains/(admin)/studio/queries';
import { ProductRoutesEditor } from '@/components/admin/ProductRoutesEditor';
import { WorkflowEditor } from '@/components/admin/WorkflowEditor';
import { getAdminPeople, getAssignmentRules } from '@/data/domains/(admin)/tasks/queries';
import { backfillStudioProjects, saveStudioMode } from '@/actions/studio';
import { hasAdminPermission } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StudioSettingsPage() {
  const user = await getCurrentUser();
  if (!hasAdminPermission(user, 'canManageStudio')) return <Unauthorized />;
  const [ready, stages, people, rules, products, routes] = await Promise.all([
    getStudioReadiness(),
    getStudioStages(),
    getAdminPeople(),
    getAssignmentRules(),
    getStudioCustomProducts(),
    getStudioProductRoutes(),
  ]);
  const mode = ready.mode;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-10 px-6 py-12">
      <DashboardPageHeader title="إعدادات استوديو القصص" backHref="/dashboard/admin/studio" />

      <section id="stages" aria-labelledby="stages-h" className="space-y-4">
        <h2 id="stages-h" className="text-xl font-black text-slate-800">
          سير العمل — المراحل والمسؤولون
        </h2>
        <div className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm font-medium leading-relaxed text-slate-700">
          <p>
            هنا بتدير هيكل الاستوديو كله من مكان واحد: <strong>المراحل</strong> (إضافة · حذف · ترتيب · إيقاف)،
            و<strong>اسم كل مرحلة ومهلتها وشرحها</strong>، و<strong>المسؤولين عنها</strong>، و<strong>الشغل المسموح
            فيها</strong> (نص / صفحات)، و<strong>شروط الدخول</strong> (موافقة العميل · اعتماد الشخصية · الصفحات · فحص
            الجودة…)، و<strong>مين ينقل منها</strong>، و<strong>الانتقالات الاستثنائية</strong> (رجوع / قفز).
          </p>
          <p>
            الاستوديو مسار من منظومة «إنها لك» في «سير العمل والتوزيع» ({' '}
            <Link href="/dashboard/admin/tasks/workflow?group=enha_lak#track-studio" className="font-bold text-blue-800 underline underline-offset-4">
              نفس الشاشة من هناك
            </Link>
            {' '}). المحفّز في قاعدة البيانات هو اللي بيفرض القواعد دي فعلًا، فمفيش حد يقدر يتخطّاها حتى لو لعب في الرابط.
          </p>
          <p>
            ⚠️ المهلة بتتطبّق على المشاريع اللي بتدخل المرحلة بعد الحفظ. ومرحلة فيها مشاريع ماتتحذفش ولا تتوقف قبل ما
            تنقلهم.
          </p>
        </div>
        {rules === null ? (
          <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
            التوزيع محتاج ملف القاعدة 14 يتشغّل الأول.
          </p>
        ) : (
          <WorkflowEditor
            line="studio"
            steps={stages.steps.map((s) => ({ ...s, line: 'studio' as const }))}
            flow={stages.flow}
            engine={stages.engine}
            canStructure
            rules={rules}
            people={people}
          />
        )}
      </section>

      <section id="product-routes" aria-labelledby="routes-h" className="space-y-4">
        <h2 id="routes-h" className="text-xl font-black text-slate-800">
          تسلسل كل منتج
        </h2>
        <p className="text-sm font-medium leading-relaxed text-slate-600">
          التسلسل العام فوق هو الأصل. هنا كل منتج «قصة مخصّصة» ينفع يمشي على تسلسل مختلف: مرحلة إلزامية أو اختيارية أو
          غير مستخدمة، وشروط دخول تتلغي له (مثلًا منتج من غير موافقة العميل). المنتج اللي مالوش تخصيص بيمشي على العام،
          وأي تعديل في العام بيتطبّق عليه.
        </p>
        <ProductRoutesEditor products={products} routes={routes} flow={stages.flow} />
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

      {/* ── حالة التجهيز: إيه اتطبّق وإيه لسه ── */}
      <details
        aria-labelledby="ready"
        open={
          !ready.tablesReady || ready.staffCount === 0 || ready.backfillPending > 0 || ready.projectCount === 0
        }
        className="rounded-3xl border border-slate-200 bg-white p-5"
      >
        <summary id="ready" className="cursor-pointer text-lg font-black text-slate-800">
          حالة التجهيز
        </summary>
        <ul className="mt-4 space-y-2">
          {[
            {
              ok: ready.tablesReady,
              label: 'جداول الاستوديو في قاعدة البيانات',
              todo: 'طبّق migration استوديو القصص (staging ثم production) — من غيرها مفيش حاجة بتشتغل.',
            },
            {
              ok: ready.rolesFound.length === STUDIO_ROLE_NAMES.length,
              label: `الأدوار الجاهزة (اختيارية) (${ready.rolesFound.length.toLocaleString('ar-EG')} من ${STUDIO_ROLE_NAMES.length.toLocaleString('ar-EG')})`,
              todo: 'بتتضاف مع الـ migration. ينفع تتعدّل من صفحة الصلاحيات. مش شرط: التوزيع على المراحل كفاية.',
            },
            {
              ok: ready.staffCount > 0,
              label: `موظفون للاستوديو — بدور أو بتوزيع على مرحلة (${ready.staffCount.toLocaleString('ar-EG')})`,
              todo: 'وزّع مسؤولين على المراحل من «سير العمل» تحت، أو عيّن مسؤول إنتاج من إدارة المستخدمين.',
            },
            {
              ok: mode === 'on',
              label: 'الاستوديو شغّال',
              todo: 'شغّله من قسم «التشغيل» بعد ما تخلّص الخطوات اللي قبل.',
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
      </details>

      <section aria-labelledby="how" className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-6">
        <h2 id="how" className="text-lg font-black text-slate-800">
          إزاي بيشتغل الفريق
        </h2>
        <ul className="list-disc space-y-2 pr-5 text-sm leading-relaxed font-medium text-slate-700">
          <li>
            <strong>المسؤول عن المرحلة</strong> (من «المسؤولون عن المرحلة» فوق): بيستلم المشروع لما يدخلها، والمهمة بتظهر
            في «مهامي»، وبيشتغل عليها وينقلها للمرحلة التالية لو المرحلة بتسمح لصاحبها بالنقل. مش محتاج دور استوديو
            مخصوص.
          </li>
          <li>
            <strong>الاستثناء على مشروع بعينه:</strong> مسؤول الإنتاج يقدر يعيّن محررًا أو مشرفًا فنيًا على مشروع محدد من
            صفحته، وده بيغلب قاعدة المرحلة لمراحل النص/الرسم بتاعته.
          </li>
          <li>
            <strong>مسؤول إنتاج القصص:</strong> بيدير الهيكل (المراحل والشروط)، ويوزّع المشاريع، ويعمل الفحص النهائي
            والتسليم والإيقاف والإلغاء، وبيشوف التكلفة.
          </li>
          <li>
            الأدوار الجاهزة («محرر قصص» · «مشرف فني» · «مسؤول إنتاج القصص») لسه موجودة لمن يحب يدّيها بالصلاحيات، بس مش
            شرط للتشغيل.
          </li>
        </ul>
      </section>
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

    </div>
  );
}
