'use client';

import React, { useEffect, useState } from 'react';
import {
  Clock,
  TrendingUp,
  Users,
  Gavel,
  Search,
  Filter,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  Badge,
  Input,
  Button,
  LoadingSkeleton,
  EmptyState,
} from '@/components/UI';
import { Header } from '@/components/Header';
import { formatCurrency, formatCarbonTonnes, formatRelativeTime } from '@/utils/format';
import { useAccount } from 'wagmi';
import { useNotification } from '@/hooks';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';

interface AuctionItem {
  id: string;
  seller: string;
  quantity: number;
  startingPrice: number;
  currentBid: number;
  highestBidder: string;
  startTime: number;
  endTime: number;
  status: 'active' | 'ended' | 'cancelled';
}

export default function AuctionsPage() {
  const { address, isConnected } = useAccount();
  const { getActiveAuctions, placeBid, finalizeAuction, getErc20Allowance, approveErc20 } = useContractInteraction();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ending-soon'>('all');
  const [selectedAuction, setSelectedAuction] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { success, error: errorNotif } = useNotification();

  useEffect(() => {
    if (!isConnected || !address) {
      setIsLoading(false);
      return;
    }

    const fetchAuctions = async () => {
      setIsLoading(true);
      try {
        const data = await getActiveAuctions();
        const mapped = (data || []).map((auction) => ({
          id: auction.auctionId.toString(),
          seller: auction.seller,
          quantity: auction.amount,
          startingPrice: auction.startPrice,
          currentBid: auction.highestBid,
          highestBidder: auction.highestBidder,
          startTime: auction.startTime,
          endTime: auction.endTime,
          status: (auction.isActive ? 'active' : 'ended') as AuctionItem['status'],
        }));
        setAuctions(mapped);
      } catch (error) {
        console.error('Error loading auctions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAuctions();
  }, [isConnected, address, getActiveAuctions]);

  const filteredAuctions = auctions.filter((auction) => {
    const matchesSearch =
      auction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      auction.seller.toLowerCase().includes(searchTerm.toLowerCase());

    const hoursUntilEnd = (auction.endTime - Date.now() / 1000) / 3600;
    let matchesFilter = filterStatus === 'all';
    if (filterStatus === 'active') {
      matchesFilter = auction.status === 'active';
    } else if (filterStatus === 'ending-soon') {
      matchesFilter = auction.status === 'active' && hoursUntilEnd < 24;
    }

    return matchesSearch && matchesFilter;
  });

  const handlePlaceBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) === 0) {
      errorNotif('Please enter a valid bid amount');
      return;
    }

    if (
      selectedAuction &&
      parseFloat(bidAmount) <= selectedAuction.currentBid
    ) {
      errorNotif(
        `Bid must be higher than current bid (${formatCurrency(selectedAuction.currentBid)})`
      );
      return;
    }

    if (!selectedAuction || !address) return;

    try {
      const bidValue = parseFloat(bidAmount);
      const allowance = await getErc20Allowance(
        CONTRACTS.usdc,
        address,
        CONTRACTS.carbonMarketplace
      );

      if (allowance < bidValue) {
        const approveTx = await approveErc20(CONTRACTS.usdc, CONTRACTS.carbonMarketplace, bidValue);
        if (!approveTx) {
          errorNotif('USDC approval failed');
          return;
        }
        success('USDC approved! Placing bid...');
      }

      const txHash = await placeBid(parseInt(selectedAuction.id), bidValue);
      if (txHash) {
        success(`Bid placed: ${txHash.slice(0, 10)}...`);
      }
      setSelectedAuction(null);
      setBidAmount('');
    } catch (error: any) {
      errorNotif(error?.message || 'Bid failed');
    }
  };

  const getAuctionStatus = (auction: AuctionItem) => {
    const now = Date.now() / 1000;
    const hoursLeft = (auction.endTime - now) / 3600;

    if (hoursLeft < 0) return <Badge variant="error">Ended</Badge>;
    if (hoursLeft < 1) return <Badge variant="warning">Ending Soon</Badge>;
    if (hoursLeft < 24) return <Badge variant="warning">24h Left</Badge>;
    return <Badge variant="success">Active</Badge>;
  };

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Carbon Credit Auctions</h1>
          <p className="text-dark-400">
            Bid on verified carbon credits from projects worldwide
          </p>
        </div>

        {/* Search and Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Input
            placeholder="Search by project name or location..."
            icon={<Search className="w-5 h-5" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2">
            {(['all', 'active', 'ending-soon'] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={
                  filterStatus === status ? 'primary' : 'secondary'
                }
                onClick={() => setFilterStatus(status)}
                className="capitalize"
              >
                {status.replace('-', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Auction Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <LoadingSkeleton height="h-40" />
          ) : filteredAuctions.length > 0 ? (
            filteredAuctions.map((auction) => {
              const now = Date.now() / 1000;
              const timeLeft = auction.endTime - now;
              const hoursLeft = Math.floor(timeLeft / 3600);
              const minutesLeft = Math.floor((timeLeft % 3600) / 60);

              return (
                <Card
                  key={auction.id}
                  className="space-y-4 hover:shadow-lg hover:shadow-primary-500/10 transition-all"
                  interactive
                >
                  {/* Auction Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg font-bold">CCT Auction #{auction.id}</h3>
                      {getAuctionStatus(auction)}
                    </div>
                    <p className="text-sm text-dark-400">Seller: {auction.seller}</p>
                  </div>

                  {/* Auction Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-dark-800 p-3 rounded">
                      <p className="text-dark-400 text-xs">Quantity</p>
                      <p className="font-semibold">
                        {formatCarbonTonnes(auction.quantity)}
                      </p>
                    </div>
                  </div>

                  {/* Price Section */}
                  <div className="space-y-3 border-t border-dark-700 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Starting Price</span>
                      <span className="font-medium">
                        {formatCurrency(auction.startingPrice)}/tonne
                      </span>
                    </div>
                    {auction.currentBid > 0 ? (
                      <>
                        <div>
                          <p className="text-primary-400 font-semibold mb-1">
                            Current Bid
                          </p>
                          <p className="text-2xl font-bold gradient-text">
                            {formatCurrency(auction.currentBid)}/tonne
                          </p>
                        </div>
                        <p className="text-xs text-dark-400">
                          Highest: {auction.highestBidder || 'No bids'}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-dark-400 italic">
                        No bids yet - Be the first to bid!
                      </p>
                    )}
                  </div>

                  {/* Time Left */}
                  <div className="flex items-center gap-2 text-sm text-dark-300 bg-dark-800 p-3 rounded">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    {hoursLeft > 0 ? (
                      <span>
                        Ends in <strong>{hoursLeft}h {minutesLeft}m</strong>
                      </span>
                    ) : (
                      <span className="text-red-400">Auction ended</span>
                    )}
                  </div>

                  <Button
                    size="sm"
                    icon={<Gavel className="w-4 h-4" />}
                    onClick={() => setSelectedAuction(auction)}
                    disabled={auction.status !== 'active'}
                    className="w-full"
                  >
                    {auction.status === 'active' ? 'Place Bid' : 'Auction Ended'}
                  </Button>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full">
              <EmptyState
                title="No auctions found"
                description="Try adjusting your search or filters"
                icon="🔍"
              />
            </div>
          )}
        </div>

        {/* Bid Modal */}
        {selectedAuction && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  CCT Auction #{selectedAuction.id}
                </h2>
                <p className="text-dark-400">Seller: {selectedAuction.seller}</p>
              </div>

              {/* Current Bid Info */}
              <div className="bg-dark-800 p-4 rounded-lg space-y-2">
                <p className="text-sm text-dark-400">Current Bid</p>
                <p className="text-3xl font-bold gradient-text">
                  {selectedAuction.currentBid > 0
                    ? formatCurrency(selectedAuction.currentBid)
                    : 'No bids'}
                </p>
                <p className="text-xs text-dark-400">Total bid amount</p>
              </div>

              {/* Bid Input */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-dark-400 mb-2 block">
                    Your Total Bid (USDC)
                  </label>
                  <Input
                    type="number"
                    placeholder={
                      selectedAuction.currentBid > 0
                        ? `Must be > ${formatCurrency(selectedAuction.currentBid)}`
                        : `Min: ${formatCurrency(selectedAuction.startingPrice)}`
                    }
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                  />
                </div>

                {bidAmount && (
                  <div className="bg-dark-800 p-3 rounded space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Total Bid</span>
                      <span className="font-medium">{formatCurrency(parseFloat(bidAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Quantity</span>
                      <span className="font-medium">
                        {formatCarbonTonnes(selectedAuction.quantity)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Alert */}
              <div className="flex gap-2 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded text-sm text-yellow-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Your bid will be locked until the auction ends</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedAuction(null);
                    setBidAmount('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePlaceBid}
                  disabled={!bidAmount || parseFloat(bidAmount) === 0}
                  className="flex-1"
                >
                  Confirm Bid
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
