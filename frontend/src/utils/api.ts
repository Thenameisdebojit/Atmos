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
