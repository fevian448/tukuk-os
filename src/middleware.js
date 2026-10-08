const config = require('./config');

const buckets = new Map();
let cleanupCounter = 0;

function clientKey(req) {
  if (config.rateLimit.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function rateLimit({ windowMs, max, keyPrefix = '' }) {
  return (req, res, next) => {
    const id = `${keyPrefix}${clientKey(req)}`;
    const now = Date.now();

    cleanupCounter += 1;
    if (cleanupCounter % 500 === 0) {
      for (const [key, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(key);
      }
    }

    let entry = buckets.get(id);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      buckets.set(id, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Terlalu banyak permintaan',
        retryAfterSeconds: retryAfter
      });
    }

    return next();
  };
}

function requireApiKey(req, res, next) {
  if (!config.security.apiKey) return next();

  const provided =
    req.headers['x-api-key'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (provided && provided === config.security.apiKey) return next();

  return res.status(401).json({ error: 'API key tidak sah atau tiada' });
}

module.exports = { rateLimit, requireApiKey, clientKey, buckets };