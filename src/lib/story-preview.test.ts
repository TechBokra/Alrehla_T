import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PREVIEW_NOTE_MAX,
  awaitingCount,
  latestPerItem,
  noteProblem,
  paragraphsOf,
  previewState,
  type PreviewRow,
} from './story-preview';

function row(over: Partial<PreviewRow> = {}): PreviewRow {
  return {
    projectId: 'p1',
    orderItemId: 'i1',
    productId: 'prod1',
    projectStatus: 'client_text_approval',
    versionId: 'v1',
    versionNo: 1,
    body: 'كان في ولد اسمه يوسف.',
    versionStatus: 'editor_approved',
    sentAt: '2026-10-18T10:00:00Z',
    decisionAt: null,
    decisionNote: null,
    decidedByMe: false,
    ...over,
  };
}

describe('previewState', () => {
  it('المعتمدة من المحرّر = مستنية قراره، وهي الوحيدة', () => {
    expect(previewState(row()).kind).toBe('awaiting');
    expect(previewState(row({ versionStatus: 'client_approved' })).kind).toBe('approved');
    expect(previewState(row({ versionStatus: 'changes_requested' })).kind).toBe('changes');
    expect(previewState(row({ versionStatus: 'superseded' })).kind).toBe('superseded');
  });

  /**
   * ⚠️ الحالة المجهولة لازم **ماتطلّعش زرار قرار**: أهون إننا
   *    مانعرضش زرار من إننا نعرضه على حاجة مش فاهمينها.
   */
  it('الحالة المجهولة مش بتطلّع زرار', () => {
    for (const s of ['draft', 'weird_new_state', '']) {
      expect(previewState(row({ versionStatus: s })).kind, s).not.toBe('awaiting');
    }
  });

  it('كل حالة ليها عنوان ونص بالعربي', () => {
    for (const s of ['editor_approved', 'client_approved', 'changes_requested', 'superseded']) {
      const st = previewState(row({ versionStatus: s }));
      expect(st.title.length, s).toBeGreaterThan(3);
      expect(st.text.length, s).toBeGreaterThan(20);
      expect(st.title, s).not.toMatch(/[A-Za-z_]{3}/);
    }
  });

  it('المستنية بتقول إن الرسم مابيبدأش قبل موافقته', () => {
    expect(previewState(row()).text).toContain('الرسم مابيبدأش');
  });
});

describe('latestPerItem', () => {
  it('أحدث نسخة لكل بند — القاعدة بترتّب تنازليًا', () => {
    const rows = [
      row({ orderItemId: 'a', versionId: 'a2', versionNo: 2 }),
      row({ orderItemId: 'a', versionId: 'a1', versionNo: 1 }),
      row({ orderItemId: 'b', versionId: 'b1', versionNo: 1 }),
    ];
    expect(latestPerItem(rows).map((r) => r.versionId)).toEqual(['a2', 'b1']);
  });

  it('الفاضي بيرجع فاضي', () => {
    expect(latestPerItem([])).toEqual([]);
  });
});

describe('awaitingCount', () => {
  it('بيعدّ المستنية بس', () => {
    expect(
      awaitingCount([
        row(),
        row({ orderItemId: 'b', versionStatus: 'client_approved' }),
        row({ orderItemId: 'c', versionStatus: 'changes_requested' }),
      ]),
    ).toBe(1);
  });
});

describe('noteProblem', () => {
  it('الفاضي والقصير بيترفضوا برسايل مختلفة', () => {
    expect(noteProblem('')).toContain('اكتب عايز نعدّل إيه');
    expect(noteProblem('   ')).toContain('اكتب عايز نعدّل إيه');
    expect(noteProblem('لأ')).toContain('قصيرة');
  });

  it('الوصف المعقول بيعدّي', () => {
    expect(noteProblem('اسم البطلة غلط، اسمها نور مش نورا')).toBeNull();
  });

  it('الأطول من الحد بيترفض — نفس حد القاعدة', () => {
    expect(noteProblem('ا'.repeat(PREVIEW_NOTE_MAX))).toBeNull();
    expect(noteProblem('ا'.repeat(PREVIEW_NOTE_MAX + 1))).toContain('أطول');
  });

  it('كل الرسايل عربية ومفيدة', () => {
    for (const v of ['', 'لأ', 'ا'.repeat(600)]) {
      const msg = noteProblem(v) ?? '';
      expect(msg).not.toMatch(/[A-Za-z_]{3}/);
      expect(msg.length).toBeGreaterThan(15);
    }
  });
});

describe('paragraphsOf', () => {
  it('بيفصل الفقرات على السطر الفاضي', () => {
    expect(paragraphsOf('فقرة أولى\n\nفقرة تانية')).toEqual(['فقرة أولى', 'فقرة تانية']);
  });

  it('بيتجاهل الأسطر الفاضية الزايدة', () => {
    expect(paragraphsOf('\n\n أ \n\n\n ب \n\n')).toEqual(['أ', 'ب']);
  });

  it('النص الفاضي بيرجع قايمة فاضية — والشاشة بتقول «وصل فاضي»', () => {
    expect(paragraphsOf('')).toEqual([]);
    expect(paragraphsOf('   \n\n  ')).toEqual([]);
  });
});

/**
 * ── السلسلة موصّلة ─────────────────────────────────────────
 *
 * ⚠️ الميزة دي قيمتها كلها في إن **ولي الأمر يوصلها**. لو
 *    السطر في قايمة الطلبات اتشال، الصفحة تفضل شغّالة ومحدش
 *    يدخلها — والطلب يقف وإحنا فاكرين إننا بنيّنا الميزة.
 */
describe('السلسلة موصّلة من أول اللوحة لآخر قرار العميل', () => {
  const read = (rel: string) =>
    readFileSync(new URL(rel, import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('شاشة الاستوديو فيها زرار «ابعتها لولي الأمر»', () => {
    const src = read('../app/(admin)/dashboard/admin/studio/[id]/panels.tsx');
    expect(src).toMatch(/action=\{sendVersionToClient\}/);
    expect(src).toContain('sentToClientAt');
  });

  it('قايمة الطلبات فيها رابط المعاينة لما يكون فيه نص مستني', () => {
    const src = read('../app/(client)/account/orders/enha-lak/page.tsx');
    expect(src).toMatch(/countAwaitingPreviews\s*\(/);
    expect(src).toContain('/preview');
  });

  /**
   * ⚠️ والخريطة التالتة للحالات اللي كانت هنا لازم تفضل مشيلة:
   *    كانت بتقول `preparing: warning` بعد ما `order-status.ts`
   *    اتكتب عشان يقفل بالظبط العطل ده.
   */
  it('قايمة الطلبات بتاخد الحالات من المصدر الواحد', () => {
    const src = read('../app/(client)/account/orders/enha-lak/page.tsx');
    expect(src).toMatch(/productOrderStatus\s*\(/);
    expect(src).not.toMatch(/const ORDER_STATUS\b/);
  });

  it('صفحة المعاينة بتقرا بالدالة مش باستعلام على الجدول', () => {
    const src = read('../data/domains/(client)/story-preview/queries.ts');
    expect(src).toMatch(/rpc\(\s*'my_story_previews'/);
    expect(src).not.toMatch(/from\(\s*'story_versions'\s*\)/);
  });

  it('الأكشن بينادي دالة القاعدة، والملاحظة بتتفحص قبلها', () => {
    const src = read('../actions/story-preview.ts');
    expect(src).toMatch(/rpc\(\s*'story_preview_decide'/);
    expect(src).toMatch(/noteProblem\s*\(/);
    expect(src).toMatch(/rpc\(\s*'story_version_send_to_client'/);
  });

  it('ملف الترحيل بيضيف فرع المشتري وما بيمسحش حاجة', () => {
    const sql = readFileSync(
      new URL('../../supabase/migrations/20261018150000_story_preview_and_client_approval.sql', import.meta.url),
      'utf8',
    );
    expect(sql).toContain('v_is_buyer');
    expect(sql).toContain('story_project_buyer');
    expect(sql).toContain('my_story_previews');
    // ولي الأمر مايقدرش يوافق على نسخة مااتبعتتش له.
    expect(sql).toContain('مااتبعتتلكش للمعاينة');
    expect(sql).not.toMatch(/\b(drop table|delete from|truncate)\b/i);
  });

  /**
   * ⚠️ إشعار المعاينة **مقفول**: إيقافه بيوقّف الطلب في السكوت
   *    (الرسم مابيبدأش، وولي الأمر مش عارف إن فيه حاجة مستنيّاه).
   */
  it('إشعار المعاينة مش قابل للإيقاف من اللوحة', () => {
    const src = readFileSync(new URL('./notification-events.ts', import.meta.url), 'utf8');
    const block = src.slice(src.indexOf("key: 'story_preview'"));
    expect(block.slice(0, 700)).toContain('locked: true');
  });
});
