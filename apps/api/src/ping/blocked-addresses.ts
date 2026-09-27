import { BlockList, isIP } from 'node:net';

// Non-public ranges a monitor must never reach (SSRF). BlockList also matches
// IPv4-mapped IPv6 (::ffff:10.0.0.1) against the IPv4 rules.
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['64:ff9b::', 96],
  ['2001:db8::', 32],
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

export function isBlockedAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 0) return false;
  return blocked.check(ip, version === 4 ? 'ipv4' : 'ipv6');
}
