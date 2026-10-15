/**
 * أدوات التنسيق في محرر المقال — بتعدّل النص بنفس التنسيق المبسّط اللي
 * `RichText` بيعرضه (راجع `components/ui/RichText.tsx`):
 *
 *   # عنوان            → عنوان
 *   ## عنوان فرعي      → عنوان فرعي
 *   - نقطة             → قائمة
 *   **نص**             → عريض
 *
 * دوال نقية (نص + موضع التحديد ← نص + موضع جديد) عشان تتختبر من غير متصفح.
 * مفيش HTML: اللي بيتخزّن نص عادي، فمفيش مدخل لحقن سكربت.
 */

export type Edit = { text: string; selectionStart: number; selectionEnd: number };

export const BOLD_PLACEHOLDER = 'نص مهم';
export const HEADING_PREFIX = '# ';
export const SUBHEADING_PREFIX = '## ';
export const LIST_PREFIX = '- ';

const HEADING_RE = /^#{1,2} /;

function lineStartOf(text: string, index: number): number {
  return text.lastIndexOf('\n', index - 1) + 1;
}

function lineEndOf(text: string, index: number): number {
  const i = text.indexOf('\n', index);
  return i === -1 ? text.length : i;
}

/** عريض: يلفّ التحديد بـ`**`، ولو ملفوف أصلًا يشيلهم. من غير تحديد يحط نص تجريبي. */
export function toggleBold(text: string, start: number, end: number): Edit {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(text.length, Math.max(start, end));

  if (s === e) {
    const inserted = `**${BOLD_PLACEHOLDER}**`;
    return {
      text: text.slice(0, s) + inserted + text.slice(e),
      selectionStart: s + 2,
      selectionEnd: s + 2 + BOLD_PLACEHOLDER.length,
    };
  }

  // العلامات تلزق في الكلام: نشيل المسافات من أطراف التحديد.
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  if (s === e) return { text, selectionStart: start, selectionEnd: end };

  // ملفوف من بره: **|نص|**
  if (text.slice(s - 2, s) === '**' && text.slice(e, e + 2) === '**') {
    return {
      text: text.slice(0, s - 2) + text.slice(s, e) + text.slice(e + 2),
      selectionStart: s - 2,
      selectionEnd: e - 2,
    };
  }
  // العلامات داخل التحديد: |**نص**|
  const inner = text.slice(s, e);
  if (inner.length > 4 && inner.startsWith('**') && inner.endsWith('**')) {
    return {
      text: text.slice(0, s) + inner.slice(2, -2) + text.slice(e),
      selectionStart: s,
      selectionEnd: e - 4,
    };
  }

  return {
    text: text.slice(0, s) + '**' + inner + '**' + text.slice(e),
    selectionStart: s + 2,
    selectionEnd: e + 2,
  };
}

/**
 * عنوان/عنوان فرعي على **السطر** اللي فيه المؤشر.
 * ضغطة تانية على نفس النوع تشيله، ونوع تاني (أو قائمة) بيتبدّل.
 */
export function setHeading(
  text: string,
  start: number,
  prefix: typeof HEADING_PREFIX | typeof SUBHEADING_PREFIX,
): Edit {
  const ls = lineStartOf(text, start);
  const le = lineEndOf(text, start);
  const line = text.slice(ls, le);

  const bare = line.replace(HEADING_RE, '').replace(/^- /, '');
  const same = line.startsWith(prefix);
  const next = same ? bare : prefix + bare;

  return {
    text: text.slice(0, ls) + next + text.slice(le),
    selectionStart: ls + (same ? 0 : prefix.length),
    selectionEnd: ls + next.length,
  };
}

/** قائمة نقطية على كل الأسطر المحدّدة؛ لو كلها قائمة أصلًا بتشيلها. */
export function toggleList(text: string, start: number, end: number): Edit {
  const s = Math.max(0, Math.min(start, end));
  let e = Math.min(text.length, Math.max(start, end));
  if (e > s && text[e - 1] === '\n') e--;

  const ls = lineStartOf(text, s);
  const le = lineEndOf(text, e);
  const lines = text.slice(ls, le).split('\n');

  const nonEmpty = lines.filter((l) => l.trim() !== '');
  const allList = nonEmpty.length > 0 && nonEmpty.every((l) => l.startsWith(LIST_PREFIX));

  const next = lines
    .map((l) => {
      if (l.trim() === '') return l;
      if (allList) return l.slice(LIST_PREFIX.length);
      return LIST_PREFIX + l.replace(HEADING_RE, '').replace(/^- /, '');
    })
    .join('\n');

  return {
    text: text.slice(0, ls) + next + text.slice(le),
    selectionStart: ls,
    selectionEnd: ls + next.length,
  };
}
