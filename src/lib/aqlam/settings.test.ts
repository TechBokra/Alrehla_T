import { describe, it, expect } from 'vitest';
import {
  aqlamAllowsUser,
  aqlamNavVisible,
  aqlamReadable,
  normalizeAqlamSettings,
} from './settings';

describe('إعدادات أقلام الرحلة', () => {
  it('الافتراضي مقفول — صف فاضي أو قيمة غلط', () => {
    expect(normalizeAqlamSettings(undefined).mode).toBe('off');
    expect(normalizeAqlamSettings({}).mode).toBe('off');
    expect(normalizeAqlamSettings({ aqlamMode: 'yes' }).mode).toBe('off');
  });

  it('القايمة المسموحة بتتنضّف', () => {
    const s = normalizeAqlamSettings({ aqlamMode: 'pilot', aqlamAllowlist: ['a', '', 3, null, 'b'] });
    expect(s).toEqual({ mode: 'pilot', allowlist: ['a', 'b'] });
  });

  it('مقفول: لا قراءة ولا رابط ولا نشر', () => {
    const s = normalizeAqlamSettings({ aqlamMode: 'off', aqlamAllowlist: ['a'] });
    expect(aqlamReadable(s)).toBe(false);
    expect(aqlamNavVisible(s)).toBe(false);
    expect(aqlamAllowsUser(s, 'a')).toBe(false);
  });

  it('تجريبي: قراءة بالرابط، من غير رابط في القائمة، والنشر للمسموحين', () => {
    const s = normalizeAqlamSettings({ aqlamMode: 'pilot', aqlamAllowlist: ['a'] });
    expect(aqlamReadable(s)).toBe(true);
    expect(aqlamNavVisible(s)).toBe(false);
    expect(aqlamAllowsUser(s, 'a')).toBe(true);
    expect(aqlamAllowsUser(s, 'b')).toBe(false);
    expect(aqlamAllowsUser(s, null)).toBe(false);
  });

  it('عام: الكل', () => {
    const s = normalizeAqlamSettings({ aqlamMode: 'public' });
    expect(aqlamReadable(s)).toBe(true);
    expect(aqlamNavVisible(s)).toBe(true);
    expect(aqlamAllowsUser(s, 'x')).toBe(true);
  });
});
