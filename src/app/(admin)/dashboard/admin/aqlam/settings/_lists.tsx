import React from 'react';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, Select, TextArea, TextInput } from '@/components/forms/Form';
import { saveAqlamConfigSection } from '@/actions/aqlam';
import { AGE_BANDS } from '@/lib/age-bands';
import {
  AQLAM_CATEGORY_ICONS,
  AQLAM_ICON_LABELS,
  AQLAM_MAX_CATEGORIES,
  AQLAM_SORT_KEYS,
  AQLAM_SORT_LABELS,
  type AqlamConfig,
} from '@/lib/aqlam/config';
import { SaveRow, SectionCard } from './_parts';

const arNum = (n: number) => n.toLocaleString('ar-EG');

/** الترتيبات وشرايح السن — بتتحفظ مع قسم «فلاتر الصفحة العامة». */
export function FilterChoices({ config }: { config: AqlamConfig }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-bold text-slate-700">الترتيبات المتاحة للزائر</legend>
        {AQLAM_SORT_KEYS.map((k) => (
          <Checkbox key={k} name="sorts" value={k} label={AQLAM_SORT_LABELS[k]} defaultChecked={config.filters.sorts.includes(k)} />
        ))}
        <p className="text-xs font-medium text-slate-500">لازم تفضل واحدة على الأقل، والافتراضي منها.</p>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-bold text-slate-700">شرايح السن في الفلتر</legend>
        {AGE_BANDS.map((b) => (
          <Checkbox
            key={b.id}
            name="ageBands"
            value={b.id}
            label={b.label}
            hint={b.hint}
            defaultChecked={config.filters.ageBands.includes(b.id)}
          />
        ))}
        <p className="text-xs font-medium text-slate-500">لو شلت كلهم، فلتر السن مش هيظهر.</p>
      </fieldset>
    </div>
  );
}

const ROW = 'rounded-2xl border border-slate-200 bg-slate-50 p-4';

/** التصنيفات: تعديل الاسم والأيقونة والترتيب والتفعيل، وإضافة جديد، وحذف اللي مالوش نصوص. */
export function CategoriesEditor({ config, counts }: { config: AqlamConfig; counts: Record<string, number> }) {
  const existing = config.categories;
  const blank = Math.max(0, Math.min(3, AQLAM_MAX_CATEGORIES - existing.length));
  const total = existing.length + blank;
  return (
    <SectionCard
      id="categories"
      title="التصنيفات"
      description={`الأنواع اللي الكاتب بيختار منها والزائر بيفلتر بيها (حتى ${arNum(AQLAM_MAX_CATEGORIES)}). التعطيل بيخفي التصنيف من النشر والفلتر، والنصوص القديمة بتفضل ظاهرة باسمها. الحذف للتصنيف اللي مالوش نصوص بس.`}
    >
      <ActionForm action={saveAqlamConfigSection} successMessage="اتحفظت التصنيفات." className="space-y-4">
        <input type="hidden" name="section" value="categories" />
        <input type="hidden" name="rowCount" value={total} />
        <ul className="space-y-3">
          {existing.map((c, i) => {
            const used = counts[c.key] ?? 0;
            return (
              <li key={c.key} className={ROW}>
                <input type="hidden" name={`cat_key_${i}`} value={c.key} />
                <div className="grid gap-3 sm:grid-cols-[1fr_9rem_5rem]">
                  <Field label={`الاسم (الكود: ${c.key})`} name={`cat_label_${i}`}>
                    <TextInput maxLength={30} defaultValue={c.label} />
                  </Field>
                  <Field label="الأيقونة" name={`cat_icon_${i}`}>
                    <Select defaultValue={c.icon}>
                      {AQLAM_CATEGORY_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {AQLAM_ICON_LABELS[ic]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="الترتيب" name={`cat_order_${i}`}>
                    <TextInput type="number" inputMode="numeric" min={1} max={99} dir="ltr" defaultValue={i + 1} className="text-left" />
                  </Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  <Checkbox name={`cat_enabled_${i}`} label="مفعّل" defaultChecked={c.enabled} />
                  {used === 0 ? (
                    <Checkbox name={`cat_delete_${i}`} label="حذف التصنيف" />
                  ) : (
                    <span className="text-xs font-bold text-slate-500">عليه {arNum(used)} نص — عطّله بدل الحذف</span>
                  )}
                </div>
              </li>
            );
          })}
          {Array.from({ length: blank }, (_, j) => {
            const i = existing.length + j;
            return (
              <li key={`new-${i}`} className={`${ROW} border-dashed bg-white`}>
                <p className="mb-3 text-sm font-black text-slate-600">تصنيف جديد (سيبه فاضي لو مش عايز)</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_9rem_5rem]">
                  <Field label="الكود (إنجليزي صغير)" name={`cat_key_${i}`} hint="مثال: drama — مابيتغيّرش بعد الحفظ.">
                    <TextInput maxLength={24} dir="ltr" className="text-left" placeholder="drama" />
                  </Field>
                  <Field label="الاسم" name={`cat_label_${i}`}>
                    <TextInput maxLength={30} placeholder="دراما" />
                  </Field>
                  <Field label="الأيقونة" name={`cat_icon_${i}`}>
                    <Select defaultValue="pen">
                      {AQLAM_CATEGORY_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {AQLAM_ICON_LABELS[ic]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="الترتيب" name={`cat_order_${i}`}>
                    <TextInput type="number" inputMode="numeric" min={1} max={99} dir="ltr" defaultValue={i + 1} className="text-left" />
                  </Field>
                </div>
                <div className="mt-3">
                  <Checkbox name={`cat_enabled_${i}`} label="مفعّل" defaultChecked />
                </div>
              </li>
            );
          })}
        </ul>
        <SaveRow />
      </ActionForm>
    </SectionCard>
  );
}

/** الملصقات الثلاثة: الاسم والرمز والتفعيل (الأكواد ثابتة). */
export function ReactionsEditor({ config }: { config: AqlamConfig }) {
  return (
    <SectionCard
      id="reactions"
      title="ملصقات التشجيع"
      description="الاسم والرمز اللي بيظهروا للزائر. تعطيل ملصق بيخفيه من الواجهة ويمنع إضافته، وتشجيعات الناس القديمة بتفضل محسوبة."
    >
      <ActionForm action={saveAqlamConfigSection} successMessage="اتحفظت الملصقات." className="space-y-4">
        <input type="hidden" name="section" value="reactions" />
        <ul className="space-y-3">
          {config.reactions.map((r) => (
            <li key={r.key} className={ROW}>
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <Field label="الاسم" name={`rx_label_${r.key}`}>
                  <TextInput maxLength={20} defaultValue={r.label} />
                </Field>
                <Field label="الرمز" name={`rx_emoji_${r.key}`}>
                  <TextInput maxLength={16} defaultValue={r.emoji} className="text-center text-xl" />
                </Field>
              </div>
              <div className="mt-3">
                <Checkbox name={`rx_enabled_${r.key}`} label="مفعّل" defaultChecked={r.enabled} />
              </div>
            </li>
          ))}
        </ul>
        <SaveRow />
      </ActionForm>
    </SectionCard>
  );
}

/** أسباب البلاغ الخمسة: الصياغة والتفعيل. */
export function ReportReasonsEditor({ config }: { config: AqlamConfig }) {
  return (
    <SectionCard
      id="reportReasons"
      title="أسباب البلاغ"
      description="الأسباب اللي بتظهر لمن يبلّغ عن نص أو تعليق. تعطيل سبب بيخفيه من القايمة، والبلاغات القديمة بتفضل بسببها."
    >
      <ActionForm action={saveAqlamConfigSection} successMessage="اتحفظت الأسباب." className="space-y-4">
        <input type="hidden" name="section" value="reportReasons" />
        <ul className="space-y-3">
          {config.reportReasons.map((r) => (
            <li key={r.key} className={`${ROW} grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end`}>
              <Field label="الصياغة" name={`rr_label_${r.key}`}>
                <TextInput maxLength={40} defaultValue={r.label} />
              </Field>
              <Checkbox name={`rr_enabled_${r.key}`} label="مفعّل" defaultChecked={r.enabled} className="pb-3" />
            </li>
          ))}
        </ul>
        <SaveRow />
      </ActionForm>
    </SectionCard>
  );
}

/** الكلمات الممنوعة: سطر لكل كلمة. بتتقرا للإدارة بس ومابتظهرش للزوار. */
export function BlockedWordsEditor({ words }: { words: string[] }) {
  return (
    <SectionCard
      id="blockedWords"
      title="الكلمات الممنوعة"
      description="كلمة أو عبارة في كل سطر (٢–٤٠ حرف، حتى ٣٠٠). المطابقة بتتجاهل التشكيل والتطويل والفروق بين (أ/إ/آ/ا) و(ى/ي). نصوص النشر بتتعامل بحسب خيار «لو النص فيه كلمة ممنوعة» فوق، والتعليقات والنبذة بتترفض دايمًا. القايمة مش بتظهر للزوار، ومش بتتسجّل في سجل التغييرات (عددها بس)."
    >
      <ActionForm action={saveAqlamConfigSection} successMessage="اتحفظت القايمة." className="space-y-4">
        <input type="hidden" name="section" value="blockedWords" />
        <Field label={`القايمة (${arNum(words.length)} كلمة حاليًا)`} name="blockedWords">
          <TextArea rows={8} dir="rtl" defaultValue={words.join('\n')} placeholder={'كلمة\nعبارة ممنوعة'} />
        </Field>
        <SaveRow resetLabel="مسح القايمة" />
      </ActionForm>
    </SectionCard>
  );
}
