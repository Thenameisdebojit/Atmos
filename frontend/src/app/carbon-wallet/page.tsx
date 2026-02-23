'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Leaf, Shield, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, StatCard, Badge, Button, LoadingSkeleton, EmptyState, Input } from '@/components/UI';
import { Header } from '@/components/Header';
import { formatCarbonTonnes } from '@/utils/format';
import { fetchDepositoryCredits, retireDepositoryCredit, type DepositoryCredit } from '@/utils/api';
import { useAccount } from 'wagmi';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function CarbonWalletPage() {
  const { address, isConnected } = useAccount();
  const [credits, setCredits] = useState<DepositoryCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retireCreditId, setRetireCreditId] = useState<string | null>(null);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);
  const [showRetired, setShowRetired] = useState(true);

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
    fetchCredits();
  }, [fetchCredits]);

  const activeCredits = credits.filter((c) => c.status === 'Active');
  const retiredCredits = credits.filter((c) => c.status === 'Retired');
  const totalActiveTonnes = activeCredits.reduce((s, c) => s + c.co2Amount, 0);
  const totalRetiredTonnes = retiredCredits.reduce((s, c) => s + c.co2Amount, 0);

  const handleRetire = async () => {
    if (!retireCreditId || !address) return;
    setRetiring(true);
    try {
      await retireDepositoryCredit(retireCreditId, address, retireReason);
      toast.success('Credit retired successfully');
      setRetireCreditId(null);
      setRetireReason('');
      await fetchCredits();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Retirement failed');
    } finally {
      setRetiring(false);
    }
  };

  const displayList = showRetired ? credits : activeCredits;

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
            <span className="bg-gradient-to-r from-emerald-300 to-emerald-600 bg-clip-text text-transparent">
              Carbon Wallet
            </span>
            <Leaf className="w-10 h-10 text-emerald-500" />
          </h1>
          <p className="text-dark-400">
            Demat-style carbon credit account — your holdings in the ATMOS Depository
          </p>
          {!isConnected && (
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-sm flex items-center gap-2">
              <Wallet className="w-5 h-5 shrink-0" />
              Connect your wallet to view depository holdings and retire credits
            </div>
          )}
        </div>

        {isConnected && (
          <>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {loading ? (
                <>
                  <LoadingSkeleton count={3} height="h-28" />
                </>
              ) : (
                <>
                  <StatCard
                    label="Active credits"
                    value={formatCarbonTonnes(totalActiveTonnes)}
                    icon={<Wallet className="w-5 h-5" />}
                    subtext={`${activeCredits.length} credit(s)`}
                  />
                  <StatCard
                    label="Retired"
                    value={formatCarbonTonnes(totalRetiredTonnes)}
                    icon={<Shield className="w-5 h-5" />}
                    subtext={`${retiredCredits.length} credit(s)`}
                  />
                  <StatCard
                    label="Total holdings"
                    value={formatCarbonTonnes(totalActiveTonnes + totalRetiredTonnes)}
                    icon={<Leaf className="w-5 h-5" />}
                    subtext="All time"
                  />
                </>
              )}
            </div>

            <Card className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-xl font-semibold text-dark-50">Holdings</h2>
                <div className="flex items-center gap-2">
                  <span className="text-dark-400 text-sm">Show retired</span>
                  <button
                    type="button"
                    onClick={() => setShowRetired(!showRetired)}
                    className="p-2 rounded-lg border border-dark-600 hover:bg-dark-700 text-dark-300"
                  >
                    {showRetired ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loading ? (
                <LoadingSkeleton count={5} height="h-14" />
              ) : displayList.length === 0 ? (
                <EmptyState
                  title="No credits in your Carbon Wallet"
                  description="Credits held in the ATMOS Depository will appear here. Register or receive credits to see them."
                  icon={<Wallet className="w-12 h-12 text-dark-500" />}
                />
              ) : (
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
                      {displayList.map((c) => (
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
                                <span className="text-dark-500 text-xs" title={c.retirementReason}>
                                  Retired
                                </span>
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
                                    <Button
                                      variant="primary"
                                      loading={retiring}
                                      disabled={retiring}
                                      onClick={handleRetire}
                                      icon={retiring ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                                    >
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
                                <p className="text-dark-500 text-xs mt-2">
                                  Retiring is permanent; this credit cannot be transferred again.
                                </p>
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
      </main>
    </div>
  );
}
