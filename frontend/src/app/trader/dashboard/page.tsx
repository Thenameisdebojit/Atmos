'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Card, StatCard, Button } from '@/components/UI';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';

interface TraderData {
  name: string;
  email: string;
  phone: string;
  country: string;
  walletAddress: string;
  registrationDate: number;
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  creditCount: number;
}

const mockPriceHistory = [
  { date: '1/1', price: 22.5 },
  { date: '1/2', price: 23.1 },
  { date: '1/3', price: 22.8 },
  { date: '1/4', price: 24.2 },
  { date: '1/5', price: 25.0 },
  { date: '1/6', price: 24.5 },
  { date: '1/7', price: 26.3 },
];

const mockPortfolioHistory = [
  { month: 'Sep', value: 1000 },
  { month: 'Oct', value: 1200 },
  { month: 'Nov', value: 1150 },
  { month: 'Dec', value: 1400 },
  { month: 'Jan', value: 1650 },
  { month: 'Feb', value: 1800 },
];

const mockAssetAllocation = [
  { name: 'Solar Projects', value: 40, color: '#f59e0b' },
  { name: 'Wind Energy', value: 30, color: '#3b82f6' },
  { name: 'Reforestation', value: 20, color: '#22c55e' },
  { name: 'Ocean Carbon', value: 10, color: '#06b6d4' },
];

export default function TraderDashboard() {
  const { address, isConnected } = useAccount();
  const { getTraderData, getUserCredits } = useContractInteraction();

  const [trader, setTrader] = useState<TraderData | null>(null);
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }

    const fetchData = async () => {
      try {
        const traderData = await getTraderData(address);
        const userCredits = await getUserCredits(address);

        setTrader(traderData || {
          name: 'Carbon Trader',
          email: 'trader@example.com',
          phone: '+1 (555) 123-4567',
          country: 'United States',
          walletAddress: address,
          registrationDate: Date.now(),
          totalInvested: 5000,
          currentValue: 6200,
          totalProfit: 1200,
          creditCount: 250,
        });

        setCredits(userCredits || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching trader data:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [isConnected, address]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <Card className="p-12 text-center max-w-lg">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Connect Wallet to View Dashboard</h2>
            <p className="text-gray-400 mb-6">
              Click the <strong>"Connect"</strong> button in the top-right corner to access your trading dashboard.
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
            <p className="text-gray-400">Loading trader data...</p>
          </Card>
        </div>
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 text-center max-w-md">
            <h2 className="text-xl font-semibold text-white mb-4">Trader Account Not Found</h2>
            <p className="text-gray-400 mb-6">Register as a trader to start buying and selling carbon credits.</p>
            <Link href="/trader/register">
              <Button>Register as Trader</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const profitPercent = ((trader.totalProfit / trader.totalInvested) * 100).toFixed(2);
  const roi = trader.totalInvested > 0 ? ((trader.currentValue - trader.totalInvested) / trader.totalInvested * 100).toFixed(2) : '0.00';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">{trader.name}</h1>
              <p className="text-gray-400">Carbon Credit Trader</p>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm font-semibold">
                ✓ Active Trader
              </div>
            </div>
          </div>
        </div>

        {/* Portfolio Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Portfolio Value"
            value={`$${trader.currentValue.toFixed(2)}`}
            subtext="current holdings"
            change={parseFloat(roi)}
          />
          <StatCard
            label="Total Invested"
            value={`$${trader.totalInvested.toFixed(2)}`}
            subtext="capital deployed"
            change={0}
          />
          <StatCard
            label="Total Profit"
            value={`$${trader.totalProfit.toFixed(2)}`}
            subtext={`${profitPercent}% gain`}
            change={parseFloat(profitPercent)}
          />
          <StatCard
            label="Carbon Credits"
            value={trader.creditCount.toString()}
            subtext="tonnes owned"
            change={15}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          {['overview', 'portfolio', 'trading', 'analytics'].map(tab => (
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
              {/* Portfolio Value Chart */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-6">Portfolio Growth</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={mockPortfolioHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                      }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              {/* Quick Actions */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/marketplace">
                    <Button className="w-full">Buy Credits</Button>
                  </Link>
                  <Link href="/sell-credits">
                    <Button className="w-full" variant="secondary">Sell Credits</Button>
                  </Link>
                  <Link href="/auctions">
                    <Button className="w-full">View Auctions</Button>
                  </Link>
                  <Link href="/portfolio">
                    <Button className="w-full" variant="secondary">My Portfolio</Button>
                  </Link>
                </div>
              </Card>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              {/* Market Price */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Carbon Price</h3>
                <div className="mb-4">
                  <p className="text-3xl font-bold text-green-400">${mockPriceHistory[mockPriceHistory.length - 1].price}</p>
                  <p className="text-sm text-gray-400">per tonne CO₂</p>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={mockPriceHistory}>
                    <Line type="monotone" dataKey="price" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              {/* Asset Allocation */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Asset Allocation</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={mockAssetAllocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {mockAssetAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-4">
                  {mockAssetAllocation.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className="text-gray-300">{item.name}</span>
                      </div>
                      <span className="text-white font-semibold">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Account Info */}
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Account Info</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-400">Email</p>
                    <p className="text-white">{trader.email}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Country</p>
                    <p className="text-white">{trader.country}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Wallet</p>
                    <p className="text-white font-mono text-xs">{trader.walletAddress.slice(0, 10)}...{trader.walletAddress.slice(-8)}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            {credits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {credits.map((credit, idx) => (
                  <Card key={idx} className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-white">{credit.projectName || 'Carbon Credit'}</h4>
                        <p className="text-gray-400 text-sm">#{credit.id}</p>
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
                        <p className="text-gray-400">Value:</p>
                        <p className="text-white font-semibold">${(credit.co2Tonnes * 25).toFixed(2)}</p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-gray-400">Methodology:</p>
                        <p className="text-white">{credit.methodology}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-400 mb-4">No carbon credits in portfolio yet</p>
                <Link href="/marketplace">
                  <Button>Buy Credits Now</Button>
                </Link>
              </Card>
            )}
          </div>
        )}

        {/* Trading & Analytics Tabs */}
        {(activeTab === 'trading' || activeTab === 'analytics') && (
          <Card className="p-8 text-center">
            <p className="text-gray-400">Coming soon...</p>
          </Card>
        )}
      </main>
    </div>
  );
}
