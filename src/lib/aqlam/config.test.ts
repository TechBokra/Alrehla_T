import { describe, it, expect } from 'vitest';
import {
  AQLAM_FIELDS,
  DEFAULT_AQLAM_CONFIG,
  categoryMeta,
  enabledCategories,
  enabledReactions,
  enabledReportReasons,
  getAtPath,
  normalizeAqlamConfig,
  parseBlockedWords,
  parseCategories,
  parseFieldValue,
  parseReactions,
  parseReportReasons,
  resolveSort,
  validateConfigRelations,
  visibleAgeBands,
  visibleSorts,
  withValueAt,
  type AqlamConfig,
} from './config';

const D = DEFAULT_AQLAM_CONFIG;

/** كل الخانات «المفردة» في الافتراضي (من غير القوايم). */
function scalarPaths(): string[] {
  const out: string[] = [];
  for (const group of ['limits', 'moderation', 'features', 'filters', 'featured', 'texts', 'admin'] as const) {
    for (const [k, v] of Object.entries(D[group])) {
      if (Array.isArray(v)) continue;
      out.push(`${group}.${k}`);
    }
  }
  return out;
}

describe('سجل الخانات', () => {
  it('كل خانة مفردة في الافتراضي ليها تعريف، ومفيش تعريف زيادة', () => {
    expect(AQLAM_FIELDS.map((f) => f.path).sort()).toEqual(scalarPaths().sort());
  });

  it('مفيش مسار متكرر', () => {
    const paths = AQLAM_FIELDS.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('القيمة الافتراضية لكل خانة داخل حدودها', () => {
    for (const f of AQLAM_FIELDS) {
      const v = getAtPath(D, f.path);
      if (f.kind === 'int') {
        expect(typeof v).toBe('number');
        expect(v as number).toBeGreaterThanOrEqual(f.min);
        expect(v as number).toBeLessThanOrEqual(f.max);
      } else if (f.kind === 'bool') {
        expect(typeof v).toBe('boolean');
      } else if (f.kind === 'enum') {
        expect(f.options.map((o) => o.value)).toContain(v);
      } else {
        expect(typeof v).toBe('string');
        expect((v as string).length).toBeGreaterThanOrEqual(f.minLen);
        expect((v as string).length).toBeLessThanOrEqual(f.maxLen);
      }
    }
  });

  it('الافتراضي = السلوك القديم المعتمد', () => {
    expect(D.limits.postsPerDay).toBe(3);
    expect(D.limits.commentsPerDay).toBe(20);
    expect(D.limits.titleMax).toBe(120);
    expect(D.limits.bodyMin).toBe(20);
    expect(D.limits.bodyMax).toBe(20000);
    expect(D.moderation.reportsToAutoHide).toBe(5);
    expect(D.moderation.removedRetentionDays).toBe(7);
    expect(D.moderation.maxPinned).toBe(6);
    expect(D.moderation.review12Plus).toBe('off');
    expect(D.categories.map((c) => c.key)).toEqual(['story', 'poem', 'reflection', 'article', 'scene']);
    expect(D.reactions.map((r) => r.key)).toEqual(['heart', 'star', 'spark']);
    expect(D.reportReasons.map((r) => r.key)).toEqual(['contact_info', 'inappropriate', 'bullying', 'copied', 'other']);
    expect(D.filters.sorts).toEqual(['new', 'top']);
    expect(D.filters.ageBands).toEqual(['6-9', '10-12', '13-17', '18-20']);
  });
});

describe('قراءة الإعداد المخزّن', () => {
  it('الافتراضي بيرجع نفسه، والقيمة الغلط أو الناقصة بترجع الافتراضي', () => {
    expect(normalizeAqlamConfig(D)).toEqual(D);
    for (const junk of [undefined, null, 'x', 5, [], {}]) {
      expect(normalizeAqlamConfig(junk)).toEqual(D);
    }
  });

  it('رقم برّه الحدود أو مش صحيح ← الافتراضي', () => {
    for (const bad of [0, 51, 2.5, '3', null]) {
      const cfg = normalizeAqlamConfig({ limits: { postsPerDay: bad } });
      expect(cfg.limits.postsPerDay).toBe(3);
    }
    expect(normalizeAqlamConfig({ limits: { postsPerDay: 7 } }).limits.postsPerDay).toBe(7);
  });

  it('صفر مقبول لحد الإخفاء التلقائي (مقفول)', () => {
    expect(normalizeAqlamConfig({ moderation: { reportsToAutoHide: 0 } }).moderation.reportsToAutoHide).toBe(0);
  });

  it('حدود متعارضة ← الافتراضي للاتنين', () => {
    const c = normalizeAqlamConfig({ limits: { bodyMin: 1500, bodyMax: 1000 } });
    expect([c.limits.bodyMin, c.limits.bodyMax]).toEqual([20, 20000]);
    const g = normalizeAqlamConfig({ limits: { guardianReasonMin: 100, guardianReasonMax: 60 } });
    expect([g.limits.guardianReasonMin, g.limits.guardianReasonMax]).toEqual([10, 500]);
  });

  it('قيمة enum مش معروفة ← الافتراضي', () => {
    expect(normalizeAqlamConfig({ moderation: { review12Plus: 'sometimes' } }).moderation.review12Plus).toBe('off');
    expect(normalizeAqlamConfig({ moderation: { review12Plus: 'all' } }).moderation.review12Plus).toBe('all');
  });

  it('التصنيفات: مخصّص بيتحفظ، والمعطوب بيرجع للافتراضي', () => {
    const custom = [
      { key: 'story', label: 'حكاية', icon: 'book', enabled: true },
      { key: 'drama', label: 'دراما', icon: 'star', enabled: false },
    ];
    const c = normalizeAqlamConfig({ categories: custom });
    expect(c.categories).toEqual(custom);
    expect(normalizeAqlamConfig({ categories: [{ key: 'Bad Key', label: 'x', icon: 'pen', enabled: true }] }).categories).toEqual(D.categories);
    expect(normalizeAqlamConfig({ categories: [{ key: 'story', label: 'x', icon: 'pen', enabled: false }] }).categories).toEqual(D.categories);
  });

  it('الترتيب الافتراضي لازم يكون من المفعّل', () => {
    const f = normalizeAqlamConfig({ filters: { sorts: ['top'], defaultSort: 'new' } }).filters;
    expect(f.sorts).toEqual(['top']);
    expect(f.defaultSort).toBe('top');
    expect(normalizeAqlamConfig({ filters: { sorts: [] } }).filters.sorts).toEqual(['new', 'top']);
    expect(normalizeAqlamConfig({ filters: { sorts: ['new', 'new', 'zzz', 'old'] } }).filters.sorts).toEqual(['new', 'old']);
  });

  it('شرايح السن: فاضية مقبولة، والغريبة بتتشال', () => {
    expect(normalizeAqlamConfig({ filters: { ageBands: [] } }).filters.ageBands).toEqual([]);
    expect(normalizeAqlamConfig({ filters: { ageBands: ['13-17', 'x'] } }).filters.ageBands).toEqual(['13-17']);
  });
});

describe('تحقق خانة من النموذج', () => {
  const field = (path: string) => AQLAM_FIELDS.find((f) => f.path === path)!;

  it('رقم', () => {
    const f = field('limits.postsPerDay');
    expect(parseFieldValue(f, '5')).toEqual({ ok: true, value: 5 });
    expect(parseFieldValue(f, ' 5 ')).toEqual({ ok: true, value: 5 });
    for (const bad of ['', '0', '51', '2.5', 'abc', null]) {
      expect(parseFieldValue(f, bad).ok).toBe(false);
    }
  });

  it('صفر مسموح لحد البلاغات التلقائي بس', () => {
    expect(parseFieldValue(field('moderation.reportsToAutoHide'), '0').ok).toBe(true);
    expect(parseFieldValue(field('limits.commentsPerDay'), '0').ok).toBe(false);
  });

  it('مفتاح تشغيل: الغياب = مقفول', () => {
    const f = field('features.comments');
    expect(parseFieldValue(f, 'on')).toEqual({ ok: true, value: true });
    expect(parseFieldValue(f, null)).toEqual({ ok: true, value: false });
  });

  it('اختيار ونص', () => {
    expect(parseFieldValue(field('moderation.review12Plus'), 'all')).toEqual({ ok: true, value: 'all' });
    expect(parseFieldValue(field('moderation.review12Plus'), 'x').ok).toBe(false);
    expect(parseFieldValue(field('featured.title'), '  مختارات  ')).toEqual({ ok: true, value: 'مختارات' });
    expect(parseFieldValue(field('featured.title'), '').ok).toBe(false);
    expect(parseFieldValue(field('featured.title'), 'ع'.repeat(41)).ok).toBe(false);
    // إرشادات النشر اختيارية، وبتحافظ على الأسطر
    expect(parseFieldValue(field('texts.publishGuidelines'), '')).toEqual({ ok: true, value: '' });
    expect(parseFieldValue(field('texts.publishGuidelines'), 'أ\r\nب')).toEqual({ ok: true, value: 'أ\nب' });
    // نص من سطر واحد بيتضغط
    expect(parseFieldValue(field('texts.emptyMessage'), 'أ\nب')).toEqual({ ok: true, value: 'أ ب' });
  });
});

describe('القوايم', () => {
  const cat = (key: string, label = 'اسم', icon = 'pen', enabled = true) => ({ key, label, icon, enabled });

  it('تصنيفات سليمة', () => {
    const r = parseCategories([cat('story', ' قصة '), cat('my_cat2', 'جديد', 'star', false), cat('x_y', 'ثالث', 'nope')]);
    expect(r.ok && r.value).toEqual([
      { key: 'story', label: 'قصة', icon: 'pen', enabled: true },
      { key: 'my_cat2', label: 'جديد', icon: 'star', enabled: false },
      { key: 'x_y', label: 'ثالث', icon: 'pen', enabled: true },
    ]);
  });

  it('تصنيفات مرفوضة', () => {
    expect(parseCategories([]).ok).toBe(false);
    expect(parseCategories([cat('a')]).ok).toBe(false); // كود حرف واحد
    expect(parseCategories([cat('bad key')]).ok).toBe(false);
    // الحروف الكبيرة بتتحوّل لصغيرة بدل ما تترفض.
    expect(parseCategories([cat('Bad')])).toMatchObject({ ok: true, value: [{ key: 'bad' }] });
    expect(parseCategories([cat('1ab')]).ok).toBe(false);
    expect(parseCategories([cat('ab'), cat('ab')]).ok).toBe(false);
    expect(parseCategories([cat('ab', '')]).ok).toBe(false);
    expect(parseCategories([cat('ab', 'ع'.repeat(31))]).ok).toBe(false);
    expect(parseCategories([cat('ab', 'اسم', 'pen', false)]).ok).toBe(false);
    expect(parseCategories(Array.from({ length: 13 }, (_, i) => cat(`cat_${i}`))).ok).toBe(false);
  });

  it('تفاعلات', () => {
    const rows = D.reactions.map((r) => ({ ...r }));
    expect(parseReactions(rows).ok).toBe(true);
    expect(parseReactions(rows.slice(0, 2)).ok).toBe(false);
    expect(parseReactions(rows.map((r) => ({ ...r, label: '' }))).ok).toBe(false);
    expect(parseReactions(rows.map((r) => ({ ...r, emoji: '' }))).ok).toBe(false);
    expect(parseReactions(rows.map((r) => ({ ...r, enabled: false }))).ok).toBe(true); // الإيقاف الكامل بمفتاح features.reactions
  });

  it('أسباب البلاغ', () => {
    const rows = D.reportReasons.map((r) => ({ ...r }));
    expect(parseReportReasons(rows).ok).toBe(true);
    expect(parseReportReasons(rows.map((r) => ({ ...r, enabled: false }))).ok).toBe(false);
    expect(parseReportReasons(rows.slice(1)).ok).toBe(false);
    expect(parseReportReasons(rows.map((r, i) => ({ ...r, enabled: i === 4 }))).ok).toBe(true);
  });

  it('الكلمات الممنوعة', () => {
    const r = parseBlockedWords(' كلمة \r\n\nكلمة\nتانية  \n');
    expect(r).toEqual({ ok: true, value: ['كلمة', 'تانية'] });
    expect(parseBlockedWords('')).toEqual({ ok: true, value: [] });
    expect(parseBlockedWords('ك').ok).toBe(false);
    expect(parseBlockedWords('ع'.repeat(41)).ok).toBe(false);
    expect(parseBlockedWords(Array.from({ length: 301 }, (_, i) => `كلمة${i}`).join('\n')).ok).toBe(false);
  });
});

describe('مساعدات القراءة', () => {
  const cfg: AqlamConfig = {
    ...D,
    categories: [
      { key: 'story', label: 'حكاية', icon: 'book', enabled: true },
      { key: 'poem', label: 'شعر', icon: 'feather', enabled: false },
    ],
    reactions: D.reactions.map((r) => ({ ...r, enabled: r.key !== 'star' })),
    reportReasons: D.reportReasons.map((r) => ({ ...r, enabled: r.key === 'other' })),
    filters: { ...D.filters, sorts: ['old', 'new'], defaultSort: 'old', ageBands: ['13-17'] },
  };

  it('التصنيفات', () => {
    expect(enabledCategories(cfg).map((c) => c.key)).toEqual(['story']);
    expect(categoryMeta(cfg, 'poem')?.label).toBe('شعر'); // المتعطّل بيفضل بتسميته
    expect(categoryMeta(cfg, 'nope')).toBeNull();
  });

  it('التفاعلات المفعّلة، ومقفولة كلها لو المفتاح العام اتقفل', () => {
    expect(enabledReactions(cfg).map((r) => r.key)).toEqual(['heart', 'spark']);
    expect(enabledReactions({ ...cfg, features: { ...cfg.features, reactions: false } })).toEqual([]);
    expect(enabledReportReasons(cfg).map((r) => r.key)).toEqual(['other']);
  });

  it('الفلاتر', () => {
    expect(visibleSorts(cfg)).toEqual(['new', 'old']);
    expect(visibleAgeBands(cfg).map((b) => b.id)).toEqual(['13-17']);
    expect(resolveSort(cfg, 'top')).toBe('old'); // مش مفعّل ← الافتراضي
    expect(resolveSort(cfg, 'new')).toBe('new');
    expect(resolveSort(cfg, undefined)).toBe('old');
  });

  it('withValueAt مابتغيّرش الأصل', () => {
    const next = withValueAt(D, 'limits.postsPerDay', 9);
    expect(next.limits.postsPerDay).toBe(9);
    expect(D.limits.postsPerDay).toBe(3);
  });
});

describe('ترابط الحدود', () => {
  it('الافتراضي سليم', () => {
    expect(validateConfigRelations(D)).toBeNull();
  });
  it('يرفض التعارض', () => {
    expect(validateConfigRelations(withValueAt(D, 'limits.bodyMin', 20000))).toMatch(/للنص/);
    expect(validateConfigRelations(withValueAt(withValueAt(D, 'limits.penNameMin', 10), 'limits.penNameMax', 10))).toBeNull();
    expect(validateConfigRelations(withValueAt(D, 'limits.guardianReasonMin', 100))).toBeNull();
    expect(validateConfigRelations(withValueAt(withValueAt(D, 'limits.guardianReasonMin', 100), 'limits.guardianReasonMax', 50))).toMatch(/ولي الأمر/);
    expect(validateConfigRelations({ ...D, filters: { ...D.filters, sorts: ['top'], defaultSort: 'new' } })).toMatch(/الافتراضي/);
  });
});
