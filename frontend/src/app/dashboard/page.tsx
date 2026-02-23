'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Users,
  Leaf,
  BarChart3,
  Activity,
} from 'lucide-react';
import { Card, StatCard, LoadingSkeleton, Badge } from '@/components/UI';
import { Header } from '@/components/Header';
import { formatCurrency, formatCarbonTonnes } from '@/utils/format';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Mock data - replace with actual API calls
const mockPriceHistory = [
  { date: '2024-01-01', price: 15 },
  { date: '2024-01-02', price: 16.5 },
  { date: '2024-01-03', price: 15.8 },
  { date: '2024-01-04', price: 17.2 },
  { date: '2024-01-05', price: 18.1 },
  { date: '2024-01-06', price: 17.9 },
  { date: '2024-01-07', price: 19.5 },
];

const mockVolumeData = [
  { date: '2024-01-01', volume: 125000 },
  { date: '2024-01-02', volume: 185000 },
  { date: '2024-01-03', volume: 145000 },
  { date: '2024-01-04', volume: 250000 },
  { date: '2024-01-05', volume: 310000 },
  { date: '2024-01-06', volume: 280000 },
  { date: '2024-01-07', volume: 380000 },
];

const mockEmissionsData = [
  { month: 'Jan', scope1: 4000, scope2: 2400, scope3: 2400 },
  { month: 'Feb', scope1: 3000, scope2: 1398, scope3: 2210 },
  { month: 'Mar', scope1: 2000, scope2: 9800, scope3: 2290 },
  { month: 'Apr', scope1: 2780, scope2: 3908, scope3: 2000 },
  { month: 'May', scope1: 1890, scope2: 4800, scope3: 2181 },
  { month: 'Jun', scope1: 2390, scope2: 3800, scope3: 2500 },
];

export default function DashboardPage() {
  const {
    getCarbonPrice,
    getMarketplaceOrders,
    getCompanyEmissions,
    isConnected,
    address,
    blockNumber,
  } = useContractInteraction();

  const [isLoading, setIsLoading] = useState(true);
  const [carbonPrice, setCarbonPrice] = useState<number | null>(null);
  const [totalVolume, setTotalVolume] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);
  const [priceHistory, setPriceHistory] = useState(mockPriceHistory);

  // Real-time data fetching
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch carbon price
        const price = await getCarbonPrice();
        if (price) {
          setCarbonPrice(price);
        }
        
        // Fetch marketplace orders
        const orders = await getMarketplaceOrders('active');
        setActiveOrders(orders.length);
        
        // Calculate total volume
        const volume = orders.reduce((sum, order) => {
          const orderValue = (order.amount || 0) * (order.pricePerTonne || 0);
          return sum + orderValue;
        }, 0);
        setTotalVolume(volume);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setIsLoading(false);
      }
    };

    if (isConnected) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [isConnected, getCarbonPrice, getMarketplaceOrders, blockNumber]);

  const handleConnect = () => {
    // Implement wallet connection logic
    console.log('Connect wallet');
  };

  const handleDisconnect = () => {
    console.log('Disconnect wallet');
  };

  const currentPrice = carbonPrice || 18.5;
  const priceChange = ((currentPrice - 15) / 15) * 100;;

  return (
    <div className="min-h-screen bg-dark-950">
      <Header
        walletAddress={address}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Carbon Credit Dashboard</h1>
          <p className="text-dark-400">
            Real-time market insights and your portfolio overview
          </p>
        </div>

        {/* Real-time Status Indicator */}
        {isConnected && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-dark-400">
              Connected to blockchain (Block: {blockNumber?.toString()})
            </span>
          </div>
        )}

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
                label="Market Price (Live)"
                value={formatCurrency(currentPrice)}
                icon={<TrendingUp className="w-5 h-5" />}
                change={priceChange}
                subtext="per tonne CO2e"
              />
              <StatCard
                label="Total Volume"
                value={formatCurrency(totalVolume)}
                icon={<Leaf className="w-5 h-5" />}
                subtext="24h trading volume"
              />
              <StatCard
                label="Active Orders"
                value={activeOrders.toLocaleString()}
                icon={<Zap className="w-5 h-5" />}
                subtext="open buy & sell orders"
              />
              <StatCard
                label="Block Height"
                value={blockNumber?.toString() || 'N/A'}
                icon={<Users className="w-5 h-5" />}
                subtext="current blockchain block"
              />
            </>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Price Chart */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-500" />
                Price Trend
              </h2>
              <Badge variant="success" size="sm">
                ↑ +8.5%
              </Badge>
            </div>
            {isLoading ? (
              <LoadingSkeleton height="h-64" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockPriceHistory}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#475569"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#475569" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => `$${value}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorPrice)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Volume Chart */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-500" />
                Trading Volume
              </h2>
              <Badge variant="info" size="sm">
                24H
              </Badge>
            </div>
            {isLoading ? (
              <LoadingSkeleton height="h-64" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockVolumeData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#475569"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#475569" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => `${(value as number).toLocaleString()}`}
                  />
                  <Bar
                    dataKey="volume"
                    fill="#22c55e"
                    radius={[8, 8, 0, 0]}
                    opacity={0.8}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* Emissions Analysis */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-500" />
              Global Emissions Analysis
            </h2>
            <div className="flex gap-2">
              <Badge variant="default" size="sm">
                Scope 1
              </Badge>
              <Badge variant="info" size="sm">
                Scope 2
              </Badge>
              <Badge variant="warning" size="sm">
                Scope 3
              </Badge>
            </div>
          </div>
          {isLoading ? (
            <LoadingSkeleton height="h-64" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockEmissionsData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e293b"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#475569"
                  style={{ fontSize: '12px' }}
                />
                <YAxis stroke="#475569" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  wrapperStyle={{ color: '#94a3b8' }}
                />
                <Bar
                  dataKey="scope1"
                  fill="#22c55e"
                  radius={[8, 8, 0, 0]}
                  opacity={0.8}
                />
                <Bar
                  dataKey="scope2"
                  fill="#3b82f6"
                  radius={[8, 8, 0, 0]}
                  opacity={0.8}
                />
                <Bar
                  dataKey="scope3"
                  fill="#f59e0b"
                  radius={[8, 8, 0, 0]}
                  opacity={0.8}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="space-y-3">
            <p className="text-dark-400 text-sm">Total Market Cap</p>
            <p className="text-3xl font-bold gradient-text">$4.8B</p>
            <p className="text-xs text-dark-500">Across all methodologies</p>
          </Card>
          <Card className="space-y-3">
            <p className="text-dark-400 text-sm">Retired Credits</p>
            <p className="text-3xl font-bold gradient-text">840.5K</p>
            <p className="text-xs text-dark-500">Permanently offset</p>
          </Card>
          <Card className="space-y-3">
            <p className="text-dark-400 text-sm">24H Trading Volume</p>
            <p className="text-3xl font-bold gradient-text">$128.5M</p>
            <p className="text-xs text-dark-500">Across all pairs</p>
          </Card>
        </div>
      </main>
    </div>
  );
}
