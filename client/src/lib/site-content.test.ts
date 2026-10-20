import { describe, it, expect } from 'vitest';
import {
  CONTENT_GROUPS,
  CONTENT_FIELDS,
  CONTENT_DEFAULTS,
} from '@/lib/site-content';
import { SITE_IMAGE_SLOTS, SITE_IMAGE_BY_KEY } from '@/lib/site-images';

/**
 * سلامة سجل المحتوى.
 *
 * الوعد المعلن في شاشة الإدارة: «خانة فارغة تعرض النص الأصلي، ولا يمكن
 * أن يظهر مكان فارغ للزائر». الوعد ده كله متوقف على إن كل خانة لها نص
 * أصلي مكتوب في الكود — لو واحدة اتضافت من غيره، الصفحة هتفضى.
 *
 * الاختبار ده بيمسك الحالة دي وقت البناء بدل ما الزائر يمسكها.
 */
describe('سجل نصوص الموقع', () => {
  it('كل خانة لها نص أصلي غير فارغ', () => {
    const empty = CONTENT_FIELDS.filter((f) => !f.fallback || !f.fallback.trim());
    expect(empty.map((f) => f.key)).toEqual([]);
  });

  it('لا يوجد مفتاح مكرر — التكرار يعني أن خانة تكتب فوق أخرى', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const f of CONTENT_FIELDS) {
      if (seen.has(f.key)) dupes.push(f.key);
      seen.add(f.key);
    }
    expect(dupes).toEqual([]);
  });

  it('كل خانة لها اسم ومكان يظهران للإدارة', () => {
    const nameless = CONTENT_FIELDS.filter((f) => !f.label?.trim());
    expect(nameless.map((f) => f.key)).toEqual([]);
    const homeless = CONTENT_GROUPS.filter((g) => !g.title?.trim() || !g.path?.trim());
    expect(homeless.map((g) => g.id)).toEqual([]);
  });

  it('جدول النصوص الأصلية يغطي كل خانة', () => {
    for (const f of CONTENT_FIELDS) {
      expect(CONTENT_DEFAULTS[f.key]).toBe(f.fallback);
    }
    expect(Object.keys(CONTENT_DEFAULTS)).toHaveLength(CONTENT_FIELDS.length);
  });

  it('كل مسار صفحة يبدأ بشرطة مائلة — الروابط في شاشة الإدارة تعتمد عليه', () => {
    const bad = CONTENT_GROUPS.filter((g) => !g.path.startsWith('/'));
    expect(bad.map((g) => g.path)).toEqual([]);
  });
});

/**
 * سجل صور الموقع.
 *
 * كل خانة صورة بتتحوّل لأمر تحويل على Cloudinary. لو خانة ناقصها العرض
 * أو نوع الضبط، الصورة هتتعرض بمقاسها الأصلي — وده بالظبط اللي كنا
 * بنحاول نمنعه (صورة تتقص أو تطلع بمقاس غلط).
 */
describe('سجل صور الموقع', () => {
  it('كل خانة لها عرض موجب ونوع ضبط معروف', () => {
    for (const slot of SITE_IMAGE_SLOTS) {
      expect(slot.w, `العرض ناقص في ${slot.key}`).toBeGreaterThan(0);
      expect(['pad', 'contain'], `نوع الضبط غير معروف في ${slot.key}`).toContain(
        slot.fit,
      );
    }
  });

  it('نسبة الأبعاد — إن وُجدت — بصيغة «عدد:عدد»', () => {
    for (const slot of SITE_IMAGE_SLOTS) {
      if (slot.ar) expect(slot.ar, slot.key).toMatch(/^\d+(\.\d+)?:\d+(\.\d+)?$/);
    }
  });

  it('لا يوجد مفتاح صورة مكرر', () => {
    const keys = SITE_IMAGE_SLOTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('فهرس البحث السريع يغطي كل خانة', () => {
    for (const slot of SITE_IMAGE_SLOTS) {
      expect(SITE_IMAGE_BY_KEY[slot.key]).toBe(slot);
    }
  });

  it('كل خانة لها اسم ومكان ووصف مقاس يظهر للإدارة', () => {
    for (const slot of SITE_IMAGE_SLOTS) {
      expect(slot.label.trim(), slot.key).not.toBe('');
      expect(slot.location.trim(), slot.key).not.toBe('');
      expect(slot.ratio.trim(), slot.key).not.toBe('');
    }
  });
});
