import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAuthOrigin } from './auth-origin';
const site = 'https://www.alrehla.org';
afterEach(() => vi.unstubAllEnvs());
describe('trusted auth origins', () => {
  it('keeps the production application origin', () => expect(getAuthOrigin(site, site)).toBe(site));
  it('rejects external email redirects', () => expect(getAuthOrigin('https://evil.example', site)).toBe(site));
  it('rejects embedded credentials', () => expect(getAuthOrigin('https://attacker@www.alrehla.org', site)).toBe(site));
  it('handles missing and malformed origins', () => {
    expect(getAuthOrigin(null, site)).toBe(site);
    expect(getAuthOrigin('not a url', site)).toBe(site);
  });
  it('supports localhost during development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(getAuthOrigin('http://localhost:3000', site)).toBe('http://localhost:3000');
  });
  it('rejects localhost in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(getAuthOrigin('http://localhost:3000', site)).toBe(site);
  });
});
