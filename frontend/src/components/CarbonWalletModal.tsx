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
} from 'lucide-react';
import { Card, Badge, Button, LoadingSkeleton, EmptyState, Input } from '@/components/UI';
import { formatCarbonTonnes } from '@/utils/format';
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
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const UNLOCK_VALID_MS = 30 * 60 * 1000; // 30 min
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

export function CarbonWalletModal({ isOpen, onClose }: CarbonWalletModalProps) {
  const { address, isConnected } = useAccount();
  const [walletStatus, setWalletStatus] = useState<{ hasPassword: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [credits, setCredits] = useState<DepositoryCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retireCreditId, setRetireCreditId] = useState<string | null>(null);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);
  const [showRetired, setShowRetired] = useState(true);

  // Password flow state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!address) return;
    try {
      const st = await getCarbonWalletStatus(address);
      setWalletStatus(st);
    } catch {
      setWalletStatus({ hasPassword: false });
    }
  }, [address]);

  const fetchCredits = useCallback(async () => {
    if (!address) {
      setCredits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDepositoryCredits(address, false);
      setCredits(res.credits || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load credits');
      setCredits([]);
    } finally {
      setLoading(false);
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
      fetchCredits();
      setWalletStatus({ hasPassword: true });
      return;
    }
    setUnlocked(false);
    fetchStatus();
  }, [isOpen, address, fetchStatus, fetchCredits]);

  useEffect(() => {
    if (unlocked && address) fetchCredits();
  }, [unlocked, address, fetchCredits]);

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
      fetchCredits();
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
        fetchCredits();
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
      fetchCredits();
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

  const activeCredits = credits.filter((c) => c.status === 'Active');
  const retiredCredits = credits.filter((c) => c.status === 'Retired');
  const totalActiveTonnes = activeCredits.reduce((s, c) => s + c.co2Amount, 0);
  const totalRetiredTonnes = retiredCredits.reduce((s, c) => s + c.co2Amount, 0);
  const displayList = showRetired ? credits : activeCredits;
  const accountNumber = address ? getCarbonAccountNumber(address) : '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="bg-dark-900 border border-dark-600 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <Leaf className="w-8 h-8 text-emerald-500" />
            <div>
              <h2 className="text-xl font-bold text-white">Official Carbon Wallet</h2>
              <p className="text-xs text-dark-400">ATMOS Depository • Government-authorized</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-white"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!isConnected ? (
            <div className="py-8 text-center text-dark-400">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Connect your wallet to open your Official Carbon Wallet.</p>
            </div>
          ) : walletStatus === null ? (
            <LoadingSkeleton count={3} height="h-20" />
          ) : !walletStatus.hasPassword ? (
            <div className="max-w-sm mx-auto py-6">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Lock className="w-5 h-5" /> Set wallet password
              </h3>
              <p className="text-dark-400 text-sm mb-4">
                Individuals and companies can set a password to protect access to this Carbon Wallet.
              </p>
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
                className="w-full mt-4"
                onClick={handleSetPassword}
                loading={settingPassword}
                disabled={settingPassword || password.length < 6 || password !== confirmPassword}
              >
                Set password & open wallet
              </Button>
            </div>
          ) : !unlocked ? (
            <div className="max-w-sm mx-auto py-6">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Unlock className="w-5 h-5" /> Unlock Carbon Wallet
              </h3>
              <p className="text-dark-400 text-sm mb-4">Enter your password to view your official carbon account.</p>
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
          ) : (
            <>
              {/* Account & Certificate */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <Card className="p-4">
                  <p className="text-dark-400 text-xs uppercase tracking-wider mb-1">Account number</p>
                  <p className="font-mono font-semibold text-emerald-400">{accountNumber}</p>
                  <p className="text-dark-400 text-xs mt-2">Wallet address</p>
                  <p className="font-mono text-sm text-dark-200 break-all">{address}</p>
                </Card>
                <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <Award className="w-8 h-8 text-emerald-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-white">Official Carbon Wallet Certificate</p>
                      <p className="text-dark-400 text-sm mt-1">
                        This account is part of the ATMOS Carbon Credit Depository. Carbon credits held here are
                        officially recorded and authorized for trading and retirement.
                      </p>
                      <p className="text-xs text-dark-500 mt-2">Certificate ID: {accountNumber}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{formatCarbonTonnes(totalActiveTonnes)}</p>
                  <p className="text-xs text-dark-400">Active</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-dark-300">{formatCarbonTonnes(totalRetiredTonnes)}</p>
                  <p className="text-xs text-dark-400">Retired</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold text-white">{formatCarbonTonnes(totalActiveTonnes + totalRetiredTonnes)}</p>
                  <p className="text-xs text-dark-400">Total</p>
                </Card>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">{error}</div>
              )}

              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <h3 className="font-semibold text-white">Carbon credit ownership</h3>
                  <button
                    type="button"
                    onClick={() => setShowRetired(!showRetired)}
                    className="text-dark-400 text-sm flex items-center gap-1"
                  >
                    {showRetired ? 'Hide' : 'Show'} retired <ChevronUp className={`w-4 h-4 ${showRetired ? '' : 'rotate-180'}`} />
                  </button>
                </div>
                {loading ? (
                  <LoadingSkeleton count={3} height="h-12" />
                ) : displayList.length === 0 ? (
                  <EmptyState
                    title="No credits yet"
                    description="Claim credits via Company Register or receive transfers. They will appear here."
                    icon={<Wallet className="w-10 h-10 text-dark-500" />}
                  />
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-dark-700 text-dark-400">
                          <th className="pb-2 pr-2">Credit ID</th>
                          <th className="pb-2 pr-2">Project</th>
                          <th className="pb-2 pr-2">Tonnes</th>
                          <th className="pb-2 pr-2">Status</th>
                          <th className="pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayList.map((c) => (
                          <React.Fragment key={c.creditId}>
                            <tr className="border-b border-dark-700/70">
                              <td className="py-2 pr-2 font-mono text-dark-200">{c.creditId}</td>
                              <td className="py-2 pr-2 text-dark-200">{c.projectId}</td>
                              <td className="py-2 pr-2 font-medium text-dark-100">{formatCarbonTonnes(c.co2Amount)}</td>
                              <td className="py-2 pr-2">
                                <Badge variant={c.status === 'Active' ? 'success' : 'default'}>{c.status}</Badge>
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
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
