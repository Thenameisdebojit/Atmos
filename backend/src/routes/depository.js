/**
 * Carbon Credit Depository — REST API
 * Phase 1–5 — Register, query, transfer, retire; validators; settlement; KYC hooks; audit export.
 */

const express = require('express');
const { createLedger } = require('../depository/ledger');
const { createCreditsIndex } = require('../depository/creditsIndex');
const { createValidatorsStore } = require('../depository/validatorsStore');
const { createProjectsStore } = require('../depository/projectsStore');
const { createSettlementsStore } = require('../depository/settlementsStore');
const { createTransferQueue } = require('../depository/transferQueue');
const { createKycStore } = require('../depository/kycStore');
const { createWalletAuthStore } = require('../depository/walletAuthStore');
const { createDepositoryService } = require('../depository/service');
const path = require('path');

const DEPOSITORY_DATA = process.env.DEPOSITORY_DATA || path.join(__dirname, '..', '..', 'data', 'depository');
const LEDGER_PATH = path.join(DEPOSITORY_DATA, 'ledger.jsonl');
const INDEX_PATH = path.join(DEPOSITORY_DATA, 'credits.json');
const VALIDATORS_PATH = path.join(DEPOSITORY_DATA, 'validators.json');
const PROJECTS_PATH = path.join(DEPOSITORY_DATA, 'projects.json');
const SETTLEMENTS_PATH = path.join(DEPOSITORY_DATA, 'settlements.json');
const TRANSFER_QUEUE_PATH = path.join(DEPOSITORY_DATA, 'transfer-queue.json');
const KYC_PATH = path.join(DEPOSITORY_DATA, 'kyc-verified.json');
const WALLET_AUTH_PATH = path.join(DEPOSITORY_DATA, 'wallet-auth.json');

const ledger = createLedger(LEDGER_PATH);
const walletAuthStore = createWalletAuthStore(WALLET_AUTH_PATH);
const index = createCreditsIndex(INDEX_PATH);
const validatorsStore = createValidatorsStore(VALIDATORS_PATH);
const projectsStore = createProjectsStore(PROJECTS_PATH);
const settlementsStore = createSettlementsStore(SETTLEMENTS_PATH);
const transferQueue = createTransferQueue(TRANSFER_QUEUE_PATH);
const kycStore = createKycStore(KYC_PATH);
const depository = createDepositoryService(ledger, index, validatorsStore, projectsStore, settlementsStore, transferQueue);

const KYC_REQUIRED = process.env.KYC_REQUIRED === 'true' || process.env.KYC_REQUIRED === '1';

const router = express.Router();

function isValidWalletAddress(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

/** Phase 5: Return true if request should be blocked due to KYC (caller should send 403). */
function kycBlocked(wallet) {
  if (!KYC_REQUIRED || !wallet) return false;
  return !kycStore.isVerified(wallet);
}

// POST /depository/credits/register-claim — Register company claim credits in official Carbon Wallet (idempotent)
router.post('/credits/register-claim', async (req, res) => {
  try {
    const ownerId = req.body && req.body.ownerId;
    if (!ownerId) return res.status(400).json({ error: 'Body "ownerId" (wallet address) is required' });
    if (!isValidWalletAddress(ownerId)) return res.status(400).json({ error: 'Invalid wallet address' });
    const result = await depository.registerClaimCredits(ownerId);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Failed to register claim credits' });
  }
});

// POST /depository/credits — Register a new credit (issuance)
router.post('/credits', async (req, res) => {
  try {
    const body = req.body || {};
    if (kycBlocked(body.ownerId)) {
      return res.status(403).json({ error: 'KYC verification required for issuance', code: 'KYC_REQUIRED' });
    }
    const { credit, sequenceId } = await depository.registerCredit(body);
    res.status(201).json({ credit, sequenceId });
  } catch (e) {
    const status = e.message && e.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: e.message || 'Failed to register credit' });
  }
});

// GET /depository/credits?owner=0x... — List credits by owner (Carbon Wallet) — must be before :creditId
router.get('/credits', (req, res) => {
  const owner = req.query.owner;
  if (!owner) {
    return res.status(400).json({ error: 'Query parameter "owner" (wallet address) is required' });
  }
  if (!isValidWalletAddress(owner)) {
    return res.status(400).json({ error: 'Invalid wallet address for owner' });
  }
  const activeOnly = req.query.activeOnly !== 'false';
  const credits = depository.getCreditsByOwner(owner, activeOnly);
  res.json({ owner: owner.toLowerCase(), credits });
});

// GET /depository/credits/:creditId — Get one credit by ID (includes verificationSourceId, oracleProofHash when set)
router.get('/credits/:creditId', (req, res) => {
  const credit = depository.getCredit(req.params.creditId);
  if (!credit) return res.status(404).json({ error: 'Credit not found' });
  const expand = (req.query.expand || '').split(',').map((s) => s.trim()).filter(Boolean);
  let out = credit;
  if (expand.includes('validator') && credit.verificationSourceId) {
    const validator = depository.getValidator(credit.verificationSourceId);
    out = { ...credit, validator: validator || null };
  }
  if (expand.includes('project')) {
    const project = depository.getProject(credit.projectId);
    out = { ...out, project: project || null };
  }
  res.json(out);
});

// ---------- Phase 2: Validators ----------
// GET /depository/validators — List validators (optional ?activeOnly=true)
router.get('/validators', (req, res) => {
  const activeOnly = req.query.activeOnly === 'true';
  const list = depository.listValidators(activeOnly);
  res.json({ validators: list });
});
// GET /depository/validators/:id
router.get('/validators/:id', (req, res) => {
  const v = depository.getValidator(req.params.id);
  if (!v) return res.status(404).json({ error: 'Validator not found' });
  res.json(v);
});
// POST /depository/validators — Register validator
router.post('/validators', (req, res) => {
  try {
    const validator = depository.registerValidator(req.body || {});
    res.status(201).json(validator);
  } catch (e) {
    const status = e.message && e.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: e.message || 'Failed to register validator' });
  }
});

// ---------- Phase 2: Projects ----------
// GET /depository/projects — List projects (optional ?activeOnly=true)
router.get('/projects', (req, res) => {
  const activeOnly = req.query.activeOnly === 'true';
  const list = depository.listProjects(activeOnly);
  res.json({ projects: list });
});
// GET /depository/projects/:projectId
router.get('/projects/:projectId', (req, res) => {
  const p = depository.getProject(req.params.projectId);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(p);
});
// GET /depository/validators/:id/projects — Projects verified by this validator
router.get('/validators/:id/projects', (req, res) => {
  const list = depository.getProjectsByValidator(req.params.id);
  res.json({ validatorId: req.params.id, projects: list });
});
// POST /depository/projects — Register project (links project to validator + optional oracleProofHash)
router.post('/projects', (req, res) => {
  try {
    const project = depository.registerProject(req.body || {});
    res.status(201).json(project);
  } catch (e) {
    const status = e.message && e.message.includes('already exists') ? 409 : 400;
    res.status(status).json({ error: e.message || 'Failed to register project' });
  }
});

// ---------- Phase 3: Settlement engine ----------
// POST /depository/transfers/process-queue — Process pending transfer queue (worker/cron)
router.post('/transfers/process-queue', async (req, res) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.body?.limit, 10) || 10));
    const count = await depository.processTransferQueue(limit);
    res.status(200).json({ processed: count });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Queue processing failed' });
  }
});

// GET /depository/transfers/requests/:requestId — Queue request status
router.get('/transfers/requests/:requestId', (req, res) => {
  const req_ = depository.getTransferRequest(req.params.requestId);
  if (!req_) return res.status(404).json({ error: 'Transfer request not found' });
  res.json(req_);
});

// GET /depository/transfers/confirmations?idempotencyKey= — Get settlement by idempotency key (must be before :settlementId)
router.get('/transfers/confirmations', (req, res) => {
  const key = req.query.idempotencyKey;
  if (!key) return res.status(400).json({ error: 'Query idempotencyKey is required' });
  const s = depository.getSettlementByKey(key);
  if (!s) return res.status(404).json({ error: 'Settlement not found' });
  res.json(s);
});

// GET /depository/transfers/confirmations/:settlementId — Get settlement by ID (non-repudiation)
router.get('/transfers/confirmations/:settlementId', (req, res) => {
  const s = depository.getSettlementById(req.params.settlementId);
  if (!s) return res.status(404).json({ error: 'Settlement not found' });
  res.json(s);
});

// POST /depository/transfers — Transfer with idempotency + confirmation; optional queue
router.post('/transfers', async (req, res) => {
  try {
    const body = req.body || {};
    const { creditId, fromOwner, toOwner, idempotencyKey: bodyKey, queue: useQueue } = body;
    if (kycBlocked(fromOwner)) {
      return res.status(403).json({ error: 'KYC verification required for transfer', code: 'KYC_REQUIRED' });
    }
    const idempotencyKey = bodyKey || (req.headers && req.headers['idempotency-key']);
    if (!creditId || !fromOwner || !toOwner) {
      return res.status(400).json({ error: 'creditId, fromOwner, and toOwner are required' });
    }
    if (useQueue === true) {
      const rec = depository.enqueueTransfer({ creditId, fromOwner, toOwner, idempotencyKey });
      return res.status(202).json({
        message: 'Transfer queued',
        requestId: rec.requestId,
        status: rec.status,
      });
    }
    const result = await depository.transferWithSettlement(creditId, fromOwner, toOwner, idempotencyKey);
    res.status(200).json({
      credit: result.credit,
      sequenceId: result.sequenceId,
      settlementId: result.settlementId,
      auditHash: result.auditHash,
      confirmation: result.confirmation,
      idempotent: result.idempotent === true,
    });
  } catch (e) {
    if (e.message && e.message.includes('not found')) return res.status(404).json({ error: e.message });
    res.status(400).json({ error: e.message || 'Transfer failed' });
  }
});

// POST /depository/credits/:creditId/retire — Retire credit permanently (Sprint 1.2)
router.post('/credits/:creditId/retire', async (req, res) => {
  try {
    const creditId = req.params.creditId;
    const { retiredBy, reason } = req.body || {};
    if (!retiredBy) {
      return res.status(400).json({ error: 'retiredBy (current owner wallet) is required' });
    }
    if (kycBlocked(retiredBy)) {
      return res.status(403).json({ error: 'KYC verification required for retirement', code: 'KYC_REQUIRED' });
    }
    const { credit, sequenceId } = await depository.retireCredit(creditId, retiredBy, reason);
    res.status(200).json({ credit, sequenceId });
  } catch (e) {
    if (e.message && e.message.includes('not found')) return res.status(404).json({ error: e.message });
    res.status(400).json({ error: e.message || 'Retirement failed' });
  }
});

// GET /depository/ledger/verify — Sprint 1.3: Snapshot fingerprint for external audit (must be before /ledger)
router.get('/ledger/verify', async (_req, res) => {
  try {
    const fingerprint = await depository.getLedgerFingerprint();
    res.json(fingerprint);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to compute fingerprint' });
  }
});

// ---------- Phase 5: Audit export for regulators ----------
// GET /depository/ledger/export?format=csv|json&offset=0&limit=5000
router.get('/ledger/export', async (req, res) => {
  try {
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const limit = Math.min(10000, Math.max(1, parseInt(req.query.limit, 10) || 1000));
    const format = (req.query.format || 'json').toLowerCase();
    const entries = await depository.getLedger(offset, limit);
    if (format === 'csv') {
      const header = 'sequenceId,eventType,creditId,timestamp,previousHash,auditHash,payloadJson';
      const rows = entries.map((e) => {
        const payloadStr = JSON.stringify(e.payload || {}).replace(/"/g, '""');
        return [e.sequenceId, e.eventType, e.creditId, e.timestamp, e.previousHash || '', e.auditHash || '', `"${payloadStr}"`].join(',');
      });
      const csv = [header, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="depository-ledger-${offset}-${offset + entries.length}.csv"`);
      return res.send(csv);
    }
    res.setHeader('Content-Disposition', `attachment; filename="depository-ledger-${offset}-${offset + entries.length}.json"`);
    res.json({ offset, limit, entries });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Export failed' });
  }
});

// GET /depository/ledger — Paginated audit log
router.get('/ledger', async (req, res) => {
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const entries = await depository.getLedger(offset, limit);
  res.json({ offset, limit, entries });
});

// ---------- Phase 5: KYC check (public) ----------
// GET /depository/kyc/check?wallet=0x...
router.get('/kyc/check', (req, res) => {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ error: 'Query parameter "wallet" is required' });
  if (!isValidWalletAddress(wallet)) return res.status(400).json({ error: 'Invalid wallet address' });
  const verified = kycStore.isVerified(wallet);
  res.json({ wallet: wallet.toLowerCase(), verified, kycRequired: KYC_REQUIRED });
});

// ---------- Carbon Wallet: password protection (individual/company) ----------
// GET /depository/wallet/status?wallet=0x...
router.get('/wallet/status', (req, res) => {
  const wallet = req.query.wallet;
  if (!wallet) return res.status(400).json({ error: 'Query parameter "wallet" is required' });
  if (!isValidWalletAddress(wallet)) return res.status(400).json({ error: 'Invalid wallet address' });
  const status = walletAuthStore.getStatus(wallet);
  res.json({ wallet: wallet.toLowerCase(), ...status });
});

// POST /depository/wallet/set-password — Set or create password for Carbon Wallet
router.post('/wallet/set-password', (req, res) => {
  const { wallet, password } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'Body "wallet" is required' });
  if (!isValidWalletAddress(wallet)) return res.status(400).json({ error: 'Invalid wallet address' });
  if (!password) return res.status(400).json({ error: 'Body "password" is required' });
  try {
    walletAuthStore.setPassword(wallet, password);
    return res.status(200).json({ wallet: wallet.toLowerCase(), success: true });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Failed to set password' });
  }
});

// POST /depository/wallet/verify-password — Unlock Carbon Wallet
router.post('/wallet/verify-password', (req, res) => {
  const { wallet, password } = req.body || {};
  if (!wallet) return res.status(400).json({ error: 'Body "wallet" is required' });
  if (!isValidWalletAddress(wallet)) return res.status(400).json({ error: 'Invalid wallet address' });
  if (!password) return res.status(400).json({ error: 'Body "password" is required' });
  const ok = walletAuthStore.verifyPassword(wallet, password);
  if (!ok) return res.status(401).json({ error: 'Invalid password' });
  res.json({ wallet: wallet.toLowerCase(), verified: true });
});

// POST /depository/kyc/verified — Add wallet to KYC allowlist (requires X-Admin-Key header)
router.post('/kyc/verified', (req, res) => {
  const adminKey = process.env.DEPOSITORY_KYC_ADMIN_KEY;
  if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const wallet = req.body && req.body.wallet;
  if (!wallet) return res.status(400).json({ error: 'Body "wallet" is required' });
  if (!isValidWalletAddress(wallet)) return res.status(400).json({ error: 'Invalid wallet address' });
  try {
    kycStore.addVerified(wallet);
    return res.status(201).json({ wallet: wallet.toLowerCase(), verified: true });
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Failed to add' });
  }
});

module.exports = router;
