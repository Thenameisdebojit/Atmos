'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Leaf,
  Shield,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  Award,
  Lock,
  Unlock,
  DollarSign,
  Zap,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Check,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { Card, Badge, Button, LoadingSkeleton, EmptyState, Input } from '@/components/UI';
import { formatCarbonTonnes, formatCurrency, formatAddress } from '@/utils/format';
import {
  fetchDepositoryCredits,
  retireDepositoryCredit,
  getCarbonWalletStatus,
  setCarbonWalletPassword,
  verifyCarbonWalletPassword,
  getCarbonAccountNumber,
  type DepositoryCredit,
} from '@/utils/api';
import { useAccount } from 'wagmi';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';
import { CarbonCredit, Order } from '@/types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const UNLOCK_VALID_MS = 30 * 60 * 1000;
const STORAGE_KEY = 'atmos_carbon_wallet_unlocked';

function getStoredUnlock(address: string | undefined): boolean {
  if (typeof window === 'undefined' || !address) return false;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { wallet, ts } = JSON.parse(raw);
    if (wallet !== address.toLowerCase()) return false;
    if (Date.now() - ts > UNLOCK_VALID_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function setStoredUnlock(address: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ wallet: address.toLowerCase(), ts: Date.now() }));
  } catch {}
}

interface CarbonWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type WalletTab = 'overview' | 'nfts' | 'orders' | 'depository';

export function CarbonWalletModal({ isOpen, onClose }: CarbonWalletModalProps) {
  const { address, isConnected } = useAccount();
  const {
    getErc20Balance,
    getUserCredits,
    getMarketplaceOrders,
  } = useContractInteraction();

  // Wallet password state
  const [walletStatus, setWalletStatus] = useState<{ hasPassword: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // On-chain data
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [cctBalance, setCctBalance] = useState<number | null>(null);
  const [nftCredits, setNftCredits] = useState<CarbonCredit[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);

  // Depository data
  const [depCredits, setDepCredits] = useState<DepositoryCredit[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WalletTab>('overview');
  const [retireCreditId, setRetireCreditId] = useState<string | null>(null);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);
  const [copied, setCopied] = useState(false);

  const accountNumber = address ? getCarbonAccountNumber(address) : '';

  // ── Data fetching ──────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setBalanceRefreshing(true);
    try {
      const [usdc, cct] = await Promise.all([
        getErc20Balance(CONTRACTS.usdc, address).catch(() => 0),
        getErc20Balance(CONTRACTS.carbonCreditToken, address).catch(() => 0),
      ]);
      setUsdcBalance(usdc);
      setCctBalance(cct);
    } catch {
      // silently fail
    } finally {
      setBalanceRefreshing(false);
    }
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
      const mine = (orders || []).filter(
        (o) => o.trader.toLowerCase() === address.toLowerCase() && o.isActive
      );
      setMyOrders(mine);
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
    if (!address) return;
    setLoading(true);
    setError(null);
    await Promise.all([
      fetchBalances(),
      fetchNfts(),
      fetchOrders(),
      fetchDepository(),
    ]).catch(() => {});
    setLoading(false);
  }, [address, fetchBalances, fetchNfts, fetchOrders, fetchDepository]);

  // ── Password flow ──────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!address) return;
    try {
      const st = await getCarbonWalletStatus(address);
      setWalletStatus(st);
    } catch {
      setWalletStatus({ hasPassword: false });
    }
  }, [address]);

  useEffect(() => {
    if (!isOpen) return;
    if (!address) {
      setWalletStatus(null);
      setUnlocked(false);
      return;
    }
    if (getStoredUnlock(address)) {
      setUnlocked(true);
      setWalletStatus({ hasPassword: true });
      return;
    }
    setUnlocked(false);
    fetchStatus();
  }, [isOpen, address, fetchStatus]);

  useEffect(() => {
    if (unlocked && address && isOpen) fetchAll();
  }, [unlocked, address, isOpen, fetchAll]);

  const handleSetPassword = async () => {
    if (!address || !password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSettingPassword(true);
    try {
      await setCarbonWalletPassword(address, password);
      toast.success('Password set. Your Carbon Wallet is now protected.');
      setWalletStatus({ hasPassword: true });
      setPassword('');
      setConfirmPassword('');
      setUnlocked(true);
      setStoredUnlock(address);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleUnlock = async () => {
    if (!address || !password) {
      toast.error('Enter your password');
      return;
    }
    setVerifying(true);
    try {
      const ok = await verifyCarbonWalletPassword(address, password);
      if (ok) {
        setUnlocked(true);
        setStoredUnlock(address);
        setPassword('');
      } else {
        toast.error('Invalid password');
      }
    } catch {
      toast.error('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

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

  const handleClose = () => {
    setPassword('');
    setConfirmPassword('');
    onClose();
  };

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Computed stats ─────────────────────────────────
  const activeDepCredits = depCredits.filter((c) => c.status === 'Active');
  const retiredDepCredits = depCredits.filter((c) => c.status === 'Retired');
  const totalDepActive = activeDepCredits.reduce((s, c) => s + c.co2Amount, 0);
  const totalDepRetired = retiredDepCredits.reduce((s, c) => s + c.co2Amount, 0);
  const nftActiveTonnes = nftCredits.filter(c => !c.isRetired).reduce((s, c) => s + c.co2Tonnes, 0);
  const myBuyOrders = myOrders.filter(o => o.isBuyOrder);
  const mySellOrders = myOrders.filter(o => !o.isBuyOrder);

  if (!isOpen) return null;

  const tabs: { id: WalletTab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'nfts', label: 'NFT Credits', count: nftCredits.length },
    { id: 'orders', label: 'My Orders', count: myOrders.length },
    { id: 'depository', label: 'Depository', count: depCredits.length },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-dark-900 border border-dark-600 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700 bg-gradient-to-r from-dark-900 to-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Carbon Wallet</h2>
              <p className="text-xs text-dark-400">ATMOS Depository • Real-time on-chain data</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto">
          {!isConnected ? (
            <div className="py-16 text-center text-dark-400">
              <div className="w-16 h-16 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">Connect your wallet</p>
              <p className="text-sm text-dark-500 mt-1">to open your Official Carbon Wallet</p>
            </div>
          ) : walletStatus === null ? (
            <div className="p-6"><LoadingSkeleton count={3} height="h-20" /></div>
          ) : !walletStatus.hasPassword ? (
            /* ─── Set password screen ─── */
            <div className="max-w-sm mx-auto py-10 px-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white text-center mb-1">Secure your wallet</h3>
              <p className="text-dark-400 text-sm text-center mb-6">Set a password to protect your Carbon Wallet.</p>
              <Input
                label="Password (min 6 characters)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <div className="mt-3">
                <Input
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                className="w-full mt-5"
                onClick={handleSetPassword}
                loading={settingPassword}
                disabled={settingPassword || password.length < 6 || password !== confirmPassword}
              >
                Set password & open wallet
              </Button>
            </div>
          ) : !unlocked ? (
            /* ─── Unlock screen ─── */
            <div className="max-w-sm mx-auto py-10 px-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Unlock className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white text-center mb-1">Unlock Carbon Wallet</h3>
              <p className="text-dark-400 text-sm text-center mb-6">Enter your password to continue.</p>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <Button className="w-full mt-5" onClick={handleUnlock} loading={verifying} disabled={verifying || !password}>
                Unlock
              </Button>
            </div>
          ) : (
            /* ═══════════════════════════════════════════════
               UNLOCKED WALLET — MAIN CONTENT
               ═══════════════════════════════════════════════ */
            <div className="p-6 space-y-6">

              {/* ─── Account card + Balances row ─── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Account info */}
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

                {/* Balance cards */}
                <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* USDC */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-xs text-dark-400 font-medium">USDC</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '...' : usdcBalance !== null ? formatCurrency(usdcBalance) : '$0.00'}
                    </p>
                    <p className="text-xs text-dark-500 mt-1">Payment token</p>
                  </div>
                  {/* CCT */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-emerald-400" />
                      </div>
                      <span className="text-xs text-dark-400 font-medium">CCT</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '...' : cctBalance !== null ? formatCarbonTonnes(cctBalance) : '0'}
                    </p>
                    <p className="text-xs text-dark-500 mt-1">Wrapped carbon tokens</p>
                  </div>
                  {/* NFTs */}
                  <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                        <Leaf className="w-4 h-4 text-purple-400" />
                      </div>
                      <span className="text-xs text-dark-400 font-medium">NFT Credits</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      {loading ? '...' : nftCredits.length}
                    </p>
                    <p className="text-xs text-dark-500 mt-1">{formatCarbonTonnes(nftActiveTonnes)} active</p>
                  </div>
                </div>
              </div>

              {/* ─── Quick stats row ─── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                  <p className="text-dark-400 text-xs mb-1">Active Orders</p>
                  <p className="text-lg font-bold text-white">{loading ? '...' : myOrders.length}</p>
                </div>
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                  <p className="text-dark-400 text-xs mb-1">Buy Orders</p>
                  <p className="text-lg font-bold text-emerald-400">{loading ? '...' : myBuyOrders.length}</p>
                </div>
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                  <p className="text-dark-400 text-xs mb-1">Sell Orders</p>
                  <p className="text-lg font-bold text-orange-400">{loading ? '...' : mySellOrders.length}</p>
                </div>
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-4 py-3 text-center">
                  <p className="text-dark-400 text-xs mb-1">Depository</p>
                  <p className="text-lg font-bold text-blue-400">{loading ? '...' : `${activeDepCredits.length} active`}</p>
                </div>
              </div>

              {/* ─── Refresh ─── */}
              <div className="flex justify-end">
                <button
                  onClick={() => fetchAll()}
                  disabled={loading || balanceRefreshing}
                  className="flex items-center gap-1.5 text-xs text-dark-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${(loading || balanceRefreshing) ? 'animate-spin' : ''}`} />
                  Refresh all
                </button>
              </div>

              {/* ─── Tabs ─── */}
              <div className="flex gap-1 border-b border-dark-700 -mx-6 px-6">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                      activeTab === t.id
                        ? 'text-emerald-400'
                        : 'text-dark-400 hover:text-dark-200'
                    }`}
                  >
                    {t.label}
                    {t.count !== undefined && t.count > 0 && (
                      <span className="ml-1.5 text-[10px] bg-dark-700 text-dark-300 rounded-full px-1.5 py-0.5">{t.count}</span>
                    )}
                    {activeTab === t.id && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t" />
                    )}
                  </button>
                ))}
              </div>

              {/* ═══ Tab content ═══ */}

              {/* ─── Overview Tab ─── */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Portfolio summary cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="p-5 bg-gradient-to-br from-blue-500/5 to-dark-800 border-blue-500/10">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-dark-300">Token Holdings</h4>
                        <DollarSign className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-blue-400">$</span>
                            </div>
                            <span className="text-dark-200 text-sm">USDC</span>
                          </div>
                          <span className="font-semibold text-white">{usdcBalance !== null ? formatCurrency(usdcBalance) : '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-emerald-500/20 flex items-center justify-center">
                              <Zap className="w-3 h-3 text-emerald-400" />
                            </div>
                            <span className="text-dark-200 text-sm">CCT (wrapped)</span>
                          </div>
                          <span className="font-semibold text-white">{cctBalance !== null ? formatCarbonTonnes(cctBalance) : '—'}</span>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-5 bg-gradient-to-br from-emerald-500/5 to-dark-800 border-emerald-500/10">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-dark-300">Carbon Credits</h4>
                        <Leaf className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-dark-200 text-sm">NFT Credits (on-chain)</span>
                          <span className="font-semibold text-white">{nftCredits.length} ({formatCarbonTonnes(nftActiveTonnes)})</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-dark-200 text-sm">Depository (active)</span>
                          <span className="font-semibold text-white">{activeDepCredits.length} ({formatCarbonTonnes(totalDepActive)})</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-dark-200 text-sm">Retired</span>
                          <span className="font-semibold text-dark-400">{retiredDepCredits.length} ({formatCarbonTonnes(totalDepRetired)})</span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Active orders summary */}
                  {myOrders.length > 0 && (
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-dark-300">Active Orders</h4>
                        <button onClick={() => setActiveTab('orders')} className="text-xs text-emerald-400 hover:underline">View all →</button>
                      </div>
                      <div className="space-y-2">
                        {myOrders.slice(0, 3).map((o) => (
                          <div key={o.orderId} className="flex items-center justify-between text-sm py-2 border-b border-dark-700/50 last:border-0">
                            <div className="flex items-center gap-2">
                              {o.isBuyOrder ? (
                                <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4 text-orange-400" />
                              )}
                              <span className="text-dark-200">{o.isBuyOrder ? 'Buy' : 'Sell'} #{o.orderId}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-white font-medium">{formatCarbonTonnes(o.amount - o.filled)}</span>
                              <span className="text-dark-500 ml-2">@ {formatCurrency(o.pricePerTonne)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ─── NFT Credits Tab ─── */}
              {activeTab === 'nfts' && (
                <div>
                  {nftCredits.length === 0 ? (
                    <EmptyState
                      title="No NFT credits"
                      description="Carbon credit NFTs you own will appear here. Register as a company and get credits minted."
                      icon={<Leaf className="w-10 h-10 text-dark-500" />}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {nftCredits.map((c) => (
                        <div key={c.id} className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-white text-sm">{c.projectName}</p>
                              <p className="text-xs text-dark-400 font-mono">Token #{c.tokenId}</p>
                            </div>
                            <Badge variant={c.isRetired ? 'default' : 'success'} size="sm">
                              {c.isRetired ? 'Retired' : 'Active'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-dark-500">Tonnes</p>
                              <p className="text-white font-medium">{formatCarbonTonnes(c.co2Tonnes)}</p>
                            </div>
                            <div>
                              <p className="text-dark-500">Vintage</p>
                              <p className="text-white font-medium">{c.vintageYear}</p>
                            </div>
                            <div>
                              <p className="text-dark-500">Methodology</p>
                              <p className="text-white font-medium text-[10px]">{c.methodology}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── My Orders Tab ─── */}
              {activeTab === 'orders' && (
                <div>
                  {myOrders.length === 0 ? (
                    <EmptyState
                      title="No active orders"
                      description="Your marketplace buy and sell orders will appear here."
                      icon={<ShoppingCart className="w-10 h-10 text-dark-500" />}
                    />
                  ) : (
                    <div className="space-y-3">
                      {myOrders.map((o) => (
                        <div key={o.orderId} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {o.isBuyOrder ? (
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                                  <ArrowUpRight className="w-4 h-4 text-orange-400" />
                                </div>
                              )}
                              <div>
                                <p className="text-white font-medium text-sm">{o.isBuyOrder ? 'Buy' : 'Sell'} Order #{o.orderId}</p>
                                <p className="text-dark-400 text-xs">{formatCurrency(o.pricePerTonne)} per tonne</p>
                              </div>
                            </div>
                            <Badge variant={o.isActive ? 'success' : 'default'} size="sm">
                              {o.isActive ? 'Active' : 'Closed'}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-xs mt-3">
                            <div>
                              <p className="text-dark-500">Total</p>
                              <p className="text-white font-medium">{formatCarbonTonnes(o.amount)}</p>
                            </div>
                            <div>
                              <p className="text-dark-500">Filled</p>
                              <p className="text-emerald-400 font-medium">{formatCarbonTonnes(o.filled)}</p>
                            </div>
                            <div>
                              <p className="text-dark-500">Remaining</p>
                              <p className="text-orange-400 font-medium">{formatCarbonTonnes(o.amount - o.filled)}</p>
                            </div>
                          </div>
                          {o.filled > 0 && (
                            <div className="mt-2">
                              <div className="w-full bg-dark-700 rounded-full h-1.5">
                                <div
                                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                                  style={{ width: `${(o.filled / o.amount) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ─── Depository Tab ─── */}
              {activeTab === 'depository' && (
                <div>
                  {depCredits.length === 0 ? (
                    <EmptyState
                      title="No depository credits"
                      description="Credits held in the ATMOS Depository will appear here."
                      icon={<Wallet className="w-10 h-10 text-dark-500" />}
                    />
                  ) : (
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-dark-700 text-dark-400 text-xs">
                            <th className="pb-2 pr-2">Credit ID</th>
                            <th className="pb-2 pr-2">Project</th>
                            <th className="pb-2 pr-2">Tonnes</th>
                            <th className="pb-2 pr-2">Status</th>
                            <th className="pb-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {depCredits.map((c) => (
                            <React.Fragment key={c.creditId}>
                              <tr className="border-b border-dark-700/70">
                                <td className="py-2 pr-2 font-mono text-dark-200 text-xs">{c.creditId}</td>
                                <td className="py-2 pr-2 text-dark-200 text-xs">{c.projectId}</td>
                                <td className="py-2 pr-2 font-medium text-dark-100">{formatCarbonTonnes(c.co2Amount)}</td>
                                <td className="py-2 pr-2">
                                  <Badge variant={c.status === 'Active' ? 'success' : 'default'} size="sm">{c.status}</Badge>
                                </td>
                                <td className="py-2">
                                  {c.status === 'Active' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setRetireCreditId(retireCreditId === c.creditId ? null : c.creditId)}
                                    >
                                      Retire
                                    </Button>
                                  )}
                                </td>
                              </tr>
                              {retireCreditId === c.creditId && c.status === 'Active' && (
                                <tr className="bg-dark-800/50">
                                  <td colSpan={5} className="py-3 px-2">
                                    <Input
                                      placeholder="Reason (optional)"
                                      value={retireReason}
                                      onChange={(e) => setRetireReason(e.target.value)}
                                      className="mb-2"
                                    />
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={handleRetire} loading={retiring} disabled={retiring}>
                                        Confirm retire
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setRetireCreditId(null); setRetireReason(''); }} disabled={retiring}>
                                        Cancel
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
