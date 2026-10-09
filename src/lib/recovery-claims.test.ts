import { describe, it, expect } from 'vitest';
import { hasValidRecoveryClaims } from './recovery-claims';

const now = 10000;
const claims = { sub: 'user', exp: now + 3600, session_id: 'session', amr: [{ method: 'recovery', timestamp: now - 60 }] };

describe('verified recovery claims', () => {
  it('accepts a recent recovery proof for the same user', () => expect(hasValidRecoveryClaims(claims, 'user', now)).toBe(true));
  it('rejects a different user', () => expect(hasValidRecoveryClaims(claims, 'other', now)).toBe(false));
  it('rejects expired JWTs', () => expect(hasValidRecoveryClaims({ ...claims, exp: now }, 'user', now)).toBe(false));
  it('rejects normal password sign-ins', () => expect(hasValidRecoveryClaims({ ...claims, amr: [{ method: 'password', timestamp: now }] }, 'user', now)).toBe(false));
  it('rejects stale recovery proofs even on refreshed JWTs', () => expect(hasValidRecoveryClaims({ ...claims, amr: [{ method: 'recovery', timestamp: now - 901 }] }, 'user', now)).toBe(false));
  it('rejects future-dated proofs', () => expect(hasValidRecoveryClaims({ ...claims, amr: [{ method: 'recovery', timestamp: now + 60 }] }, 'user', now)).toBe(false));
  it('rejects missing session identifiers', () => expect(hasValidRecoveryClaims({ ...claims, session_id: '' }, 'user', now)).toBe(false));
  it('rejects malformed claims', () => expect(hasValidRecoveryClaims({ ...claims, amr: [null, 'recovery', {}] }, 'user', now)).toBe(false));
});
