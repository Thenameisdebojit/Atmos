/**
 * Phase 5: Rate limiting for depository API (per IP).
 * In-memory store; use Redis in production for multi-instance.
 * GET requests count toward read limit, POST/PUT/DELETE toward write limit.
 */

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_READS_PER_WINDOW = Number(process.env.DEPOSITORY_RATE_LIMIT_READ) || 120;
const MAX_WRITES_PER_WINDOW = Number(process.env.DEPOSITORY_RATE_LIMIT_WRITE) || 30;

const readCounts = new Map();
const writeCounts = new Map();

function getClientId(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function checkLimit(store, limit) {
  const now = Date.now();
  return (req, res, next) => {
    const id = getClientId(req);
    let entry = store.get(id);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + WINDOW_MS };
      store.set(id, entry);
    }
    entry.count++;
    if (entry.count > limit) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests', retryAfter: Math.ceil((entry.resetAt - now) / 1000) });
    }
    next();
  };
}

const rateLimitRead = checkLimit(readCounts, MAX_READS_PER_WINDOW);
const rateLimitWrite = checkLimit(writeCounts, MAX_WRITES_PER_WINDOW);

/** Single middleware: GET uses read limit, other methods use write limit. */
function depositoryRateLimit(req, res, next) {
  if (req.method === 'GET') return rateLimitRead(req, res, next);
  return rateLimitWrite(req, res, next);
}

module.exports = { rateLimitRead, rateLimitWrite, depositoryRateLimit };