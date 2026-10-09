import { describe, it, expect } from 'vitest';
import {
  autoDeleteDate,
  normalizeCleanupDays,
  normalizeLedger,
  normalizeMediaCleanup,
  planCleanup,
} from '@/lib/media-cleanup';

const now = new Date('2026-10-30T00:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

describe('المسح التلقائي للصور المتسابة', () => {
  it('الصورة الجديدة في السجل بتبدأ النهارده ومابتتمسحش', () => {
    const r = planCleanup({ orphanIds: ['alrehla/a'], ledger: {}, days: 30, now });
    expect(r.ledger['alrehla/a']).toBe(now.toISOString());
    expect(r.due).toEqual([]);
  });

  it('⚠️ بتتحسب من أول يوم اتسابت فيه، مش من يوم رفعها', () => {
    // اتسابت من ١٠ أيام بس — مهما كان عمرها على Cloudinary.
    const r = planCleanup({ orphanIds: ['alrehla/a'], ledger: { 'alrehla/a': daysAgo(10) }, days: 30, now });
    expect(r.due).toEqual([]);
  });

  it('عدّى عليها المدة = تتمسح، والأقدم الأول، وبالحد الأقصى', () => {
    const r = planCleanup({
      orphanIds: ['alrehla/a', 'alrehla/b', 'alrehla/c'],
      ledger: { 'alrehla/a': daysAgo(31), 'alrehla/b': daysAgo(60), 'alrehla/c': daysAgo(45) },
      days: 30,
      now,
      max: 2,
    });
    expect(r.due).toEqual(['alrehla/b', 'alrehla/c']);
  });

  it('صورة رجعت تتستخدم بتخرج من السجل والعدّاد بيتصفّر', () => {
    const first = planCleanup({ orphanIds: [], ledger: { 'alrehla/a': daysAgo(29) }, days: 30, now });
    expect(first.ledger).toEqual({});
    const again = planCleanup({ orphanIds: ['alrehla/a'], ledger: first.ledger, days: 30, now });
    expect(again.ledger['alrehla/a']).toBe(now.toISOString());
    expect(again.due).toEqual([]);
  });

  it('الإعدادات: شغّال افتراضيًّا، والمدة بين ٧ و٣٦٥', () => {
    expect(normalizeMediaCleanup(undefined)).toEqual({ enabled: true, days: 30 });
    expect(normalizeMediaCleanup({ enabled: false, days: 14 })).toEqual({ enabled: false, days: 14 });
    expect(normalizeCleanupDays(2)).toBe(30);
    expect(normalizeCleanupDays(9999)).toBe(30);
    expect(normalizeCleanupDays('abc')).toBe(30);
  });

  it('السجل البايظ بيتنضّف، ويوم المسح بيتحسب', () => {
    expect(normalizeLedger({ a: 'x', b: daysAgo(1), c: 5 })).toEqual({ b: daysAgo(1) });
    expect(normalizeLedger([1, 2])).toEqual({});
    expect(autoDeleteDate(daysAgo(10), 30)?.toISOString()).toBe(new Date(now.getTime() + 20 * 86400000).toISOString());
    expect(autoDeleteDate(undefined, 30)).toBeNull();
  });
});
