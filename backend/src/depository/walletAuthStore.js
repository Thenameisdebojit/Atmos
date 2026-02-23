/**
 * Carbon Wallet — password protection per wallet (individual/company).
 * Stores hashed password; used to lock/unlock official Carbon Wallet view.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const DEFAULT_DATA = { wallets: {} };
const SALT_SECRET = process.env.WALLET_PASSWORD_SALT || 'atmos-carbon-wallet-v1';

function hashPassword(wallet, password) {
  const w = (wallet || '').trim().toLowerCase();
  const p = String(password || '');
  return crypto.createHash('sha256').update(SALT_SECRET + w + p, 'utf8').digest('hex');
}

/**
 * @param {string} filePath - Path to wallet-auth.json
 */
function createWalletAuthStore(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const adapter = new FileSync(filePath);
  const db = low(adapter);
  db.defaults(DEFAULT_DATA).write();

  return {
    getStatus(walletAddress) {
      if (!walletAddress || typeof walletAddress !== 'string') return { hasPassword: false };
      const w = walletAddress.trim().toLowerCase();
      const rec = db.get('wallets').get(w).value();
      return { hasPassword: !!rec && !!rec.passwordHash };
    },

    setPassword(walletAddress, password) {
      const w = (walletAddress || '').trim().toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(w)) throw new Error('Invalid wallet address');
      if (!password || String(password).length < 6) throw new Error('Password must be at least 6 characters');
      const passwordHash = hashPassword(w, password);
      db.get('wallets').set(w, { passwordHash, createdAt: Date.now() }).write();
    },

    verifyPassword(walletAddress, password) {
      const w = (walletAddress || '').trim().toLowerCase();
      const rec = db.get('wallets').get(w).value();
      if (!rec || !rec.passwordHash) return false;
      const hash = hashPassword(w, password);
      return hash === rec.passwordHash;
    },
  };
}

module.exports = { createWalletAuthStore };