import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WORK_GROUPS, WORK_LINES, WORK_LINE_STAGES, groupOfLine } from '@/lib/work-tasks';
import { blogPlanLate, blogPlanProblem, nextBlogPlanStatus, previousBlogPlanStatus } from '@/lib/blog-plan';
import { certificateViewable, paperRequestProblem, participantNameProblem } from '@/lib/certificates';

describe('مجالات «مهامي» الجديدة (٧ نوفمبر)', () => {
  it('كل مسار في منظومة واحدة بالظبط', () => {
    const seen = WORK_GROUPS.flatMap((g) => g.lines);
    expect([...seen].sort()).toEqual([...WORK_LINES].sort());
    expect(new Set(seen).size).toBe(seen.length);
    expect(groupOfLine('channels')).toBe('contact');
    expect(groupOfLine('certificates')).toBe('courses');
  });

  it('المسارات الجديدة مالهاش مراجعة دفع', () => {
    for (const l of ['support', 'channels', 'join', 'blog', 'certificates'] as const) {
      expect(WORK_LINE_STAGES[l]).toEqual(['fulfilment']);
    }
  });

  it('قيد القاعدة فيه نفس المسارات اللي في الكود', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20261107100000_work_lines_support_join_channels.sql'),
      'utf8',
    );
    const m = sql.match(/work_tasks_line CHECK \(line = ANY \(ARRAY\[([\s\S]*?)\]\)\)/);
    expect(m).not.toBeNull();
    const inDb = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    expect(inDb).toEqual([...WORK_LINES].sort());
  });
});

describe('خطة المدونة', () => {
  it('المراحل بالترتيب', () => {
    expect(nextBlogPlanStatus('writing')).toBe('review');
    expect(nextBlogPlanStatus('publishing')).toBe('done');
    expect(nextBlogPlanStatus('done')).toBeNull();
    expect(previousBlogPlanStatus('review')).toBe('writing');
    expect(previousBlogPlanStatus('writing')).toBeNull();
  });

  it('فحص الإدخال', () => {
    expect(blogPlanProblem({ title: 'اب', notes: '', plannedFor: '' })?.field).toBe('title');
    expect(blogPlanProblem({ title: 'عنوان كويس', notes: '', plannedFor: '7/11' })?.field).toBe('plannedFor');
    expect(blogPlanProblem({ title: 'عنوان كويس', notes: '', plannedFor: '2026-11-20' })).toBeNull();
  });

  it('المتأخر = الميعاد عدّى والبند شغّال', () => {
    expect(blogPlanLate({ status: 'review', plannedFor: '2026-11-01' }, '2026-11-07')).toBe(true);
    expect(blogPlanLate({ status: 'done', plannedFor: '2026-11-01' }, '2026-11-07')).toBe(false);
    expect(blogPlanLate({ status: 'writing', plannedFor: null }, '2026-11-07')).toBe(false);
  });
});

describe('شهادات الإتمام', () => {
  it('الرقمية بتتفتح من أول الإصدار', () => {
    expect(certificateViewable('pending')).toBe(false);
    expect(certificateViewable('issued')).toBe(true);
    expect(certificateViewable('shipped')).toBe(true);
  });

  it('بيانات الشحن', () => {
    const ok = {
      recipientName: 'منى',
      recipientPhone: '0100 123 4567',
      addressLine: '12 شارع النصر',
      city: 'مدينة نصر',
      governorate: 'القاهرة',
      notes: '',
    };
    expect(paperRequestProblem(ok)).toBeNull();
    expect(paperRequestProblem({ ...ok, recipientPhone: '123' })?.field).toBe('recipientPhone');
    expect(paperRequestProblem({ ...ok, addressLine: 'x' })?.field).toBe('addressLine');
  });

  it('اسم المشارك', () => {
    expect(participantNameProblem(' ي ')).not.toBeNull();
    expect(participantNameProblem('يوسف أحمد')).toBeNull();
  });
});
