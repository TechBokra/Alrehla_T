import Link from 'next/link';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { DecisionButton } from '@/components/forms/DecisionButton';
import {
  Checkbox,
  Field,
  FormActions,
  Select,
  SubmitButton,
  TextArea,
  TextInput,
} from '@/components/forms/Form';
import { StatusBadge } from '@/components/StatusBadge';
import type {
  StudioCost,
  StudioPage,
  StudioProjectDetail,
  StudioStaff,
  StudioVersion,
} from '@/data/domains/(admin)/studio/queries';
import {
  addStudioCost,
  addStudioVersion,
  approveStudioCharacter,
  approveStudioVersion,
  assignStudioProject,
  deleteStudioPage,
  sendVersionToClient,
  recordClientDecision,
  recordPhotoConsent,
  reviewStudioPage,
  saveStudioBrief,
  saveStudioCharacter,
  saveStudioPage,
  saveStudioQa,
} from '@/actions/studio';
import { AGE_BANDS } from '@/lib/age-bands';
import { formatDate } from '@/lib/utils';
import {
  COST_KIND_LABELS,
  COST_KINDS,
  FACE_MODE_LABELS,
  PAGE_STATUS_LABELS,
  PAGE_STATUS_TONES,
  PAGE_TARGET_MAX,
  PAGE_TARGET_MIN,
  VERSION_SOURCE_LABELS,
  VERSION_STATUS_LABELS,
  VERSION_STATUS_TONES,
  qaItemsFor,
  type PageStatus,
  type VersionStatus,
} from '@/lib/studio';

const card = 'space-y-4 rounded-3xl border border-slate-200 bg-white p-5';
const h3 = 'text-lg font-black text-slate-800';

function Hidden({ projectId }: { projectId: string }) {
  return <input type="hidden" name="projectId" value={projectId} />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">{children}</p>;
}

/** مفتاح brief → اسم عربي لو معروف، وإلا المفتاح نفسه. */
const BRIEF_LABELS: Record<string, string> = {
  childName: 'اسم الطفل',
  childAge: 'العمر',
  age: 'العمر',
  gender: 'النوع',
  interests: 'الاهتمامات',
  theme: 'الموضوع',
  topic: 'الموضوع',
  message: 'الرسالة المطلوبة',
  dedication: 'الإهداء',
  notes: 'ملاحظات',
};

function briefValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.slice(0, 1000);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v).slice(0, 1000);
  } catch {
    return '';
  }
}

// ── بيانات المشروع ───────────────────────────────────────────────────────────

export function BriefPanel({
  project,
  staff,
  canManage,
  orderHref,
}: {
  project: StudioProjectDetail;
  staff: StudioStaff[];
  canManage: boolean;
  orderHref: string | null;
}) {
  const entries = Object.entries(project.brief).filter(
    ([k, v]) => k !== 'childPhoto' && briefValue(v) !== '',
  );
  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="brief-h">
        <h3 id="brief-h" className={h3}>
          طلب العميل
        </h3>
        {entries.length === 0 ? (
          <Empty>مفيش بيانات مخصّصة محفوظة على الطلب.</Empty>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            {entries.map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-slate-50 p-3">
                <dt className="text-xs font-bold text-slate-500">{BRIEF_LABELS[k] ?? k}</dt>
                <dd className="text-sm font-medium whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">
                  {briefValue(v)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs font-medium text-slate-500">
          صورة الطفل مش منسوخة هنا — بتتقرا من الطلب نفسه
          {orderHref ? (
            <>
              {' '}
              (<Link href={orderHref} className="underline">فتح الطلب</Link>)
            </>
          ) : (
            ' (محتاجة صلاحية الطلبات)'
          )}
          .
        </p>
      </section>

      <section className={card} aria-labelledby="meta-h">
        <h3 id="meta-h" className={h3}>
          مواصفات القصة
        </h3>
        <ActionForm action={saveStudioBrief} successMessage="اتحفظت." className="space-y-4">
          <Hidden projectId={project.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="الفئة العمرية" name="ageBand">
              <Select name="ageBand" defaultValue={project.ageBand ?? ''}>
                <option value="">غير محددة</option>
                {AGE_BANDS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="عدد الصفحات المستهدف" name="pageTarget" hint={`من ${PAGE_TARGET_MIN} إلى ${PAGE_TARGET_MAX}`}>
              <TextInput name="pageTarget" type="number" min={PAGE_TARGET_MIN} max={PAGE_TARGET_MAX} defaultValue={project.pageTarget ?? ''} />
            </Field>
            <Field label="شكل الوجه" name="faceMode" required>
              <Select name="faceMode" defaultValue={project.faceMode}>
                {Object.entries(FACE_MODE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Checkbox
            name="sensitiveTopic"
            defaultChecked={project.sensitiveTopic}
            label="موضوع حسّاس (نفسي/أسري)"
            hint="بيضيف مراجعة متخصص إجبارية في فحص الجودة قبل التسليم."
          />
          <FormActions>
            <SubmitButton>حفظ</SubmitButton>
          </FormActions>
        </ActionForm>
      </section>

      {project.faceMode === 'real' && (
        <section className={card} aria-labelledby="consent-h">
          <h3 id="consent-h" className={h3}>
            موافقة ولي الأمر على استخدام الصورة
          </h3>
          {project.photoConsentAt ? (
            <div className="space-y-1 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
              <p className="font-black">اتسجّلت الموافقة في {formatDate(project.photoConsentAt)}</p>
              {project.photoConsentNote && <p className="[overflow-wrap:anywhere]">{project.photoConsentNote}</p>}
            </div>
          ) : (
            <ActionForm action={recordPhotoConsent} successMessage="اتسجّلت الموافقة." className="space-y-4">
              <Hidden projectId={project.id} />
              <Field label="إزاي ومتى ولي الأمر وافق؟" name="note" required hint="مثلًا: رسالة واتساب بتاريخ كذا. الوجه الحقيقي مايتقبلش من غير موافقة.">
                <TextArea name="note" rows={2} maxLength={1000} />
              </Field>
              <FormActions>
                <SubmitButton>تسجيل الموافقة</SubmitButton>
              </FormActions>
            </ActionForm>
          )}
        </section>
      )}

      {canManage && (
        <section className={card} aria-labelledby="assign-h">
          <h3 id="assign-h" className={h3}>
            التوزيع والموعد
          </h3>
          {staff.length === 0 && (
            <p className="rounded-2xl bg-amber-50 p-3 text-xs font-bold text-amber-900">
              مفيش موظفين ظاهرين للتعيين. أضف الأدوار (محرر قصص / مشرف فني) للمستخدمين من إدارة المستخدمين.
            </p>
          )}
          <ActionForm action={assignStudioProject} successMessage="اتحفظ التوزيع." className="space-y-4">
            <Hidden projectId={project.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="المحرّر" name="editorId">
                <Select name="editorId" defaultValue={project.editorId ?? ''}>
                  <option value="">غير معيّن</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="المشرف الفني" name="artLeadId">
                <Select name="artLeadId" defaultValue={project.artLeadId ?? ''}>
                  <option value="">غير معيّن</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="موعد التسليم" name="dueAt">
                <TextInput name="dueAt" type="date" defaultValue={project.dueAt ? project.dueAt.slice(0, 10) : ''} />
              </Field>
            </div>
            <FormActions>
              <SubmitButton>حفظ التوزيع</SubmitButton>
            </FormActions>
          </ActionForm>
        </section>
      )}
    </div>
  );
}

// ── النص ─────────────────────────────────────────────────────────────────────

export function TextPanel({
  project,
  versions,
  writing,
  clientStage,
}: {
  project: StudioProjectDetail;
  versions: StudioVersion[];
  /** المرحلة الحالية بتسمح بكتابة النص (قدرة «text» في سير العمل). */
  writing: boolean;
  /** بعد المرحلة دي مباشرة بتشترط موافقة العميل — فهنا بيتسجّل قراره. */
  clientStage: boolean;
}) {
  return (
    <div className="space-y-6">
      {writing && (
        <section className={card} aria-labelledby="new-version">
          <h3 id="new-version" className={h3}>
            نسخة جديدة من النص
          </h3>
          <ActionForm action={addStudioVersion} successMessage="اتحفظت النسخة." className="space-y-4">
            <Hidden projectId={project.id} />
            <Field label="نص القصة" name="body" required>
              <TextArea name="body" rows={12} maxLength={100000} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="مصدر المسودة" name="source">
                <Select name="source" defaultValue="editor">
                  <option value="editor">{VERSION_SOURCE_LABELS.editor}</option>
                  <option value="ai">{VERSION_SOURCE_LABELS.ai}</option>
                </Select>
              </Field>
              <Field label="ملاحظة (اختياري)" name="note">
                <TextInput name="note" maxLength={2000} />
              </Field>
            </div>
            <FormActions>
              <SubmitButton>حفظ كنسخة جديدة</SubmitButton>
            </FormActions>
          </ActionForm>
        </section>
      )}

      <section className="space-y-4" aria-labelledby="versions-h">
        <h3 id="versions-h" className={h3}>
          النسخ ({versions.length.toLocaleString('ar-EG')})
        </h3>
        {versions.length === 0 ? (
          <Empty>لسه مفيش نسخة نص.</Empty>
        ) : (
          <ul className="space-y-4">
            {versions.map((v) => {
              const status = (v.status in VERSION_STATUS_LABELS ? v.status : 'draft') as VersionStatus;
              return (
                <li key={v.id} className={card}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-slate-900">
                      النسخة {v.versionNo.toLocaleString('ar-EG')} · {VERSION_SOURCE_LABELS[v.source]}
                    </p>
                    <StatusBadge label={VERSION_STATUS_LABELS[status]} type={VERSION_STATUS_TONES[status]} />
                  </div>
                  <p className="text-xs font-medium text-slate-500">
                    {formatDate(v.createdAt)}
                    {v.note ? ` · ${v.note}` : ''}
                  </p>
                  <div className="max-h-80 overflow-y-auto rounded-2xl bg-slate-50 p-4 text-sm leading-loose font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                    {v.body}
                  </div>
                  {v.clientDecisionAt && (
                    <p className="rounded-2xl bg-slate-50 p-3 text-xs font-medium text-slate-600">
                      قرار العميل ({formatDate(v.clientDecisionAt)}): {v.clientDecisionNote ?? '—'}
                    </p>
                  )}

                  {v.sentToClientAt && (
                    <p className="rounded-2xl bg-sky-50 p-3 text-xs font-bold text-sky-900">
                      اتبعتت لولي الأمر {formatDate(v.sentToClientAt)}
                      {v.clientDecisionAt ? '' : ' — مستنيين قراره'}
                    </p>
                  )}

                  {status === 'draft' && writing && (
                    <ActionForm action={approveStudioVersion} successMessage="اتعتمد النص." className="flex justify-end">
                      <Hidden projectId={project.id} />
                      <input type="hidden" name="versionId" value={v.id} />
                      <SubmitButton pendingLabel="جارٍ الاعتماد…">اعتماد كمحرّر</SubmitButton>
                    </ActionForm>
                  )}

                  {/* ══ ابعتها لولي الأمر ═══════════════════════
                      ⚠️ **الخطوة دي ما كانتش موجودة خالص.** اعتماد
                         المحرّر كان بيخلّي النسخة «جاهزة» ومحدش
                         بيقول لولي الأمر — فالفريق كان بيكلّمه
                         على الواتساب، أو بيحطّ العلامة بنفسه
                         وخلاص. ولي الأمر دافع ٨٥٠ جنيه وما شافش
                         نص قصة ابنه. */}
                  {status === 'editor_approved' && clientStage && !v.sentToClientAt && (
                    <ActionForm
                      action={sendVersionToClient}
                      successMessage="اتبعتت لولي الأمر، ووصله إشعار."
                      className="space-y-3"
                    >
                      <Hidden projectId={project.id} />
                      <input type="hidden" name="versionId" value={v.id} />
                      <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
                        ولي الأمر هيشوف النص في «طلباتي» ويوافق أو يطلب تعديل بنفسه.
                        والرسم مش هيفتح قبل موافقته.
                      </p>
                      <FormActions>
                        <SubmitButton pendingLabel="جارٍ الإرسال…">ابعتها لولي الأمر</SubmitButton>
                      </FormActions>
                    </ActionForm>
                  )}

                  {/* ══ التسجيل بالنيابة ════════════════════════
                      ⚠️ **بقى الطريق التاني مش الأول.** القرار
                         المفروض يجي من حساب ولي الأمر؛ ده
                         للحالات اللي بيرد فيها على التليفون أو
                         الواتساب. والحارس في القاعدة بيطلب تكتب
                         إزاي ومتى — عشان «وافق العميل» ماتبقاش
                         علامة بلا أثر. */}
                  {status === 'editor_approved' && clientStage && (
                      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <summary className="cursor-pointer text-xs font-bold text-slate-600">
                          سجّل قراره بالنيابة (رد على تليفون أو واتساب)
                        </summary>
                        <ActionForm action={recordClientDecision} successMessage="اتسجّل القرار." className="mt-3 space-y-3">
                        <Hidden projectId={project.id} />
                        <input type="hidden" name="versionId" value={v.id} />
                        <Field
                          label="قرار العميل — إزاي ومتى؟"
                          name="note"
                          hint="إلزامي مع الموافقة (مثلًا: واتساب بتاريخ كذا). مع طلب التعديل اكتب المطلوب."
                        >
                          <TextArea name="note" rows={2} maxLength={1000} />
                        </Field>
                        <FormActions>
                          <DecisionButton name="decision" value="changes" variant="secondary" pendingLabel="جارٍ التسجيل…">
                            العميل طلب تعديل
                          </DecisionButton>
                          <DecisionButton name="decision" value="approve" pendingLabel="جارٍ التسجيل…">
                            العميل وافق
                          </DecisionButton>
                        </FormActions>
                        </ActionForm>
                      </details>
                    )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── الشخصية ──────────────────────────────────────────────────────────────────

export function CharacterPanel({ project }: { project: StudioProjectDetail }) {
  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="char-h">
        <h3 id="char-h" className={h3}>
          مرجع الشخصية
        </h3>
        {project.characterApprovedAt && (
          <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-900">
            اتعتمد في {formatDate(project.characterApprovedAt)}
          </p>
        )}
        <ActionForm action={saveStudioCharacter} successMessage="اتحفظ." className="space-y-4">
          <Hidden projectId={project.id} />
          <Field label="وصف الشخصية (الملامح، الملابس، الألوان)" name="characterNotes">
            <TextArea name="characterNotes" rows={6} maxLength={4000} defaultValue={project.characterNotes ?? ''} />
          </Field>
          <Field
            label="رابط صورة المرجع"
            name="characterRefUrl"
            hint="رابط https، ويفضّل رابط Cloudinary (غيره ممكن مايظهرش في المعاينة). رفع الملفات من هنا لسه مش متاح."
          >
            <TextInput name="characterRefUrl" type="url" dir="ltr" maxLength={500} defaultValue={project.characterRefUrl ?? ''} />
          </Field>
          <FormActions>
            <SubmitButton>حفظ</SubmitButton>
          </FormActions>
        </ActionForm>
        {project.characterRefUrl && (
          <img
            src={project.characterRefUrl}
            alt="مرجع الشخصية"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="max-h-80 rounded-2xl border border-slate-200 object-contain"
          />
        )}
        {!project.characterApprovedAt && (
          <ActionForm action={approveStudioCharacter} successMessage="اتعتمد المرجع." className="flex justify-end">
            <Hidden projectId={project.id} />
            <SubmitButton pendingLabel="جارٍ الاعتماد…">اعتماد المرجع</SubmitButton>
          </ActionForm>
        )}
      </section>
    </div>
  );
}

// ── الصفحات ──────────────────────────────────────────────────────────────────

export function PagesPanel({
  project,
  pages,
  canManage,
  art,
}: {
  project: StudioProjectDetail;
  pages: StudioPage[];
  canManage: boolean;
  /** المرحلة الحالية بتسمح بتجهيز الصفحات (قدرة «pages» في سير العمل). */
  art: boolean;
}) {
  const nextNo = pages.length === 0 ? 0 : Math.max(...pages.map((p) => p.pageNo)) + 1;
  const approvedCount = pages.filter((p) => p.status === 'approved').length;
  return (
    <div className="space-y-6">
      <p className="text-sm font-bold text-slate-600">
        {approvedCount.toLocaleString('ar-EG')} من {pages.length.toLocaleString('ar-EG')} صفحة معتمدة
        {project.pageTarget ? ` · المستهدف ${project.pageTarget.toLocaleString('ar-EG')}` : ''}
      </p>

      {art && (
        <section className={card} aria-labelledby="page-new">
          <h3 id="page-new" className={h3}>
            إضافة / تعديل صفحة
          </h3>
          <ActionForm action={saveStudioPage} successMessage="اتحفظت الصفحة." className="space-y-4">
            <Hidden projectId={project.id} />
            <Field label="رقم الصفحة (٠ = الغلاف)" name="pageNo" required hint="لو الرقم موجود بتتعدّل الصفحة.">
              <TextInput name="pageNo" type="number" min={0} max={99} defaultValue={nextNo} />
            </Field>
            <Field label="نص الصفحة" name="pageText">
              <TextArea name="pageText" rows={3} maxLength={4000} />
            </Field>
            <Field label="وصف المشهد" name="sceneDescription">
              <TextArea name="sceneDescription" rows={3} maxLength={4000} />
            </Field>
            <Field label="رابط صورة الصفحة" name="imageUrl" hint="رابط https (يفضّل Cloudinary). الصفحة بتبقى «مجهّزة» لما النص والمشهد والصورة يكتملوا.">
              <TextInput name="imageUrl" type="url" dir="ltr" maxLength={500} />
            </Field>
            <FormActions>
              <SubmitButton>حفظ الصفحة</SubmitButton>
            </FormActions>
          </ActionForm>
        </section>
      )}

      {pages.length === 0 ? (
        <Empty>لسه مفيش صفحات.</Empty>
      ) : (
        <ul className="space-y-4">
          {pages.map((p) => {
            const status = (p.status in PAGE_STATUS_LABELS ? p.status : 'pending') as PageStatus;
            return (
              <li key={p.id} className={card}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-slate-900">
                    {p.pageNo === 0 ? 'الغلاف' : `صفحة ${p.pageNo.toLocaleString('ar-EG')}`}
                    {p.attempts > 0 ? ` · محاولات الإعادة: ${p.attempts.toLocaleString('ar-EG')}` : ''}
                  </p>
                  <StatusBadge label={PAGE_STATUS_LABELS[status]} type={PAGE_STATUS_TONES[status]} />
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                  <div className="space-y-2 text-sm font-medium text-slate-700 [overflow-wrap:anywhere]">
                    {p.pageText && <p className="whitespace-pre-wrap">{p.pageText}</p>}
                    {p.sceneDescription && (
                      <p className="rounded-xl bg-slate-50 p-3 text-xs whitespace-pre-wrap text-slate-600">
                        المشهد: {p.sceneDescription}
                      </p>
                    )}
                    {p.reviewerNote && <p className="text-xs font-bold text-rose-700">ملاحظة المراجع: {p.reviewerNote}</p>}
                  </div>
                  {p.imageUrl && (
                              <img
                      src={p.imageUrl}
                      alt={p.pageNo === 0 ? 'الغلاف' : `صفحة ${p.pageNo}`}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="max-h-48 w-full rounded-xl border border-slate-200 object-contain"
                    />
                  )}
                </div>
                {art && (status === 'drafted' || status === 'approved') && (
                  <ActionForm action={reviewStudioPage} successMessage="اتسجّلت المراجعة." className="space-y-3">
                    <Hidden projectId={project.id} />
                    <input type="hidden" name="pageId" value={p.id} />
                    <Field label="ملاحظة المراجعة (إلزامية مع الإعادة)" name="reviewerNote">
                      <TextInput name="reviewerNote" maxLength={1000} defaultValue={p.reviewerNote ?? ''} />
                    </Field>
                    <FormActions>
                      <DecisionButton name="decision" value="needs_redo" variant="secondary" pendingLabel="جارٍ التسجيل…">
                        إعادة الصفحة
                      </DecisionButton>
                      {status === 'drafted' && (
                        <DecisionButton name="decision" value="approved" pendingLabel="جارٍ الاعتماد…">
                          اعتماد الصفحة
                        </DecisionButton>
                      )}
                    </FormActions>
                  </ActionForm>
                )}
                {status === 'needs_redo' && art && (
                  <p className="text-xs font-bold text-slate-500">عدّل الصفحة من النموذج فوق (نفس الرقم) وهتبقى «مجهّزة» تاني.</p>
                )}
                {canManage && (
                  <ActionForm action={deleteStudioPage} successMessage="اتحذفت." className="flex justify-end">
                    <Hidden projectId={project.id} />
                    <input type="hidden" name="pageId" value={p.id} />
                    <SubmitButton className="!bg-white !text-rose-700 border border-rose-200 !shadow-none hover:!bg-rose-50" pendingLabel="جارٍ الحذف…">
                      حذف الصفحة
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── فحص الجودة ───────────────────────────────────────────────────────────────

export function QaPanel({ project, canManage }: { project: StudioProjectDetail; canManage: boolean }) {
  const items = qaItemsFor(project.sensitiveTopic);
  return (
    <section className={card} aria-labelledby="qa-h">
      <h3 id="qa-h" className={h3}>
        قايمة فحص الجودة
      </h3>
      {project.qaPassedAt && (
        <p className="rounded-2xl bg-emerald-50 p-3 text-sm font-black text-emerald-900">
          اجتاز الفحص في {formatDate(project.qaPassedAt)}
        </p>
      )}
      {canManage ? (
        <ActionForm action={saveStudioQa} successMessage="اتحفظت القايمة." className="space-y-3">
          <Hidden projectId={project.id} />
          {items.map((i) => (
            <Checkbox key={i.key} name={i.key} label={i.label} defaultChecked={project.qaChecklist[i.key] === true} />
          ))}
          <p className="text-xs font-medium text-slate-500">
            كل البنود إلزامية قبل «جاهز للتسليم». الفحص النهائي لمسؤول الإنتاج بس.
          </p>
          <FormActions>
            <SubmitButton>حفظ القايمة</SubmitButton>
          </FormActions>
        </ActionForm>
      ) : (
        <ul className="space-y-2 text-sm font-medium text-slate-700">
          {items.map((i) => (
            <li key={i.key}>
              {project.qaChecklist[i.key] === true ? '✓' : '○'} {i.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── التكلفة ──────────────────────────────────────────────────────────────────

export function CostsPanel({ project, costs }: { project: StudioProjectDetail; costs: StudioCost[] }) {
  const total = costs.reduce((s, c) => s + c.amount, 0);
  const minutes = costs.reduce((s, c) => s + (c.minutes ?? 0), 0);
  return (
    <div className="space-y-6">
      <section className={card} aria-labelledby="cost-new">
        <h3 id="cost-new" className={h3}>
          تسجيل تكلفة
        </h3>
        <ActionForm action={addStudioCost} successMessage="اتسجّلت." className="space-y-4">
          <Hidden projectId={project.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="النوع" name="kind" required>
              <Select name="kind" defaultValue="tool">
                {COST_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {COST_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="المبلغ" name="amount">
              <TextInput name="amount" type="number" min={0} step="0.01" defaultValue={0} />
            </Field>
            <Field label="دقائق عمل (اختياري)" name="minutes">
              <TextInput name="minutes" type="number" min={0} step={1} />
            </Field>
          </div>
          <Field label="ملاحظة" name="note">
            <TextInput name="note" maxLength={500} />
          </Field>
          <FormActions>
            <SubmitButton>تسجيل</SubmitButton>
          </FormActions>
        </ActionForm>
      </section>

      <section className="space-y-3" aria-labelledby="cost-list">
        <h3 id="cost-list" className={h3}>
          الإجمالي: {total.toLocaleString('ar-EG')} · {minutes.toLocaleString('ar-EG')} دقيقة
        </h3>
        {costs.length === 0 ? (
          <Empty>لسه مفيش تكاليف.</Empty>
        ) : (
          <ul className="space-y-2">
            {costs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                <span>
                  {(COST_KIND_LABELS as Record<string, string>)[c.kind] ?? c.kind}
                  {c.note ? ` — ${c.note}` : ''}
                </span>
                <span className="font-black">
                  {c.amount.toLocaleString('ar-EG')}
                  {c.minutes ? ` · ${c.minutes.toLocaleString('ar-EG')} د` : ''} · {formatDate(c.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
