/**
 * Carbon Credit Depository — Transfer request queue for async settlement
 * Phase 3 — Role: Optional queue for transfer requests; process in order for blockchain sync / batch.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DEFAULT_DATA = { requests: [] };
const STATUS = Object.freeze({ PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed' });

/**
 * @param {string} filePath - Path to transfer-queue.json
 */
function createTransferQueue(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const adapter = new FileSync(filePath);
  const db = low(adapter);
  db.defaults(DEFAULT_DATA).write();

  function generateRequestId() {
    return 'TQR-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  return {
    STATUS,

    enqueue(payload) {
      const requestId = generateRequestId();
      const now = Date.now();
      const record = {
        requestId,
        creditId: payload.creditId,
        fromOwner: (payload.fromOwner || '').toLowerCase(),
        toOwner: (payload.toOwner || '').toLowerCase(),
        idempotencyKey: payload.idempotencyKey ? String(payload.idempotencyKey).trim() : undefined,
        status: STATUS.PENDING,
        createdAt: now,
        updatedAt: now,
        result: null,
        error: null,
      };
      db.get('requests').push(record).write();
      return record;
    },

    getByRequestId(requestId) {
      return db.get('requests').find({ requestId: String(requestId) }).value();
    },

    getPending(limit = 10) {
      return db.get('requests').filter({ status: STATUS.PENDING }).value().slice(0, limit);
    },

    setProcessing(requestId) {
      const r = db.get('requests').find({ requestId: String(requestId) });
      if (!r.value()) return null;
      r.assign({ status: STATUS.PROCESSING, updatedAt: Date.now() }).write();
      return r.value();
    },

    setCompleted(requestId, result) {
      const r = db.get('requests').find({ requestId: String(requestId) });
      if (!r.value()) return null;
      r.assign({ status: STATUS.COMPLETED, result, updatedAt: Date.now() }).write();
      return r.value();
    },

    setFailed(requestId, errorMessage) {
      const r = db.get('requests').find({ requestId: String(requestId) });
      if (!r.value()) return null;
      r.assign({ status: STATUS.FAILED, error: errorMessage, updatedAt: Date.now() }).write();
      return r.value();
    },

    list(limit = 50, offset = 0, statusFilter = null) {
      let chain = db.get('requests');
      if (statusFilter) chain = chain.filter({ status: statusFilter });
      const all = chain.value();
      return all.slice(offset, offset + limit);
    },
  };
}

module.exports = { createTransferQueue, STATUS: STATUS };
