/**
 * Carbon Credit Depository — Settlements (completed transfers) for idempotency and non-repudiation
 * Phase 3 — Role: Key transfer results by idempotency key; provide confirmation / audit for settlement.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DEFAULT_DATA = { settlements: [], byIdempotencyKey: {} };

/**
 * @param {string} filePath - Path to settlements.json
 */
function createSettlementsStore(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const adapter = new FileSync(filePath);
  const db = low(adapter);
  db.defaults(DEFAULT_DATA).write();

  function generateSettlementId() {
    return 'STL-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  return {
    getByIdempotencyKey(key) {
      if (!key || typeof key !== 'string') return null;
      const k = String(key).trim();
      if (!k) return null;
      return db.get('settlements').find({ idempotencyKey: k }).value();
    },

    getBySettlementId(settlementId) {
      return db.get('settlements').find({ settlementId: String(settlementId) }).value();
    },

    /** Store completed settlement; key by idempotencyKey for idempotent retries */
    add(record) {
      const settlementId = record.settlementId || generateSettlementId();
      const entry = {
        ...record,
        settlementId,
      };
      db.get('settlements').push(entry).write();
      return entry;
    },

    list(limit = 50, offset = 0) {
      const all = db.get('settlements').value();
      return all.slice(offset, offset + limit);
    },
  };
}

module.exports = { createSettlementsStore };
