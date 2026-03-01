'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, ShoppingCart, Send, Zap, Wallet, RefreshCw } from 'lucide-react';
import {
  Card,
  Badge,
  Input,
  Select,
  Button,
  LoadingSkeleton,
} from '@/components/UI';
import { Header } from '@/components/Header';
import { formatCurrency, formatCarbonTonnes } from '@/utils/format';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';
import { notifyTradeSuccess, requestNotificationPermission } from '@/utils/notifications';
import toast from 'react-hot-toast';

interface OrderListing {
  id: number;
  trader: string;
  isBuyOrder: boolean;
  amount: number;
  isActive: boolean;
  pricePerTonne: number;
  filled: number;
  available: number;
}

export default function MarketplacePage() {
  const {
    getMarketplaceOrders,
    fillOrder,
    getErc20Allowance,
    getErc20Balance,
    approveErc20,
    isConnected,
    address,
    publicClient,
  } = useContractInteraction();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [viewMode, setViewMode] = useState<'listings' | 'companies'>('listings');
  const [selectedListing, setSelectedListing] = useState<OrderListing | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<OrderListing[]>([]);
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
    if (!isConnected || !address) return;
    try {
      const data = await getMarketplaceOrders();
      const mapped = (data || []).map((order) => ({
        id: Number(order.orderId),
        trader: order.trader,
        isBuyOrder: order.isBuyOrder,
        amount: Number(order.amount),
        isActive: Boolean(order.isActive),
        pricePerTonne: Number(order.pricePerTonne),
        filled: Number(order.filled || 0),
        available: Number(order.amount) - Number(order.filled || 0),
      })).filter((order) => order.available > 0 && order.isActive);
      setOrders(mapped);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  }, [isConnected, address, getMarketplaceOrders]);

  useEffect(() => {
    requestNotificationPermission();
    loadOrders();
    loadBalances();
  }, [loadOrders, loadBalances]);

  const filteredListings = orders.filter((order) => {
    if (order.isBuyOrder) return false;
    const matchesSearch = order.trader.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const filteredCompanies = orders.filter((order) => {
    if (!order.isBuyOrder) return false;
    return order.trader.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Carbon Credit Marketplace</h1>
          <p className="text-dark-400">
            Trade verified carbon credits with companies worldwide
          </p>
          {!isConnected && (
            <div className="mt-4 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
              💡 Connect your wallet to buy carbon credits
            </div>
          )}
        </div>

        {/* Wallet Balances */}
        {isConnected && (
          <div className="mb-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2.5">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="text-dark-400 text-sm">USDC</span>
              <span className="font-semibold text-lg">
                {usdcBalance !== null ? formatCurrency(usdcBalance) : '—'}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 rounded-lg px-4 py-2.5">
              <Zap className="w-4 h-4 text-green-400" />
              <span className="text-dark-400 text-sm">CCT</span>
              <span className="font-semibold text-lg">
                {cctBalance !== null ? formatCarbonTonnes(cctBalance) : '—'}
              </span>
            </div>
            <button
              onClick={() => loadBalances()}
              disabled={balanceRefreshing}
              className="p-2 rounded-lg bg-dark-800 border border-dark-700 hover:bg-dark-700 transition-colors disabled:opacity-50"
              title="Refresh balances"
            >
              <RefreshCw className={`w-4 h-4 text-dark-400 ${balanceRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={viewMode === 'listings' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('listings')}
          >
            For Sale
          </Button>
          <Button
            variant={viewMode === 'companies' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('companies')}
          >
            Companies Need Credits
          </Button>
        </div>

        {viewMode === 'listings' ? (
          <>
            {/* Search and Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Input
                placeholder="Search projects or locations..."
                icon={<Search className="w-5 h-5" />}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select
                options={[
                  { value: 'price', label: 'Sort by Price' },
                  { value: 'quantity', label: 'Sort by Quantity' },
                  { value: 'newest', label: 'Newest First' },
                ]}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              />
            </div>

            {/* Listings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {filteredListings.length > 0 ? (
                filteredListings.map((listing) => (
                  <Card
                    key={listing.id}
                    className="space-y-4 hover:shadow-lg hover:shadow-primary-500/10 transition-all cursor-pointer"
                    interactive
                  >
                    {/* Header with Emoji */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div>
                          <p className="font-semibold text-lg">Sell Order #{listing.id}</p>
                          <p className="text-sm text-dark-400">Seller: {listing.trader}</p>
                        </div>
                      </div>
                      <Badge variant="success" size="sm">
                        CCT
                      </Badge>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-dark-400">Available</span>
                        <span className="font-medium">
                          {formatCarbonTonnes(listing.available)}
                          {listing.filled > 0 && (
                            <span className="text-dark-400 text-xs ml-1">
                              ({listing.filled.toFixed(1)} filled)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Price and Action */}
                    <div className="border-t border-dark-700 pt-4 flex items-center justify-between">
                      <div>
                        <p className="text-dark-400 text-xs">Price per Tonne</p>
                        <p className="text-2xl font-bold gradient-text">
                          {formatCurrency(listing.pricePerTonne)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        icon={<ShoppingCart className="w-4 h-4" />}
                        onClick={() => setSelectedListing(listing)}
                      >
                        Buy
                      </Button>
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-dark-400">
                  No listings found matching your criteria
                </div>
              )}
            </div>

          </>
        ) : (
          <>
            {/* Companies Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredCompanies.length > 0 ? (
                filteredCompanies.map((order) => (
                  <Card
                    key={order.id}
                    className="space-y-4 hover:shadow-lg hover:shadow-primary-500/10"
                    interactive
                  >
                    <div>
                      <h3 className="text-xl font-bold mb-1">Buy Order #{order.id}</h3>
                      <p className="text-sm text-dark-400">Buyer: {order.trader}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-dark-800 p-2 rounded">
                        <p className="text-dark-400">Amount</p>
                        <p className="font-semibold">
                          {formatCarbonTonnes(order.amount)}
                        </p>
                      </div>
                      <div className="bg-dark-800 p-2 rounded">
                        <p className="text-dark-400">Price/Tonne</p>
                        <p className="font-semibold">
                          {formatCurrency(order.pricePerTonne)}
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      icon={<Zap className="w-4 h-4" />}
                      className="w-full"
                      onClick={() => setSelectedListing(order)}
                    >
                      Sell to Order
                    </Button>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-dark-400">
                  No buy orders available
                </div>
              )}
            </div>
          </>
        )}

        {/* Order Fill Modal — works for both sell orders (buying) and buy orders (selling) */}
        {selectedListing && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {selectedListing.isBuyOrder ? 'Buy' : 'Sell'} Order #{selectedListing.id}
                </h2>
                <p className="text-dark-400">
                  {selectedListing.isBuyOrder ? 'Buyer' : 'Seller'}: {selectedListing.trader}
                </p>
                <p className="text-sm text-dark-300">
                  Available: {selectedListing.available.toFixed(2)} tonnes
                  {selectedListing.filled > 0 && ` (${selectedListing.filled.toFixed(2)} filled)`}
                </p>
                {selectedListing.isBuyOrder && (
                  <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-400 text-xs">
                    💰 You will sell your CCT tokens and receive USDC payment
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Input
                  label={`Amount to ${selectedListing.isBuyOrder ? 'sell' : 'buy'} (Max: ${selectedListing.available.toFixed(2)} Tonnes)`}
                  type="number"
                  placeholder="e.g., 1000"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  max={selectedListing.available}
                />
                <div className="bg-dark-800 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-dark-400">Price per Tonne</span>
                    <span className="font-medium">
                      {formatCurrency(selectedListing.pricePerTonne)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>{selectedListing.isBuyOrder ? 'You Receive' : 'Total Cost'}</span>
                    <span className="gradient-text">
                      {formatCurrency(
                        (parseFloat(buyAmount) || 0) * selectedListing.pricePerTonne
                      )}
                    </span>
                  </div>
                  {selectedListing.isBuyOrder ? (
                    <>
                      <div className="flex justify-between text-sm border-t border-dark-700 pt-2 mt-2">
                        <span className="text-dark-400">Your CCT Balance</span>
                        <span className={`font-medium ${
                          cctBalance !== null && (parseFloat(buyAmount) || 0) > cctBalance
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        }`}>
                          {cctBalance !== null ? formatCarbonTonnes(cctBalance) : 'Loading...'}
                        </span>
                      </div>
                      {cctBalance !== null && (parseFloat(buyAmount) || 0) > cctBalance && (
                        <p className="text-red-400 text-xs mt-1">⚠️ Insufficient CCT balance</p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm border-t border-dark-700 pt-2 mt-2">
                        <span className="text-dark-400">Your USDC Balance</span>
                        <span className={`font-medium ${
                          usdcBalance !== null && (parseFloat(buyAmount) || 0) * selectedListing.pricePerTonne > usdcBalance
                            ? 'text-red-400'
                            : 'text-emerald-400'
                        }`}>
                          {usdcBalance !== null ? formatCurrency(usdcBalance) : 'Loading...'}
                        </span>
                      </div>
                      {usdcBalance !== null && (parseFloat(buyAmount) || 0) * selectedListing.pricePerTonne > usdcBalance && (
                        <p className="text-red-400 text-xs mt-1">⚠️ Insufficient USDC balance</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => { setSelectedListing(null); setBuyAmount(''); }}
                >
                  Cancel
                </Button>
                <Button
                  icon={<Send className="w-4 h-4" />}
                  disabled={!buyAmount || parseFloat(buyAmount) === 0 || !isConnected || isLoading}
                  onClick={async () => {
                    if (!isConnected) {
                      toast.error('Please connect your wallet first');
                      return;
                    }
                    
                    setIsLoading(true);
                    const loadingToast = toast.loading('Processing transaction...');
                    try {
                      const amountToFill = parseFloat(buyAmount);
                      
                      // Validate amount
                      if (amountToFill > selectedListing.available) {
                        throw new Error(`Cannot fill ${amountToFill} tonnes. Only ${selectedListing.available} available.`);
                      }
                      
                      // Handle approvals based on order type
                      if (selectedListing.isBuyOrder) {
                        // Selling CCT to buyer - need CCT approval
                        const allowance = await getErc20Allowance(
                          CONTRACTS.carbonCreditToken,
                          address as string,
                          CONTRACTS.carbonMarketplace
                        );

                        if (allowance < amountToFill) {
                          toast.dismiss(loadingToast);
                          toast.loading('Approving CCT...');
                          const approveTx = await approveErc20(
                            CONTRACTS.carbonCreditToken,
                            CONTRACTS.carbonMarketplace,
                            amountToFill,
                            true // wait for confirmation
                          );
                          if (!approveTx) {
                            throw new Error('CCT approval failed');
                          }
                          toast.dismiss();
                          toast.success('CCT approved!');
                        }
                      } else {
                        // Buying CCT from seller - need USDC approval
                        const totalCost = amountToFill * selectedListing.pricePerTonne;
                        const allowance = await getErc20Allowance(
                          CONTRACTS.usdc,
                          address as string,
                          CONTRACTS.carbonMarketplace
                        );

                        if (allowance < totalCost) {
                          toast.dismiss(loadingToast);
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
                      }

                      // Now fill the order
                      toast.loading('Filling order...');
                      const tx = await fillOrder(selectedListing.id, amountToFill);
                      if (!tx) {
                        throw new Error('Fill order transaction failed');
                      }

                      // Wait for fill transaction confirmation
                      if (publicClient) {
                        await publicClient.waitForTransactionReceipt({ hash: tx });
                      }

                      toast.dismiss();
                      toast.success(
                        selectedListing.isBuyOrder
                          ? `Sold ${amountToFill} CCT successfully! USDC received.`
                          : `Bought ${amountToFill} CCT successfully!`
                      );
                      notifyTradeSuccess(
                        selectedListing.isBuyOrder ? 'sell' : 'buy',
                        amountToFill,
                        selectedListing.pricePerTonne,
                        tx
                      );
                      setSelectedListing(null);
                      setBuyAmount('');
                      
                      await Promise.all([loadOrders(), loadBalances()]);
                    } catch (error: any) {
                      toast.dismiss();
                      console.error('Fill order error:', error);
                      console.error('Error details:', {
                        message: error?.message,
                        shortMessage: error?.shortMessage,
                        cause: error?.cause,
                        metaMessages: error?.metaMessages
                      });
                      toast.error(error?.message || error?.shortMessage || 'Transaction failed');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                >
                  {isLoading ? 'Processing...' : selectedListing.isBuyOrder ? 'Sell Credits' : 'Buy Credits'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
