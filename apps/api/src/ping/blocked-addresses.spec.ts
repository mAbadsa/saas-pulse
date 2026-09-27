import { isBlockedAddress } from './blocked-addresses';

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111'])(
    'allows %s',
    (ip) => expect(isBlockedAddress(ip)).toBe(false),
  );

  it('treats non-IPs as not blocked (hostnames are checked after DNS)', () =>
    expect(isBlockedAddress('not-an-ip')).toBe(false));
});
