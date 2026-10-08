'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth-guard';
import { logAuditAction } from '@/lib/audit';
import { cairoWallClockToUtc } from '@/lib/timezone';
import {
  isDiscountLine,
  isValidDiscountCode,
  normalizeDiscountCode,
  type DiscountLine,
} from '@/lib/discount-codes';

/**
 * أكواد الخصم (ملف 13).
 *
 * ⚠️ **الخصم نفسه بيتحسب في القاعدة** وقت الطلب (`create_customer_order`
 *    وأخواتها). اللي هنا: الإدارة بتعمل الأكواد، والعميل بيسأل «الكود
 *    ده ينفع؟» قبل ما يطلب — والإجابة للعرض بس.
 *
 * وكل الدوال بترجّع ولا بترمي (قاعدة «هـ»).
 */

export type DiscountCheck =
  | { ok: true; code: string; percent: number }
  | { ok: false; error: string };

/** العميل كتب كود — ينفع على القسم ده؟ */
export async function checkDiscountCode(code: string, line: DiscountLine): Promise<DiscountCheck> {
  const value = normalizeDiscountCode(code ?? '');
  if (!value) return { ok: false, error: 'اكتب الكود الأول' };
  if (!isValidDiscountCode(value)) return { ok: false, error: 'كود الخصم ده مش صحيح أو متوقف' };
  if (!isDiscountLine(line)) return { ok: false, error: 'قسم غير معروف' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'لازم تسجّل الدخول الأول' };

  const { data, error } = await supabase.rpc('discount_code_check', { p_code: value, p_line: line });
  if (error || !data) {
    console.error('discount_code_check', error);
    return { ok: false, error: 'تعذّر التحقق من الكود — جرّب تاني' };
  }
  const r = data as { ok?: boolean; code?: string; percent?: number; error?: string };
  if (!r.ok || !r.code || !r.percent) return { ok: false, error: r.error ?? 'كود الخصم ده مش صحيح' };
  return { ok: true, code: r.code, percent: r.percent };
}

// ── الإدارة ─────────────────────────────────────────────────

export type DiscountCodeInput = {
  id?: string;
  code: string;
  percent: number;
  /** فاضية = كل المنصة. */
  lines: string[];
  /** `YYYY-MM-DD` أو فاضي. البداية من أول اليوم والنهاية آخره (بتوقيت القاهرة). */
  startsOn: string;
  endsOn: string;
  /** فاضي = من غير حد. */
  maxUses: string;
  note: string;
  isActive: boolean;
};

export type DiscountCodeResult = { ok: true } | { ok: false; error: string; field?: string };

const fail = (error: string, field?: string): DiscountCodeResult => ({ ok: false, error, field });

async function requireFinanceAdmin() {
  try {
    return await requireAdmin('canManageFinance', 'غير مصرح لك بإدارة أكواد الخصم');
  } catch {
    return null;
  }
}

/**
 * `2026-10-08` ← أول اليوم (00:00) أو آخره (23:59) **بساعة القاهرة**،
 * صيفي أو شتوي (`cairoWallClockToUtc`). `'bad'` = تاريخ غلط.
 */
function cairoDay(day: string, end: boolean): string | null {
  if (!day) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return 'bad';
  const at = cairoWallClockToUtc({
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: end ? 23 : 0,
    minute: end ? 59 : 0,
  });
  if (Number.isNaN(at.getTime())) return 'bad';
  // آخر دقيقة كاملة: 23:59:59.
  return new Date(at.getTime() + (end ? 59_000 : 0)).toISOString();
}

export async function saveDiscountCode(input: DiscountCodeInput): Promise<DiscountCodeResult> {
  const admin = await requireFinanceAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أكواد الخصم');

  const code = normalizeDiscountCode(input.code ?? '');
  if (!isValidDiscountCode(code)) {
    return fail('الكود من ٣ لـ٣٠ حرف: حروف إنجليزي وأرقام و- و_ بس', 'code');
  }
  const percent = Math.trunc(Number(input.percent));
  if (!Number.isFinite(percent) || percent < 1 || percent > 90) {
    return fail('نسبة الخصم من ١ لـ٩٠٪', 'percent');
  }
  const lines = (input.lines ?? []).filter(isDiscountLine);

  const startsAt = cairoDay(input.startsOn?.trim() ?? '', false);
  const endsAt = cairoDay(input.endsOn?.trim() ?? '', true);
  if (startsAt === 'bad') return fail('تاريخ البداية غير صحيح', 'startsOn');
  if (endsAt === 'bad') return fail('تاريخ النهاية غير صحيح', 'endsOn');
  if (startsAt && endsAt && endsAt <= startsAt) {
    return fail('تاريخ النهاية لازم يكون بعد البداية', 'endsOn');
  }

  let maxUses: number | null = null;
  if (input.maxUses?.trim()) {
    maxUses = Math.trunc(Number(input.maxUses));
    if (!Number.isFinite(maxUses) || maxUses < 1) {
      return fail('عدد الاستخدامات رقم من ١ وطالع — أو سيبه فاضي من غير حد', 'maxUses');
    }
  }
  const note = input.note?.trim() || null;
  if (note && note.length > 300) return fail('الملاحظة أطول من ٣٠٠ حرف', 'note');

  const row = {
    code,
    percent,
    lines: lines.length ? lines : null,
    starts_at: startsAt,
    ends_at: endsAt,
    max_uses: maxUses,
    note,
    is_active: input.isActive,
  };

  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase.from('discount_codes').update(row).eq('id', input.id).select('id')
    : await supabase.from('discount_codes').insert({ ...row, created_by: admin.id }).select('id');

  if (error) {
    if (error.code === '23505') return fail('الكود ده موجود قبل كده — اختار اسم تاني', 'code');
    if (error.code === '42P01') return fail('أكواد الخصم محتاجة ملف القاعدة 13 يتشغّل الأول');
    console.error('saveDiscountCode', error);
    return fail('تعذّر حفظ الكود');
  }
  if (!data || data.length === 0) return fail('الكود ماتحفظش — حدّث الصفحة وجرّب تاني');

  await logAuditAction({
    actorProfileId: admin.id,
    action: input.id ? 'discount_code_updated' : 'discount_code_created',
    entityType: 'discount_code',
    entityId: data[0].id,
    metadata: { code, percent, lines: row.lines, maxUses },
  });
  revalidatePath('/dashboard/admin/finance/discount-codes');
  return { ok: true };
}

export async function setDiscountCodeActive(id: string, isActive: boolean): Promise<DiscountCodeResult> {
  const admin = await requireFinanceAdmin();
  if (!admin) return fail('غير مصرح لك بإدارة أكواد الخصم');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('discount_codes')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('id, is_active');
  if (error || !data || data.length === 0 || data[0].is_active !== isActive) {
    console.error('setDiscountCodeActive', error);
    return fail('تعذّر تغيير حالة الكود');
  }
  await logAuditAction({
    actorProfileId: admin.id,
    action: isActive ? 'discount_code_enabled' : 'discount_code_disabled',
    entityType: 'discount_code',
    entityId: id,
  });
  revalidatePath('/dashboard/admin/finance/discount-codes');
  return { ok: true };
}
