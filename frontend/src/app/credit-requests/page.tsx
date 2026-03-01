'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Card, Button, Input, StatCard } from '@/components/UI';
import toast from 'react-hot-toast';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';
import { notifyTradeSuccess, requestNotificationPermission } from '@/utils/notifications';
import { formatCurrency, formatCarbonTonnes } from '@/utils/format';
import { Wallet, Zap, RefreshCw } from 'lucide-react';

interface OrderRow {
  orderId: number;
  trader: string;
  isBuyOrder: boolean;
  amount: number;
  pricePerTonne: number;
  filled: number;
  isActive: boolean;
  createdAt: number;
  expiresAt: number;
}

export default function CreditRequests() {
  const { address, isConnected } = useAccount();
  const {
    createBuyOrder,
    fillOrder,
    getMarketplaceOrders,
    getErc20Allowance,
    getErc20Balance,
    approveErc20,
    publicClient,
  } = useContractInteraction();

  const [tab, setTab] = useState<'request' | 'browse' | 'my-requests'>('browse');
  const [formData, setFormData] = useState({
    creditAmount: '',
    maxPricePerTonne: '',
    deadline: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestedCredits, setRequestedCredits] = useState<OrderRow[]>([]);
  const [availableCredits, setAvailableCredits] = useState<OrderRow[]>([]);
  const [buyAmounts, setBuyAmounts] = useState<{ [orderId: number]: string }>({});
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [cctBalance, setCctBalance] = useState<number | null>(null);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);

  const loadBalances = useCallback(async () => {
    if (!isConnected || !address) return;
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
  }, [isConnected, address, getErc20Balance]);

  const loadOrders = useCallback(async () => {
    try {
      const orders = await getMarketplaceOrders();
      const sellOrders = (orders || []).filter((order) => !order.isBuyOrder && order.isActive && (order.amount - order.filled) > 0);
      const buyOrders = (orders || []).filter((order) => order.isBuyOrder && order.isActive);

      setAvailableCredits(sellOrders);
      setRequestedCredits(
        buyOrders.filter((order) => order.trader.toLowerCase() === address?.toLowerCase())
      );

      const amounts: { [orderId: number]: string } = {};
      sellOrders.forEach(order => {
        amounts[order.orderId] = (order.amount - order.filled).toFixed(2);
      });
      setBuyAmounts(amounts);
    } catch (error) {
      // Error loading orders silently
    }
  }, [getMarketplaceOrders, address]);

  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }
    requestNotificationPermission();
    loadOrders();
    loadBalances();
  }, [isConnected, address, loadOrders, loadBalances]);



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.creditAmount || !formData.maxPricePerTonne) {
      toast.error('Please fill all fields');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Checking USDC approval...');

    try {
      const amount = parseFloat(formData.creditAmount);
      const price = parseFloat(formData.maxPricePerTonne);
      const totalCost = amount * price;

      // Check USDC allowance
      const allowance = await getErc20Allowance(
        CONTRACTS.usdc,
        address as string,
        CONTRACTS.carbonMarketplace
      );

      // Approve USDC if needed
      if (allowance < totalCost) {
        toast.dismiss(loadingToast);
        const approveToast = toast.loading(`Approving ${totalCost} USDC...`);
        
        const approveTx = await approveErc20(CONTRACTS.usdc, CONTRACTS.carbonMarketplace, totalCost);
        
        if (!approveTx) {
          toast.dismiss(approveToast);
          toast.error('USDC approval failed');
          setIsSubmitting(false);
          return;
        }
        
        toast.dismiss(approveToast);
        toast.success('USDC approved! Creating buy order...');
      }

      // Create buy order
      const orderToast = toast.loading('Creating buy order...');
      const txHash = await createBuyOrder(amount, price, 0, false);

      toast.dismiss(orderToast);
      
      if (txHash) {
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          if (receipt.status !== 'success') {
            throw new Error('Buy order transaction reverted');
          }
        }
        toast.success(`Buy order created! TX: ${txHash.slice(0, 10)}...`);
        notifyTradeSuccess('buy', amount, price, txHash);
      } else {
        throw new Error('Buy order transaction was cancelled or failed');
      }

      setFormData({ creditAmount: '', maxPricePerTonne: '', deadline: '' });
      setTab('my-requests');
      await Promise.all([loadOrders(), loadBalances()]);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Error:', error);
      const errorMessage = error?.shortMessage || error?.message || 'Failed to submit request';
      const normalized = String(errorMessage).toLowerCase();
      if (
        normalized.includes('user rejected') ||
        normalized.includes('rejected') ||
        normalized.includes('cancelled') ||
        normalized.includes('denied')
      ) {
        toast.error('Transaction cancelled in wallet');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyCredit = async (orderId: number, maxAvailable: number, price: number) => {
    if (!isConnected) {
      toast.error('Please connect wallet');
      return;
    }

    const amount = parseFloat(buyAmounts[orderId] || '0');
    if (amount <= 0 || amount > maxAvailable) {
      toast.error(`Please enter a valid amount (0 < amount <= ${maxAvailable})`);
      return;
    }

    const confirmToast = toast.loading(`Processing purchase...`);

    try {
      const totalCost = amount * price;
      const allowance = await getErc20Allowance(
        CONTRACTS.usdc,
        address as string,
        CONTRACTS.carbonMarketplace
      );

      if (allowance < totalCost) {
        toast.dismiss(confirmToast);
        toast.loading('Approving USDC...');
        const approveTx = await approveErc20(
          CONTRACTS.usdc,
          CONTRACTS.carbonMarketplace,
          totalCost,
          true // wait for confirmation
        );
        if (!approveTx) {
          throw new Error('USDC approval failed');
        }
        toast.dismiss();
        toast.success('USDC approved!');
      }

      toast.loading('Filling order...');
      const txHash = await fillOrder(orderId, amount);
      if (!txHash) {
        throw new Error('Fill order transaction failed');
      }

      // Wait for fill transaction confirmation
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      toast.dismiss();
      toast.success(`Purchased ${amount} credits successfully!`);
      notifyTradeSuccess('buy', amount, price, txHash);
      await Promise.all([loadOrders(), loadBalances()]);
    } catch (error: any) {
      toast.dismiss();
      console.error('Purchase error:', error);
      console.error('Error details:', {
        message: error?.message,
        shortMessage: error?.shortMessage,
        cause: error?.cause,
        metaMessages: error?.metaMessages
      });
      toast.error(error?.message || error?.shortMessage || 'Purchase failed');
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <Card className="p-12 text-center max-w-lg">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Connect Wallet to Trade Credits</h2>
            <p className="text-gray-400 mb-6">
              Click the <strong>"Connect"</strong> button in the top-right corner to buy or request carbon credits.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const totalRequests = requestedCredits.reduce((sum, req) => sum + req.amount, 0);
  const filledRequests = requestedCredits.reduce((sum, req) => sum + req.filled, 0);
  const pendingAmount = requestedCredits.reduce((sum, req) => sum + (req.amount - req.filled), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-2">
            Carbon Credit Marketplace
          </h1>
          <p className="text-gray-400">Request credits or buy from sellers</p>
        </div>

        {/* Wallet Balances */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span className="text-gray-400 text-sm">USDC</span>
            <span className="font-semibold text-lg text-white">
              {usdcBalance !== null ? formatCurrency(usdcBalance) : '\u2014'}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-gray-400 text-sm">CCT</span>
            <span className="font-semibold text-lg text-white">
              {cctBalance !== null ? formatCarbonTonnes(cctBalance) : '\u2014'}
            </span>
          </div>
          <button
            onClick={() => loadBalances()}
            disabled={balanceRefreshing}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refresh balances"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${balanceRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Requested"
            value={totalRequests.toFixed(0)}
            subtext="tonnes"
            change={12}
          />
          <StatCard
            label="Already Filled"
            value={filledRequests.toFixed(0)}
            subtext="tonnes"
            change={8}
          />
          <StatCard
            label="Still Pending"
            value={pendingAmount.toFixed(0)}
            subtext="tonnes"
            change={pendingAmount > 100 ? 15 : 5}
          />
          <StatCard
            label="Available Credits"
            value={availableCredits.reduce((sum, c) => sum + (c.amount - c.filled), 0).toFixed(0)}
            subtext="tonnes"
            change={18}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          {['browse', 'my-requests', 'request'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              className={`px-4 py-3 font-semibold transition-colors capitalize ${
                tab === t
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {t === 'my-requests' ? 'My Requests' : t === 'browse' ? 'Browse Market' : 'Submit Request'}
            </button>
          ))}
        </div>

        {/* Browse Available Credits */}
        {tab === 'browse' && (
          <div className="space-y-6">
            {availableCredits.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {availableCredits.map(credit => (
                  <Card key={credit.orderId} className="p-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-white">Sell Order #{credit.orderId}</h3>
                            <p className="text-gray-400 text-sm">Seller: {credit.trader}</p>
                          </div>
                          <div className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 text-xs font-semibold">
                            💰 Fixed Price
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Amount Available</p>
                          <p className="text-white font-bold text-lg">{(credit.amount - credit.filled).toFixed(2)}</p>
                          <p className="text-gray-500 text-xs">tonnes CO₂</p>
                          {credit.filled > 0 && (
                            <p className="text-gray-600 text-xs mt-1">({credit.filled.toFixed(1)} filled)</p>
                          )}
                        </div>
                        <div>
                          <p className="text-gray-400">Price</p>
                          <p className="text-white font-bold text-lg">${credit.pricePerTonne}</p>
                          <p className="text-gray-500 text-xs">per tonne</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-700 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="Amount to buy"
                            min="0.01"
                            max={credit.amount - credit.filled}
                            step="0.01"
                            value={buyAmounts[credit.orderId] || ''}
                            onChange={(e) => setBuyAmounts(prev => ({ ...prev, [credit.orderId]: e.target.value }))}
                            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                          />
                          <span className="text-gray-400 text-sm">tonnes</span>
                        </div>
                        <Button
                          onClick={() => handleBuyCredit(credit.orderId, credit.amount - credit.filled, credit.pricePerTonne)}
                          className="w-full"
                        >
                          Buy Now
                        </Button>
                      </div>

                      <p className="text-xs text-gray-500 text-center">
                        Total Cost: ${((parseFloat(buyAmounts[credit.orderId]) || 0) * credit.pricePerTonne).toFixed(2)}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-400">No credits available for sale right now</p>
              </Card>
            )}
          </div>
        )}

        {/* My Requests */}
        {tab === 'my-requests' && (
          <div className="space-y-6">
            {requestedCredits.length > 0 ? (
              <div className="space-y-4">
                {requestedCredits.map(req => (
                  <Card key={req.orderId} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Buy Order #{req.orderId}</h3>
                        <p className="text-gray-400 text-sm">by {req.trader}</p>
                      </div>
                      <div className={`px-4 py-2 rounded font-semibold text-sm ${
                        req.amount === req.filled
                          ? 'bg-green-500/20 text-green-400'
                          : req.filled > 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {req.amount === req.filled ? 'FILLED' : req.filled > 0 ? 'PARTIAL' : 'PENDING'}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4 text-sm">
                      <div>
                        <p className="text-gray-400">Total Amount</p>
                        <p className="text-white font-bold">{req.amount}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Filled</p>
                        <p className="text-green-400 font-bold">{req.filled}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Remaining</p>
                        <p className="text-orange-400 font-bold">{req.amount - req.filled}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Max Price</p>
                        <p className="text-white font-bold">${req.pricePerTonne}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{((req.filled / req.amount) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{width: `${(req.filled / req.amount) * 100}%`}}
                        ></div>
                      </div>
                    </div>

                    {req.amount - req.filled > 0 && (
                      <Button className="w-full" size="sm">Open for Sellers ({req.amount - req.filled} tonnes)</Button>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-400 mb-4">You haven't submitted any credit requests yet</p>
                <Button onClick={() => setTab('request')}>Submit Request</Button>
              </Card>
            )}
          </div>
        )}

        {/* Submit Request Form */}
        {tab === 'request' && (
          <Card className="p-8 max-w-2xl">
            <h2 className="text-2xl font-semibold text-white mb-6">Submit Credit Request</h2>
            <form onSubmit={handleSubmitRequest} className="space-y-6">
              <Input
                label="Credits Needed (tonnes CO₂)"
                name="creditAmount"
                type="number"
                placeholder="e.g., 500"
                value={formData.creditAmount}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />

              <Input
                label="Maximum Price per Tonne ($)"
                name="maxPricePerTonne"
                type="number"
                placeholder="e.g., 25"
                step="0.01"
                value={formData.maxPricePerTonne}
                onChange={handleInputChange}
                disabled={isSubmitting}
              />

              {formData.creditAmount && formData.maxPricePerTonne && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm text-gray-400">Estimated Cost:</p>
                  <p className="text-white font-bold text-lg">
                    ${(parseFloat(formData.creditAmount || '0') * parseFloat(formData.maxPricePerTonne || '0')).toFixed(2)} max
                  </p>
                </div>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                Your request will be listed on the marketplace for sellers to fulfill
              </p>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}
