import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { sendEmail } from './email';

describe('sendEmail', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('من غير مفتاح = بيتخطّى من غير ما يرمي', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(await sendEmail({ to: ['a@b.co'], subject: 's', lines: ['x'] })).toEqual({ sent: false, reason: 'no-key' });
  });

  it('فشل Resend = نتيجة، مش استثناء — والنص بيتعمله escape', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test');
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad', { status: 422 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await sendEmail({ to: ['a@b.co'], subject: 's', lines: ['<script>'] });
    expect(r).toEqual({ sent: false, reason: 'http-422' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.html).toContain('&lt;script&gt;');
    expect(body.from).toContain('alrehla.org');
  });
});

describe('البلاغ العاجل', () => {
  const src = readFileSync(new URL('../actions/incidents.ts', import.meta.url), 'utf8');
  it('بيبعت إيميل للإدارة لما البلاغ عاجل', () => {
    expect(src).toMatch(/checked\.severity === 'urgent'[\s\S]{0,200}sendEmail\(/);
  });
});
