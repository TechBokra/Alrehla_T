import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * الصفحات العامة بتتحدّث من مكان واحد (`lib/revalidate`).
 *
 * لو عملية كتبت `revalidatePath('/enha-lak/...')` بإيدها، رجعنا للمشكلة
 * القديمة: قايمة صفحات بتتنسي، وزائر يشوف سعر قديم. الاختبار ده بيفشل
 * لو حد عمل كده.
 *
 * الاستثناء: صفحات الدفع (الشراء والحجز) — بتتبني لكل عميل، وتحديث
 * الموقع كله مع كل طلب كان هيمسح التخزين المؤقت مع كل عملية شراء.
 */
const DIRS = ['src/actions', 'src/app/actions'];
const ALLOWED = new Set(["'/enha-lak/checkout'", "'/creative-writing/booking/confirm'"]);

describe('تحديث الصفحات العامة من مكان واحد', () => {
  it('مفيش عملية بتحدّث صفحة عامة بإيدها', () => {
    const offenders: string[] = [];
    for (const dir of DIRS) {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
        const text = readFileSync(join(dir, file), 'utf8');
        for (const m of text.matchAll(/revalidatePath\(\s*(['`"])([^'`"]*)\1/g)) {
          const path = m[2];
          if (path.startsWith('/dashboard') || path.startsWith('/account') || path.startsWith('/notifications')) continue;
          if (ALLOWED.has(`'${path}'`)) continue;
          offenders.push(`${dir}/${file}: ${path}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
