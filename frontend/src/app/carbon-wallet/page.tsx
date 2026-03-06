'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Leaf,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  Award,
  DollarSign,
  Zap,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  ShoppingCart,
} from 'lucide-react';
import { Card, StatCard, Badge, Button, LoadingSkeleton, EmptyState, Input } from '@/components/UI';
import { Header } from '@/components/Header';
import { formatCarbonTonnes, formatCurrency, formatAddress } from '@/utils/format';
import {
  fetchDepositoryCredits,
  retireDepositoryCredit,
  getCarbonAccountNumber,
  type DepositoryCredit,
} from '@/utils/api';
import { useAccount } from 'wagmi';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';
import { CarbonCredit, Order } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type PageTab = 'overview' | 'nfts' | 'orders' | 'depository';

export default function CarbonWalletPage() {
  const { address, isConnected } = useAccount();
  const { getErc20Balance, getUserCredits, getMarketplaceOrders } = useContractInteraction();

  // On-chain data
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [cctBalance, setCctBalance] = useState<number | null>(null);
  const [nftCredits, setNftCredits] = useState<CarbonCredit[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  // Depository data
  const [depCredits, setDepCredits] = useState<DepositoryCredit[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PageTab>('overview');
  const [retireCreditId, setRetireCreditId] = useState<string | null>(null);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);
  const [copied, setCopied] = useState(false);

  const accountNumber = address ? getCarbonAccountNumber(address) : '';

  // ── Data fetching ──────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    try {
      const [usdc, cct] = await Promise.all([
        getErc20Balance(CONTRACTS.usdc, address).catch(() => 0),
        getErc20Balance(CONTRACTS.carbonCreditToken, address).catch(() => 0),
      ]);
      setUsdcBalance(usdc);
      setCctBalance(cct);
    } catch {}
  }, [address, getErc20Balance]);

  const fetchNfts = useCallback(async () => {
    if (!address) return;
    try {
      const credits = await getUserCredits(address);
      setNftCredits(credits || []);
    } catch {
      setNftCredits([]);
    }
  }, [address, getUserCredits]);

  const fetchOrders = useCallback(async () => {
    if (!address) return;
    try {
      const orders = await getMarketplaceOrders();
      setMyOrders((orders || []).filter((o) => o.trader.toLowerCase() === address.toLowerCase() && o.isActive));
    } catch {
      setMyOrders([]);
    }
  }, [address, getMarketplaceOrders]);

  const fetchDepository = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetchDepositoryCredits(address, false);
      setDepCredits(res.credits || []);
    } catch {
      setDepCredits([]);
    }
  }, [address]);

  const fetchAll = useCallback(async () => {
    if (!address) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    await Promise.all([fetchBalances(), fetchNfts(), fetchOrders(), fetchDepository()]).catch(() => {});
    setLoading(false);
  }, [address, fetchBalances, fetchNfts, fetchOrders, fetchDepository]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Retire handler ─────────────────────────────────
  const handleRetire = async () => {
    if (!retireCreditId || !address) return;
    setRetiring(true);
    try {
      await retireDepositoryCredit(retireCreditId, address, retireReason);
      toast.success('Credit retired successfully');
      setRetireCreditId(null);
      setRetireReason('');
      fetchDepository();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retirement failed');
    } finally {
      setRetiring(false);
    }
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Computed ────────────────────────────────────────
  const activeDepCredits = depCredits.filter((c) => c.status === 'Active');
  const retiredDepCredits = depCredits.filter((c) => c.status === 'Retired');
  const totalDepActive = activeDepCredits.reduce((s, c) => s + c.co2Amount, 0);
  const totalDepRetired = retiredDepCredits.reduce((s, c) => s + c.co2Amount, 0);
  const nftActiveTonnes = nftCredits.filter((c) => !c.isRetired).reduce((s, c) => s + c.co2Tonnes, 0);
  const myBuyOrders = myOrders.filter((o) => o.isBuyOrder);
  const mySellOrders = myOrders.filter((o) => !o.isBuyOrder);

  const tabs: { id: PageTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'nfts', label: 'NFT Credits', count: nftCredits.length },
    { id: 'orders', label: 'My Orders', count: myOrders.length },
    { id: 'depository', label: 'Depository', count: depCredits.length },
  ];

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ─── Page heading ─── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-1 flex items-center gap-3">
              <span className="bg-gradient-to-r from-emerald-300 to-emerald-600 bg-clip-text text-transparent">
                Carbon Wallet
              </span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
            </h1>
            <p className="text-dark-400">
              Unified view of your on-chain balances, NFT credits, orders &amp; depository holdings
            </p>
          </div>
          {isConnected && (
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className="flex items-center gap-2 text-sm text-dark-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
              Refresh all
            </button>
          )}
        </div>

        {!isConnected ? (
          <div className="py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-dark-500" />
            </div>
            <p className="text-dark-300 text-lg font-medium">Connect your wallet</p>
            <p className="text-dark-500 text-sm mt-1">to open your Official Carbon Wallet</p>
          </div>
        ) : (
          <>
            {/* ─── Account card + Balance cards ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
              {/* Account */}
              <div className="lg:col-span-1 bg-gradient-to-br from-emerald-600/20 via-dark-800 to-dark-800 border border-emerald-500/20 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Carbon Account</span>
                </div>
                <p className="font-mono text-emerald-300 font-bold text-lg mb-2">{accountNumber}</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm text-dark-300 truncate">{address ? formatAddress(address, 6) : ''}</p>
                  <button onClick={copyAddress} className="text-dark-400 hover:text-white transition-colors" title="Copy address">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-dark-500">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Government-authorized depository</span>
                </div>
              </div>

              {/* USDC */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="text-sm text-dark-400 font-medium">USDC Balance</span>
                </div>
                <p className="text-3xl font-bold text-white">
                  {loading ? '...' : usdcBalance !== null ? formatCurrency(usdcBalance) : '$0.00'}
                </p>
                <p className="text-xs text-dark-500 mt-2">Payment token for marketplace</p>
              </div>

              {/* CCT */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-emerald-400" />
                  </div>
                  <span className="text-sm text-dark-400 font-medium">CCT Balance</span>
                </div>
                <p className="text-3xl font-bold text-white">
                  {loading ? '...' : cctBalance !== null ? formatCarbonTonnes(cctBalance) : '0'}
                </p>
                <p className="text-xs text-dark-500 mt-2">Wrapped carbon tokens</p>
              </div>

              {/* NFTs + Orders */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-5 flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-purple-400" />
                  </div>
                  <span className="text-sm text-dark-400 font-medium">NFT Credits</span>
                </div>
                <p className="text-3xl font-bold text-white">{loading ? '...' : nftCredits.length}</p>
                <p className="text-xs text-dark-500 mt-2">{formatCarbonTonnes(nftActiveTonnes)} active tonnes</p>
              </div>
            </div>

            {/* ─── Quick stats ─── */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
              <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                <p className="text-dark-400 text-xs mb-1">Active Orders</p>
                <p className="text-lg font-bold text-white">{loading ? '—' : myOrders.length}</p>
              </div>
              <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                <p className="text-dark-400 text-xs mb-1">Buy Orders</p>
                <p className="text-lg font-bold text-emerald-400">{loading ? '—' : myBuyOrders.length}</p>
              </div>
              <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                <p className="text-dark-400 text-xs mb-1">Sell Orders</p>
                <p className="text-lg font-bold text-orange-400">{loading ? '—' : mySellOrders.length}</p>
              </div>
              <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                <p className="text-dark-400 text-xs mb-1">Depository Active</p>
                <p className="text-lg font-bold text-blue-400">{loading ? '—' : activeDepCredits.length}</p>
              </div>
              <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center col-span-2 sm:col-span-1">
                <p className="text-dark-400 text-xs mb-1">Dep. Retired</p>
                <p className="text-lg font-bold text-dark-400">{loading ? '—' : retiredDepCredits.length}</p>
              </div>
            </div>

            {/* ─── Tabs ─── */}
            <div className="flex gap-1 border-b border-dark-700 mb-6">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-5 py-3 text-sm font-medium transition-colors relative ${
                    activeTab === t.id ? 'text-emerald-400' : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className="ml-1.5 text-[10px] bg-dark-700 text-dark-300 rounded-full px-1.5 py-0.5">{t.count}</span>
                  )}
                  {activeTab === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t" />}
                </button>
              ))}
            </div>

            {/* ═══ Tab content ═══ */}

            {/* ── Overview ── */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 bg-gradient-to-br from-blue-500/5 to-dark-800 border-blue-500/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-dark-200">Token Holdings</h3>
                    <DollarSign className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-blue-400">$</span>
                        </div>
                        <div>
                          <p className="text-dark-100 text-sm font-medium">USDC</p>
                          <p className="text-dark-500 text-xs">Payment token</p>
                        </div>
                      </div>
                      <span className="font-bold text-white text-lg">{usdcBalance !== null ? formatCurrency(usdcBalance) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Zap className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-dark-100 text-sm font-medium">CCT (Wrapped)</p>
                          <p className="text-dark-500 text-xs">Carbon credit tokens</p>
                        </div>
                      </div>
                      <span className="font-bold text-white text-lg">{cctBalance !== null ? formatCarbonTonnes(cctBalance) : '—'}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-emerald-500/5 to-dark-800 border-emerald-500/10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-dark-200">Carbon Credits Summary</h3>
                    <Leaf className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-dark-200 text-sm">NFT Credits (on-chain)</span>
                      <span className="font-bold text-white">{nftCredits.length} ({formatCarbonTonnes(nftActiveTonnes)})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-dark-200 text-sm">Depository (active)</span>
                      <span className="font-bold text-white">{activeDepCredits.length} ({formatCarbonTonnes(totalDepActive)})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-dark-200 text-sm">Depository (retired)</span>
                      <span className="font-bold text-dark-400">{retiredDepCredits.length} ({formatCarbonTonnes(totalDepRetired)})</span>
                    </div>
                  </div>
                </Card>

                {/* Active orders mini */}
                {myOrders.length > 0 && (
                  <Card className="p-6 lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-semibold text-dark-200">Active Orders</h3>
                      <button onClick={() => setActiveTab('orders')} className="text-xs text-emerald-400 hover:underline">View all →</button>
                    </div>
                    <div className="space-y-2">
                      {myOrders.slice(0, 4).map((o) => (
                        <div key={o.orderId} className="flex items-center justify-between text-sm py-2.5 border-b border-dark-700/50 last:border-0">
                          <div className="flex items-center gap-2">
                            {o.isBuyOrder ? (
                              <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-orange-400" />
                            )}
                            <span className="text-dark-200">{o.isBuyOrder ? 'Buy' : 'Sell'} Order #{o.orderId}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-white font-medium">{formatCarbonTonnes(o.amount - o.filled)} remaining</span>
                            <span className="text-dark-500 ml-2">@ {formatCurrency(o.pricePerTonne)}/t</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ── NFT Credits ── */}
            {activeTab === 'nfts' && (
              <div>
                {loading ? (
                  <LoadingSkeleton count={4} height="h-28" />
                ) : nftCredits.length === 0 ? (
                  <EmptyState
                    title="No NFT credits"
                    description="Carbon credit NFTs you own will appear here. Register as a company and get credits minted."
                    icon={<Leaf className="w-12 h-12 text-dark-500" />}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {nftCredits.map((c) => (
                      <div key={c.id} className="bg-dark-800 border border-dark-700 rounded-xl p-5 space-y-3 hover:border-dark-600 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-white">{c.projectName}</p>
                            <p className="text-xs text-dark-400 font-mono">Token #{c.tokenId}</p>
                          </div>
                          <Badge variant={c.isRetired ? 'default' : 'success'} size="sm">
                            {c.isRetired ? 'Retired' : 'Active'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <p className="text-dark-500">Tonnes</p>
                            <p className="text-white font-semibold text-sm">{formatCarbonTonnes(c.co2Tonnes)}</p>
                          </div>
                          <div>
                            <p className="text-dark-500">Vintage</p>
                            <p className="text-white font-medium">{c.vintageYear}</p>
                          </div>
                          <div>
                            <p className="text-dark-500">Methodology</p>
                            <p className="text-white font-medium truncate" title={c.methodology}>{c.methodology}</p>
                          </div>
                        </div>
                        {c.geography && (
                          <p className="text-xs text-dark-400">📍 {c.geography}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── My Orders ── */}
            {activeTab === 'orders' && (
              <div>
                {loading ? (
                  <LoadingSkeleton count={4} height="h-20" />
                ) : myOrders.length === 0 ? (
                  <EmptyState
                    title="No active orders"
                    description="Your marketplace buy and sell orders will appear here."
                    icon={<ShoppingCart className="w-12 h-12 text-dark-500" />}
                  />
                ) : (
                  <div className="space-y-4">
                    {myOrders.map((o) => (
                      <div key={o.orderId} className="bg-dark-800 border border-dark-700 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {o.isBuyOrder ? (
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                <ArrowDownRight className="w-5 h-5 text-emerald-400" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-orange-500/15 flex items-center justify-center">
                                <ArrowUpRight className="w-5 h-5 text-orange-400" />
                              </div>
                            )}
                            <div>
                              <p className="text-white font-semibold">{o.isBuyOrder ? 'Buy' : 'Sell'} Order #{o.orderId}</p>
                              <p className="text-dark-400 text-sm">{formatCurrency(o.pricePerTonne)} per tonne</p>
                            </div>
                          </div>
                          <Badge variant={o.isActive ? 'success' : 'default'}>{o.isActive ? 'Active' : 'Closed'}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-dark-500 text-xs">Total Amount</p>
                            <p className="text-white font-medium">{formatCarbonTonnes(o.amount)}</p>
                          </div>
                          <div>
                            <p className="text-dark-500 text-xs">Filled</p>
                            <p className="text-emerald-400 font-medium">{formatCarbonTonnes(o.filled)}</p>
                          </div>
                          <div>
                            <p className="text-dark-500 text-xs">Remaining</p>
                            <p className="text-orange-400 font-medium">{formatCarbonTonnes(o.amount - o.filled)}</p>
                          </div>
                        </div>
                        {o.filled > 0 && (
                          <div className="mt-3">
                            <div className="w-full bg-dark-700 rounded-full h-2">
                              <div
                                className="bg-emerald-500 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min((o.filled / o.amount) * 100, 100)}%` }}
                              />
                            </div>
                            <p className="text-dark-500 text-xs mt-1 text-right">{((o.filled / o.amount) * 100).toFixed(1)}% filled</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Depository ── */}
            {activeTab === 'depository' && (
              <div>
                {loading ? (
                  <LoadingSkeleton count={5} height="h-14" />
                ) : depCredits.length === 0 ? (
                  <EmptyState
                    title="No depository credits"
                    description="Credits held in the ATMOS Depository will appear here. Register or receive credits."
                    icon={<Wallet className="w-12 h-12 text-dark-500" />}
                  />
                ) : (
                  <Card>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-dark-700 text-dark-400 text-sm">
                            <th className="pb-3 pr-4">Credit ID</th>
                            <th className="pb-3 pr-4">Project</th>
                            <th className="pb-3 pr-4">Tonnes</th>
                            <th className="pb-3 pr-4">Methodology</th>
                            <th className="pb-3 pr-4">Vintage</th>
                            <th className="pb-3 pr-4">Status</th>
                            <th className="pb-3 pr-4">Issued</th>
                            <th className="pb-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {depCredits.map((c) => (
                            <React.Fragment key={c.creditId}>
                              <tr className="border-b border-dark-700/70 hover:bg-dark-800/30">
                                <td className="py-3 pr-4 font-mono text-sm text-dark-200">{c.creditId}</td>
                                <td className="py-3 pr-4 text-dark-200">{c.projectId}</td>
                                <td className="py-3 pr-4 text-dark-100 font-medium">{formatCarbonTonnes(c.co2Amount)}</td>
                                <td className="py-3 pr-4 text-dark-300 text-sm">{c.methodology}</td>
                                <td className="py-3 pr-4 text-dark-300">{c.vintageYear}</td>
                                <td className="py-3 pr-4">
                                  <Badge variant={c.status === 'Active' ? 'success' : 'default'}>{c.status}</Badge>
                                </td>
                                <td className="py-3 pr-4 text-dark-400 text-sm">
                                  {format(new Date(c.issuedAt), 'MMM d, yyyy')}
                                </td>
                                <td className="py-3">
                                  {c.status === 'Active' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setRetireCreditId(retireCreditId === c.creditId ? null : c.creditId)}
                                    >
                                      Retire
                                    </Button>
                                  )}
                                  {c.status === 'Retired' && c.retirementReason && (
                                    <span className="text-dark-500 text-xs" title={c.retirementReason}>Retired</span>
                                  )}
                                </td>
                              </tr>
                              {retireCreditId === c.creditId && c.status === 'Active' && (
                                <tr className="bg-dark-800/50 border-b border-dark-700">
                                  <td colSpan={8} className="py-4 px-4">
                                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                                      <div className="flex-1 w-full sm:max-w-md">
                                        <Input
                                          label="Retirement reason (optional)"
                                          placeholder="e.g. Scope 1 offset 2024"
                                          value={retireReason}
                                          onChange={(e) => setRetireReason(e.target.value)}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button variant="primary" loading={retiring} disabled={retiring} onClick={handleRetire}
                                          icon={retiring ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}>
                                          Confirm retire
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          onClick={() => { setRetireCreditId(null); setRetireReason(''); }}
                                          disabled={retiring}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-dark-500 text-xs mt-2">Retiring is permanent; this credit cannot be transferred again.</p>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
