export interface CompanyProfilePayload {
  walletAddress: string;
  name: string;
  legalEntityId: string;
  email: string;
  phone: string;
  scope1Emissions: number;
  scope2Emissions: number;
  scope3Emissions: number;
  registrationDate: number;
}

export interface CompanyProfile extends CompanyProfilePayload {
  updatedAt: number;
}

const getBackendUrl = () => {
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
};

// ---------- Phase 4: Carbon Wallet — Depository API ----------

export interface DepositoryCredit {
  creditId: string;
  projectId: string;
  co2Amount: number;
  ownerId: string;
  status: 'Active' | 'Transferred' | 'Retired';
  methodology: string;
  vintageYear: number;
  geography: string;
  serialNumber: string;
  issuedAt: number;
  auditHash: string;
  retiredAt?: number;
  retirementReason?: string;
  verificationSourceId?: string;
  verifiedAt?: number;
  oracleProofHash?: string;
}

export interface DepositoryCreditsResponse {
  owner: string;
  credits: DepositoryCredit[];
}

export const fetchDepositoryCredits = async (
  owner: string,
  activeOnly = false
): Promise<DepositoryCreditsResponse> => {
  const baseUrl = getBackendUrl();
  const params = new URLSearchParams({ owner });
  if (activeOnly) params.set('activeOnly', 'true');
  const response = await fetch(`${baseUrl}/depository/credits?${params}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to fetch depository credits');
  }
  return response.json();
};

export const retireDepositoryCredit = async (
  creditId: string,
  retiredBy: string,
  reason = ''
): Promise<{ credit: DepositoryCredit; sequenceId: number }> => {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/depository/credits/${encodeURIComponent(creditId)}/retire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ retiredBy, reason }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Failed to retire credit');
  }
  return response.json();
};

// Carbon Wallet: password protection (official wallet lock)
export const getCarbonWalletStatus = async (wallet: string): Promise<{ hasPassword: boolean }> => {
  const baseUrl = getBackendUrl();
  const res = await fetch(`${baseUrl}/depository/wallet/status?wallet=${encodeURIComponent(wallet)}`);
  if (!res.ok) throw new Error('Failed to get wallet status');
  const data = await res.json();
  return { hasPassword: !!data.hasPassword };
};

export const setCarbonWalletPassword = async (wallet: string, password: string): Promise<void> => {
  const baseUrl = getBackendUrl();
  const res = await fetch(`${baseUrl}/depository/wallet/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Failed to set password');
  }
};

export const verifyCarbonWalletPassword = async (wallet: string, password: string): Promise<boolean> => {
  const baseUrl = getBackendUrl();
  const res = await fetch(`${baseUrl}/depository/wallet/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, password }),
  });
  if (res.status === 401) return false;
  if (!res.ok) throw new Error('Verification failed');
  return true;
};

/** Derive official account number from wallet address (ATMOS-ACC-XXXXXXXXXXXX). */
export const getCarbonAccountNumber = (walletAddress: string): string => {
  if (!walletAddress || walletAddress.length < 14) return 'ATMOS-ACC-N/A';
  return 'ATMOS-ACC-' + walletAddress.slice(2, 14).toUpperCase();
};

/** Register claimed company credits in the official Carbon Wallet (depository). Call after on-chain claim. */
export const registerClaimCreditsInDepository = async (ownerId: string): Promise<{ registered: number; credits: unknown[] }> => {
  const baseUrl = getBackendUrl();
  const res = await fetch(`${baseUrl}/depository/credits/register-claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || 'Failed to register credits in Carbon Wallet');
  }
  return res.json();
};

export const fetchCompanyProfile = async (walletAddress: string) => {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/companies/${encodeURIComponent(walletAddress)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to fetch company profile');
  }

  const data = await response.json();
  return {
    ...data,
    scope1Emissions: Number(data.scope1Emissions ?? 0),
    scope2Emissions: Number(data.scope2Emissions ?? 0),
    scope3Emissions: Number(data.scope3Emissions ?? 0),
    registrationDate: Number(data.registrationDate ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  } as CompanyProfile;
};

export const saveCompanyProfile = async (payload: CompanyProfilePayload) => {
  const baseUrl = getBackendUrl();
  const response = await fetch(`${baseUrl}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to save company profile');
  }

  const data = await response.json();
  return {
    ...data,
    scope1Emissions: Number(data.scope1Emissions ?? 0),
    scope2Emissions: Number(data.scope2Emissions ?? 0),
    scope3Emissions: Number(data.scope3Emissions ?? 0),
    registrationDate: Number(data.registrationDate ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  } as CompanyProfile;
};
