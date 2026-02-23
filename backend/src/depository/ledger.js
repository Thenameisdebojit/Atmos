/**
 * Carbon Credit Depository — Append-only ledger
 * Phase 1, Sprint 1.1 + 1.3 — Role: Immutable audit log; no updates or deletes (immutability enforced by design).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const INITIAL_HASH = 'ATMOS_LEDGER_GENESIS';

/**
 * @param {string} ledgerPath - Path to .jsonl file
 * @returns {{ append: (entry: import('./schema').LedgerEntry) => Promise<void>, readAll: () => Promise<import('./schema').LedgerEntry[]> }}
 */
function createLedger(ledgerPath) {
  const dir = path.dirname(ledgerPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(ledgerPath)) {
    fs.writeFileSync(ledgerPath, '', 'utf8');
  }

  /** @type {string | null} */
  let lastHash = null;

  function hashEntry(previousHash, entryPayload) {
    const data = previousHash + JSON.stringify(entryPayload);
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Read all lines and return last known hash and next sequenceId
   */
  function readState() {
    const raw = fs.readFileSync(ledgerPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const entries = lines.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
    const last = entries[entries.length - 1];
    return {
      entries,
      lastHash: last ? last.auditHash : null,
      nextSequenceId: entries.length + 1,
    };
  }

  return {
    /**
     * Append a single ledger entry. Computes previousHash and auditHash.
     * @param {Omit<import('./schema').LedgerEntry, 'sequenceId' | 'previousHash' | 'auditHash'>} entryWithoutHash
     * @returns {Promise<import('./schema').LedgerEntry>} The appended entry (includes auditHash, sequenceId)
     */
    async append(entryWithoutHash) {
      const { entries, lastHash: prev, nextSequenceId } = readState();
      const previousHash = prev || INITIAL_HASH;
      const payload = {
        sequenceId: nextSequenceId,
        eventType: entryWithoutHash.eventType,
        creditId: entryWithoutHash.creditId,
        payload: entryWithoutHash.payload,
        timestamp: entryWithoutHash.timestamp,
        previousHash,
      };
      const auditHash = hashEntry(previousHash, payload);
      const entry = { ...payload, auditHash };
      fs.appendFileSync(ledgerPath, JSON.stringify(entry) + '\n', 'utf8');
      return entry;
    },

    async readAll() {
      const { entries } = readState();
      return entries;
    },

    async readPaginated(offset = 0, limit = 50) {
      const { entries } = readState();
      return entries.slice(offset, offset + limit);
    },

    /**
     * Sprint 1.3: Snapshot fingerprint for external audit. Anyone with the ledger file can recompute
     * snapshotHash and compare to verify integrity (no tampering of entries or order).
     * @returns {{ lastSequenceId: number, lastAuditHash: string | null, snapshotHash: string, entryCount: number }}
     */
    async getFingerprint() {
      const entries = await this.readAll();
      const last = entries[entries.length - 1];
      const lastSequenceId = last ? last.sequenceId : 0;
      const lastAuditHash = last ? last.auditHash : null;
      const concat = entries.map((e) => e.auditHash).join('');
      const snapshotHash =
        concat === ''
          ? crypto.createHash('sha256').update(INITIAL_HASH, 'utf8').digest('hex')
          : crypto.createHash('sha256').update(concat, 'utf8').digest('hex');
      return {
        lastSequenceId,
        lastAuditHash,
        snapshotHash,
        entryCount: entries.length,
      };
    },
  };
}

module.exports = { createLedger, INITIAL_HASH };
