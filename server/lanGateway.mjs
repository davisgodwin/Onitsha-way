import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { isLocalNetwork, normalizeIp } from './net.mjs';

/**
 * LAN gateway for `npm run lan`: the single door that phones and other PCs on the same Wi-Fi use.
 * - Serves the built game (dist/) and passes /api and /socket through to the account server, which itself
 *   keeps listening on 127.0.0.1 only.
 * - Refuses every connection that does not come from this computer or the local network, so an accidental
 *   router port-forward does not put the prototype on the internet.
 * - Tells the account server each player's real address (rate limits, join code) with a secret header that
 *   only this gateway knows; a browser cannot fake it.
 */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };
const COMPRESS = /^(text\/|application\/(json|manifest\+json)|image\/svg|model\/gltf\+json)/;
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'te', 'trailer', 'x-forwarded-for', 'x-ow-gateway', 'x-ow-client-ip']);

export const CA_PATH = '/onitsha-way-local-ca.crt';
/**
 * With `tls` ({ key, cert, caCert }) the gateway speaks https, and plain-http visitors on the same port (someone
 * typing the address without https://) are redirected — the first byte of a connection tells the two apart.
 */
export function createGateway({ distDir, backendHost = '127.0.0.1', backendPort = 8787, secret, extraNets = [], tls = null, log = console } = {}) {
  if (!secret) throw Error('gateway secret required');
  const root = path.resolve(distDir), gz = new Map();
  const allowed = (sock) => isLocalNetwork(sock.remoteAddress, extraNets);
  const clientIp = (sock) => normalizeIp(sock.remoteAddress);
  const forwardHeaders = (req) => {
    const h = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k)) h[k] = v;
    h['x-ow-client-ip'] = clientIp(req.socket); h['x-ow-gateway'] = secret;
    return h;
  };

  function serveFile(req, res, file, stat) {
    const ext = path.extname(file).toLowerCase(), type = TYPES[ext] ?? 'application/octet-stream';
    const hashed = /\/assets\//.test(file.replaceAll('\\', '/'));
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Last-Modified', stat.mtime.toUTCString());
    if (!hashed && req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(stat.mtime.toUTCString())) { res.writeHead(304); res.end(); return; }
    if (COMPRESS.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '') && stat.size > 1024) {
      const key = `${file}:${stat.mtimeMs}`;
      let body = gz.get(key); if (!body) { body = zlib.gzipSync(fs.readFileSync(file), { level: 6 }); gz.set(key, body); }
      res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding'); res.setHeader('Content-Length', body.length);
      res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    res.setHeader('Content-Length', stat.size); res.writeHead(200);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let rel; try { rel = decodeURIComponent(pathname); } catch { res.writeHead(400); res.end(); return; }
    const file = path.resolve(root, '.' + path.posix.normalize('/' + rel));
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    let stat = fs.statSync(file, { throwIfNoEntry: false });
    if (stat?.isDirectory()) { const index = path.join(file, 'index.html'); stat = fs.statSync(index, { throwIfNoEntry: false }); if (stat) return serveFile(req, res, index, stat); }
    else if (stat?.isFile()) return serveFile(req, res, file, stat);
    if (!path.extname(rel)) { const index = path.join(root, 'index.html'), s = fs.statSync(index, { throwIfNoEntry: false }); if (s) return serveFile(req, res, index, s); }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found');
  }

  function proxyApi(req, res) {
    const up = http.request({ host: backendHost, port: backendPort, method: req.method, path: req.url, headers: forwardHeaders(req) }, (r) => {
      const headers = { ...r.headers }; delete headers.connection; delete headers['keep-alive'];
      res.writeHead(r.statusCode ?? 502, headers); r.pipe(res);
    });
    up.on('error', () => { if (!res.headersSent) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'The account server on the host computer is not running. Restart npm run lan there.' })); } else res.destroy(); });
    req.pipe(up);
  }

  const sendCa = (res) => { res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="onitsha-way-local-ca.crt"', 'Cache-Control': 'no-store' }); res.end(tls.caCert); };
  const handler = (req, res) => {
    if (!allowed(req.socket)) { res.writeHead(403, { 'Content-Type': 'text/plain' }); res.end('Onitsha Way LAN play is only open to devices on the same local network.'); return; }
    const pathname = new URL(req.url, 'http://lan').pathname;
    if (tls && pathname === CA_PATH) return sendCa(res);
    if (pathname === '/api' || pathname.startsWith('/api/')) return proxyApi(req, res);
    serveStatic(req, res, pathname);
  };
  const server = tls ? https.createServer({ key: tls.key, cert: tls.cert }, handler) : http.createServer(handler);

  server.on('upgrade', (req, socket, head) => {
    if (!allowed(socket) || new URL(req.url, 'http://lan').pathname !== '/socket') { socket.destroy(); return; }
    const up = net.connect(backendPort, backendHost, () => {
      const headers = forwardHeaders(req); headers.connection = 'Upgrade'; headers.upgrade = req.headers.upgrade;
      up.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(headers).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${k}: ${x}`)).join('\r\n')}\r\n\r\n`);
      if (head?.length) up.write(head);
      up.pipe(socket); socket.pipe(up);
    });
    const end = () => { up.destroy(); socket.destroy(); };
    up.on('error', end); socket.on('error', end); up.on('close', () => socket.destroy()); socket.on('close', () => up.destroy());
  });
  server.on('clientError', (e, socket) => socket.destroy());
  if (!tls) return server;

  // one port, both protocols: TLS handshakes start with byte 0x16; anything else is plain http → redirect to https
  const redirect = http.createServer((req, res) => {
    if (!allowed(req.socket)) { res.writeHead(403); res.end(); return; }
    if (new URL(req.url, 'http://lan').pathname === CA_PATH) return sendCa(res);
    const host = String(req.headers.host || '').replace(/[^\w.:[\]-]/g, '') || `${req.socket.localAddress}:${req.socket.localPort}`;
    res.writeHead(301, { Location: `https://${host}${req.url.startsWith('/') ? req.url : '/'}`, 'Cache-Control': 'no-store' }); res.end();
  });
  redirect.on('clientError', (e, socket) => socket.destroy());
  const front = net.createServer((sock) => {
    if (!allowed(sock)) { sock.destroy(); return; }
    sock.on('error', () => sock.destroy());
    sock.once('data', (buf) => { sock.pause(); sock.unshift(buf); (buf[0] === 0x16 ? server : redirect).emit('connection', sock); process.nextTick(() => sock.resume()); });
  });
  const close = front.close.bind(front);
  front.close = (cb) => { server.close(); redirect.close(); return close(cb); };
  return front;
}
