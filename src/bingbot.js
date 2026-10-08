'use strict';

// Pengesahan Bingbot mengikut kaedah rasmi Bing Webmaster Tools:
//   1. Reverse DNS IP mesti berakhir dengan `.search.msn.com`
//   2. Forward-confirm: hostname itu mesti resolve balik ke IP yang sama
//   3. Isyarat ketiga: IP ada dalam senarai rasmi bing.com/toolbox/bingbot.json
//      (sesetengah subnet sah tiada rDNS tetapi tersenarai di situ)

const dns = require('dns').promises;
const net = require('net');
const https = require('https');

const RDNS_SUFFIX = '.search.msn.com';
const IP_LIST_URL = 'https://www.bing.com/toolbox/bingbot.json';
const DOCS = {
  verify: 'https://www.bing.com/webmasters/help/how-to-verify-bingbot-3905dc26',
  report: 'https://www.bing.com/webmasters/help?topicid=25c19802',
  tool: 'https://www.bing.com/toolbox/verify-bingbot',
  ipList: IP_LIST_URL
};

const LIST_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam
let listCache = { at: 0, v4: [], v6: [], status: 'never' };

function getJson(url, ms = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: ms }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2e6) req.destroy(new Error('respons terlalu besar'));
      });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('masa tamat')));
    req.on('error', reject);
  });
}

function collectCidrs(node, out) {
  if (typeof node === 'string') {
    if (/^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/.test(node)) out.v4.push(node);
    else if (node.includes(':') && node.includes('/') && !node.includes('://')) out.v6.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectCidrs(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) collectCidrs(value, out);
  }
}

async function loadIpList() {
  if (listCache.status !== 'never' && Date.now() - listCache.at < LIST_TTL_MS) return listCache;
  try {
    const data = await getJson(IP_LIST_URL);
    const out = { v4: [], v6: [] };
    collectCidrs(data, out);
    if (!out.v4.length && !out.v6.length) throw new Error('senarai kosong');
    listCache = { at: Date.now(), v4: out.v4, v6: out.v6, status: 'ok' };
  } catch (error) {
    listCache = { ...listCache, at: Date.now(), status: listCache.status === 'ok' ? 'stale' : 'failed' };
  }
  return listCache;
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function inCidrV4(ip, cidrs) {
  const value = ipv4ToInt(ip);
  return cidrs.some((cidr) => {
    const [base, bitsStr] = cidr.split('/');
    const bits = Number(bitsStr);
    if (!(bits >= 0 && bits <= 32) || !net.isIPv4(base)) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((value & mask) >>> 0) === ((ipv4ToInt(base) & mask) >>> 0);
  });
}

// Best-effort: banding prefix heks (kedua-dua belas tanpa ':')
function inCidrV6(ip, cidrs) {
  const norm = ip.toLowerCase().replace(/:/g, '');
  return cidrs.some((cidr) => {
    const [base, bitsStr] = cidr.split('/');
    const bits = Number(bitsStr) || 128;
    if (!base.includes(':')) return false;
    const hexChars = Math.floor(bits / 4);
    const baseHex = base.toLowerCase().replace(/:/g, '');
    return norm.startsWith(baseHex.slice(0, hexChars));
  });
}

async function reverseLookup(ip) {
  try {
    const hostnames = await dns.reverse(ip);
    return Array.isArray(hostnames) ? hostnames : [];
  } catch {
    return []; // tiada PTR — bukan ralat
  }
}

async function forwardMatches(hostname, ip) {
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    return { ok: addrs.some((entry) => entry.address === ip), addresses: addrs.map((entry) => entry.address) };
  } catch {
    return { ok: false, addresses: [] };
  }
}

function verdictText(verdict, why) {
  const label = {
    verified: 'VALID BINGBOT',
    mismatch: 'SUSPICIOUS — rDNS TETAPI FORWARD TIDAK SEPADAN',
    'not-bingbot': 'NOT BINGBOT',
    inconclusive: 'INCONCLUSIVE'
  }[verdict] || verdict;
  return { label, why };
}

async function verify(rawIp) {
  const ip = String(rawIp || '').trim();
  if (!net.isIP(ip)) {
    return {
      valid: false,
      error: 'IP tidak sah — contoh: 157.55.39.212 atau 2603:1020:200::5'
    };
  }

  const startedAt = Date.now();
  const hostnames = await reverseLookup(ip);
  const matched = hostnames.filter((name) => name.toLowerCase().endsWith(RDNS_SUFFIX));
  const forward = matched.length
    ? await forwardMatches(matched[0], ip)
    : { ok: false, addresses: [] };

  const list = await loadIpList();
  const published = list.status === 'ok'
    ? (net.isIPv4(ip) ? inCidrV4(ip, list.v4) : inCidrV6(ip, list.v6))
    : null;

  let verdict;
  let why;
  if (matched.length && forward.ok) {
    verdict = 'verified';
    why = 'rDNS berakhir .search.msn.com dan forward-confirm sepadan';
  } else if (matched.length && !forward.ok) {
    verdict = 'mismatch';
    why = 'hostname rDNS sepadan suffix tetapi resolve balik bukan kepada IP ini';
  } else if (published === true) {
    verdict = 'verified';
    why = 'tiada rDNS tetapi IP tersenarai dalam senarai rasmi bingbot.json';
  } else if (published === false) {
    verdict = 'not-bingbot';
    why = 'tiada rDNS search.msn.com dan IP tidak dalam senarai rasmi';
  } else {
    verdict = 'inconclusive';
    why = 'tiada rDNS dan senarai IP rasmi tidak dapat dimuat';
  }

  const { label } = verdictText(verdict, why);
  return {
    valid: true,
    ip,
    verdict,
    label,
    why,
    rdns: { hostnames, matched: matched[0] || null },
    forward: { checked: matched.length > 0, ok: forward.ok, addresses: forward.addresses },
    publishedList: published,
    listStatus: list.status,
    checkedAt: new Date().toISOString(),
    tookMs: Date.now() - startedAt,
    docs: DOCS
  };
}

module.exports = { verify, DOCS };
