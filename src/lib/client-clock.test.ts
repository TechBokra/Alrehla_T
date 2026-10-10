import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeClock, subscribeDeadline } from './client-clock';

let windowEvents: EventTarget;
let documentEvents: EventTarget & { visibilityState: string };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  windowEvents = Object.assign(new EventTarget(), {
    setTimeout, clearTimeout, setInterval, clearInterval,
  });
  documentEvents = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', windowEvents);
  vi.stubGlobal('document', documentEvents);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('client clock subscriptions', () => {
  it('updates asynchronously after hydration, then every thirty seconds', () => {
    const tick = vi.fn();
    const stop = subscribeClock(tick);
    expect(tick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(tick).toHaveBeenLastCalledWith(1_000_000);
    vi.advanceTimersByTime(30_000);
    expect(tick).toHaveBeenLastCalledWith(1_030_000);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('refreshes on focus and visibility resume, but not while hidden', () => {
    const tick = vi.fn();
    const stop = subscribeClock(tick);
    documentEvents.visibilityState = 'hidden';
    vi.advanceTimersByTime(30_000);
    expect(tick).not.toHaveBeenCalled();
    documentEvents.visibilityState = 'visible';
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(tick).toHaveBeenLastCalledWith(1_030_000);
    vi.setSystemTime(1_090_000);
    windowEvents.dispatchEvent(new Event('focus'));
    expect(tick).toHaveBeenLastCalledWith(1_090_000);
    stop();
    tick.mockClear();
    windowEvents.dispatchEvent(new Event('focus'));
    documentEvents.dispatchEvent(new Event('visibilitychange'));
    expect(tick).not.toHaveBeenCalled();
  });
  it('cleans up before the initial callback', () => {
    const tick = vi.fn();
    subscribeClock(tick)();
    vi.advanceTimersByTime(60_000);
    expect(tick).not.toHaveBeenCalled();
  });
});

describe('announcement deadlines', () => {
  it('expires at the exact deadline rather than waiting for a clock interval', () => {
    const expire = vi.fn();
    const stop = subscribeDeadline(1_000_500, expire);
    vi.advanceTimersByTime(499);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledTimes(1);
    stop();
  });
  it('handles already-expired cached pages asynchronously', () => {
    const expire = vi.fn();
    subscribeDeadline(999_999, expire);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it('avoids browser timeout overflow for deadlines farther than 24 days', () => {
    const expire = vi.fn();
    const stop = subscribeDeadline(1_000_000 + 2_147_483_647 + 500, expire);
    vi.advanceTimersByTime(2_147_483_647);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(expire).toHaveBeenCalledTimes(1);
    stop();
  });
  it('cancels obsolete deadlines', () => {
    const expire = vi.fn();
    subscribeDeadline(1_000_500, expire)();
    vi.advanceTimersByTime(1000);
    expect(expire).not.toHaveBeenCalled();
  });
});
