import { describe, it, expect } from 'vitest';
import { uploadFolderProblem, UPLOAD_FOLDERS } from '@/lib/upload-folders';
import { publicUploadTicket } from '@/lib/cloudinary-private';

describe('مين يرفع فين', () => {
  it('الزائر مايرفعش خالص', () => {
    expect(uploadFolderProblem('alrehla/avatars', 'visitor')).not.toBeNull();
  });

  it('أي حد داخل يرفع صورته الشخصية وصورة ابنه', () => {
    expect(uploadFolderProblem('alrehla/avatars', 'customer')).toBeNull();
    expect(uploadFolderProblem('alrehla/children', 'customer')).toBeNull();
    expect(uploadFolderProblem('alrehla/avatars', 'student')).toBeNull();
  });

  it('صور الموقع للإدارة بس', () => {
    expect(uploadFolderProblem('alrehla/site', 'customer')).not.toBeNull();
    expect(uploadFolderProblem('alrehla/site', 'publisher')).not.toBeNull();
    expect(uploadFolderProblem('alrehla/site', 'general_supervisor')).toBeNull();
    expect(uploadFolderProblem('alrehla/site', 'super_admin')).toBeNull();
  });

  it('المنتجات للإدارة والناشر، وملف المدرب للمدرب', () => {
    expect(uploadFolderProblem('alrehla/products', 'publisher')).toBeNull();
    expect(uploadFolderProblem('alrehla/products', 'instructor')).not.toBeNull();
    expect(uploadFolderProblem('alrehla/instructors/works', 'instructor')).toBeNull();
    expect(uploadFolderProblem('alrehla/instructors/works', 'publisher')).not.toBeNull();
  });

  it('مجلّد مش في القايمة (أو الخاص) بيترفض', () => {
    expect(uploadFolderProblem('alrehla/private/children', 'super_admin')).not.toBeNull();
    expect(uploadFolderProblem('other-project', 'super_admin')).not.toBeNull();
    expect(uploadFolderProblem('alrehla', 'super_admin')).not.toBeNull();
  });

  it('كل المجلّدات جوّه alrehla/ ومفيش ولا واحد خاص', () => {
    for (const f of Object.keys(UPLOAD_FOLDERS)) {
      expect(f.startsWith('alrehla/')).toBe(true);
      expect(f.startsWith('alrehla/private')).toBe(false);
    }
  });
});

describe('تذكرة الرفع العام', () => {
  it('التوقيع بيشمل المجلّد والمفتاح والصيغ', () => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = 'key123';
    process.env.CLOUDINARY_API_SECRET = 'abcd';
    const a = publicUploadTicket('alrehla/avatars', 1_700_000_000_000)!;
    const b = publicUploadTicket('alrehla/site', 1_700_000_000_000)!;
    expect(a.folder).toBe('alrehla/avatars');
    expect(a.uploadPreset).toBe('alreha');
    expect(a.timestamp).toBe(1_700_000_000);
    expect(a.signature).toMatch(/^[0-9a-f]{40}$/);
    // مجلّد مختلف = توقيع مختلف: المتصفح مايقدرش يغيّر المجلّد.
    expect(a.signature).not.toBe(b.signature);
  });

  it('من غير المفاتيح مفيش تذكرة', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(publicUploadTicket('alrehla/avatars')).toBeNull();
  });
});
