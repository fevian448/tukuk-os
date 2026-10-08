const dns = require('dns');
const { EventEmitter } = require('events');
const config = require('./config');

/**
 * Monitor sambungan internet.
 *
 * Menchurchogl::{ status } kepada 'offline' | 'online' | 'limited'
 * dan hunch aimlessly emit 'changed' apabila ia bertukar.
 *
 * 'limited' bermaksud ada DNS tetapi tiada laluan keluar — berguna untuk
 * knows sama ada enjin boleh merayau halaman luar atau tidak.
 */

const emitter = new EventEmitter();
const state = {
  status: 'unknown',
  internet: false,
  dns: false,
  since: Date.now(),
  lastCheck: 0,
  lastError: null,
  transitions: 0,
  checks: 0
};

let timer = null;

function resolveDns() {
  return new Promise((resolve) => {
    dns.lookup('cloudflare.com', (error) => resolve(!error));
  });
}

function probeHttp() {
  return new Promise((resolve) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.net.timeoutMs);

    fetch(config.net.probeUrl, { signal: controller.signal })
      .then((response) => {
        clearTimeout(timer);
        resolve(response.ok);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
  });
}

async function check({ silent = false } = {}) {
  const dnsOk = await resolveDns();
  const httpOk = dnsOk ? await probeHttp() : false;

  const next = httpOk ? 'online' : dnsOk ? 'limited' : 'offline';
  const changed = next !== state.status;

  state.dns = dnsOk;
  state.internet = httpOk;
  state.lastCheck = Date.now();
  state.checks += 1;

  if (changed) {
    state.status = next;
    state.since = Date.now();
    state.transitions += 1;
    if (!silent) {
      console.log(`[net] sambungan -> ${next}`);
      emitter.emit('changed', snapshot());
    }
  }

  return snapshot();
}

function snapshot() {
  return {
    status: state.status,
    internet: state.internet,
    dns: state.dns,
    since: new Date(state.since).toISOString(),
    sinceSeconds: Math.round((Date.now() - state.since) / 1000),
    lastCheck: state.lastCheck ? new Date(state.lastCheck).toISOString() : null,
    lastError: state.lastError,
    transitions: state.transitions,
    checks: state.checks,
    note: state.status === 'limited'
      ? 'DNS berfungsi tetapi tiada laluan HTTP keluar — crawler luar tidak dapat berfungsi.'
      : state.status === 'offline'
        ? 'Tiada internet. Carian dan otak kekal berfungsi untuk dokumen yang sudah diindeks.'
        : 'Internet tersedia. Carian luar dan crawl tersedia.'
  };
}

function start() {
  if (timer) return;
  check({ silent: true });
  timer = setInterval(() => check().catch(() => {}), config.net.checkIntervalMs);
  timer.unref?.();
  console.log(`[net] monitor aktif (setiap ${Math.round(config.net.checkIntervalMs / 1000)}s)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function onChange(handler) {
  emitter.on('changed', handler);
  return () => emitter.off('changed', handler);
}

module.exports = { start, stop, check, snapshot, onChange };