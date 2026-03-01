'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Card, StatCard, Button } from '@/components/UI';
import toast from 'react-hot-toast';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { fetchCompanyProfile, CompanyProfile } from '@/utils/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

interface CompanyData {
  name: string;
  legalEntityId: string;
  scope1: bigint;
  scope2: bigint;
  scope3: bigint;
  totalEmissions: bigint;
  availableCredits: bigint;
  walletAddress: string;
  email: string;
  phone: string;
  isVerified: boolean;
  registrationDate: number;
}

const mockEmissionsHistory = [
  { month: 'Jan', scope1: 120, scope2: 80, scope3: 100 },
  { month: 'Feb', scope1: 135, scope2: 85, scope3: 110 },
  { month: 'Mar', scope1: 140, scope2: 90, scope3: 115 },
  { month: 'Apr', scope1: 125, scope2: 88, scope3: 105 },
  { month: 'May', scope1: 130, scope2: 92, scope3: 120 },
  { month: 'Jun', scope1: 145, scope2: 95, scope3: 125 },
];

export default function CompanyDashboard() {
  const { address, isConnected } = useAccount();
  const { getCompanyData, getUserCredits } = useContractInteraction();

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch all data in parallel instead of sequentially
        const [companyDataRaw, userCredits, profileData] = await Promise.all([
          getCompanyData(address).catch((error) => {
            console.error('Error fetching on-chain company data:', error);
            return null;
          }),
          getUserCredits(address).catch((error) => {
            console.error('Error fetching user credits:', error);
            return [];
          }),
          fetchCompanyProfile(address).catch((error) => {
            console.error('Error fetching company profile:', error);
            return null;
          }),
        ]);

        // Transform tuple to CompanyData object if returned from contract
        let companyData: CompanyData | null = null;
        if (companyDataRaw && Array.isArray(companyDataRaw)) {
          companyData = {
            name: companyDataRaw[0] as string,
            legalEntityId: companyDataRaw[1] as string,
            scope1: BigInt(companyDataRaw[2]),
            scope2: BigInt(companyDataRaw[3]),
            scope3: BigInt(companyDataRaw[4]),
            totalEmissions: BigInt(companyDataRaw[2]) + BigInt(companyDataRaw[3]) + BigInt(companyDataRaw[4]),
            availableCredits: BigInt(companyDataRaw[5]),
            walletAddress: address,
            email: profileData?.email || 'Not provided',
            phone: profileData?.phone || 'Not provided',
            isVerified: companyDataRaw[6] as boolean,
            registrationDate: profileData?.registrationDate || Date.now(),
          };
        }

        const creditsTotal = (userCredits || []).reduce(
          (sum, credit) => sum + (Number(credit?.co2Tonnes) || 0),
          0
        );

        if (!companyData && profileData) {
          const scope1 = Number(profileData.scope1Emissions || 0);
          const scope2 = Number(profileData.scope2Emissions || 0);
          const scope3 = Number(profileData.scope3Emissions || 0);
          const totalEmissions = scope1 + scope2 + scope3;

          companyData = {
            name: profileData.name,
            legalEntityId: profileData.legalEntityId,
            scope1: BigInt(Math.floor(scope1 * 1e18)),
            scope2: BigInt(Math.floor(scope2 * 1e18)),
            scope3: BigInt(Math.floor(scope3 * 1e18)),
            totalEmissions: BigInt(Math.floor(totalEmissions * 1e18)),
            availableCredits: BigInt(Math.floor(creditsTotal * 1e18)),
            walletAddress: address,
            email: profileData.email,
            phone: profileData.phone,
            isVerified: false,
            registrationDate: profileData.registrationDate || Date.now(),
          };
        }

        setCompany(companyData);
        setCredits(userCredits || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching company data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [isConnected, address, getCompanyData, getUserCredits]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <Card className="p-12 text-center max-w-lg">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Connect Wallet to View Dashboard</h2>
            <p className="text-gray-400 mb-6">
              Click the <strong>"Connect"</strong> button in the top-right corner to access your company dashboard.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading company data...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 text-center max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Company Not Found</h2>
            <p className="text-gray-400 mb-6">You haven't registered yet. Register your company to get started.</p>
            <Link href="/company/register">
              <Button>Register Company</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const totalEmissions = Number(company.totalEmissions) / 1e18;
  const availableCredits = Number(company.availableCredits) / 1e18;
  const creditsNeeded = totalEmissions - availableCredits;
  const creditsDeficit = creditsNeeded > 0 ? creditsNeeded : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{company.name}</h1>
              <p className="text-gray-400">
                Legal ID: <span className="text-gray-300">{company.legalEntityId}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {company.isVerified && (
                <div className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm font-semibold">
                  ✓ Verified
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Emissions"
            value={`${totalEmissions.toFixed(2)}`}
            subtext="tonnes CO₂"
            change={5}
          />
          <StatCard
            label="Available Credits"
            value={`${availableCredits.toFixed(2)}`}
            subtext="tonnes CO₂"
            change={12}
          />
          {creditsDeficit > 0 && (
            <StatCard
              label="Credits Needed"
              value={`${creditsDeficit.toFixed(2)}`}
              subtext="tonnes CO₂"
              change={creditsDeficit > 50 ? 15 : 8}
            />
          )}
          <StatCard
            label="Credit Coverage"
            value={`${((availableCredits / totalEmissions) * 100).toFixed(1)}%`}
            subtext="compliance status"
            change={8}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          {['overview', 'emissions', 'credits', 'requests'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-semibold transition-colors capitalize ${
                activeTab === tab
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Contact Card */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-400 text-sm">Email</p>
                    <p className="text-white font-mono">{company.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Phone</p>
                    <p className="text-white">{company.phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Wallet Address</p>
                    <p className="text-white font-mono text-sm">{company.walletAddress.slice(0, 10)}...{company.walletAddress.slice(-8)}</p>
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/credit-requests">
                    <Button className="w-full">Request Credits</Button>
                  </Link>
                  <Link href="/marketplace">
                    <Button className="w-full" variant="secondary">Buy Credits</Button>
                  </Link>
                  <Link href="/sell-credits">
                    <Button className="w-full">Sell Credits</Button>
                  </Link>
                  <Link href="/auctions">
                    <Button className="w-full" variant="secondary">Bid on Auctions</Button>
                  </Link>
                </div>
              </Card>
            </div>

            {/* Status Card */}
            <Card className="p-6 h-fit sticky top-8">
              <h3 className="text-lg font-semibold text-white mb-4">Status</h3>
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400 text-sm font-semibold">Registration Status</p>
                  <p className="text-white font-bold">✓ Verified</p>
                </div>
                
                {creditsDeficit > 0 && (
                  <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                    <p className="text-orange-400 text-sm font-semibold">Action Required</p>
                    <p className="text-white font-bold">{creditsDeficit.toFixed(2)} credits needed</p>
                    <p className="text-gray-400 text-xs mt-2">Buy or request more credits to cover emissions</p>
                  </div>
                )}

                {availableCredits >= totalEmissions && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-blue-400 text-sm font-semibold">Compliant Status</p>
                    <p className="text-white font-bold">✓ Fully Covered</p>
                    <p className="text-gray-400 text-xs mt-2">Consider selling excess credits</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Emissions Tab */}
        {activeTab === 'emissions' && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-6">Monthly Emissions Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockEmissionsHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                    cursor={{ fill: 'rgba(34, 197, 94, 0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="scope1" stackId="a" fill="#ef4444" name="Scope 1" />
                  <Bar dataKey="scope2" stackId="a" fill="#f59e0b" name="Scope 2" />
                  <Bar dataKey="scope3" stackId="a" fill="#3b82f6" name="Scope 3" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Scope Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-gray-400">Scope 1 - Direct Emissions</p>
                    <p className="text-white font-semibold">{(Number(company.scope1) / 1e18).toFixed(2)} tonnes</p>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{width: '38%'}}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-gray-400">Scope 2 - Indirect Energy</p>
                    <p className="text-white font-semibold">{(Number(company.scope2) / 1e18).toFixed(2)} tonnes</p>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-amber-500 h-2 rounded-full" style={{width: '27%'}}></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-gray-400">Scope 3 - Indirect Other</p>
                    <p className="text-white font-semibold">{(Number(company.scope3) / 1e18).toFixed(2)} tonnes</p>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{width: '35%'}}></div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Credits Tab */}
        {activeTab === 'credits' && (
          <div className="space-y-6">
            {credits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {credits.map((credit, idx) => (
                  <Card key={idx} className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{credit.projectName || 'Carbon Credit'}</h4>
                        <p className="text-gray-400 text-sm">Token ID: #{credit.id}</p>
                      </div>
                      <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded text-green-400 text-xs font-semibold">
                        Active
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <p className="text-gray-400">Amount:</p>
                        <p className="text-white font-semibold">{credit.co2Tonnes} tonnes</p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-gray-400">Methodology:</p>
                        <p className="text-white">{credit.methodology}</p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-gray-400">Vintage Year:</p>
                        <p className="text-white">{credit.vintageYear}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-400 mb-4">No carbon credits yet</p>
                <Link href="/marketplace">
                  <Button>Buy Credits Now</Button>
                </Link>
              </Card>
            )}
          </div>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <div className="space-y-6">
            <Card className="p-6 text-center">
              <p className="text-gray-400 mb-4">You have no pending credit requests</p>
              <Link href="/credit-requests">
                <Button>Request Credits</Button>
              </Link>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
