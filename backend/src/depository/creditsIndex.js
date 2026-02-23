/**
 * Carbon Credit Depository — Current-state index for credits
 * Phase 1, Sprint 1.1 + 1.3 — Role: Fast lookup; creditId and serialNumber uniqueness (double-spend prevention).
 */

const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { STATUS } = require('./schema');

const DEFAULT_INDEX = { credits: [] };

/**
 * @param {string} indexPath - Path to credits index JSON file
 */
function createCreditsIndex(indexPath) {
  const dir = path.dirname(indexPath);
  const fs = require('fs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const adapter = new FileSync(indexPath);
  const db = low(adapter);
  db.defaults(DEFAULT_INDEX).write();

  return {
    getById(creditId) {
      return db.get('credits').find({ creditId: String(creditId) }).value();
    },

    getByOwner(ownerId) {
      const normalized = (ownerId || '').toLowerCase();
      if (!normalized) return [];
      return db.get('credits').filter((c) => c.ownerId === normalized && c.status === STATUS.ACTIVE).value();
    },

    getAllByOwner(ownerId) {
      const normalized = (ownerId || '').toLowerCase();
      if (!normalized) return [];
      return db.get('credits').filter((c) => c.ownerId === normalized).value();
    },

    hasId(creditId) {
      return !!db.get('credits').find({ creditId: String(creditId) }).value();
    },

    /** Sprint 1.3: Globally unique external serial (e.g. Verra); prevents double-counting across registries. */
    hasSerialNumber(serialNumber) {
      const s = (v) => (v != null && v !== '' ? String(v).trim() : '');
      const sn = s(serialNumber);
      if (!sn) return false;
      const credits = db.get('credits').value();
      return credits.some((c) => s(c.serialNumber) === sn);
    },

    add(record) {
      if (db.get('credits').find({ creditId: record.creditId }).value()) {
        throw new Error(`Depository: creditId already exists: ${record.creditId}`);
      }
      db.get('credits').push(record).write();
    },

    update(creditId, updater) {
      const r = db.get('credits').find({ creditId: String(creditId) });
      const current = r.value();
      if (!current) throw new Error(`Depository: credit not found: ${creditId}`);
      r.assign(updater(current)).write();
    },
  };
}

module.exports = { createCreditsIndex };
