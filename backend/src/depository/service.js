/**
 * Carbon Credit Depository — Business logic
 * Phase 1 + Phase 2 — Role: Issuance, transfer, retire; validators & projects; verification/oracle link.
 */

const { STATUS, EVENT_TYPES, validateCreditPayload, validateValidatorPayload, validateProjectPayload, isValidWalletAddress } = require('./schema');

/**
 * @param {ReturnType<import('./ledger').createLedger>} ledger
 * @param {ReturnType<import('./creditsIndex').createCreditsIndex>} index
 * @param {ReturnType<import('./validatorsStore').createValidatorsStore>} [validatorsStore]
 * @param {ReturnType<import('./projectsStore').createProjectsStore>} [projectsStore]
 * @param {ReturnType<import('./settlementsStore').createSettlementsStore>} [settlementsStore]
 * @param {ReturnType<import('./transferQueue').createTransferQueue>} [transferQueue]
 */
function createDepositoryService(ledger, index, validatorsStore = null, projectsStore = null, settlementsStore = null, transferQueue = null) {
  return {
    /**
     * Register a new carbon credit (issuance). Optionally link to validator and/or oracle proof (Phase 2).
     * @param {Object} payload - Raw API payload (creditId, projectId, ownerId, co2Amount, ... verificationSourceId?, verifiedAt?, oracleProofHash?)
     * @returns {{ credit: import('./schema').CreditRecord, sequenceId: number }}
     */
    async registerCredit(payload) {
      const validated = validateCreditPayload(payload);
      if (index.hasId(validated.creditId)) {
        throw new Error(`Depository: creditId already exists: ${validated.creditId}`);
      }
      if (validated.serialNumber && index.hasSerialNumber(validated.serialNumber)) {
        throw new Error(`Depository: serialNumber already registered (double-counting prevention): ${validated.serialNumber}`);
      }
      if (validated.verificationSourceId && validatorsStore) {
        const validator = validatorsStore.getById(validated.verificationSourceId);
        if (!validator) throw new Error(`Depository: validator not found: ${validated.verificationSourceId}`);
        if (validator.isActive === false) throw new Error(`Depository: validator is inactive: ${validated.verificationSourceId}`);
      }

      const now = Date.now();
      const credit = {
        creditId: validated.creditId,
        projectId: validated.projectId,
        co2Amount: validated.co2Amount,
        ownerId: validated.ownerId,
        status: STATUS.ACTIVE,
        methodology: validated.methodology,
        vintageYear: validated.vintageYear,
        geography: validated.geography,
        serialNumber: validated.serialNumber,
        issuedAt: now,
        auditHash: '', // set after ledger append
        ...(validated.verificationSourceId && { verificationSourceId: validated.verificationSourceId }),
        ...(validated.verifiedAt != null && { verifiedAt: validated.verifiedAt }),
        ...(validated.oracleProofHash && { oracleProofHash: validated.oracleProofHash }),
      };

      const ledgerPayload = {
        eventType: EVENT_TYPES.ISSUED,
        creditId: credit.creditId,
        payload: {
          projectId: credit.projectId,
          co2Amount: credit.co2Amount,
          ownerId: credit.ownerId,
          methodology: credit.methodology,
          vintageYear: credit.vintageYear,
          geography: credit.geography,
          serialNumber: credit.serialNumber,
          issuedAt: credit.issuedAt,
          ...(credit.verificationSourceId && { verificationSourceId: credit.verificationSourceId }),
          ...(credit.verifiedAt != null && { verifiedAt: credit.verifiedAt }),
          ...(credit.oracleProofHash && { oracleProofHash: credit.oracleProofHash }),
        },
        timestamp: now,
      };

      const appended = await ledger.append(ledgerPayload);
      credit.auditHash = appended.auditHash;
      index.add(credit);
      return { credit, sequenceId: appended.sequenceId };
    },

    // ---------- Phase 2: Validators ----------
    registerValidator(payload) {
      const validated = validateValidatorPayload(payload);
      if (!validatorsStore) throw new Error('Depository: validators store not configured');
      validatorsStore.add(validated);
      return validatorsStore.getById(validated.id);
    },
    getValidator(id) {
      if (!validatorsStore) return null;
      return validatorsStore.getById(id) || null;
    },
    listValidators(activeOnly = false) {
      if (!validatorsStore) return [];
      return validatorsStore.list(activeOnly);
    },

    // ---------- Phase 2: Projects ----------
    registerProject(payload) {
      const validated = validateProjectPayload(payload);
      if (!projectsStore) throw new Error('Depository: projects store not configured');
      if (validatorsStore) {
        const v = validatorsStore.getById(validated.validatorId);
        if (!v) throw new Error(`Depository: validator not found: ${validated.validatorId}`);
        if (v.isActive === false) throw new Error(`Depository: validator is inactive: ${validated.validatorId}`);
      }
      projectsStore.add(validated);
      return projectsStore.getById(validated.projectId);
    },
    getProject(projectId) {
      if (!projectsStore) return null;
      return projectsStore.getById(projectId) || null;
    },
    listProjects(activeOnly = false) {
      if (!projectsStore) return [];
      return projectsStore.list(activeOnly);
    },
    getProjectsByValidator(validatorId) {
      if (!projectsStore) return [];
      return projectsStore.getByValidatorId(validatorId);
    },

    getCredit(creditId) {
      return index.getById(creditId) || null;
    },

    /**
     * Register company claim credits in the depository (so they appear in Official Carbon Wallet).
     * Idempotent: only creates credits that don't already exist (ATMOS-CLAIM-{walletSlice}-1..5).
     */
    async registerClaimCredits(ownerId) {
      if (!ownerId || typeof ownerId !== 'string') throw new Error('ownerId is required');
      const owner = ownerId.trim().toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(owner)) throw new Error('Invalid wallet address');
      const prefix = `ATMOS-CLAIM-${owner.slice(2, 12)}`;
      const created = [];
      for (let i = 1; i <= 5; i++) {
        const creditId = `${prefix}-${i}`;
        if (index.hasId(creditId)) continue;
        const { credit } = await this.registerCredit({
          creditId,
          projectId: 'ATMOS-REGISTRATION',
          ownerId: owner,
          co2Amount: 1,
          methodology: 'ICM_COMPLIANCE',
          vintageYear: new Date().getFullYear(),
          geography: 'GLOBAL',
        });
        created.push(credit);
      }
      return { registered: created.length, credits: created };
    },

    getCreditsByOwner(ownerId, activeOnly = true) {
      return activeOnly ? index.getByOwner(ownerId) : index.getAllByOwner(ownerId);
    },

    getLedger(offset, limit) {
      return ledger.readPaginated(offset, limit);
    },

    /** Sprint 1.3: Audit fingerprint for external verification (snapshot hash over all ledger audit hashes). */
    async getLedgerFingerprint() {
      return ledger.getFingerprint();
    },

    /**
     * Transfer a credit from current owner to new owner. Only Active credits can be transferred.
     * Appends TRANSFERRED to ledger and updates index (new owner, new auditHash).
     * Phase 1, Sprint 1.2 — Role: Lifecycle transition; audit chain preserved.
     * @param {string} creditId
     * @param {string} fromOwner - Current owner (wallet); must match credit.ownerId
     * @param {string} toOwner - New owner (wallet)
     * @returns {{ credit: object, sequenceId: number }}
     */
    async transferCredit(creditId, fromOwner, toOwner) {
      const credit = index.getById(creditId);
      if (!credit) throw new Error(`Depository: credit not found: ${creditId}`);
      if (credit.status !== STATUS.ACTIVE) {
        throw new Error(`Depository: only Active credits can be transferred; current status: ${credit.status}`);
      }
      const from = (fromOwner || '').toLowerCase();
      const to = (toOwner || '').toLowerCase();
      if (credit.ownerId !== from) throw new Error(`Depository: fromOwner does not match current owner`);
      if (!isValidWalletAddress(to)) throw new Error(`Depository: toOwner must be a valid wallet address`);
      if (from === to) throw new Error(`Depository: toOwner must be different from fromOwner`);

      const now = Date.now();
      const ledgerPayload = {
        eventType: EVENT_TYPES.TRANSFERRED,
        creditId,
        payload: { from, to, transferredAt: now },
        timestamp: now,
      };
      const appended = await ledger.append(ledgerPayload);
      index.update(creditId, (r) => ({
        ...r,
        ownerId: to,
        auditHash: appended.auditHash,
      }));
      const updated = index.getById(creditId);
      return { credit: updated, sequenceId: appended.sequenceId, auditHash: appended.auditHash };
    },

    /**
     * Phase 3: Transfer with idempotency key and settlement confirmation (non-repudiation).
     * If idempotencyKey was already used, returns the same result without re-executing.
     * @param {string} creditId
     * @param {string} fromOwner
     * @param {string} toOwner
     * @param {string} [idempotencyKey]
     * @returns {{ credit: object, sequenceId: number, settlementId: string, auditHash: string, confirmation: object }}
     */
    async transferWithSettlement(creditId, fromOwner, toOwner, idempotencyKey) {
      const key = idempotencyKey && String(idempotencyKey).trim();
      if (key && settlementsStore) {
        const existing = settlementsStore.getByIdempotencyKey(key);
        if (existing) {
          const credit = index.getById(existing.creditId);
          return {
            credit: credit || existing.creditSnapshot,
            sequenceId: existing.sequenceId,
            settlementId: existing.settlementId,
            auditHash: existing.auditHash,
            confirmation: {
              settlementId: existing.settlementId,
              sequenceId: existing.sequenceId,
              auditHash: existing.auditHash,
              creditId: existing.creditId,
              fromOwner: existing.fromOwner,
              toOwner: existing.toOwner,
              completedAt: existing.completedAt,
            },
            idempotent: true,
          };
        }
      }

      const { credit, sequenceId, auditHash } = await this.transferCredit(creditId, fromOwner, toOwner);
      const now = Date.now();
      let settlementId = null;
      if (settlementsStore) {
        const entry = settlementsStore.add({
          idempotencyKey: key || undefined,
          creditId,
          fromOwner: (fromOwner || '').toLowerCase(),
          toOwner: (toOwner || '').toLowerCase(),
          sequenceId,
          auditHash,
          completedAt: now,
          creditSnapshot: credit,
        });
        settlementId = entry.settlementId;
      }

      return {
        credit,
        sequenceId,
        settlementId,
        auditHash,
        confirmation: settlementId
          ? {
              settlementId,
              sequenceId,
              auditHash,
              creditId,
              fromOwner: (fromOwner || '').toLowerCase(),
              toOwner: (toOwner || '').toLowerCase(),
              completedAt: now,
            }
          : null,
        idempotent: false,
      };
    },

    getSettlementByKey(idempotencyKey) {
      if (!settlementsStore) return null;
      return settlementsStore.getByIdempotencyKey(idempotencyKey);
    },
    getSettlementById(settlementId) {
      if (!settlementsStore) return null;
      return settlementsStore.getBySettlementId(settlementId);
    },
    listSettlements(limit, offset) {
      if (!settlementsStore) return [];
      return settlementsStore.list(limit, offset);
    },

    /** Phase 3: Enqueue transfer for async processing; returns requestId. */
    enqueueTransfer(payload) {
      if (!transferQueue) throw new Error('Depository: transfer queue not configured');
      return transferQueue.enqueue(payload);
    },
    getTransferRequest(requestId) {
      if (!transferQueue) return null;
      return transferQueue.getByRequestId(requestId);
    },
    /** Process up to limit pending transfer requests; returns processed count. */
    async processTransferQueue(limit = 10) {
      if (!transferQueue || !settlementsStore) return 0;
      const pending = transferQueue.getPending(limit);
      let count = 0;
      for (const req of pending) {
        transferQueue.setProcessing(req.requestId);
        try {
          const result = await this.transferWithSettlement(
            req.creditId,
            req.fromOwner,
            req.toOwner,
            req.idempotencyKey
          );
          transferQueue.setCompleted(req.requestId, result);
          count++;
        } catch (e) {
          transferQueue.setFailed(req.requestId, e.message || 'Transfer failed');
        }
      }
      return count;
    },

    /**
     * Retire a credit permanently. Only Active credits can be retired; retired credits are locked forever.
     * Appends RETIRED to ledger and updates index (status Retired, retiredAt, retirementReason, auditHash).
     * Phase 1, Sprint 1.2 — Role: Prevents reuse fraud; non-reversible.
     * @param {string} creditId
     * @param {string} retiredBy - Owner retiring the credit (must match credit.ownerId)
     * @param {string} [reason] - Optional retirement reason (e.g. "Scope 1 offset 2024")
     * @returns {{ credit: object, sequenceId: number }}
     */
    async retireCredit(creditId, retiredBy, reason = '') {
      const credit = index.getById(creditId);
      if (!credit) throw new Error(`Depository: credit not found: ${creditId}`);
      if (credit.status !== STATUS.ACTIVE) {
        throw new Error(`Depository: only Active credits can be retired; current status: ${credit.status}`);
      }
      const by = (retiredBy || '').toLowerCase();
      if (credit.ownerId !== by) throw new Error(`Depository: retiredBy must be the current owner`);

      const now = Date.now();
      const ledgerPayload = {
        eventType: EVENT_TYPES.RETIRED,
        creditId,
        payload: { retiredBy: by, reason: String(reason || '').trim(), retiredAt: now },
        timestamp: now,
      };
      const appended = await ledger.append(ledgerPayload);
      index.update(creditId, (r) => ({
        ...r,
        status: STATUS.RETIRED,
        retiredAt: now,
        retirementReason: String(reason || '').trim(),
        auditHash: appended.auditHash,
      }));
      const updated = index.getById(creditId);
      return { credit: updated, sequenceId: appended.sequenceId };
    },
  };
}

module.exports = { createDepositoryService };
