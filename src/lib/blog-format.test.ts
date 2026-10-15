import { describe, expect, it } from 'vitest';
import {
  BOLD_PLACEHOLDER,
  HEADING_PREFIX,
  SUBHEADING_PREFIX,
  setHeading,
  toggleBold,
  toggleList,
} from './blog-format';

describe('toggleBold', () => {
  it('wraps the selection', () => {
    const r = toggleBold('اقرأ كل يوم', 5, 11);
    expect(r.text).toBe('اقرأ **كل يوم**');
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('كل يوم');
  });
  it('inserts a placeholder when nothing is selected', () => {
    const r = toggleBold('ab', 1, 1);
    expect(r.text).toBe(`a**${BOLD_PLACEHOLDER}**b`);
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe(BOLD_PLACEHOLDER);
  });
  it('removes the markers when the selection is already wrapped (outside)', () => {
    const r = toggleBold('a **مهم** b', 4, 7);
    expect(r.text).toBe('a مهم b');
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('مهم');
  });
  it('removes the markers when the selection includes them', () => {
    const r = toggleBold('a **مهم** b', 2, 9);
    expect(r.text).toBe('a مهم b');
    expect(r.text.slice(r.selectionStart, r.selectionEnd)).toBe('مهم');
  });
  it('keeps the markers snug against the text (ignores edge spaces)', () => {
    const r = toggleBold('a مهم b', 1, 6);
    expect(r.text).toBe('a **مهم** b');
  });
  it('a whitespace-only selection changes nothing', () => {
    const r = toggleBold('a   b', 1, 4);
    expect(r.text).toBe('a   b');
  });
});

describe('setHeading', () => {
  it('adds a heading to the caret line only', () => {
    const r = setHeading('أول\nثاني\nثالث', 5, HEADING_PREFIX);
    expect(r.text).toBe('أول\n# ثاني\nثالث');
  });
  it('adds a subheading', () => {
    expect(setHeading('نص', 0, SUBHEADING_PREFIX).text).toBe('## نص');
  });
  it('pressing the same level again removes it', () => {
    expect(setHeading('# نص', 3, HEADING_PREFIX).text).toBe('نص');
    expect(setHeading('## نص', 3, SUBHEADING_PREFIX).text).toBe('نص');
  });
  it('switches between heading levels and from a list item', () => {
    expect(setHeading('# نص', 3, SUBHEADING_PREFIX).text).toBe('## نص');
    expect(setHeading('## نص', 3, HEADING_PREFIX).text).toBe('# نص');
    expect(setHeading('- نص', 3, HEADING_PREFIX).text).toBe('# نص');
  });
  it('works on the last line without a trailing newline', () => {
    expect(setHeading('أ\nب', 3, HEADING_PREFIX).text).toBe('أ\n# ب');
  });
});

describe('toggleList', () => {
  it('turns every selected line into a bullet, skipping blank lines', () => {
    const t = 'أ\n\nب\nج';
    expect(toggleList(t, 0, t.length).text).toBe('- أ\n\n- ب\n- ج');
  });
  it('removes the bullets when all lines already have them', () => {
    const t = '- أ\n- ب';
    expect(toggleList(t, 0, t.length).text).toBe('أ\nب');
  });
  it('converts headings to bullets without leaving the # marks', () => {
    expect(toggleList('## عنوان', 0, 0).text).toBe('- عنوان');
  });
  it('a selection ending right after a newline does not bullet the next line', () => {
    const t = 'أ\nب';
    expect(toggleList(t, 0, 2).text).toBe('- أ\nب');
  });
});
