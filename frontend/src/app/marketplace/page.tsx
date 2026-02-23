'use client';

import React, { useState, useEffect } from 'react';
import { Search, ShoppingCart, Send, Zap } from 'lucide-react';
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
import toast from 'react-hot-toast';

interface OrderListing {
  id: number;
  trader: string;
  isBuyOrder: boolean;
  amount: number;
  pricePerTonne: number;
}

export default function MarketplacePage() {
  const {
    getMarketplaceOrders,
    fillOrder,
    getErc20Allowance,
    approveErc20,
    isConnected,
    address,
  } = useContractInteraction();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [viewMode, setViewMode] = useState<'listings' | 'companies'>('listings');
  const [selectedListing, setSelectedListing] = useState<OrderListing | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<OrderListing[]>([]);

  useEffect(() => {
    const loadOrders = async () => {
      if (!isConnected || !address) return;
      try {
        const data = await getMarketplaceOrders();
        const mapped = (data || []).map((order) => ({
          id: order.orderId,
          trader: order.trader,
          isBuyOrder: order.isBuyOrder,
          amount: order.amount,
          pricePerTonne: order.pricePerTonne,
        }));
        setOrders(mapped);
      } catch (error) {
        console.error('Failed to load orders:', error);
      }
    };

    loadOrders();
  }, [isConnected, address, getMarketplaceOrders]);

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
      <Header walletAddress={address} />

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
                        <span className="text-dark-400">Amount</span>
                        <span className="font-medium">{formatCarbonTonnes(listing.amount)}</span>
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

            {/* Listing Modal */}
            {selectedListing && (
              <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                <Card className="max-w-md w-full space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">
                      Sell Order #{selectedListing.id}
                    </h2>
                    <p className="text-dark-400">Seller: {selectedListing.trader}</p>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Amount (Tonnes)"
                      type="number"
                      placeholder="e.g., 1000"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                    />
                    <div className="bg-dark-800 p-4 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-dark-400">Price per Tonne</span>
                        <span className="font-medium">
                          {formatCurrency(selectedListing.pricePerTonne)}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg font-semibold">
                        <span>Total Cost</span>
                        <span className="gradient-text">
                          {formatCurrency(
                            (parseFloat(buyAmount) || 0) * selectedListing.pricePerTonne
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedListing(null)}
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
                        try {
                          const amountToFill = parseFloat(buyAmount);
                          if (selectedListing.isBuyOrder) {
                            const allowance = await getErc20Allowance(
                              CONTRACTS.carbonCreditToken,
                              address,
                              CONTRACTS.carbonMarketplace
                            );

                            if (allowance < amountToFill) {
                              const approveTx = await approveErc20(
                                CONTRACTS.carbonCreditToken,
                                CONTRACTS.carbonMarketplace,
                                amountToFill
                              );
                              if (!approveTx) {
                                toast.error('CCT approval failed');
                                return;
                              }
                              toast.success('CCT approved! Proceeding with fill...');
                            }
                          } else {
                            const totalCost = amountToFill * selectedListing.pricePerTonne;
                            const allowance = await getErc20Allowance(
                              CONTRACTS.usdc,
                              address,
                              CONTRACTS.carbonMarketplace
                            );

                            if (allowance < totalCost) {
                              const approveTx = await approveErc20(
                                CONTRACTS.usdc,
                                CONTRACTS.carbonMarketplace,
                                totalCost
                              );
                              if (!approveTx) {
                                toast.error('USDC approval failed');
                                return;
                              }
                              toast.success('USDC approved! Proceeding with purchase...');
                            }
                          }

                          const tx = await fillOrder(selectedListing.id, amountToFill);
                          if (tx) {
                            toast.success(`Order filled! Tx: ${tx.slice(0, 10)}...`);
                            setSelectedListing(null);
                            setBuyAmount('');
                          }
                        } catch (error: any) {
                          toast.error(error.message || 'Transaction failed');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                    >
                      {isLoading ? 'Processing...' : 'Fill Order'}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
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
      </main>
    </div>
  );
}
