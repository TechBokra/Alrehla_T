'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { BusyButton, Checkbox, Field, Select, SubmitButton, TextInput } from '@/components/forms/Form';
import { PersonPicker, type PickablePerson } from '@/components/admin/PersonPicker';
import { FormError } from '@/components/ui/FormError';
import { applyStageRule, saveAssignmentRule, saveTaskStep } from '@/actions/work-tasks';
import {
  createStudioStage,
  deleteStudioStage,
  moveStudioStage,
  saveStudioEdges,
  saveStudioStageFlow,
} from '@/actions/studio-flow';
import { TASK_STEP_OWNER_LABELS, type TaskStep, type TaskStepOwner, type WorkLine } from '@/lib/work-tasks';
import {
  ABILITY_LABELS,
  GATE_KEYS,
  GATE_LABELS,
  OWNER_KIND_LABELS,
  flowNext,
  flowProblems,
  type FlowStep,
  type StageAbility,
  type StudioFlow,
} from '@/lib/studio-flow';

/**
 * محرّر سير العمل لنوع واحد — مكان واحد لكل حاجة في المرحلة: الاسم والمهلة والشرح،
 * والمسؤولون عنها (التوزيع)، ولنوع «الاستوديو»: قدراتها وشروط دخولها ومين ينقل منها
 * والانتقالات الاستثنائية، وإضافة/حذف/ترتيب المراحل.
 *
 * ⚠️ كل مرحلة بتتحفظ لوحدها وخطأها بيظهر فوقها. الحارس الحقيقي في القاعدة
 *    (دوال `studio_*` ومحفّز `assignment_rules_valid_trg`)؛ الشاشة بتعرض السبب بس.
 */

const STUDIO_OWNERS: Exclude<TaskStepOwner, 'rule'>[] = ['editor', 'art_lead', 'manager'];

const KIND_LABELS: Record<FlowStep['kind'], string> = {
  start: 'بداية',
  stage: 'مرحلة',
  hold: 'إيقاف',
  done: 'تسليم',
  cancel: 'إلغاء',
};

type Props = {
  line: WorkLine;
  steps: TaskStep[];
  flow?: StudioFlow;
  /** محرك الاستوديو متطبّق في القاعدة؟ (من غيره التدفق للقراءة بس). */
  engine?: boolean;
  /** هيكل الاستوديو (إضافة/حذف/ترتيب/شروط) متاح للمستخدم؟ */
  canStructure?: boolean;
  rules: Record<string, string[]>;
  people: PickablePerson[];
};

/** مفتاح قاعدة التوزيع للمرحلة (العامتين بمفتاحهم، والدقيقة بمفتاحها). */
function ruleKeyOf(step: string): string {
  return step;
}

export function WorkflowEditor({ line, steps, flow, engine = false, canStructure = false, rules, people }: Props) {
  const isStudio = line === 'studio';
  const [notice, setNotice] = useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <p className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">
        مفيش مراحل متسجّلة — محتاج تطبيق migration «مواعيد المهام» على قاعدة البيانات.
      </p>
    );
  }
  if (isStudio && !flow) return null;

  const flowSteps = new Map((flow?.steps ?? []).map((s) => [s.step, s]));
  const problems = isStudio && flow && engine ? flowProblems(flow) : [];
  // كروت الاستوديو: كل المراحل ما عدا التسليم والإلغاء (مالهمش توزيع ولا مهلة).
  const cards = steps.filter((s) => {
    if (!isStudio) return true;
    const k = flowSteps.get(s.step)?.kind;
    return k !== 'done' && k !== 'cancel';
  });

  return (
    <div className="space-y-4">
      {isStudio && !engine && (
        <p role="status" className="rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">
          محرك المراحل لسه ماتطبّقش على قاعدة البيانات (migration «محرك سير العمل والتوزيع الموحّد»). تقدر تعدّل
          الأسماء والمهل والمسؤولين، لكن إضافة المراحل وشروطها وانتقالاتها هتشتغل بعد التطبيق.
        </p>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 rounded-2xl bg-rose-50 p-4 pr-8 text-sm font-bold text-rose-900">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {notice && (
        <p role="status" className="rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
          {notice}
        </p>
      )}

      {isStudio && (
        <ManagersCard rules={rules} people={people} onNotice={setNotice} />
      )}

      <ul className="space-y-3">
        {cards.map((s, i) => (
          <StageCard
            key={s.step}
            line={line}
            step={s}
            fs={flowSteps.get(s.step)}
            flow={flow}
            engine={engine}
            canStructure={canStructure}
            rules={rules}
            people={people}
            first={i === 0}
            last={i === cards.length - 1}
            onNotice={setNotice}
          />
        ))}
      </ul>

      {isStudio && engine && canStructure && flow && <AddStageForm flow={flow} steps={steps} />}
    </div>
  );
}

// ── مسؤولو الإنتاج (القاعدة الافتراضية للاستوديو) ───────────────────────────

function ManagersCard({
  rules,
  people,
  onNotice,
}: {
  rules: Record<string, string[]>;
  people: PickablePerson[];
  onNotice: (m: string | null) => void;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-300 bg-slate-50 p-4" aria-labelledby="mgr-h">
      <div>
        <h3 id="mgr-h" className="font-black text-slate-800">
          مسؤولو الإنتاج (الافتراضي)
        </h3>
        <p className="text-xs font-medium leading-6 text-slate-500">
          بيستلموا أي مرحلة مالهاش مسؤولين مخصوصين، وتحذير إلغاء الطلب، والمشاريع اللي مالهاش محرر/مشرف معيّن. لو
          فاضية: حاملو دور «مسؤول إنتاج القصص».
        </p>
      </div>
      <RulePicker line="studio" stepKey="fulfilment" rules={rules} people={people} onNotice={onNotice} showApply={false} />
    </section>
  );
}

// ── اختيار المسؤولين لمرحلة ─────────────────────────────────────────────────

function RulePicker({
  line,
  stepKey,
  rules,
  people,
  onNotice,
  showApply = true,
}: {
  line: WorkLine;
  stepKey: string;
  rules: Record<string, string[]>;
  people: PickablePerson[];
  onNotice: (m: string | null) => void;
  showApply?: boolean;
}) {
  const router = useRouter();
  const key = `${line}:${ruleKeyOf(stepKey)}`;
  const [chosen, setChosen] = useState<string[]>(rules[key] ?? []);
  const [busy, setBusy] = useState<'save' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const run = async (kind: 'save' | 'apply') => {
    setBusy(kind);
    setError(null);
    setSaved(false);
    onNotice(null);
    try {
      if (kind === 'save') {
        const r = await saveAssignmentRule(line, ruleKeyOf(stepKey), chosen);
        if (!r.ok) setError(r.error);
        else {
          setSaved(true);
          router.refresh();
        }
      } else {
        const r = await applyStageRule(line, stepKey);
        if (!r.ok) setError(r.error);
        else {
          onNotice(
            r.changed
              ? `اتغيّر مسؤول ${r.changed.toLocaleString('ar-EG')} مهمة مفتوحة، والجديد وصله إشعار.`
              : 'مفيش مهام مفتوحة محتاجة تغيير.',
          );
          router.refresh();
        }
      }
    } catch {
      setError('حصل خطأ غير متوقع — جرّب تاني');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <PersonPicker multiple people={people} value={chosen} disabled={busy !== null} onChange={setChosen} />
      {error && <FormError message={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <BusyButton busy={busy === 'save'} disabled={busy !== null} onClick={() => run('save')}>
          حفظ المسؤولين
        </BusyButton>
        {showApply && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run('apply')}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {busy === 'apply' ? 'جارٍ التطبيق…' : 'طبّق على المهام المفتوحة'}
          </button>
        )}
        {saved && <span className="text-sm font-bold text-emerald-700">اتحفظ ✓</span>}
        {chosen.length === 0 && (
          <span className="text-xs font-bold text-amber-700">من غير مسؤول — بيظهر لكل الإدارة</span>
        )}
      </div>
    </div>
  );
}

// ── كارت المرحلة ────────────────────────────────────────────────────────────

function StageCard({
  line,
  step: s,
  fs,
  flow,
  engine,
  canStructure,
  rules,
  people,
  first,
  last,
  onNotice,
}: {
  line: WorkLine;
  step: TaskStep;
  fs?: FlowStep;
  flow?: StudioFlow;
  engine: boolean;
  canStructure: boolean;
  rules: Record<string, string[]>;
  people: PickablePerson[];
  first: boolean;
  last: boolean;
  onNotice: (m: string | null) => void;
}) {
  const isStudio = line === 'studio';
  const generic = s.step === 'payment' || s.step === 'fulfilment';
  const structural = isStudio && engine && fs && (fs.kind === 'start' || fs.kind === 'stage');
  const inactive = fs ? !fs.active : false;

  return (
    <li className={`rounded-2xl border bg-white p-4 ${inactive ? 'border-dashed border-slate-300 opacity-80' : 'border-slate-200'}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span dir="ltr" className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-600">
          {s.step}
        </span>
        <span className="text-base font-black text-slate-900">{s.label}</span>
        {fs && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {KIND_LABELS[fs.kind]}
          </span>
        )}
        {inactive && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">متوقفة</span>}
        {fs && !fs.builtin && <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-900">مضافة</span>}
        {generic && !isStudio && (
          <span className="text-xs font-medium text-slate-500">
            {s.step === 'payment'
              ? 'مهلة ومسؤولو مراجعة الدفع'
              : 'التنفيذ العام — الافتراضي لو حالة الطلب الدقيقة مالهاش مسؤولين ولا مهلة'}
          </span>
        )}
        {structural && canStructure && flow && (
          <StageToolbar step={s.step} first={first} last={last} kind={fs.kind} />
        )}
      </div>

      <div className="space-y-3">
        <Panel title="الاسم والمهلة والشرح" defaultOpen={false}>
          <ActionForm action={saveTaskStep} successMessage="اتحفظت." className="space-y-4">
            <input type="hidden" name="line" value={s.line} />
            <input type="hidden" name="step" value={s.step} />
            <div className={`grid grid-cols-1 gap-4 ${isStudio ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              <Field label="اسم المرحلة" name="label" required className="md:col-span-2">
                <TextInput name="label" defaultValue={s.label} maxLength={60} />
              </Field>
              <Field label="المهلة (ساعات)" name="slaHours" hint="فاضية = من غير موعد">
                <TextInput
                  name="slaHours"
                  inputMode="decimal"
                  dir="ltr"
                  defaultValue={s.slaHours === null ? '' : String(s.slaHours)}
                  placeholder="مثال: 24"
                />
              </Field>
              {isStudio && (
                <Field label="صاحب المرحلة الافتراضي" name="ownerKind" required>
                  <Select name="ownerKind" defaultValue={s.ownerKind === 'rule' ? 'manager' : s.ownerKind}>
                    {STUDIO_OWNERS.map((o) => (
                      <option key={o} value={o}>
                        {TASK_STEP_OWNER_LABELS[o]}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="شرح قصير للمرحلة" name="hint" className="md:col-span-full">
                <TextInput name="hint" defaultValue={s.hint ?? ''} maxLength={300} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {isStudio ? (
                <Checkbox
                  name="showTab"
                  defaultChecked={s.showTab}
                  label="أظهر تبويب المرحلة في صندوق الاستوديو"
                  hint="التبويب اللي فيه مشاريع بيظهر دايمًا حتى لو مخفي."
                />
              ) : (
                <span />
              )}
              <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel title="المسؤولون عن المرحلة" defaultOpen>
          {isStudio && (
            <p className="mb-3 text-xs font-medium leading-6 text-slate-500">
              مين يستلم المشروع لما يدخل المرحلة دي. المحرر/المشرف الفني المعيّن على مشروع بعينه (من صفحته) بيغلب
              القاعدة دي. لو فاضية: مسؤولو الإنتاج. المسؤول هنا بيدخل الاستوديو من غير دور مخصوص.
            </p>
          )}
          {!isStudio && !generic && (
            <p className="mb-3 text-xs font-medium leading-6 text-slate-500">
              لو فاضية: بيرجع لمسؤولي «التنفيذ» العام للنوع ده.
            </p>
          )}
          <RulePicker line={line} stepKey={s.step} rules={rules} people={people} onNotice={onNotice} />
        </Panel>

        {structural && canStructure && flow && fs && (
          <>
            <Panel title="سلوك المرحلة (قدرات · شروط الدخول · مين ينقل)" defaultOpen={false}>
              <BehaviourForm fs={fs} />
            </Panel>
            <Panel title="الانتقالات الاستثنائية (رجوع / قفز)" defaultOpen={false}>
              <EdgesForm fs={fs} flow={flow} />
            </Panel>
          </>
        )}
      </div>
    </li>
  );
}

function Panel({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-slate-200 bg-slate-50/60">
      <summary className="cursor-pointer select-none rounded-xl px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-100">
        {title}
      </summary>
      <div className="border-t border-slate-200 p-4">{children}</div>
    </details>
  );
}

// ── أدوات المرحلة: ترتيب وحذف ───────────────────────────────────────────────

function StageToolbar({ step, first, last, kind }: { step: string; first: boolean; last: boolean; kind: FlowStep['kind'] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'تعذّر التنفيذ');
      else router.refresh();
    });
  };
  const btn =
    'min-h-[36px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40';
  return (
    <span className="ms-auto flex flex-wrap items-center gap-2">
      {kind === 'stage' && (
        <>
          <button type="button" className={btn} disabled={pending || first} onClick={() => run(() => moveStudioStage(step, -1))} aria-label="تحريك لأعلى">
            ↑ لفوق
          </button>
          <button type="button" className={btn} disabled={pending || last} onClick={() => run(() => moveStudioStage(step, 1))} aria-label="تحريك لأسفل">
            ↓ لتحت
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                className="min-h-[36px] rounded-lg bg-rose-700 px-3 text-xs font-bold text-white disabled:opacity-40"
                disabled={pending}
                onClick={() => run(() => deleteStudioStage(step))}
              >
                تأكيد الحذف
              </button>
              <button type="button" className={btn} onClick={() => setConfirming(false)}>
                إلغاء
              </button>
            </>
          ) : (
            <button type="button" className={`${btn} text-rose-800`} disabled={pending} onClick={() => setConfirming(true)}>
              حذف
            </button>
          )}
        </>
      )}
      {error && (
        <span role="alert" className="basis-full text-xs font-bold text-rose-800">
          {error}
        </span>
      )}
    </span>
  );
}

// ── سلوك المرحلة ────────────────────────────────────────────────────────────

function BehaviourForm({ fs }: { fs: FlowStep }) {
  return (
    <ActionForm action={saveStudioStageFlow} successMessage="اتحفظ سلوك المرحلة." className="space-y-5">
      <input type="hidden" name="step" value={fs.step} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-black text-slate-800">الشغل المسموح في المرحلة</legend>
        {(Object.keys(ABILITY_LABELS) as StageAbility[]).map((a) => (
          <Checkbox key={a} name="abilities" value={a} defaultChecked={fs.abilities.includes(a)} label={ABILITY_LABELS[a]} />
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-black text-slate-800">شروط الدخول للمرحلة</legend>
        <p className="text-xs font-medium text-slate-500">
          المشروع مايدخلش المرحلة دي غير لما كل شرط مختار يتحقق (إلا الانتقالات المعلَّمة «بدون شروط»).
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {GATE_KEYS.map((g) => (
            <Checkbox key={g} name="gates" value={g} defaultChecked={fs.gates.includes(g)} label={GATE_LABELS[g]} />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="مين ينقل المشروع من المرحلة دي للي بعدها" name="advanceBy" required>
          <Select name="advanceBy" defaultValue={fs.advanceBy}>
            <option value="owner">صاحب المرحلة (أو مسؤول الإنتاج)</option>
            <option value="manager">مسؤول الإنتاج بس</option>
          </Select>
        </Field>
        {fs.kind === 'stage' && (
          <Checkbox
            name="active"
            defaultChecked={fs.active}
            label="المرحلة فعّالة"
            hint="المرحلة المتوقفة بتتخطّاها الحركة للأمام. ماينفعش توقف مرحلة فيها مشاريع."
            className="self-end"
          />
        )}
        {fs.kind === 'start' && <input type="hidden" name="active" value="on" />}
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ السلوك</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ── الانتقالات الاستثنائية ──────────────────────────────────────────────────

function EdgesForm({ fs, flow }: { fs: FlowStep; flow: StudioFlow }) {
  const next = flowNext(flow, fs.step);
  const mine = new Map(flow.edges.filter((e) => e.from === fs.step).map((e) => [e.to, e]));
  const targets = flow.steps.filter(
    (t) => t.step !== fs.step && t.step !== next && t.active && (t.kind === 'start' || t.kind === 'stage'),
  );
  if (targets.length === 0) {
    return <p className="text-sm font-medium text-slate-500">مفيش مراحل تانية ينفع الانتقال لها.</p>;
  }
  return (
    <ActionForm action={saveStudioEdges} successMessage="اتحفظت الانتقالات." className="space-y-4">
      <input type="hidden" name="from" value={fs.step} />
      <p className="text-xs font-medium leading-6 text-slate-500">
        الحركة «للأمام» للمرحلة التالية، والإيقاف والإلغاء والاستئناف، موجودين دايمًا. هنا بتضيف رجوع أو قفز لمرحلة
        تانية، وتحدد مين ينفّذه وإيه أثره.
      </p>
      <ul className="space-y-2">
        {targets.map((t) => {
          const e = mine.get(t.step);
          return (
            <li key={t.step} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <Checkbox name="edge" value={t.step} defaultChecked={!!e} label={`إلى «${t.label}»`} />
              <div className="grid grid-cols-1 gap-2 pe-8 md:grid-cols-4">
                <Select name={`who:${t.step}`} defaultValue={e?.who ?? 'owner'} aria-label={`مين ينفّذ الانتقال إلى ${t.label}`}>
                  <option value="owner">صاحب المرحلة</option>
                  <option value="manager">مسؤول الإنتاج بس</option>
                </Select>
                <Checkbox name={`skipGates:${t.step}`} defaultChecked={e?.skipGates ?? false} label="بدون شروط" />
                <Checkbox name={`pagesRedo:${t.step}`} defaultChecked={e?.pagesRedo ?? false} label="الصفحات ترجع للمراجعة" />
                <Checkbox name={`resetQa:${t.step}`} defaultChecked={e?.resetQa ?? false} label="تصفير الفحص" />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="جارٍ الحفظ…">حفظ الانتقالات</SubmitButton>
      </div>
    </ActionForm>
  );
}

// ── إضافة مرحلة ─────────────────────────────────────────────────────────────

function AddStageForm({ flow, steps }: { flow: StudioFlow; steps: TaskStep[] }) {
  const labels = new Map(steps.map((s) => [s.step, s.label]));
  const options = flow.steps.filter((s) => s.kind === 'start' || s.kind === 'stage');
  return (
    <section className="space-y-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5" aria-labelledby="add-stage">
      <h3 id="add-stage" className="text-lg font-black text-slate-800">
        إضافة مرحلة جديدة
      </h3>
      <ActionForm action={createStudioStage} successMessage="اتضافت المرحلة." className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="اسم المرحلة" name="label" required className="md:col-span-2">
            <TextInput name="label" maxLength={60} placeholder="مثال: مراجعة قانونية" />
          </Field>
          <Field label="تتحط بعد" name="after" required>
            <Select name="after" defaultValue={options[options.length - 1]?.step}>
              {options.map((o) => (
                <option key={o.step} value={o.step}>
                  {labels.get(o.step) ?? o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="صاحب المرحلة" name="ownerKind" required>
            <Select name="ownerKind" defaultValue="manager">
              {STUDIO_OWNERS.map((o) => (
                <option key={o} value={o}>
                  {OWNER_KIND_LABELS[o]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="المهلة (ساعات)" name="slaHours" hint="فاضية = من غير موعد">
            <TextInput name="slaHours" inputMode="decimal" dir="ltr" placeholder="مثال: 24" />
          </Field>
          <Field label="شرح قصير" name="hint" className="md:col-span-3">
            <TextInput name="hint" maxLength={300} />
          </Field>
        </div>
        <p className="text-xs font-medium leading-6 text-slate-500">
          المرحلة الجديدة بتبدأ من غير قدرات ولا شروط — اضبطها من بطاقتها بعد الإضافة (الشغل المسموح، شروط الدخول،
          مين ينقل منها، والمسؤولين).
        </p>
        <div className="flex justify-end">
          <SubmitButton pendingLabel="جارٍ الإضافة…">إضافة المرحلة</SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}
