import { describe, it, expect } from 'vitest';
import { AQLAM_GENERIC_ERROR, aqlamErrorMessage, parseRpcResult } from './errors';

describe('رسائل الأخطاء', () => {
  it('كود معروف ← رسالة عربي', () => {
    expect(aqlamErrorMessage('rate_limited')).toContain('اليومي');
  });

  it('كود مش معروف ← رسالة عامة، مش نص القاعدة', () => {
    expect(aqlamErrorMessage('PGRST301')).toBe(AQLAM_GENERIC_ERROR);
    expect(aqlamErrorMessage(undefined)).toBe(AQLAM_GENERIC_ERROR);
  });

  it('رد ناجح', () => {
    expect(parseRpcResult({ ok: true, id: 'x' })).toEqual({ ok: true, data: { ok: true, id: 'x' } });
  });

  it('رد فاشل بكود', () => {
    const r = parseRpcResult({ ok: false, error: 'contact_info' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.code).toBe('contact_info');
  });

  it('رد مش مفهوم ← فشل بدل ما يتعدّى كنجاح', () => {
    expect(parseRpcResult(null).ok).toBe(false);
    expect(parseRpcResult('ok').ok).toBe(false);
    expect(parseRpcResult([]).ok).toBe(false);
    expect(parseRpcResult({ ok: 'true' }).ok).toBe(false);
  });

  it('أكواد الدفعة التانية ليها رسائل عربي مش العامة', () => {
    for (const code of ['not_editable', 'pen_name_required', 'too_young']) {
      expect(aqlamErrorMessage(code)).not.toBe(AQLAM_GENERIC_ERROR);
    }
  });

  it('أكواد طلب ولي الأمر ليها رسائل عربي', () => {
    for (const code of ['needs_admin_request', 'reason_required', 'already_pending', 'already_locked', 'note_required']) {
      expect(aqlamErrorMessage(code)).not.toBe(AQLAM_GENERIC_ERROR);
    }
  });

  it('أكواد التثبيت ليها رسائل عربي', () => {
    for (const code of ['pin_limit', 'not_published', 'not_pinned']) {
      expect(aqlamErrorMessage(code)).not.toBe(AQLAM_GENERIC_ERROR);
    }
  });
});
