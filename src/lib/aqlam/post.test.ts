import { describe, it, expect } from 'vitest';
import {
  allowedNameModes,
  displayNameFor,
  validateCommentBody,
  validatePublishInput,
} from './post';

const base = {
  title: 'غيمة صغيرة',
  body: 'كان يا ما كان في قرية صغيرة بنت اسمها نور وكانت بتحب الغيم.',
  category: 'story',
  nameMode: 'first_name',
};

describe('الأسماء', () => {
  it('أقل من ١٢: الاسم الأول بس', () => {
    expect(allowedNameModes('under_12')).toEqual(['first_name']);
  });

  it('١٢+: أول وكامل وقلمي', () => {
    expect(allowedNameModes('12_plus')).toEqual(['first_name', 'full_name', 'pen_name']);
  });

  it('الاسم الظاهر', () => {
    expect(displayNameFor({ mode: 'first_name', fullName: ' نور  أحمد علي ' })).toBe('نور');
    expect(displayNameFor({ mode: 'full_name', fullName: ' نور  أحمد علي ' })).toBe('نور أحمد علي');
    expect(displayNameFor({ mode: 'pen_name', fullName: 'نور أحمد', penName: ' قمر  الليل ' })).toBe('قمر الليل');
  });
});

describe('نموذج النشر', () => {
  it('نموذج سليم بيعدّي', () => {
    const r = validatePublishInput(base, 'under_12');
    expect(r.ok).toBe(true);
  });

  it('عنوان فاضي أو طويل', () => {
    expect(validatePublishInput({ ...base, title: '   ' }, '12_plus')).toMatchObject({ ok: false, field: 'title' });
    expect(validatePublishInput({ ...base, title: 'ع'.repeat(121) }, '12_plus')).toMatchObject({ ok: false, field: 'title' });
  });

  it('نص قصير جدًا أو طويل جدًا', () => {
    expect(validatePublishInput({ ...base, body: 'قصير' }, '12_plus')).toMatchObject({ ok: false, field: 'body' });
    expect(validatePublishInput({ ...base, body: 'ع'.repeat(20001) }, '12_plus')).toMatchObject({ ok: false, field: 'body' });
  });

  it('تصنيف غير معروف', () => {
    expect(validatePublishInput({ ...base, category: 'xx' }, '12_plus')).toMatchObject({ ok: false, field: 'category' });
  });

  it('أقل من ١٢ مايقدرش يستخدم الاسم الكامل ولا القلمي', () => {
    expect(validatePublishInput({ ...base, nameMode: 'full_name' }, 'under_12')).toMatchObject({ ok: false, field: 'nameMode' });
    expect(validatePublishInput({ ...base, nameMode: 'pen_name', penName: 'قمر' }, 'under_12')).toMatchObject({ ok: false, field: 'nameMode' });
  });

  it('١٢+ بالاسم القلمي لازم يكتبه', () => {
    expect(validatePublishInput({ ...base, nameMode: 'pen_name' }, '12_plus')).toMatchObject({ ok: false, field: 'penName' });
    const ok = validatePublishInput({ ...base, nameMode: 'pen_name', penName: 'قمر الليل' }, '12_plus');
    expect(ok.ok).toBe(true);
  });

  it('فهرسة جوجل لـ١٢+ بس', () => {
    const adult = validatePublishInput({ ...base, allowIndexing: true }, '12_plus');
    const child = validatePublishInput({ ...base, allowIndexing: true }, 'under_12');
    expect(adult.ok && adult.value.allowIndexing).toBe(true);
    expect(child.ok && child.value.allowIndexing).toBe(false);
  });

  it('بيانات التواصل في العنوان أو النص أو الاسم القلمي', () => {
    expect(validatePublishInput({ ...base, title: 'كلمني 01012345678' }, '12_plus')).toMatchObject({ ok: false, field: 'title' });
    expect(validatePublishInput({ ...base, body: base.body + ' ahmed@example.com' }, '12_plus')).toMatchObject({ ok: false, field: 'body' });
    expect(validatePublishInput({ ...base, nameMode: 'pen_name', penName: '@sara_writes' }, '12_plus')).toMatchObject({ ok: false, field: 'penName' });
  });

  it('رقم المستند الأصلي لازم يكون UUID', () => {
    const bad = validatePublishInput({ ...base, sourceDocumentId: 'abc' }, '12_plus');
    const good = validatePublishInput(
      { ...base, sourceDocumentId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' },
      '12_plus',
    );
    expect(bad.ok && bad.value.sourceDocumentId).toBeNull();
    expect(good.ok && good.value.sourceDocumentId).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });
});

describe('التعليق', () => {
  it('فاضي وطويل وبيانات تواصل', () => {
    expect(validateCommentBody('  ').ok).toBe(false);
    expect(validateCommentBody('ع'.repeat(501)).ok).toBe(false);
    expect(validateCommentBody('كلموني 01012345678').ok).toBe(false);
  });

  it('تعليق عادي', () => {
    expect(validateCommentBody('جميل جدًا، عجبتني صورة الغيم.')).toEqual({
      ok: true,
      value: 'جميل جدًا، عجبتني صورة الغيم.',
    });
  });
});
