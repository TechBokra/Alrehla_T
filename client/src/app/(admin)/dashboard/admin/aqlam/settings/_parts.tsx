import React from 'react';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { Checkbox, Field, FormActions, Select, SubmitButton, TextArea, TextInput } from '@/components/forms/Form';
import { saveAqlamConfigSection } from '@/actions/aqlam';
import { getAtPath, type AqlamConfig, type AqlamField, type AqlamSection } from '@/lib/aqlam/config';

const arNum = (n: number) => n.toLocaleString('ar-EG');

/** كارت قسم: عنوان ووصف وبعده النموذج. الـ`id` هو مرساة الفهرس. */
export function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
      <header className="space-y-1">
        <h2 id={`${id}-h`} className="text-xl font-black text-slate-800">
          {title}
        </h2>
        {description && <p className="text-sm leading-relaxed font-medium text-slate-500">{description}</p>}
      </header>
      {children}
    </section>
  );
}

/** أزرار آخر القسم: حفظ + رجوع للافتراضي (من غير فحص الخانات). */
export function SaveRow({ resetLabel = 'رجوع للافتراضي' }: { resetLabel?: string }) {
  return (
    <FormActions>
      <button
        type="submit"
        name="intent"
        value="reset"
        formNoValidate
        className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none"
      >
        {resetLabel}
      </button>
      <SubmitButton name="intent" value="save">
        حفظ القسم
      </SubmitButton>
    </FormActions>
  );
}

/** خانة واحدة من سجل الخانات، بقيمتها الحالية. */
export function FieldInput({ field, config }: { field: AqlamField; config: AqlamConfig }) {
  const value = getAtPath(config, field.path);
  switch (field.kind) {
    case 'bool':
      return <Checkbox name={field.path} label={field.label} hint={field.hint} defaultChecked={value === true} />;
    case 'int':
      return (
        <Field
          label={field.label}
          name={field.path}
          hint={
            <>
              {field.hint && <span className="block">{field.hint}</span>}
              <span className="block">
                من {arNum(field.min)} إلى {arNum(field.max)}
                {field.unit ? ` ${field.unit}` : ''}
              </span>
            </>
          }
        >
          <TextInput
            type="number"
            inputMode="numeric"
            min={field.min}
            max={field.max}
            step={1}
            dir="ltr"
            defaultValue={Number(value)}
            className="max-w-[10rem] text-left"
          />
        </Field>
      );
    case 'enum':
      return (
        <Field label={field.label} name={field.path} hint={field.hint}>
          <Select defaultValue={String(value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    case 'text':
      return (
        <Field
          label={field.label}
          name={field.path}
          hint={
            <>
              {field.hint && <span className="block">{field.hint}</span>}
              <span className="block">حتى {arNum(field.maxLen)} حرف</span>
            </>
          }
        >
          {field.multiline ? (
            <TextArea rows={field.maxLen > 300 ? 5 : 3} maxLength={field.maxLen} defaultValue={String(value)} />
          ) : (
            <TextInput maxLength={field.maxLen} defaultValue={String(value)} />
          )}
        </Field>
      );
  }
}

/** قسم عادي من السجل: كل خاناته + حفظ/رجوع. `extra` بيتحط قبل الأزرار (قوايم خاصة). */
export function ScalarSection({
  section,
  config,
  extra,
}: {
  section: AqlamSection;
  config: AqlamConfig;
  extra?: React.ReactNode;
}) {
  const checks = section.fields.filter((f) => f.kind === 'bool');
  const others = section.fields.filter((f) => f.kind !== 'bool');
  return (
    <SectionCard id={section.id} title={section.title} description={section.description}>
      <ActionForm action={saveAqlamConfigSection} successMessage="اتحفظ القسم." className="space-y-6">
        <input type="hidden" name="section" value={section.id} />
        {others.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2">
            {others.map((f) => (
              <FieldInput key={f.path} field={f} config={config} />
            ))}
          </div>
        )}
        {checks.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {checks.map((f) => (
              <FieldInput key={f.path} field={f} config={config} />
            ))}
          </div>
        )}
        {extra}
        <SaveRow />
      </ActionForm>
    </SectionCard>
  );
}
