import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateIncident } from './incidents';

describe('validateIncident', () => {
  it('⚠️ سلامة الطفل دايمًا عاجل حتى لو اتختار عادي', () => {
    const r = validateIncident({ category: 'child_safety', severity: 'normal', description: 'الطفل قال حاجة مقلقة' });
    expect(r).toMatchObject({ ok: true, severity: 'urgent' });
  });

  it('المشكلة التقنية بتفضل عادي إلا لو اتعلّم عاجل', () => {
    expect(validateIncident({ category: 'technical', severity: 'normal', description: 'الصوت قاطع طول الجلسة' })).toMatchObject({
      severity: 'normal',
    });
    expect(validateIncident({ category: 'technical', severity: 'urgent', description: 'الصوت قاطع طول الجلسة' })).toMatchObject({
      severity: 'urgent',
    });
  });

  it('نوع غير معروف أو وصف قصير = بيترفض بالخانة', () => {
    expect(validateIncident({ category: 'x', severity: 'normal', description: 'كلام كفاية هنا' })).toMatchObject({
      ok: false,
      field: 'category',
    });
    expect(validateIncident({ category: 'other', severity: 'normal', description: 'قصير' })).toMatchObject({
      ok: false,
      field: 'description',
    });
  });
});

describe('الحماية في القاعدة', () => {
  const sql = readFileSync(
    new URL('../../supabase/migrations/20261024100000_session_incidents.sql', import.meta.url),
    'utf8',
  );
  it('مفيش حد يقدر يمسح بلاغ', () => {
    expect(sql).toMatch(/revoke delete, truncate on public\.session_incidents/);
    expect(sql).not.toMatch(/for delete/);
  });
  it('المُبلّغ مايقدرش يفتح البلاغ بحالة غير «جديد»', () => {
    expect(sql).toMatch(/and status = 'open'/);
  });
});
