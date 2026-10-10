import { describe, expect, it } from 'vitest';
import {
  acceptAttr,
  cleanFileName,
  fileExpired,
  fileExpiryDate,
  fileProblem,
  kindOfExtension,
  normalizeKinds,
  normalizeMaxMb,
  normalizeRetentionDays,
  privateFilesFolder,
  resourceTypeFor,
} from './private-files';

const MB = 1024 * 1024;

describe('fileProblem', () => {
  const rules = { kinds: ['pdf', 'word'] as const, maxMb: 5 };
  it('accepts an allowed kind under the limit', () => {
    expect(fileProblem({ name: 'قصة.PDF', size: MB }, { ...rules, kinds: [...rules.kinds] })).toBeNull();
    expect(fileProblem({ name: 'a.docx', size: MB }, { ...rules, kinds: [...rules.kinds] })).toBeNull();
  });
  it('rejects a kind the service does not allow', () => {
    expect(fileProblem({ name: 'a.png', size: MB }, { ...rules, kinds: [...rules.kinds] })).toContain('PDF أو Word');
  });
  it('rejects files without a known extension', () => {
    expect(fileProblem({ name: 'a.exe', size: 10 }, { ...rules, kinds: [...rules.kinds] })).not.toBeNull();
    expect(fileProblem({ name: 'noext', size: 10 }, { ...rules, kinds: [...rules.kinds] })).not.toBeNull();
  });
  it('rejects over-size and empty files', () => {
    expect(fileProblem({ name: 'a.pdf', size: 6 * MB }, { ...rules, kinds: [...rules.kinds] })).toContain('5 ميجا');
    expect(fileProblem({ name: 'a.pdf', size: 0 }, { ...rules, kinds: [...rules.kinds] })).toBe('الملف فاضي');
  });
});

describe('normalizers', () => {
  it('kinds: keeps known, falls back to all', () => {
    expect(normalizeKinds(['pdf', 'evil', 'pdf'])).toEqual(['pdf']);
    expect(normalizeKinds(null)).toEqual(['pdf', 'word', 'image']);
    expect(normalizeKinds([])).toEqual(['pdf', 'word', 'image']);
  });
  it('max MB is clamped to 1..10', () => {
    expect(normalizeMaxMb(3)).toBe(3);
    expect(normalizeMaxMb(50)).toBe(10);
    expect(normalizeMaxMb(0)).toBe(10);
    expect(normalizeMaxMb('x')).toBe(10);
  });
  it('retention days are clamped to 7..365', () => {
    expect(normalizeRetentionDays(30)).toBe(30);
    expect(normalizeRetentionDays(1)).toBe(7);
    expect(normalizeRetentionDays(9999)).toBe(365);
    expect(normalizeRetentionDays(undefined)).toBe(30);
  });
});

describe('helpers', () => {
  it('maps extensions and resource types', () => {
    expect(kindOfExtension('JPG')).toBe('image');
    expect(kindOfExtension('doc')).toBe('word');
    expect(resourceTypeFor('image')).toBe('image');
    expect(resourceTypeFor('pdf')).toBe('raw');
    expect(acceptAttr(['pdf', 'word'])).toBe('.pdf,.doc,.docx');
  });
  it('cleans file names', () => {
    expect(cleanFileName('C:\\fake\\path\\قصتي.docx')).toBe('قصتي.docx');
    expect(cleanFileName('a\u0000b.pdf')).toBe('ab.pdf');
    expect(cleanFileName('   ')).toBe('ملف');
    expect(cleanFileName('x'.repeat(300)).length).toBe(200);
  });
  it('builds folders per owner', () => {
    expect(privateFilesFolder({ orderId: 'o1' })).toBe('alrehla/private/orders/o1');
    expect(privateFilesFolder({ documentId: 'd1' })).toBe('alrehla/private/writing/d1');
  });
});

describe('retention', () => {
  const now = new Date('2026-11-30T00:00:00Z');
  it('never expires while the order is open', () => {
    expect(fileExpired({ createdAt: '2026-01-01T00:00:00Z' }, { closed: false }, 30, now)).toBe(false);
    expect(fileExpiryDate({ createdAt: '2026-01-01T00:00:00Z' }, { closed: false }, 30)).toBeNull();
  });
  it('counts from closing, or from the upload if later', () => {
    const closed = { closed: true, closedAt: '2026-11-01T00:00:00Z' };
    expect(fileExpired({ createdAt: '2026-10-01T00:00:00Z' }, closed, 30, now)).toBe(false);
    expect(fileExpired({ createdAt: '2026-10-01T00:00:00Z' }, closed, 20, now)).toBe(true);
    expect(fileExpired({ createdAt: '2026-11-20T00:00:00Z' }, closed, 20, now)).toBe(false);
  });
  it('falls back to the upload date when the close date is unknown', () => {
    expect(fileExpired({ createdAt: '2026-10-01T00:00:00Z' }, { closed: true }, 30, now)).toBe(true);
    expect(fileExpiryDate({ createdAt: '2026-10-01T00:00:00Z' }, { closed: true }, 30)?.toISOString())
      .toBe('2026-10-31T00:00:00.000Z');
  });
});
