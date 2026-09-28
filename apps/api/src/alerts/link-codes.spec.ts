import { LINK_TTL_MS, LinkCodes } from './link-codes';

describe('LinkCodes', () => {
  it('issues unguessable codes in the Telegram start-parameter alphabet', () => {
    const codes = new LinkCodes();
    const a = codes.issue('u1').code;
    const b = codes.issue('u1').code;
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(a).not.toBe(b);
  });

  it('redeems a valid code once', () => {
    const codes = new LinkCodes();
    const { code } = codes.issue('u1', 1_000);
    expect(codes.redeem(code, 2_000)).toBe('u1');
    expect(codes.redeem(code, 2_000)).toBeNull();
  });

  it('rejects expired and unknown codes', () => {
    const codes = new LinkCodes();
    const { code, expiresAt } = codes.issue('u1', 0);
    expect(expiresAt.getTime()).toBe(LINK_TTL_MS);
    expect(codes.redeem(code, LINK_TTL_MS)).toBeNull();
    expect(codes.redeem('nope', 0)).toBeNull();
  });
});
