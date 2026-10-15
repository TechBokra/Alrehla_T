import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SIGNATURE_TOLERANCE_SECONDS,
  parseSignatureHeader,
  verifyXpaySignature,
} from './xpay-signature';

const SECRET = 'whsec_test_key';
const NOW = 1_762_000_000;
const BODY = '{"id":"evt_1","type":"checkout.session.completed"}';

function sign(body: string, t = NOW, secret = SECRET): string {
  const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return `t=${t},v1=${v1}`;
}

describe('parseSignatureHeader', () => {
  it('reads t and v1 in any order and ignores extra parts', () => {
    expect(parseSignatureHeader('v1=ab12,t=5,v0=zz')).toEqual({ timestamp: 5, signature: 'ab12' });
  });
  it('lowercases the signature', () => {
    expect(parseSignatureHeader('t=5,v1=AB12')?.signature).toBe('ab12');
  });
  it('keeps the first v1 when the header repeats it', () => {
    expect(parseSignatureHeader('t=5,v1=aa,v1=bb')?.signature).toBe('aa');
  });
  it('rejects a missing part, a non-numeric t and a non-hex v1', () => {
    expect(parseSignatureHeader('t=5')).toBeNull();
    expect(parseSignatureHeader('v1=ab')).toBeNull();
    expect(parseSignatureHeader('t=abc,v1=ab')).toBeNull();
    expect(parseSignatureHeader('t=5,v1=zz')).toBeNull();
    expect(parseSignatureHeader('')).toBeNull();
    expect(parseSignatureHeader(null)).toBeNull();
  });
});

describe('verifyXpaySignature', () => {
  it('accepts a genuine signature', () => {
    expect(verifyXpaySignature(BODY, sign(BODY), SECRET, NOW)).toEqual({ ok: true });
  });

  it('refuses when the webhook secret is not configured', () => {
    expect(verifyXpaySignature(BODY, sign(BODY), '', NOW)).toMatchObject({ reason: 'missing_secret' });
    expect(verifyXpaySignature(BODY, sign(BODY), undefined, NOW)).toMatchObject({ reason: 'missing_secret' });
  });

  it('refuses a missing or malformed header', () => {
    expect(verifyXpaySignature(BODY, null, SECRET, NOW)).toMatchObject({ reason: 'missing_header' });
    expect(verifyXpaySignature(BODY, 'nonsense', SECRET, NOW)).toMatchObject({ reason: 'malformed_header' });
  });

  it('refuses a body that was tampered with after signing', () => {
    const header = sign(BODY);
    const tampered = BODY.replace('evt_1', 'evt_2');
    expect(verifyXpaySignature(tampered, header, SECRET, NOW)).toMatchObject({ reason: 'bad_signature' });
  });

  it('refuses a signature made with the wrong secret', () => {
    expect(verifyXpaySignature(BODY, sign(BODY, NOW, 'whsec_other'), SECRET, NOW)).toMatchObject({
      reason: 'bad_signature',
    });
  });

  it('refuses a replay of an old but genuine webhook', () => {
    const old = NOW - SIGNATURE_TOLERANCE_SECONDS - 1;
    expect(verifyXpaySignature(BODY, sign(BODY, old), SECRET, NOW)).toMatchObject({
      reason: 'stale_timestamp',
    });
  });

  it('refuses a timestamp from the future by the same margin', () => {
    const ahead = NOW + SIGNATURE_TOLERANCE_SECONDS + 1;
    expect(verifyXpaySignature(BODY, sign(BODY, ahead), SECRET, NOW)).toMatchObject({
      reason: 'stale_timestamp',
    });
  });

  it('accepts exactly at the edge of the tolerance window', () => {
    const edge = NOW - SIGNATURE_TOLERANCE_SECONDS;
    expect(verifyXpaySignature(BODY, sign(BODY, edge), SECRET, NOW)).toEqual({ ok: true });
  });

  it('refuses a signature of the right body signed for a different timestamp', () => {
    // التوقيع صحيح لـ t قديم، لكن الترويسة بتدّعي t حالي.
    const v1 = createHmac('sha256', SECRET).update(`${NOW - 10}.${BODY}`).digest('hex');
    expect(verifyXpaySignature(BODY, `t=${NOW},v1=${v1}`, SECRET, NOW)).toMatchObject({
      reason: 'bad_signature',
    });
  });

  it('refuses a truncated signature instead of throwing', () => {
    const header = sign(BODY);
    const short = header.slice(0, header.length - 2);
    expect(verifyXpaySignature(BODY, short, SECRET, NOW)).toMatchObject({ reason: 'bad_signature' });
  });

  it('is sensitive to whitespace, so a re-serialised body fails', () => {
    const header = sign(BODY);
    const reserialised = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(verifyXpaySignature(reserialised, header, SECRET, NOW)).toMatchObject({
      reason: 'bad_signature',
    });
  });
});
