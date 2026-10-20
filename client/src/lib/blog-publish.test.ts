import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_IN_PAST,
  SCHEDULE_REQUIRED,
  isPublishMode,
  postStatus,
  resolvePublishing,
} from './blog-publish';

const NOW = new Date('2026-11-05T10:00:00Z');

describe('postStatus', () => {
  it('draft wins regardless of date', () => {
    expect(postStatus({ isDraft: true, publishedAt: '2026-01-01T00:00:00Z' }, NOW)).toBe('draft');
    expect(postStatus({ isDraft: true, publishedAt: '2027-01-01T00:00:00Z' }, NOW)).toBe('draft');
  });
  it('future date is scheduled, past/now is published', () => {
    expect(postStatus({ isDraft: false, publishedAt: '2026-11-05T10:00:01Z' }, NOW)).toBe('scheduled');
    expect(postStatus({ isDraft: false, publishedAt: '2026-11-05T10:00:00Z' }, NOW)).toBe('published');
    expect(postStatus({ publishedAt: '2026-08-01T09:00:00Z' }, NOW)).toBe('published');
  });
  it('an unparseable date is treated as published (never hides silently)', () => {
    expect(postStatus({ isDraft: false, publishedAt: 'nope' }, NOW)).toBe('published');
  });
});

describe('isPublishMode', () => {
  it('accepts only the three modes', () => {
    expect(isPublishMode('published')).toBe(true);
    expect(isPublishMode('scheduled')).toBe(true);
    expect(isPublishMode('draft')).toBe(true);
    expect(isPublishMode('x')).toBe(false);
    expect(isPublishMode(undefined)).toBe(false);
  });
});

describe('resolvePublishing', () => {
  it('publishes a new post now', () => {
    expect(resolvePublishing({ mode: 'published', scheduledAtIso: null, existing: null, now: NOW })).toEqual({
      ok: true,
      isDraft: false,
      publishedAt: NOW.toISOString(),
    });
  });
  it('keeps the original date when editing an already-published post', () => {
    const existing = { isDraft: false, publishedAt: '2026-08-24T09:00:00.000Z' };
    expect(resolvePublishing({ mode: 'published', scheduledAtIso: null, existing, now: NOW })).toEqual({
      ok: true,
      isDraft: false,
      publishedAt: '2026-08-24T09:00:00.000Z',
    });
  });
  it('publishing a draft or a scheduled post moves it to now', () => {
    for (const existing of [
      { isDraft: true, publishedAt: '2027-10-14T22:12:19.206Z' },
      { isDraft: false, publishedAt: '2026-12-01T09:00:00.000Z' },
    ]) {
      expect(resolvePublishing({ mode: 'published', scheduledAtIso: null, existing, now: NOW })).toEqual({
        ok: true,
        isDraft: false,
        publishedAt: NOW.toISOString(),
      });
    }
  });
  it('schedules for a future time', () => {
    expect(
      resolvePublishing({ mode: 'scheduled', scheduledAtIso: '2026-11-10T07:00:00Z', existing: null, now: NOW }),
    ).toEqual({ ok: true, isDraft: false, publishedAt: '2026-11-10T07:00:00.000Z' });
  });
  it('rejects a missing, invalid, past or present schedule', () => {
    const base = { mode: 'scheduled' as const, existing: null, now: NOW };
    expect(resolvePublishing({ ...base, scheduledAtIso: null })).toMatchObject({ ok: false, error: SCHEDULE_REQUIRED });
    expect(resolvePublishing({ ...base, scheduledAtIso: 'garbage' })).toMatchObject({ ok: false, error: SCHEDULE_REQUIRED });
    expect(resolvePublishing({ ...base, scheduledAtIso: '2026-11-04T10:00:00Z' })).toMatchObject({
      ok: false,
      error: SCHEDULE_IN_PAST,
    });
    expect(resolvePublishing({ ...base, scheduledAtIso: NOW.toISOString() })).toMatchObject({
      ok: false,
      error: SCHEDULE_IN_PAST,
    });
  });
  it('a draft keeps its date and is hidden', () => {
    expect(
      resolvePublishing({
        mode: 'draft',
        scheduledAtIso: null,
        existing: { isDraft: false, publishedAt: '2026-08-24T09:00:00.000Z' },
        now: NOW,
      }),
    ).toEqual({ ok: true, isDraft: true, publishedAt: '2026-08-24T09:00:00.000Z' });
    expect(resolvePublishing({ mode: 'draft', scheduledAtIso: null, existing: null, now: NOW })).toEqual({
      ok: true,
      isDraft: true,
      publishedAt: NOW.toISOString(),
    });
  });
});
