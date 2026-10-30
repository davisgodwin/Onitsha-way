import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { webcrypto, X509Certificate } from 'node:crypto';
import * as x509 from '@peculiar/x509';

/**
 * Certificates for LAN play over https (phones only allow the microphone on secure pages).
 * A small local certificate authority ("Onitsha Way local CA") is made once and kept in server/data/lan-cert/;
 * it signs a certificate for this computer's current Wi-Fi addresses, renewed automatically when they change.
 * Phones show a one-time "not private" warning (the CA is not a public one) unless you install the CA on them.
 * Keys never leave server/data.
 */
x509.cryptoProvider.set(webcrypto);
const ALG = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' };
const DAY = 86400000;
const hostNames = () => [os.hostname().toLowerCase()].filter((n) => /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(n) && n !== 'localhost');
const toPem = (der, label) => `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
const fromPem = (pem) => Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
/**
 * X.509 name constraints (RFC 5280 §4.2.1.10), DER-encoded by hand: the CA may only vouch for local addresses
 * (loopback, 10/8, 172.16/12, 192.168/16, 169.254/16), "localhost", *.local and this computer's name. If someone
 * installs the CA on a phone and the key ever leaked, it still could not impersonate a real website.
 */
const der = (tag, body) => { const n = body.length, len = n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]; return Buffer.concat([Buffer.from([tag, ...len]), body]); };
export const LOCAL_NETS_CIDR = [['127.0.0.0', 8], ['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['169.254.0.0', 16]];
function nameConstraints(dnsNames, extraNets = []) {
  const ipTree = ([ip, bits]) => der(0x30, der(0x87, Buffer.from([...ip.split('.').map(Number), ...[0, 1, 2, 3].map((i) => (0xffffffff << (32 - bits)) >>> (24 - i * 8) & 255)])));
  const dnsTree = (n) => der(0x30, der(0x82, Buffer.from(n, 'ascii')));
  const permitted = der(0xa0, Buffer.concat([...[...LOCAL_NETS_CIDR, ...extraNets].map(ipTree), ...dnsNames.map(dnsTree)]));
  return new x509.Extension('2.5.29.30', true, der(0x30, permitted));
}
const serial = () => Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString('hex').replace(/^[89a-f]/, '1');

async function makeCa(extraNets = []) {
  const keys = await webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const now = Date.now();
  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: serial(), name: `CN=Onitsha Way local CA (${os.hostname().slice(0, 40)}), O=Onitsha Way LAN play`, keys, signingAlgorithm: ALG,
    notBefore: new Date(now - DAY), notAfter: new Date(now + 3650 * DAY),
    extensions: [new x509.BasicConstraintsExtension(true, 0, true), new x509.KeyUsagesExtension(x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign, true), await x509.SubjectKeyIdentifierExtension.create(keys.publicKey),
      nameConstraints(['localhost', 'local', ...hostNames()], extraNets)],
  });
  return { cert: cert.toString('pem') + '\n', key: toPem(await webcrypto.subtle.exportKey('pkcs8', keys.privateKey), 'PRIVATE KEY') };
}

export async function makeLeaf(ca, ips, dns) {
  const caCert = new x509.X509Certificate(ca.cert), caKey = await webcrypto.subtle.importKey('pkcs8', fromPem(ca.key), ALG, false, ['sign']);
  const keys = await webcrypto.subtle.generateKey(ALG, true, ['sign', 'verify']);
  const now = Date.now();
  const cert = await x509.X509CertificateGenerator.create({
    serialNumber: serial(), subject: 'CN=Onitsha Way LAN play', issuer: caCert.subject, publicKey: keys.publicKey, signingKey: caKey, signingAlgorithm: ALG,
    notBefore: new Date(now - DAY), notAfter: new Date(now + 390 * DAY), // under 398 days so phones accept it once the CA is trusted
    extensions: [new x509.BasicConstraintsExtension(false, undefined, true), new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature, true),
      new x509.ExtendedKeyUsageExtension([x509.ExtendedKeyUsage.serverAuth]),
      new x509.SubjectAlternativeNameExtension([...dns.map((value) => ({ type: 'dns', value })), ...ips.map((value) => ({ type: 'ip', value }))]),
      await x509.AuthorityKeyIdentifierExtension.create(caCert), await x509.SubjectKeyIdentifierExtension.create(keys.publicKey)],
  });
  return { cert: cert.toString('pem') + '\n', key: toPem(await webcrypto.subtle.exportKey('pkcs8', keys.privateKey), 'PRIVATE KEY') };
}

/** Load or create the CA and a certificate covering `ips` (+ localhost). Returns PEMs for https.createServer. */
export async function ensureLanCert(dir, ips, { extraNets = [] } = {}) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const f = (n) => path.join(dir, n), write = (n, text) => fs.writeFileSync(f(n), text, { mode: 0o600 });
  const want = [...new Set(['127.0.0.1', ...ips])].sort(), dns = ['localhost', ...hostNames()];
  let ca;
  if (fs.existsSync(f('ca.crt')) && fs.existsSync(f('ca.key'))) ca = { cert: fs.readFileSync(f('ca.crt'), 'utf8'), key: fs.readFileSync(f('ca.key'), 'utf8') };
  else { ca = await makeCa(extraNets); write('ca.key', ca.key); write('ca.crt', ca.cert); fs.rmSync(f('server.crt'), { force: true }); }
  let leaf = null, renewed = false;
  if (fs.existsSync(f('server.crt')) && fs.existsSync(f('server.key'))) {
    try {
      const c = new X509Certificate(fs.readFileSync(f('server.crt'))), san = c.subjectAltName ?? '';
      const ok = want.every((ip) => san.includes(`IP Address:${ip}`)) && Date.parse(c.validTo) - Date.now() > 30 * DAY && c.checkIssued(new X509Certificate(ca.cert));
      if (ok) leaf = { cert: fs.readFileSync(f('server.crt'), 'utf8'), key: fs.readFileSync(f('server.key'), 'utf8') };
    } catch { /* remake below */ }
  }
  if (!leaf) { leaf = await makeLeaf(ca, want, dns); write('server.key', leaf.key); write('server.crt', leaf.cert); renewed = true; }
  const fingerprint = new X509Certificate(ca.cert).fingerprint256;
  return { key: leaf.key, cert: leaf.cert + ca.cert, caCert: ca.cert, caFingerprint: fingerprint, renewed };
}
