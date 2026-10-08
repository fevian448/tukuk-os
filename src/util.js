const dns = require('dns').promises;
const net = require('net');
const crypto = require('crypto');

const BLOCKED_V4 = [
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
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
];

function v4InRange(ip, cidr, bits) {
  const toLong = (value) => value.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (toLong(ip) & mask) === (toLong(cidr) & mask);
}

function isPrivateAddress(ip) {
  if (!net.isIP(ip)) return true;
  if (net.isIPv4(ip)) return BLOCKED_V4.some(([cidr, bits]) => v4InRange(ip, cidr, bits));
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return false;
}

async function assertPublicUrl(rawUrl, { allowPrivate = false } = {}) {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw Object.assign(new Error('Hanya protokol http dan https dibenarkan'), { statusCode: 400 });
  }
  if (!url.hostname) {
    throw Object.assign(new Error('URL tidak sah'), { statusCode: 400 });
  }

  if (allowPrivate) return url;

  if (net.isIP(url.hostname)) {
    if (isPrivateAddress(url.hostname)) {
      throw Object.assign(new Error('Alamat rangkaian dalaman tidak dibenarkan'), { statusCode: 400 });
    }
    return url;
  }

  if (/^(localhost|.*\.local|.*\.internal)$/i.test(url.hostname)) {
    throw Object.assign(new Error('Nama hos dalaman tidak dibenarkan'), { statusCode: 400 });
  }

  let records;
  try {
    records = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw Object.assign(new Error(`Tidak dapat menyelesaikan nama hos: ${url.hostname}`), { statusCode: 400 });
  }
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw Object.assign(new Error('Nama hos menyelesaikan ke alamat dalaman'), { statusCode: 400 });
  }
  return url;
}

function normalizeUrl(raw, base) {
  const url = new URL(raw, base);
  url.hash = '';
  for (const param of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|msclkid|ref|_ga)/i.test(param)) url.searchParams.delete(param);
  }
  url.searchParams.sort();
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.toString();
}

function sameSite(a, b) {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const strip = (host) => host.replace(/^www\./, '');
    return strip(ua.hostname) === strip(ub.hostname);
  } catch {
    return false;
  }
}

function documentId(url) {
  const normalized = String(url).replace(/\/+$/, '').toLowerCase();
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  return `u_${hash.slice(0, 24)}`;
}

function contentHash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function truncate(text, limit) {
  const value = String(text || '');
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).replace(/\s+\S*$/, '')}…`;
}

function decodeEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function safeError(error) {
  if (!error) return 'Ralat tidak diketahui';
  const status = error.statusCode || error.status || error.response?.status;
  return {
    message: error.message || 'Ralat tidak diketahui',
    ...(status ? { status } : {})
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  assertPublicUrl,
  isPrivateAddress,
  normalizeUrl,
  sameSite,
  documentId,
  contentHash,
  truncate,
  decodeEntities,
  safeError
};