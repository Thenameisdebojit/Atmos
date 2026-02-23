/**
 * Carbon Credit Depository — Validators registry
 * Phase 2 — Role: Register and resolve verification sources (Verra, Gold Standard, internal); link credits to validators.
 */

const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DEFAULT_DATA = { validators: [] };

/**
 * @param {string} filePath - Path to validators.json
 */
function createValidatorsStore(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const adapter = new FileSync(filePath);
  const db = low(adapter);
  db.defaults(DEFAULT_DATA).write();

  return {
    getById(id) {
      return db.get('validators').find({ id: String(id) }).value();
    },

    list(activeOnly = false) {
      const chain = db.get('validators');
      const list = activeOnly ? chain.filter((v) => v.isActive !== false).value() : chain.value();
      return list;
    },

    add(record) {
      if (db.get('validators').find({ id: record.id }).value()) {
        throw new Error(`Depository: validator id already exists: ${record.id}`);
      }
      const now = Date.now();
      db.get('validators').push({ ...record, createdAt: now }).write();
    },

    update(id, updater) {
      const r = db.get('validators').find({ id: String(id) });
      const current = r.value();
      if (!current) throw new Error(`Depository: validator not found: ${id}`);
      r.assign(updater(current)).write();
    },
  };
}

module.exports = { createValidatorsStore };
