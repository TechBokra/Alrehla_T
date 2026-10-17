import React from 'react';
import { ActionForm } from '@/components/dashboard/ActionForm';
import { FormActions, SubmitButton } from '@/components/forms/Form';
import { setAllowlistMember } from '@/actions/aqlam';
import { REPORT_REASONS } from '@/lib/aqlam/post';
import { formatDate } from '@/lib/utils';
import type { AdminPostEdit, AdminUserLabel } from '@/data/domains/(shared)/aqlam/admin';

export const REASON_LABELS: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label]));

export const MODE_OPTIONS = [
  { value: 'off', label: 'مقفول (إيقاف طارئ — محدش يقدر يتفاعل)' },
  { value: 'pilot', label: 'تجريبي (بالرابط فقط، والنشر لقايمة محددة)' },
  { value: 'public', label: 'عام (ظاهر في القائمة ومفهرس بإذن الكاتب)' },
] as const;

export const KIND_LABELS = {
  warning: 'تحذير',
  suspension_7d: 'إيقاف ٧ أيام',
  permanent: 'إيقاف دائم',
} as const;

/** الاسم والبريد بدل رقم الحساب. لو الاسم مش متاح بنرجع للرقم المختصر. */
export function who(id: string | null, labels: Map<string, AdminUserLabel>): { name: string; email: string | null } {
  if (!id) return { name: 'حساب غير معروف', email: null };
  const l = labels.get(id);
  return { name: l?.fullName || `حساب ${id.slice(0, 8)}`, email: l?.email ?? null };
}

export function Person({ id, labels }: { id: string | null; labels: Map<string, AdminUserLabel> }) {
  const { name, email } = who(id, labels);
  return (
    <span className="font-bold text-slate-700">
      {name}
      {email && (
        <span className="mx-1 font-medium text-slate-500" dir="ltr">
          {email}
        </span>
      )}
    </span>
  );
}

/** إضافة/شيل حساب من قايمة التجربة. */
export function AllowlistButton({ userId, op }: { userId: string; op: 'add' | 'remove' }) {
  return (
    <ActionForm action={setAllowlistMember}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="op" value={op} />
      <FormActions>
        <SubmitButton pendingLabel="جارٍ الحفظ…">{op === 'add' ? 'أضف للقايمة' : 'شيل من القايمة'}</SubmitButton>
      </FormActions>
    </ActionForm>
  );
}

/** النسخ القديمة قبل تعديل الكاتب (لو فيه). */
export function PostEdits({ edits }: { edits: AdminPostEdit[] | undefined }) {
  if (!edits || edits.length === 0) return null;
  return (
    <details className="rounded-2xl border border-slate-200 bg-slate-50">
      <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-sm font-bold text-slate-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:outline-none">
        اتعدّل {edits.length.toLocaleString('ar-EG')} مرة · شوف النسخ القديمة
      </summary>
      <ul className="space-y-3 border-t border-slate-200 p-4">
        {edits.map((e) => (
          <li key={e.createdAt} className="space-y-1">
            <p className="text-xs font-bold text-slate-500">قبل تعديل {formatDate(e.createdAt)} · «{e.oldTitle}»</p>
            <div className="max-h-48 overflow-y-auto rounded-xl bg-white p-3 text-sm leading-loose font-medium whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
              {e.oldBody}
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-black text-slate-800">
      {children}
    </h2>
  );
}

