/**
 * Carbon Credit Depository — Data schema and validation
 * Phase 1, Sprint 1.1 — Role: Canonical shape for credit records and ledger entries.
 */

const STATUS = Object.freeze({
  ACTIVE: 'Active',
  TRANSFERRED: 'Transferred',
  RETIRED: 'Retired',
});

const EVENT_TYPES = Object.freeze({
  ISSUED: 'ISSUED',
  TRANSFERRED: 'TRANSFERRED',
  RETIRED: 'RETIRED',
});

const METHODOLOGIES = Object.freeze([
  'ICM_COMPLIANCE',
  'VERRA_VCS',
  'GOLD_STANDARD',
]);

/** Phase 2: Verification layer — validator types (Verra, Gold Standard, internal, etc.) */
const VALIDATOR_TYPES = Object.freeze([
  'VERRA_VCS',
  'GOLD_STANDARD',
  'ICM_COMPLIANCE',
  'INTERNAL',
]);

/** @typedef {typeof STATUS[keyof STATUS]} CreditStatus */

/**
 * Current state of a single carbon credit in the depository index.
 * @typedef {Object} CreditRecord
 * @property {string} creditId - Unique ID (e.g. ATMOS-CC-00001 or UUID)
 * @property {string} projectId - Project identifier
 * @property {number} co2Amount - Tonnes CO2 (e.g. 1.5)
 * @property {string} ownerId - Wallet address (0x...)
 * @property {CreditStatus} status - Active | Transferred | Retired
 * @property {string} methodology - ICM_COMPLIANCE | VERRA_VCS | GOLD_STANDARD
 * @property {number} vintageYear - Year of reduction
 * @property {string} geography - Country/region code
 * @property {string} serialNumber - External registry serial (if any)
 * @property {number} issuedAt - Issuance timestamp (ms)
 * @property {string} auditHash - Hash of latest ledger event for this credit
 * @property {number} [retiredAt] - Set when status is Retired
 * @property {string} [retirementReason] - Optional reason for retirement
 * @property {string} [verificationSourceId] - Phase 2: ID of validator that verified this credit
 * @property {number} [verifiedAt] - Phase 2: Timestamp of verification
 * @property {string} [oracleProofHash] - Phase 2: On-chain proof hash (e.g. Chainlink attestation)
 */

/**
 * One append-only ledger entry (one line in ledger file).
 * @typedef {Object} LedgerEntry
 * @property {number} sequenceId - Monotonic sequence
 * @property {string} eventType - ISSUED | TRANSFERRED | RETIRED
 * @property {string} creditId - Credit this event refers to
 * @property {Object} payload - Event-specific data
 * @property {number} timestamp - Event time (ms)
 * @property {string} previousHash - Hash of previous ledger entry (chain)
 * @property {string} auditHash - Hash of (previousHash + payload)
 */

function isValidWalletAddress(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value) && value !== '0x0000000000000000000000000000000000000000';
}

function validateCreditPayload(payload) {
  const err = (msg) => new Error(`Depository validation: ${msg}`);
  if (!payload || typeof payload !== 'object') throw err('payload must be an object');
  const s = (v) => (v != null && v !== '' ? String(v).trim() : '');
  const creditId = s(payload.creditId);
  const projectId = s(payload.projectId);
  const ownerId = (payload.ownerId || '').trim();
  const methodology = s(payload.methodology);

  if (!creditId) throw err('creditId is required');
  if (!projectId) throw err('projectId is required');
  if (!ownerId) throw err('ownerId is required');
  if (!isValidWalletAddress(ownerId)) throw err('ownerId must be a valid wallet address');

  const co2Amount = Number(payload.co2Amount);
  if (Number.isNaN(co2Amount) || co2Amount <= 0) throw err('co2Amount must be a positive number');

  if (methodology && !METHODOLOGIES.includes(methodology)) throw err(`methodology must be one of: ${METHODOLOGIES.join(', ')}`);

  const verificationSourceId = s(payload.verificationSourceId);
  const verifiedAt = payload.verifiedAt != null ? Number(payload.verifiedAt) : null;
  const oracleProofHash = s(payload.oracleProofHash);
  if (oracleProofHash && !/^0x[a-fA-F0-9]{64}$/.test(oracleProofHash) && !/^[a-fA-F0-9]{64}$/.test(oracleProofHash)) {
    throw err('oracleProofHash must be a 64-char hex string (with or without 0x prefix)');
  }

  return {
    creditId,
    projectId,
    co2Amount,
    ownerId: ownerId.toLowerCase(),
    methodology: methodology || 'VERRA_VCS',
    vintageYear: Math.floor(Number(payload.vintageYear) || new Date().getFullYear()),
    geography: s(payload.geography) || 'GLOBAL',
    serialNumber: s(payload.serialNumber) || '',
    verificationSourceId: verificationSourceId || undefined,
    verifiedAt: verifiedAt != null && !Number.isNaN(verifiedAt) ? verifiedAt : undefined,
    oracleProofHash: oracleProofHash || undefined,
  };
}

/** Phase 2: Validator payload for registerValidator */
function validateValidatorPayload(payload) {
  const err = (msg) => new Error(`Depository validation: ${msg}`);
  if (!payload || typeof payload !== 'object') throw err('payload must be an object');
  const s = (v) => (v != null && v !== '' ? String(v).trim() : '');
  const id = s(payload.id);
  const name = s(payload.name);
  const type = s(payload.type);
  const identifier = s(payload.identifier);
  if (!id) throw err('validator id is required');
  if (!name) throw err('validator name is required');
  if (!type) throw err('validator type is required');
  if (!VALIDATOR_TYPES.includes(type)) throw err(`validator type must be one of: ${VALIDATOR_TYPES.join(', ')}`);
  if (!identifier) throw err('validator identifier (wallet or org id) is required');
  return {
    id,
    name,
    type,
    identifier: identifier.toLowerCase(),
    isActive: payload.isActive !== false,
  };
}

/** Phase 2: Project payload for registerProject */
function validateProjectPayload(payload, methodologyOptional = false) {
  const err = (msg) => new Error(`Depository validation: ${msg}`);
  if (!payload || typeof payload !== 'object') throw err('payload must be an object');
  const s = (v) => (v != null && v !== '' ? String(v).trim() : '');
  const projectId = s(payload.projectId);
  const name = s(payload.name);
  const methodology = s(payload.methodology);
  const validatorId = s(payload.validatorId);
  if (!projectId) throw err('projectId is required');
  if (!name) throw err('project name is required');
  if (!methodologyOptional && !methodology) throw err('methodology is required');
  if (methodology && !METHODOLOGIES.includes(methodology)) throw err(`methodology must be one of: ${METHODOLOGIES.join(', ')}`);
  if (!validatorId) throw err('validatorId is required');
  const oracleProofHash = s(payload.oracleProofHash);
  if (oracleProofHash && !/^0x[a-fA-F0-9]{64}$/.test(oracleProofHash) && !/^[a-fA-F0-9]{64}$/.test(oracleProofHash)) {
    throw err('oracleProofHash must be a 64-char hex string');
  }
  return {
    projectId,
    name,
    methodology: methodology || 'VERRA_VCS',
    validatorId,
    verifiedAt: payload.verifiedAt != null ? Number(payload.verifiedAt) : Date.now(),
    oracleProofHash: oracleProofHash || undefined,
    isActive: payload.isActive !== false,
  };
}

module.exports = {
  STATUS,
  EVENT_TYPES,
  METHODOLOGIES,
  VALIDATOR_TYPES,
  validateCreditPayload,
  validateValidatorPayload,
  validateProjectPayload,
  isValidWalletAddress,
};
