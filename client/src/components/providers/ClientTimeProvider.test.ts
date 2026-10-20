import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClientTimeProvider, useDeadline, useNow } from './ClientTimeProvider';

function Probe({ deadline = null }: { deadline?: number | null }) {
  const now = useNow();
  const expired = useDeadline(deadline);
  return createElement('span', null, `${now}:${expired}`);
}
function render(initialTimestamp: number, deadline: number | null = null) {
  return renderToString(createElement(ClientTimeProvider, { initialTimestamp }, createElement(Probe, { deadline })));
}
describe('hydration-safe clock seed', () => {
  it('renders the supplied server snapshot, not a new browser clock reading', () => {
    expect(render(1_000_000)).toBe('<span>1000000:false</span>');
    expect(render(1_000_000)).toBe(render(1_000_000));
  });
  it('renders a deadline consistently from the same snapshot', () => {
    expect(render(1_000_000, 1_000_001)).toBe('<span>1000000:false</span>');
    expect(render(1_000_000, 1_000_000)).toBe('<span>1000000:true</span>');
  });
});
