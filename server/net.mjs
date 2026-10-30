import net from 'node:net';
import os from 'node:os';

/**
 * Which addresses count as "this computer or the same home/office network".
 * Loopback, 10/8, 172.16/12, 192.168/16, 169.254/16 (link-local), IPv6 ::1, fe80::/10, fc00::/7.
 * Carrier/ISP shared ranges (100.64/10) and every public address are NOT local.
 */
const V4_LOCAL = ['127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16'];

const v4num = (ip) => ip.split('.').reduce((n, p) => n * 256 + Number(p), 0);
export function parseNets(list) {
  return String(list ?? '').split(',').map((s) => s.trim()).filter(Boolean).map((cidr) => {
    const [ip, bits = '32'] = cidr.split('/');
    if (!net.isIPv4(ip) || !(Number(bits) >= 0 && Number(bits) <= 32)) throw Error(`Not an IPv4 network: ${cidr}`);
    return { base: v4num(ip), bits: Number(bits) };
  });
}
const inNet = (n, { base, bits }) => bits === 0 || Math.floor(n / 2 ** (32 - bits)) === Math.floor(base / 2 ** (32 - bits));
const LOCAL_NETS = parseNets(V4_LOCAL.join(','));

/** Strip IPv6 zone ids and IPv4-mapped prefixes ("::ffff:192.168.1.5" → "192.168.1.5"). */
export function normalizeIp(ip) {
  let s = String(ip ?? '').trim().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(s)) s = s.slice(7);
  return s;
}
export function isLoopback(ip) { const s = normalizeIp(ip); return s === '::1' || (net.isIPv4(s) && s.startsWith('127.')); }
export function isLocalNetwork(ip, extra = []) {
  const s = normalizeIp(ip);
  if (net.isIPv4(s)) { const n = v4num(s); return [...LOCAL_NETS, ...extra].some((x) => inNet(n, x)); }
  if (net.isIPv6(s)) { const l = s.toLowerCase(); return l === '::1' || /^fe[89ab]/.test(l) || /^f[cd]/.test(l); }
  return false;
}
/** A browser Origin/host name that is this computer or a device on the local network. */
export function isLocalHostname(host, extra = []) {
  const h = String(host ?? '').replace(/^\[|\]$/g, '').toLowerCase();
  return h === 'localhost' || h.endsWith('.local') || isLocalNetwork(h, extra);
}

/** This computer's addresses that phones on the same Wi-Fi can open. Wi-Fi/Ethernet first, virtual adapters last. */
export function lanAddresses(extra = []) {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.internal || a.family !== 'IPv4' && a.family !== 4) continue;
      if (!isLocalNetwork(a.address, extra) || a.address.startsWith('169.254.')) continue;
      const virtual = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|br-|veth|utun|zt|tailscale/i.test(name);
      out.push({ name, address: a.address, virtual });
    }
  }
  return out.sort((a, b) => a.virtual - b.virtual || (a.address.startsWith('192.168.') ? -1 : 1));
}
