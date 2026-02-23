'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Send,
  Download,
  Eye,
  EyeOff,
  ArrowRight,
  Flame,
} from 'lucide-react';
import {
  Card,
  StatCard,
  Badge,
  Button,
  LoadingSkeleton,
} from '@/components/UI';
import { Header } from '@/components/Header';
import { formatCurrency, formatCarbonTonnes, formatRelativeTime } from '@/utils/format';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface AssetHolding {
  id: string;
  projectName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalValue: number;
  methodology: string;
  unrealizedGain: number;
}

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'retire' | 'invest';
  projectName: string;
  quantity: number;
  pricePerTonne: number;
  totalValue: number;
  date: number;
  status: 'completed' | 'pending';
  txHash: string;
}

interface Investment {
  id: string;
  projectName: string;
  amountInvested: number;
  amountReturned: number;
  creditsGenerated: number;
  status: 'active' | 'completed';
  startDate: number;
  expectedEndDate: number;
  apy: number;
}

const mockAssets: AssetHolding[] = [
  {
    id: '1',
    projectName: 'Solar Farm Alpha',
    quantity: 5000,
    averagePrice: 16.5,
    currentPrice: 18.5,
    totalValue: 92500,
    methodology: 'VERRA_VCS',
    unrealizedGain: 10000,
  },
  {
    id: '2',
    projectName: 'Reforestation Beta',
    quantity: 3000,
    averagePrice: 19.0,
    currentPrice: 22.0,
    totalValue: 66000,
    methodology: 'GOLD_STANDARD',
    unrealizedGain: 9000,
  },
  {
    id: '3',
    projectName: 'Wind Energy Gamma',
    quantity: 2500,
    averagePrice: 18.0,
    currentPrice: 19.75,
    totalValue: 49375,
    methodology: 'ICM_COMPLIANCE',
    unrealizedGain: 4375,
  },
];

const mockTransactions: Transaction[] = [
  {
    id: '1',
    type: 'buy',
    projectName: 'Solar Farm Alpha',
    quantity: 1000,
    pricePerTonne: 18.5,
    totalValue: 18500,
    date: Date.now() / 1000 - 86400,
    status: 'completed',
    txHash: '0x1234567890abcdef',
  },
  {
    id: '2',
    type: 'sell',
    projectName: 'Wind Energy Gamma',
    quantity: 500,
    pricePerTonne: 19.2,
    totalValue: 9600,
    date: Date.now() / 1000 - 172800,
    status: 'completed',
    txHash: '0x2345678901bcdef',
  },
  {
    id: '3',
    type: 'retire',
    projectName: 'Reforestation Beta',
    quantity: 500,
    pricePerTonne: 22.0,
    totalValue: 11000,
    date: Date.now() / 1000 - 259200,
    status: 'completed',
    txHash: '0x3456789012cdef',
  },
  {
    id: '4',
    type: 'invest',
    projectName: 'Methane Capture Project',
    quantity: 0,
    pricePerTonne: 0,
    totalValue: 50000,
    date: Date.now() / 1000 - 345600,
    status: 'pending',
    txHash: '0x456789023def',
  },
];

const mockInvestments: Investment[] = [
  {
    id: '1',
    projectName: 'Solar Farm Expansion',
    amountInvested: 100000,
    amountReturned: 0,
    creditsGenerated: 0,
    status: 'active',
    startDate: Date.now() / 1000 - 2592000,
    expectedEndDate: Date.now() / 1000 + 7776000,
    apy: 12.5,
  },
  {
    id: '2',
    projectName: 'Reforestation Premium',
    amountInvested: 50000,
    amountReturned: 5500,
    creditsGenerated: 1250,
    status: 'active',
    startDate: Date.now() / 1000 - 5184000,
    expectedEndDate: Date.now() / 1000 + 5184000,
    apy: 15.0,
  },
];

const mockPortfolioHistory = [
  { date: '2024-01-01', value: 195000 },
  { date: '2024-01-02', value: 198000 },
  { date: '2024-01-03', value: 195000 },
  { date: '2024-01-04', value: 202000 },
  { date: '2024-01-05', value: 210000 },
  { date: '2024-01-06', value: 207875 },
  { date: '2024-01-07', value: 207875 },
];

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

export default function PortfolioPage() {
  const {
    getUserCredits,
    getCarbonPrice,
    isConnected,
    address,
  } = useContractInteraction();

  const { startListening, stopListening } = useRealtimeEvents(
    (event) => {
      console.log('Trade event:', event);
      // Update portfolio on trade
    },
    (event) => {
      console.log('Credit event:', event);
      // Update assets on mint/retire
    }
  );

  const [showHiddenValues, setShowHiddenValues] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'transactions' | 'investments'>(
    'overview'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [userAssets, setUserAssets] = useState<AssetHolding[]>([]);
  const [carbonPrice, setCarbonPrice] = useState(0);

  // Fetch user data on mount or when wallet connects
  useEffect(() => {
    const fetchPortfolioData = async () => {
      if (!isConnected || !address) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Get user's carbon credits
        const credits = await getUserCredits(address);
        
        // Get current carbon price
        const price = await getCarbonPrice();
        if (price) {
          setCarbonPrice(price);
        }

        // Transform credits to asset holdings
        const assets: AssetHolding[] = credits.map((credit, index) => ({
          id: credit.id.toString(),
          projectName: credit.projectName,
          quantity: credit.co2Tonnes,
          averagePrice: credit.price,
          currentPrice: price || credit.price,
          totalValue: credit.co2Tonnes * (price || credit.price),
          methodology: credit.methodology,
          unrealizedGain: credit.co2Tonnes * ((price || credit.price) - credit.price),
        }));

        setUserAssets(assets);
        
        // Start listening to real-time events
        startListening();
      } catch (error) {
        console.error('Error fetching portfolio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolioData();

    return () => {
      stopListening();
    };
  }, [isConnected, address, getUserCredits, getCarbonPrice, startListening, stopListening]);

  // Use user assets if available, otherwise use mock data
  const assets = userAssets.length > 0 ? userAssets : mockAssets;
  const totalAssets = assets.reduce((sum, asset) => sum + asset.totalValue, 0);
  const totalInvested = mockInvestments.reduce(
    (sum, inv) => sum + inv.amountInvested,
    0
  );
  const totalRetired = 1500; // Mock value
  const totalUnrealizedGain = mockAssets.reduce(
    (sum, asset) => sum + asset.unrealizedGain,
    0
  );

  const assetallocationData = assets.map((asset) => ({
    name: asset.projectName,
    value: asset.totalValue,
  }));

  return (
    <div className="min-h-screen bg-dark-950">
      <Header walletAddress={address} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Your Portfolio</h1>
          <p className="text-dark-400">Manage your carbon credit holdings</p>
          {!isConnected && (
            <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400 text-sm">
              💡 Connect your wallet to view your real carbon credit holdings and portfolio
            </div>
          )}
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isLoading ? (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <LoadingSkeleton key={i} height="h-32" />
              ))}
            </>
          ) : (
            <>
              <StatCard
                label="Portfolio Value"
                value={
                  showHiddenValues
                    ? formatCurrency(totalAssets)
                    : '*****'
                }
                icon={<Wallet className="w-5 h-5" />}
                change={5.2}
                subtext="Total holdings"
              />
              <StatCard
                label="Unrealized Gain"
                value={
                  showHiddenValues
                    ? formatCurrency(totalUnrealizedGain)
                    : '*****'
                }
                icon={<TrendingUp className="w-5 h-5" />}
                change={12.5}
                subtext="Profit potential"
              />
              <StatCard
                label="Active Investments"
                value={formatCurrency(totalInvested)}
                icon={<Send className="w-5 h-5" />}
                subtext="In 2 projects"
              />
              <StatCard
                label="Credits Retired"
                value={formatCarbonTonnes(totalRetired)}
                icon={<Flame className="w-5 h-5" />}
                subtext="Permanently offset"
              />
            </>
          )}
        </div>

        {/* Privacy Toggle */}
        <div className="flex justify-end mb-8">
          <Button
            size="sm"
            variant="ghost"
            icon={showHiddenValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            onClick={() => setShowHiddenValues(!showHiddenValues)}
          >
            {showHiddenValues ? 'Hide Values' : 'Show Values'}
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-dark-800">
          {(['overview', 'assets', 'transactions', 'investments'] as const).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-400'
                    : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                {tab}
              </button>
            )
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Portfolio Chart */}
            <div className="lg:col-span-2">
              <Card className="space-y-4 h-full">
                <h2 className="text-xl font-semibold">Portfolio Value Trend</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mockPortfolioHistory}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1e293b"
                      vertical={false}
                    />
                    <XAxis dataKey="date" stroke="#475569" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#475569" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        background: '#0f172a',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => formatCurrency(value as number)}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#22c55e"
                      dot={false}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Asset Allocation */}
            <Card className="space-y-4">
              <h2 className="text-xl font-semibold">Asset Allocation</h2>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={assetallocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {assetallocationData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(value as number)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 text-sm">
                {mockAssets.map((asset, idx) => (
                  <div
                    key={asset.id}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ background: COLORS[idx] }}
                    />
                    <span className="text-dark-400 flex-1">{asset.projectName}</span>
                    <span className="font-medium">
                      {((asset.totalValue / totalAssets) * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Assets Tab */}
        {activeTab === 'assets' && (
          <div className="space-y-6">
            {mockAssets.map((asset) => (
              <Card key={asset.id} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{asset.projectName}</h3>
                    <Badge variant="default" size="sm" className="mt-2">
                      {asset.methodology}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-dark-400 text-sm">Total Value</p>
                    <p className="text-2xl font-bold gradient-text">
                      {formatCurrency(asset.totalValue)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-dark-800 p-3 rounded">
                    <p className="text-dark-400 text-xs">Quantity</p>
                    <p className="font-semibold">
                      {formatCarbonTonnes(asset.quantity)}
                    </p>
                  </div>
                  <div className="bg-dark-800 p-3 rounded">
                    <p className="text-dark-400 text-xs">Avg Price</p>
                    <p className="font-semibold">
                      {formatCurrency(asset.averagePrice)}
                    </p>
                  </div>
                  <div className="bg-dark-800 p-3 rounded">
                    <p className="text-dark-400 text-xs">Current Price</p>
                    <p className="font-semibold text-primary-400">
                      {formatCurrency(asset.currentPrice)}
                    </p>
                  </div>
                  <div className="bg-dark-800 p-3 rounded">
                    <p className="text-dark-400 text-xs">Unrealized Gain</p>
                    <p className="font-semibold text-green-400">
                      {formatCurrency(asset.unrealizedGain)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" icon={<Send className="w-4 h-4" />}>
                      Sell
                    </Button>
                    <Button size="sm" variant="outline" icon={<Flame className="w-4 h-4" />}>
                      Retire
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-3">
            {mockTransactions.map((tx) => (
              <Card key={tx.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === 'buy'
                        ? 'bg-green-500/20'
                        : tx.type === 'sell'
                        ? 'bg-red-500/20'
                        : tx.type === 'retire'
                        ? 'bg-yellow-500/20'
                        : 'bg-blue-500/20'
                    }`}
                  >
                    {tx.type === 'buy' ? (
                      <TrendingDown className="w-5 h-5 text-green-400" />
                    ) : tx.type === 'sell' ? (
                      <TrendingUp className="w-5 h-5 text-red-400" />
                    ) : tx.type === 'retire' ? (
                      <Flame className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Send className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold capitalize">{tx.type}</p>
                    <p className="text-sm text-dark-400">{tx.projectName}</p>
                    <p className="text-xs text-dark-500">
                      {formatRelativeTime(new Date(tx.date * 1000))}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {formatCurrency(tx.totalValue)}
                  </p>
                  <Badge
                    variant={tx.status === 'completed' ? 'success' : 'warning'}
                    size="sm"
                    className="mt-1"
                  >
                    {tx.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Investments Tab */}
        {activeTab === 'investments' && (
          <div className="space-y-6">
            {mockInvestments.map((inv) => (
              <Card key={inv.id} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{inv.projectName}</h3>
                    <Badge
                      variant={inv.status === 'active' ? 'success' : 'default'}
                      size="sm"
                      className="mt-2"
                    >
                      {inv.status}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-dark-400 text-sm">Expected APY</p>
                    <p className="text-2xl font-bold text-primary-400">
                      {inv.apy}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-dark-800 p-3 rounded">
                    <p className="text-dark-400 text-xs">Amount Invested</p>
                    <p className="font-semibold">
                      {formatCurrency(inv.amountInvested)}
                    </p>
                  </div>
                  <div className="bg-dark-800 p-3 rounded">
                    <p className="text-dark-400 text-xs">Returned</p>
                    <p className="font-semibold text-green-400">
                      {formatCurrency(inv.amountReturned)}
                    </p>
                  </div>
                  <div className="bg-dark-800 p-3 rounded">
                    <p className="text-dark-400 text-xs">Credits Generated</p>
                    <p className="font-semibold">
                      {formatCarbonTonnes(inv.creditsGenerated)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline">
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
