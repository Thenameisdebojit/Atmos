# Carbon Wallet — Master Plan (Demat-Style Carbon Credit Depository)

**Goal:** Build a **Carbon Credit Depository (CCD)** — the authoritative ownership ledger for carbon credits — and a **Carbon Wallet** UI that displays Demat-style holdings. Credits are stored as entries in the central ledger (like NSDL for stocks), not "in" the app.

**Rules (mandatory):**
1. **No boilerplate** — Complete each piece end-to-end.
2. **Go slow, quality** — Sprint by sprint; follow Rule 1.
3. **Document** — For each implementation, state Phase, Sprint, and role in the wallet.

---

## Mapping: Demat → ATMOS Carbon

| Stock Market     | ATMOS Carbon System        |
|------------------|----------------------------|
| Shares           | Carbon Credits             |
| NSDL/CDSL        | Carbon Credit Depository  |
| Broker           | ATMOS App / Partners      |
| Demat Account    | Carbon Wallet             |
| SEBI             | Regulator / DAO Governance|

---

## Phase 0: Foundation (Done)

- [x] Architecture analysis (Demat → Carbon)
- [x] Decision: Registry first, then verification, settlement, then UI
- [x] Plan and sprint breakdown

---

## Phase 1: Carbon Credit Depository (CCD) — Registry / Ledger

**Role:** Central authoritative ledger. All credit ownership and lifecycle live here (with optional blockchain mirror later).

### Sprint 1.1 — Ledger schema + append-only storage + API ✅ DONE
**Batch 1.1.1** — Data model & storage  
- [x] Define canonical credit record: `creditId`, `projectId`, `co2Amount`, `ownerId` (wallet), `status`, `timestamp`, `auditHash`, methodology, vintage, geography, serialNumber.  
- [x] Implement append-only ledger store (`data/depository/ledger.jsonl`) — no updates/deletes, only appends.  
- [x] Implement current-state index (`data/depository/credits.json`) for fast lookup by owner and by creditId.

**Batch 1.1.2** — REST API  
- [x] `POST /depository/credits` — Register a new credit (issuance); append to ledger and index.  
- [x] `GET /depository/credits/:creditId` — Get one credit by ID.  
- [x] `GET /depository/credits?owner=0x...` — List credits by owner (Carbon Wallet will use this).  
- [x] `GET /depository/ledger` — Paginated audit log (ledger entries).

**Deliverable:** Backend that can store and serve credit records; Carbon Wallet will later call `GET /depository/credits?owner=...`. Implemented in `backend/src/depository/` and `backend/src/routes/depository.js`.

---

### Sprint 1.2 — Credit lifecycle + audit hash ✅ DONE
- [x] Status enum: `Active` | `Transferred` | `Retired`.  
- [x] On transfer: append TRANSFERRED ledger entry (from, to, transferredAt), update index (new ownerId, new auditHash); only Active credits transferable.  
- [x] On retire: append RETIRED ledger entry (retiredBy, reason, retiredAt), set status Retired in index with retiredAt and retirementReason; **retired credits are locked forever** (no further transfers).  
- [x] Each ledger entry includes `auditHash` (chain of previousHash + payload); existing ISSUED chain preserved.

**Deliverable:** Lifecycle and single-credit audit chain implemented in backend. API: `POST /depository/transfers` (body: creditId, fromOwner, toOwner), `POST /depository/credits/:creditId/retire` (body: retiredBy, reason).

---

### Sprint 1.3 — Double-spend prevention + audit trail ✅ DONE
- [x] Uniqueness: `creditId` globally unique (existing); `serialNumber` globally unique when provided — reject duplicate issuance with error "serialNumber already registered (double-counting prevention)".  
- [x] Transfer rules: only `Active` credits transferable (enforced in Sprint 1.2); single-credit model so no fractional balance / no negative.  
- [x] Snapshot hash for external audit: `GET /depository/ledger/verify` returns `{ lastSequenceId, lastAuditHash, snapshotHash, entryCount }`. `snapshotHash` = SHA-256 of concatenated audit hashes in order; anyone with the ledger file can recompute and verify.  
- [x] Immutability: ledger module is append-only by design (no update/delete methods); no API to edit or delete ledger rows.

**Deliverable:** No double counting; verifiable audit trail. Index: `hasSerialNumber()` in creditsIndex; Ledger: `getFingerprint()`; API: `GET /depository/ledger/verify`.

---

## Phase 2: Verification Layer ✅ DONE

- [x] Validator entity and API: `POST/GET /depository/validators`, `GET /depository/validators/:id`, `GET /depository/validators/:id/projects`. Validators have id, name, type (VERRA_VCS | GOLD_STANDARD | ICM_COMPLIANCE | INTERNAL), identifier, isActive.  
- [x] Project verification: `POST/GET /depository/projects`, `GET /depository/projects/:projectId`. Projects have projectId, name, methodology, validatorId (who verified), verifiedAt, optional oracleProofHash, isActive. Credits reference projectId; at issuance they can set verificationSourceId (validator) and optional verifiedAt, oracleProofHash.  
- [x] Oracle link: Credit and project records support optional `oracleProofHash` (64-char hex). Stored in depository ledger on ISSUED; returned on GET credit. Enables Chainlink/EmissionVerifier proof to be recorded and audited.

**Deliverable:** Credits in depository can be tied to verified projects and validators; oracle proof hash stored for on-chain verification. Implemented in `backend/src/depository/validatorsStore.js`, `projectsStore.js`; schema extensions and service/routes in `schema.js`, `service.js`, `routes/depository.js`. GET `/depository/credits/:creditId?expand=validator,project` returns embedded validator and project when requested.

---

## Phase 3: Settlement Engine ✅ DONE

- [x] Transfer API: `POST /depository/transfers` — body `creditId`, `fromOwner`, `toOwner`; optional `idempotencyKey` (or header `Idempotency-Key`). Idempotent: same key returns same result without re-executing.  
- [x] Settlement rules: validate ownership, status (Active), then append ledger + update index (unchanged from Phase 1).  
- [x] Confirmation + non-repudiation: response includes `settlementId`, `sequenceId`, `auditHash`, `confirmation` (settlementId, sequenceId, auditHash, creditId, fromOwner, toOwner, completedAt). `GET /depository/transfers/confirmations/:settlementId` and `GET /depository/transfers/confirmations?idempotencyKey=...` return stored settlement.  
- [x] Queue: optional `queue: true` in body → transfer enqueued, returns `202` with `requestId`. `GET /depository/transfers/requests/:requestId` for status. `POST /depository/transfers/process-queue` (body `limit`) processes pending requests (worker/cron).

**Deliverable:** Reliable, auditable transfer flow with idempotency and optional async queue. Implemented in `backend/src/depository/settlementsStore.js`, `transferQueue.js`; service `transferWithSettlement`, `getSettlementByKey`, `getSettlementById`, `enqueueTransfer`, `processTransferQueue`; routes in `routes/depository.js`.

---

## Phase 4: Carbon Wallet UI (Demat-style) ✅ DONE

- [x] Carbon Wallet page at `/carbon-wallet` (Demat-style account). “My Carbon Account” or “Carbon Wallet”.  
- [x] Fetch holdings: `GET /depository/credits?owner=...&activeOnly=false` via `fetchDepositoryCredits()` in `api.ts`.  
- [x] Display: StatCards (active/retired/total tonnes); table (Credit ID, Project, Tonnes, Methodology, Vintage, Status, Issued); toggle retired.  
- [ ] Optional (future): Sync or link to on-chain NFTs.  
- [x] Retire flow: Retire button → inline form → `POST .../credits/:id/retire`; toast + refetch.

**Deliverable:** User-facing Carbon Wallet; `frontend/src/app/carbon-wallet/page.tsx`, `api.ts`, `Header.tsx`.

---

## Phase 5: Security & Compliance ✅ DONE

- [x] **KYC hooks:** When `KYC_REQUIRED=true`, issuance (ownerId), transfer (fromOwner), and retire (retiredBy) require the wallet to be in the KYC allowlist. `kycStore` (file `data/depository/kyc-verified.json`) holds verified wallets. `GET /depository/kyc/check?wallet=0x...` returns `{ verified, kycRequired }`. `POST /depository/kyc/verified` (header `X-Admin-Key: <DEPOSITORY_KYC_ADMIN_KEY>`, body `{ wallet }`) adds a wallet.  
- [ ] **Ledger security:** TLS and secure storage are deployment/infra (use HTTPS and restricted file permissions in production).  
- [x] **Audit export:** `GET /depository/ledger/export?format=csv|json&offset=0&limit=5000` returns ledger as CSV or JSON for regulators (download filename set).  
- [x] **Rate limits:** Per-IP limits on `/depository`: GET 120/min, POST (and other mutations) 30/min (configurable via `DEPOSITORY_RATE_LIMIT_READ`, `DEPOSITORY_RATE_LIMIT_WRITE`). Middleware: `backend/src/middleware/rateLimit.js`; applied in `server.js`.

---

## Technology Choices (current stack)

- **Backend:** Node/Express (existing); add depository routes and ledger logic.  
- **Storage:** Append-only ledger file(s) + lowdb/JSON for index (later: PostgreSQL for ledger + index).  
- **Frontend:** Next.js; Carbon Wallet consumes depository API.  
- **Blockchain:** Keep existing CarbonCreditNFT/Token; depository can mirror or settle on-chain in later phase.

---

## Next step after Sprint 1.1

After completing **Sprint 1.1**, the suggested next step is **Sprint 1.2** (Credit lifecycle + audit hash), then **Sprint 1.3** (Double-spend prevention + audit trail). Then Phase 2 (Verification) or Phase 3 (Settlement) depending on priority.
