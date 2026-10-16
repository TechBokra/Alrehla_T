import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * سجلّ المستحقات واحد: `payouts`.
 *
 * ⚠️ **نظامان متوازيان هما سبب العطل الأصلي.** `instructor_payouts` و
 *    `publisher_payouts` كان فيهم نفس المنطق مكتوب مرتين — فمحفّز
 *    «قفل المستحقات» اتكتب لواحد واتنسى في التاني، ونفس الفلوس بقت
 *    تتسحب أكتر من مرة (20261016130000). وإضافة جدول تالت لمقدّمي
 *    الخدمات كانت هتعمّق نفس المشكلة بدل ما تحلّها.
 *
 *    الاختبار ده بيمنع الرجوع للجدولين القديمين من كود التطبيق.
 *    الجداول نفسها لسه موجودة في القاعدة (فاضية) لحد ما يتشالوا
 *    في ملف منفصل.
 */
const DIRS = ['src/actions', 'src/data', 'src/app', 'src/components'];
const LEGACY = /\.from\(\s*['"](instructor_payouts|publisher_payouts)['"]\s*\)/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) out.push(full);
  }
  return out;
}

describe('سجلّ المستحقات الموحّد', () => {
  it('مفيش كود بيقرا أو يكتب في جدولي المستحقات القديمين', () => {
    const offenders = DIRS.flatMap(walk).filter((f) => LEGACY.test(readFileSync(f, 'utf8')));
    expect(
      offenders,
      'استعمل payouts بـ owner_kind — الجدولان القديمان متروكان',
    ).toEqual([]);
  });

  /**
   * التلاتة لازم يفضلوا متعاملين بنفس الطريقة. لو حد اتضاف لواحد
   * واتنسي في التاني، بنرجع لنفس عطل الصبح.
   */
  it('التلات أنواع متغطّية في طلب السحب', () => {
    const finance = readFileSync('src/actions/finance.ts', 'utf8');
    for (const kind of ['instructor', 'publisher', 'provider']) {
      expect(finance, `النوع ${kind} ناقص في طلب السحب`).toContain(`'${kind}'`);
    }
    const withdrawals = readFileSync('src/actions/withdrawals.ts', 'utf8');
    expect(withdrawals).toContain('provider');
  });
});
