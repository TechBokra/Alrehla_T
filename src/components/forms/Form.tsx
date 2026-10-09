'use client';

/**
 * ══ مكوّنات النماذج الموحّدة ═══════════════════════════════════
 *
 * كل نماذج اللوحة كانت بتكتب الخانة بإيدها: نفس الـ`className` الطويل
 * متكرّر ٢٢ مرة بشكل وحوالي ١٠ أشكال تانية، و«مطلوب» مش باين، والمساعدة
 * مرة تحت الخانة ومرة جنبها، وزرار الحفظ أحيانًا مالوش حالة تحميل ولا
 * بيعرض خطأ. (ملاحظة تامر: «توحيد النماذج».)
 *
 * دلوقتي خانة = `<Field>` حواليها عنوان، ونجمة لو مطلوبة، وسطر مساعدة،
 * ورسالة الخطأ لو الخادم رجّعها على الخانة دي. والخانات نفسها
 * (`TextInput` …) بنفس الشكل في كل مكان. والزرار `SubmitButton` بيقفل
 * ويكتب «جارٍ الحفظ…» وهو شغّال.
 *
 * بتشتغل جوّه `ActionForm` (اللي بيعرض خطأ الخادم ويمنع الضغطتين).
 * ولو الأكشن رجّع `{ ok: false, error, field: 'price' }` الخانة دي
 * بتتعلّم بالأحمر والمؤشر بيروح عليها.
 */

import React, { useId } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { useFormState } from './FormContext';

/** شكل الخانة الواحد — لو محتاج تستعمله على عنصر خاص (نادرًا). */
export const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 ' +
  'placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
  'disabled:bg-slate-50 disabled:text-slate-500 ' +
  'aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-red-300';

type FieldProps = {
  label: React.ReactNode;
  /** اسم الخانة في النموذج — بيربط رسالة الخطأ اللي راجعة من الخادم بيها. */
  name?: string;
  required?: boolean;
  /** سطر مساعدة تحت الخانة. */
  hint?: React.ReactNode;
  /** خطأ من الشاشة نفسها (غير خطأ الخادم). */
  error?: string;
  className?: string;
  /** الخانة نفسها — بتاخد `id` و`aria-describedby` لوحدها لو هي عنصر واحد. */
  children: React.ReactElement<Record<string, unknown>>;
};

export function Field({ label, name, required, hint, error, className = '', children }: FieldProps) {
  const auto = useId();
  const { errorField, errorMessage } = useFormState();
  const id = (children.props.id as string | undefined) ?? `f${auto}`;
  const hintId = hint ? `${id}-hint` : undefined;
  // ⚠️ (مراجعة م. محمد) خطأ الخادم على الخانة دي بيظهر **تحتها** لوحده —
  //    كانت بتتلوّن أحمر بس والرسالة فوق النموذج، فالمستخدم مش عارف ليه.
  const serverError = name !== undefined && errorField === name ? errorMessage : undefined;
  const shownError = error || serverError;
  const errorId = shownError ? `${id}-error` : undefined;
  const invalid = Boolean(shownError) || (name !== undefined && errorField === name);

  const control = React.cloneElement(children, {
    id,
    ...(name !== undefined && children.props.name === undefined ? { name } : {}),
    ...(required ? { required: true } : {}),
    'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
    'aria-invalid': invalid || undefined,
  });

  return (
    <div className={className} data-field={name}>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">
        {label}
        {required && (
          <span className="mr-1 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {control}
      {hint && (
        <p id={hintId} className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
          {hint}
        </p>
      )}
      {shownError && (
        <p id={errorId} className="mt-2 text-xs font-bold text-red-600">
          {shownError}
        </p>
      )}
    </div>
  );
}

export function TextInput({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" {...props} className={`${fieldClass} ${className}`} />;
}

export function TextArea({ className = '', rows = 3, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} {...props} className={`${fieldClass} ${className}`} />;
}

export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${fieldClass} ${className}`}>
      {children}
    </select>
  );
}

/** خانة صح/غلط — العنوان جنبها، مش فوقها. */
export function Checkbox({
  label,
  hint,
  className = '',
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: React.ReactNode; hint?: React.ReactNode }) {
  const auto = useId();
  const id = props.id ?? `c${auto}`;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          {...props}
          id={id}
          className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="font-bold text-slate-700">{label}</span>
      </label>
      {hint && <p className="mt-1 mr-8 text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
}

/** قسم في النموذج: عنوان ووصف وخانات في شبكة. */
export function FormSection({
  title,
  description,
  columns = 1,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  columns?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
  const grid = columns === 3 ? 'md:grid-cols-3' : columns === 2 ? 'md:grid-cols-2' : '';
  return (
    <section className="space-y-4">
      {(title || description) && (
        <header>
          {title && <h2 className="text-lg font-black text-slate-800">{title}</h2>}
          {description && <p className="mt-1 text-sm font-medium text-slate-500">{description}</p>}
        </header>
      )}
      <div className={`grid grid-cols-1 gap-6 ${grid}`}>{children}</div>
    </section>
  );
}

/**
 * زرار الحفظ — بيقفل ويكتب «جارٍ الحفظ…» وهو شغّال.
 *
 * بيقرا الحالة من `ActionForm`، ولو مش جوّاه من `<form action>` العادي.
 */
export function SubmitButton({
  children,
  pendingLabel = 'جارٍ الحفظ…',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingLabel?: string }) {
  const { busy } = useFormState();
  const { pending } = useFormStatus();
  const working = busy || pending;
  return (
    <button
      type="submit"
      {...props}
      disabled={working || props.disabled}
      aria-busy={working || undefined}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-8 py-3 font-bold text-white shadow-md transition-colors hover:bg-slate-800 disabled:opacity-60 ${className}`}
    >
      {working && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {working ? pendingLabel : children}
    </button>
  );
}

/** سطر الأزرار في آخر النموذج. */
export function FormActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">{children}</div>;
}

/**
 * زرار حفظ للشاشات اللي بتحفظ من غير `<form>` (حالة في الصفحة) —
 * نفس شكل `SubmitButton` ونفس «جارٍ الحفظ…»، والحالة جاية من برّه.
 */
export function BusyButton({
  busy,
  children,
  pendingLabel = 'جارٍ الحفظ…',
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  busy: boolean;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const look =
    variant === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700'
      : variant === 'secondary'
        ? 'border-2 border-slate-200 bg-white text-slate-700 hover:border-slate-400'
        : 'bg-slate-900 text-white shadow-md hover:bg-slate-800';
  return (
    <button
      type="button"
      {...props}
      disabled={busy || props.disabled}
      aria-busy={busy || undefined}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold transition-colors disabled:opacity-60 ${look} ${className}`}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {busy ? pendingLabel : children}
    </button>
  );
}
