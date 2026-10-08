import { describe, it, expect } from 'vitest';
import { chunks, fetchAllPages, fetchIn } from './fetch-all';

describe('fetchAllPages', () => {
  const rows = Array.from({ length: 2500 }, (_, i) => i);
  const page = (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null });

  it('بيقرا كل الصفوف مهما زادت عن ١٠٠٠', async () => {
    const { data, error } = await fetchAllPages(page);
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data[2499]).toBe(2499);
  });

  it('عدد مضبوط على حجم الدفعة بيقف صح', async () => {
    const { data } = await fetchAllPages((f, t) => Promise.resolve({ data: rows.slice(0, 2000).slice(f, t + 1), error: null }));
    expect(data).toHaveLength(2000);
  });

  it('الخطأ بيرجع ومابيعلّقش', async () => {
    const { error } = await fetchAllPages(() => Promise.resolve({ data: null, error: { message: 'x' } }));
    expect(error).toEqual({ message: 'x' });
  });
});

describe('chunks / fetchIn', () => {
  it('بيقسّم ويشيل المكرر', () => {
    expect(chunks([1, 2, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunks([], 2)).toEqual([]);
  });

  it('بيجمّع كل الدفعات', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => i);
    const seen: number[] = [];
    const out = await fetchIn(ids, (part) => {
      seen.push(part.length);
      return Promise.resolve({ data: part.map((x) => ({ x })), error: null });
    });
    expect(out).toHaveLength(250);
    expect(seen).toEqual([100, 100, 50]);
  });
});
