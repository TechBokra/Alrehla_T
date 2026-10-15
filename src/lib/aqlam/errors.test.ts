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
});
