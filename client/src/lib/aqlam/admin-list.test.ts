import { describe, it, expect } from 'vitest';
import { adminPostsHref, isAdminPostSort, isAdminPostStatus, likePattern } from './admin-list';

describe('قائمة كل النصوص (إدارة)', () => {
  it('الحالات والترتيب بيتحقق منهم', () => {
    expect(isAdminPostStatus('published')).toBe(true);
    expect(isAdminPostStatus('removed')).toBe(true);
    expect(isAdminPostStatus('draft')).toBe(false);
    expect(isAdminPostStatus(undefined)).toBe(false);
    expect(isAdminPostSort('top')).toBe(true);
    expect(isAdminPostSort('random')).toBe(false);
  });

  it('البحث حرفي: % و_ و\\ بيتهرّبوا', () => {
    expect(likePattern('غيمة')).toBe('%غيمة%');
    expect(likePattern('100%')).toBe('%100\\%%');
    expect(likePattern('a_b')).toBe('%a\\_b%');
    expect(likePattern('a\\b')).toBe('%a\\\\b%');
  });

  it('رابط الفلاتر', () => {
    expect(adminPostsHref({})).toBe('/dashboard/admin/aqlam/posts');
    expect(adminPostsHref({ st: 'hidden', c: 'poem', a: '13-17', s: 'top', q: ' نور ', p: 2 })).toBe(
      '/dashboard/admin/aqlam/posts?st=hidden&c=poem&a=13-17&s=top&q=%D9%86%D9%88%D8%B1&p=2',
    );
    expect(adminPostsHref({ s: 'new', p: 1, q: '  ' })).toBe('/dashboard/admin/aqlam/posts');
  });
});
