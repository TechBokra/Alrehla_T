import { describe, it, expect } from 'vitest';
import { offerRequestKind } from './offer-requests';

describe('offerRequestKind', () => {
  it('pending is a new request', () => {
    expect(offerRequestKind({ status: 'pending', requested_price: 300, approved_price: null })).toBe('new');
  });
  it('approved with a different requested price is a price change', () => {
    expect(offerRequestKind({ status: 'approved', requested_price: 400, approved_price: 300 })).toBe('price_change');
  });
  it('approved at the requested price is settled', () => {
    expect(offerRequestKind({ status: 'approved', requested_price: 300, approved_price: 300 })).toBeNull();
    expect(offerRequestKind({ status: 'approved', requested_price: null, approved_price: 300 })).toBeNull();
  });
  it('rejected is settled', () => {
    expect(offerRequestKind({ status: 'rejected', requested_price: 300, approved_price: null })).toBeNull();
  });
});
