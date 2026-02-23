/**
 * Phase 5: KYC verification registry (wallet allowlist for compliance hooks).
 * When KYC_REQUIRED=true, high-value / retire / transfer may require verified wallet.
 */

const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DEFAULT_DATA = { verifiedWallets: [] };

/**
 * @param {string} filePath - Path to kyc-verified.json
 */
function createKycStore(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const adapter = new FileSync(filePath);
  const db = low(adapter);
  db.defaults(DEFAULT_DATA).write();

  return {
    isVerified(walletAddress) {
      if (!walletAddress || typeof walletAddress !== 'string') return false;
      const w = walletAddress.trim().toLowerCase();
      const list = db.get('verifiedWallets').value();
      return Array.isArray(list) && list.some((x) => String(x).toLowerCase() === w);
    },

    addVerified(walletAddress) {
      const w = (walletAddress || '').trim().toLowerCase();
      if (!w || !/^0x[a-f0-9]{40}$/.test(w)) throw new Error('Invalid wallet address');
      const list = db.get('verifiedWallets').value();
      if (list.includes(w)) return;
      db.get('verifiedWallets').push(w).write();
    },

    listVerified() {
      return db.get('verifiedWallets').value();
    },
  };
}

module.exports = { createKycStore };