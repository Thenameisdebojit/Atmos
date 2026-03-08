'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Leaf,
  Shield,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  X,
  ArrowLeft,
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
import { Badge, Button, LoadingSkeleton, EmptyState, Input } from '@/components/UI';
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

type WalletView = 'home' | 'nfts' | 'orders' | 'depository';

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
  const [view, setView] = useState<WalletView>('home');
  const [retireCreditId, setRetireCreditId] = useState<string | null>(null);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);
  const [copied, setCopied] = useState(false);
  const [closing, setClosing] = useState(false);

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

  // Reset view when opening
  useEffect(() => {
    if (isOpen) {
      setView('home');
      setClosing(false);
    }
  }, [isOpen]);

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
    setClosing(true);
    setTimeout(() => {
      setPassword('');
      setConfirmPassword('');
      setClosing(false);
      onClose();
    }, 200);
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

  const viewTitle: Record<WalletView, string> = {
    home: 'Carbon Wallet',
    nfts: 'NFT Credits',
    orders: 'My Orders',
    depository: 'Depository',
  };

  /* ═══════════════════════════════════════════════════
     RENDER — Compact right-side slide-in panel
     ═══════════════════════════════════════════════════ */
  return (
    <div
      className={`fixed inset-0 z-50 transition-colors duration-200 ${closing ? 'bg-black/0' : 'bg-black/50'}`}
      onClick={handleClose}
    >
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-[380px] bg-dark-900 border-l border-dark-700 shadow-2xl flex flex-col transition-transform duration-200 ease-out ${closing ? 'translate-x-full' : 'translate-x-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Panel Header ─── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700 bg-dark-900/95 backdrop-blur-sm shrink-0">
          {view !== 'home' ? (
            <button
              type="button"
              onClick={() => setView('home')}
              className="p-1.5 -ml-1 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0">
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <h2 className="text-sm font-semibold text-white flex-1">{viewTitle[view]}</h2>
          {unlocked && (
            <button
              onClick={() => fetchAll()}
              disabled={loading || balanceRefreshing}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${(loading || balanceRefreshing) ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-colors"
            aria-label="Close wallet"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Panel Body ─── */}
        <div className="flex-1 overflow-y-auto">
          {!isConnected ? (
            <div className="py-14 text-center text-dark-400 px-6">
              <Wallet className="w-10 h-10 opacity-40 mx-auto mb-3" />
              <p className="text-sm font-medium">Connect your wallet</p>
              <p className="text-xs text-dark-500 mt-1">to access Carbon Wallet</p>
            </div>
          ) : walletStatus === null ? (
            <div className="p-4"><LoadingSkeleton count={3} height="h-12" /></div>
          ) : !walletStatus.hasPassword ? (
            /* ─── Set password ─── */
            <div className="px-5 py-8">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-white text-center mb-1">Secure your wallet</h3>
              <p className="text-dark-400 text-xs text-center mb-5">Set a password to protect access.</p>
              <Input
                label="Password (min 6 characters)"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <div className="mt-2.5">
                <Input
                  label="Confirm password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                className="w-full mt-4"
                onClick={handleSetPassword}
                loading={settingPassword}
                disabled={settingPassword || password.length < 6 || password !== confirmPassword}
              >
                Set password & open
              </Button>
            </div>
          ) : !unlocked ? (
            /* ─── Unlock ─── */
            <div className="px-5 py-8">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <Unlock className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-white text-center mb-1">Unlock Wallet</h3>
              <p className="text-dark-400 text-xs text-center mb-5">Enter your password to continue.</p>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <Button className="w-full mt-4" onClick={handleUnlock} loading={verifying} disabled={verifying || !password}>
                Unlock
              </Button>
            </div>
          ) : view === 'home' ? (
            /* ═══════════════════════════════════════
               HOME VIEW — compact overview
               ═══════════════════════════════════════ */
            <div className="p-4 space-y-3">

              {/* Account card */}
              <div className="bg-gradient-to-br from-emerald-600/15 via-dark-800 to-dark-800 border border-emerald-500/15 rounded-xl p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Carbon Account</span>
                </div>
                <p className="font-mono text-emerald-300 font-bold text-sm">{accountNumber}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="font-mono text-xs text-dark-400 truncate">{address ? formatAddress(address, 6) : ''}</p>
                  <button onClick={copyAddress} className="text-dark-500 hover:text-white transition-colors shrink-0" title="Copy">
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-dark-500 mt-1.5">
                  <Shield className="w-3 h-3" />
                  <span>Government-authorized depository</span>
                </div>
              </div>

              {/* Balances — 3 inline cards */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-2.5 text-center">
                  <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center mx-auto mb-1">
                    <DollarSign className="w-3 h-3 text-blue-400" />
                  </div>
                  <p className="text-xs font-bold text-white truncate">
                    {loading ? '...' : usdcBalance !== null ? formatCurrency(usdcBalance) : '$0'}
                  </p>
                  <p className="text-[10px] text-dark-500">USDC</p>
                </div>
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-2.5 text-center">
                  <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center mx-auto mb-1">
                    <Zap className="w-3 h-3 text-emerald-400" />
                  </div>
                  <p className="text-xs font-bold text-white truncate">
                    {loading ? '...' : cctBalance !== null ? formatCarbonTonnes(cctBalance) : '0'}
                  </p>
                  <p className="text-[10px] text-dark-500">CCT</p>
                </div>
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-2.5 text-center">
                  <div className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center mx-auto mb-1">
                    <Leaf className="w-3 h-3 text-purple-400" />
                  </div>
                  <p className="text-xs font-bold text-white">
                    {loading ? '...' : nftCredits.length}
                  </p>
                  <p className="text-[10px] text-dark-500">NFTs</p>
                </div>
              </div>

              {/* Quick stats — 2x2 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-dark-400 text-[11px]">Buy Orders</span>
                  <span className="text-xs font-bold text-emerald-400">{loading ? '...' : myBuyOrders.length}</span>
                </div>
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-dark-400 text-[11px]">Sell Orders</span>
                  <span className="text-xs font-bold text-orange-400">{loading ? '...' : mySellOrders.length}</span>
                </div>
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-dark-400 text-[11px]">Dep. Active</span>
                  <span className="text-xs font-bold text-blue-400">{loading ? '...' : activeDepCredits.length}</span>
                </div>
                <div className="bg-dark-800/60 border border-dark-700/50 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-dark-400 text-[11px]">Retired</span>
                  <span className="text-xs font-bold text-dark-400">{loading ? '...' : retiredDepCredits.length}</span>
                </div>
              </div>

              {/* Holdings breakdown */}
              <div className="bg-dark-800 border border-dark-700 rounded-xl p-3.5 space-y-2">
                <h4 className="text-xs font-medium text-dark-300 mb-2">Holdings Summary</h4>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-400">USDC Balance</span>
                  <span className="text-white font-medium">{usdcBalance !== null ? formatCurrency(usdcBalance) : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-400">CCT (wrapped)</span>
                  <span className="text-white font-medium">{cctBalance !== null ? formatCarbonTonnes(cctBalance) : '—'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-400">NFT Active</span>
                  <span className="text-white font-medium">{nftCredits.filter(c => !c.isRetired).length} ({formatCarbonTonnes(nftActiveTonnes)})</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-400">Depository Active</span>
                  <span className="text-white font-medium">{activeDepCredits.length} ({formatCarbonTonnes(totalDepActive)})</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-dark-400">Total Retired</span>
                  <span className="text-dark-500 font-medium">{retiredDepCredits.length} ({formatCarbonTonnes(totalDepRetired)})</span>
                </div>
              </div>

              {/* Navigation items to detail views */}
              <div className="space-y-1 pt-1">
                <button
                  onClick={() => setView('nfts')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-dark-800/50 hover:bg-dark-800 border border-dark-700/50 hover:border-dark-600 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                      <Leaf className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-dark-200">NFT Credits</p>
                      <p className="text-[10px] text-dark-500">{nftCredits.length} credits • {formatCarbonTonnes(nftActiveTonnes)} active</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-dark-500 group-hover:text-dark-300 transition-colors" />
                </button>
                <button
                  onClick={() => setView('orders')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-dark-800/50 hover:bg-dark-800 border border-dark-700/50 hover:border-dark-600 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                      <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-dark-200">My Orders</p>
                      <p className="text-[10px] text-dark-500">{myOrders.length} active orders</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-dark-500 group-hover:text-dark-300 transition-colors" />
                </button>
                <button
                  onClick={() => setView('depository')}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-dark-800/50 hover:bg-dark-800 border border-dark-700/50 hover:border-dark-600 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <Wallet className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-dark-200">Depository</p>
                      <p className="text-[10px] text-dark-500">{depCredits.length} credits • {activeDepCredits.length} active</p>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-dark-500 group-hover:text-dark-300 transition-colors" />
                </button>
              </div>

              {/* Recent orders preview */}
              {myOrders.length > 0 && (
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-dark-300">Recent Orders</h4>
                    <button onClick={() => setView('orders')} className="text-[10px] text-emerald-400 hover:underline">View all →</button>
                  </div>
                  <div className="space-y-1">
                    {myOrders.slice(0, 3).map((o) => (
                      <div key={o.orderId} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-dark-800/40">
                        <div className="flex items-center gap-1.5">
                          {o.isBuyOrder ? (
                            <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-orange-400" />
                          )}
                          <span className="text-dark-300">{o.isBuyOrder ? 'Buy' : 'Sell'} #{o.orderId}</span>
                        </div>
                        <span className="text-dark-400">{formatCarbonTonnes(o.amount - o.filled)} @ {formatCurrency(o.pricePerTonne)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : view === 'nfts' ? (
            /* ═══════════════════════════════════════
               NFT CREDITS VIEW
               ═══════════════════════════════════════ */
            <div className="p-4">
              {nftCredits.length === 0 ? (
                <EmptyState
                  title="No NFT credits"
                  description="Carbon credit NFTs you own will appear here."
                  icon={<Leaf className="w-8 h-8 text-dark-500" />}
                />
              ) : (
                <div className="space-y-2">
                  {nftCredits.map((c) => (
                    <div key={c.id} className="bg-dark-800 border border-dark-700 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-xs truncate">{c.projectName}</p>
                          <p className="text-[10px] text-dark-400 font-mono">Token #{c.tokenId}</p>
                        </div>
                        <Badge variant={c.isRetired ? 'default' : 'success'} size="sm">
                          {c.isRetired ? 'Retired' : 'Active'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <p className="text-dark-500">Tonnes</p>
                          <p className="text-white font-medium">{formatCarbonTonnes(c.co2Tonnes)}</p>
                        </div>
                        <div>
                          <p className="text-dark-500">Vintage</p>
                          <p className="text-white font-medium">{c.vintageYear}</p>
                        </div>
                        <div>
                          <p className="text-dark-500">Method</p>
                          <p className="text-white font-medium truncate">{c.methodology}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : view === 'orders' ? (
            /* ═══════════════════════════════════════
               MY ORDERS VIEW
               ═══════════════════════════════════════ */
            <div className="p-4">
              {myOrders.length === 0 ? (
                <EmptyState
                  title="No active orders"
                  description="Your marketplace orders will appear here."
                  icon={<ShoppingCart className="w-8 h-8 text-dark-500" />}
                />
              ) : (
                <div className="space-y-2">
                  {myOrders.map((o) => (
                    <div key={o.orderId} className="bg-dark-800 border border-dark-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {o.isBuyOrder ? (
                            <div className="w-6 h-6 rounded bg-emerald-500/15 flex items-center justify-center">
                              <ArrowDownRight className="w-3 h-3 text-emerald-400" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded bg-orange-500/15 flex items-center justify-center">
                              <ArrowUpRight className="w-3 h-3 text-orange-400" />
                            </div>
                          )}
                          <div>
                            <p className="text-white font-medium text-xs">{o.isBuyOrder ? 'Buy' : 'Sell'} #{o.orderId}</p>
                            <p className="text-dark-400 text-[10px]">{formatCurrency(o.pricePerTonne)}/t</p>
                          </div>
                        </div>
                        <Badge variant={o.isActive ? 'success' : 'default'} size="sm">
                          {o.isActive ? 'Active' : 'Closed'}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <p className="text-dark-500">Total</p>
                          <p className="text-white font-medium">{formatCarbonTonnes(o.amount)}</p>
                        </div>
                        <div>
                          <p className="text-dark-500">Filled</p>
                          <p className="text-emerald-400 font-medium">{formatCarbonTonnes(o.filled)}</p>
                        </div>
                        <div>
                          <p className="text-dark-500">Left</p>
                          <p className="text-orange-400 font-medium">{formatCarbonTonnes(o.amount - o.filled)}</p>
                        </div>
                      </div>
                      {o.filled > 0 && (
                        <div className="mt-2">
                          <div className="w-full bg-dark-700 rounded-full h-1">
                            <div
                              className="bg-emerald-500 h-1 rounded-full transition-all"
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
          ) : view === 'depository' ? (
            /* ═══════════════════════════════════════
               DEPOSITORY VIEW
               ═══════════════════════════════════════ */
            <div className="p-4">
              {depCredits.length === 0 ? (
                <EmptyState
                  title="No depository credits"
                  description="Credits held in the ATMOS Depository will appear here."
                  icon={<Wallet className="w-8 h-8 text-dark-500" />}
                />
              ) : (
                <div className="space-y-2">
                  {depCredits.map((c) => (
                    <div key={c.creditId} className="bg-dark-800 border border-dark-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono text-dark-200 truncate">{c.creditId}</p>
                          <p className="text-[10px] text-dark-500">{c.projectId}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge variant={c.status === 'Active' ? 'success' : 'default'} size="sm">{c.status}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white">{formatCarbonTonnes(c.co2Amount)}</span>
                        {c.status === 'Active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setRetireCreditId(retireCreditId === c.creditId ? null : c.creditId)}
                          >
                            Retire
                          </Button>
                        )}
                      </div>
                      {retireCreditId === c.creditId && c.status === 'Active' && (
                        <div className="mt-2 pt-2 border-t border-dark-700/50">
                          <Input
                            placeholder="Reason (optional)"
                            value={retireReason}
                            onChange={(e) => setRetireReason(e.target.value)}
                            className="mb-2"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleRetire} loading={retiring} disabled={retiring}>
                              Confirm
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setRetireCreditId(null); setRetireReason(''); }} disabled={retiring}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
