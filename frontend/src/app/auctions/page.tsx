'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  TrendingUp,
  Users,
  Gavel,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowUp,
  RefreshCw,
  Trophy,
  Crown,
  ShieldCheck,
  DollarSign,
  X,
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
import { formatCurrency, formatCarbonTonnes, formatAddress } from '@/utils/format';
import { useAccount, usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';
import { useNotification } from '@/hooks';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';
import toast from 'react-hot-toast';

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

interface BidHistoryEntry {
  bidder: string;
  amount: number;
  blockNumber: bigint;
}

type AuctionUserRole = 'seller' | 'highest-bidder' | 'outbid' | 'none';

export default function AuctionsPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const {
    getActiveAuctions,
    placeBid,
    finalizeAuction,
    cancelAuction,
    getErc20Allowance,
    approveErc20,
  } = useContractInteraction();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'ending-soon' | 'my-bids' | 'my-auctions'>('all');
  const [selectedAuction, setSelectedAuction] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bidHistory, setBidHistory] = useState<Record<string, BidHistoryEntry[]>>({});
  const [showBidHistoryFor, setShowBidHistoryFor] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { success, error: errorNotif } = useNotification();

  // ── Fetch auctions ─────────────────────────────────
  const fetchAuctions = useCallback(async () => {
    if (!isConnected || !address) {
      setIsLoading(false);
      return;
    }
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
  }, [isConnected, address, getActiveAuctions]);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  // ── Fetch bid history for a specific auction ───────
  const fetchBidHistory = useCallback(async (auctionId: string) => {
    if (!publicClient) return;
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const fromBlock = latestBlock > 20000n ? latestBlock - 20000n : 0n;

      const logs = await publicClient.getLogs({
        address: CONTRACTS.carbonMarketplace as `0x${string}`,
        event: parseAbi([
          'event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 bidAmount)',
        ])[0],
        args: { auctionId: BigInt(auctionId) },
        fromBlock,
        toBlock: 'latest',
      });

      const entries: BidHistoryEntry[] = logs.map((log: any) => ({
        bidder: log.args.bidder as string,
        amount: Number(log.args.bidAmount) / 1e18,
        blockNumber: log.blockNumber,
      }));

      // Sort descending (most recent first)
      entries.sort((a, b) => Number(b.blockNumber - a.blockNumber));

      setBidHistory((prev) => ({ ...prev, [auctionId]: entries }));
    } catch (error) {
      console.error('Error fetching bid history:', error);
    }
  }, [publicClient]);

  // ── Determine user's role for an auction ───────────
  const getUserRole = (auction: AuctionItem): AuctionUserRole => {
    if (!address) return 'none';
    const addr = address.toLowerCase();
    if (auction.seller.toLowerCase() === addr) return 'seller';
    if (auction.highestBidder.toLowerCase() === addr) return 'highest-bidder';
    // Check if user has bid before (from bid history)
    const history = bidHistory[auction.id];
    if (history && history.some((b) => b.bidder.toLowerCase() === addr)) return 'outbid';
    return 'none';
  };

  // ── Check if user has ever bid (from events) ───────
  // Eagerly load bid history for all auctions to detect outbid status
  useEffect(() => {
    if (!address || auctions.length === 0) return;
    auctions.forEach((a) => {
      if (!bidHistory[a.id]) fetchBidHistory(a.id);
    });
  }, [address, auctions, bidHistory, fetchBidHistory]);

  // ── Filters ────────────────────────────────────────
  const filteredAuctions = auctions.filter((auction) => {
    const matchesSearch =
      auction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      auction.seller.toLowerCase().includes(searchTerm.toLowerCase());

    const hoursUntilEnd = (auction.endTime - Date.now() / 1000) / 3600;
    let matchesFilter = true;

    if (filterStatus === 'all') matchesFilter = true;
    else if (filterStatus === 'active') matchesFilter = auction.status === 'active' && hoursUntilEnd > 0;
    else if (filterStatus === 'ending-soon') matchesFilter = auction.status === 'active' && hoursUntilEnd < 24 && hoursUntilEnd > 0;
    else if (filterStatus === 'my-bids') {
      const role = getUserRole(auction);
      matchesFilter = role === 'highest-bidder' || role === 'outbid';
    } else if (filterStatus === 'my-auctions') {
      matchesFilter = getUserRole(auction) === 'seller';
    }

    return matchesSearch && matchesFilter;
  });

  // ── Place bid handler ──────────────────────────────
  const handlePlaceBid = async () => {
    if (!bidAmount || parseFloat(bidAmount) === 0) {
      errorNotif('Please enter a valid bid amount');
      return;
    }

    if (!selectedAuction || !address) return;

    const bidValue = parseFloat(bidAmount);
    const minBid = selectedAuction.currentBid > 0 ? selectedAuction.currentBid : selectedAuction.startingPrice;

    if (bidValue <= selectedAuction.currentBid && selectedAuction.currentBid > 0) {
      errorNotif(`Bid must be higher than current bid (${formatCurrency(selectedAuction.currentBid)})`);
      return;
    }

    if (bidValue < selectedAuction.startingPrice) {
      errorNotif(`Bid must be at least the starting price (${formatCurrency(selectedAuction.startingPrice)})`);
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Placing bid...');

    try {
      const allowance = await getErc20Allowance(
        CONTRACTS.usdc,
        address,
        CONTRACTS.carbonMarketplace
      );

      if (allowance < bidValue) {
        toast.loading('Approving USDC...', { id: loadingToast });
        const approveTx = await approveErc20(CONTRACTS.usdc, CONTRACTS.carbonMarketplace, bidValue);
        if (!approveTx) {
          toast.dismiss(loadingToast);
          errorNotif('USDC approval cancelled');
          setIsSubmitting(false);
          return;
        }
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        toast.loading('USDC approved! Placing bid...', { id: loadingToast });
      }

      const txHash = await placeBid(parseInt(selectedAuction.id), bidValue);
      if (txHash && publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }

      toast.dismiss(loadingToast);
      toast.success('🎉 Bid placed successfully!');

      setSelectedAuction(null);
      setBidAmount('');
      await fetchAuctions();
      await fetchBidHistory(selectedAuction.id);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      const msg = error?.shortMessage || error?.message || 'Bid failed';
      const normalized = msg.toLowerCase();
      if (normalized.includes('user rejected') || normalized.includes('denied') || normalized.includes('cancelled')) {
        toast.error('Transaction cancelled in wallet');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Finalize auction handler (seller/anyone after end) ──
  const handleFinalize = async (auctionId: string) => {
    setFinalizingId(auctionId);
    const loadingToast = toast.loading('Finalizing auction...');
    try {
      const txHash = await finalizeAuction(parseInt(auctionId));
      if (txHash && publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      toast.dismiss(loadingToast);
      toast.success('Auction finalized! Assets transferred.');
      await fetchAuctions();
    } catch (error: any) {
      toast.dismiss(loadingToast);
      const msg = error?.shortMessage || error?.message || 'Finalize failed';
      toast.error(msg);
    } finally {
      setFinalizingId(null);
    }
  };

  // ── Cancel auction handler (seller only, no bids) ──
  const handleCancel = async (auctionId: string) => {
    setCancellingId(auctionId);
    const loadingToast = toast.loading('Cancelling auction...');
    try {
      const txHash = await cancelAuction(parseInt(auctionId));
      if (txHash && publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: txHash });
      }
      toast.dismiss(loadingToast);
      toast.success('Auction cancelled. CCT returned.');
      await fetchAuctions();
    } catch (error: any) {
      toast.dismiss(loadingToast);
      const msg = error?.shortMessage || error?.message || 'Cancel failed';
      toast.error(msg);
    } finally {
      setCancellingId(null);
    }
  };

  // ── Status badges ──────────────────────────────────
  const getAuctionTimeBadge = (auction: AuctionItem) => {
    const now = Date.now() / 1000;
    const hoursLeft = (auction.endTime - now) / 3600;
    if (hoursLeft < 0) return <Badge variant="error">Ended</Badge>;
    if (hoursLeft < 1) return <Badge variant="warning">Ending Soon</Badge>;
    if (hoursLeft < 24) return <Badge variant="warning">{Math.floor(hoursLeft)}h Left</Badge>;
    return <Badge variant="success">Active</Badge>;
  };

  const getUserRoleBadge = (role: AuctionUserRole) => {
    switch (role) {
      case 'seller':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1">
            <Crown className="w-3 h-3" /> Your Auction
          </div>
        );
      case 'highest-bidder':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
            <Trophy className="w-3 h-3" /> Highest Bidder
          </div>
        );
      case 'outbid':
        return (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1">
            <ArrowUp className="w-3 h-3" /> Outbid
          </div>
        );
      default:
        return null;
    }
  };

  const getTimeLeftString = (auction: AuctionItem) => {
    const now = Date.now() / 1000;
    const timeLeft = auction.endTime - now;
    if (timeLeft <= 0) return 'Auction ended';
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  return (
    <div className="min-h-screen bg-dark-950">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Carbon Credit Auctions</h1>
            <p className="text-dark-400">
              Bid on verified carbon credits from projects worldwide
            </p>
          </div>
          {isConnected && (
            <button
              onClick={() => fetchAuctions()}
              disabled={isLoading}
              className="flex items-center gap-2 text-sm text-dark-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="flex-1">
            <Input
              placeholder="Search by auction ID or seller..."
              icon={<Search className="w-5 h-5" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active' },
              { key: 'ending-soon', label: 'Ending Soon' },
              { key: 'my-bids', label: 'My Bids' },
              { key: 'my-auctions', label: 'My Auctions' },
            ] as const).map(({ key, label }) => (
              <Button
                key={key}
                size="sm"
                variant={filterStatus === key ? 'primary' : 'secondary'}
                onClick={() => setFilterStatus(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Auction Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {isLoading ? (
            <>
              <LoadingSkeleton height="h-56" />
              <LoadingSkeleton height="h-56" />
            </>
          ) : filteredAuctions.length > 0 ? (
            filteredAuctions.map((auction) => {
              const role = getUserRole(auction);
              const now = Date.now() / 1000;
              const hasEnded = now >= auction.endTime;
              const hasBids = auction.currentBid > 0;
              const isZeroAddr = auction.highestBidder === '0x0000000000000000000000000000000000000000';

              return (
                <Card
                  key={auction.id}
                  className={`space-y-4 transition-all ${
                    role === 'highest-bidder'
                      ? 'ring-1 ring-emerald-500/30'
                      : role === 'outbid'
                      ? 'ring-1 ring-orange-500/30'
                      : role === 'seller'
                      ? 'ring-1 ring-purple-500/30'
                      : 'hover:shadow-lg hover:shadow-primary-500/10'
                  }`}
                  interactive
                >
                  {/* Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold">CCT Auction #{auction.id}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getUserRoleBadge(role)}
                        {getAuctionTimeBadge(auction)}
                      </div>
                    </div>
                    <p className="text-sm text-dark-400">Seller: {formatAddress(auction.seller, 6)}</p>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-dark-800 p-3 rounded-lg">
                      <p className="text-dark-400 text-xs">Quantity</p>
                      <p className="font-semibold text-white">{formatCarbonTonnes(auction.quantity)}</p>
                    </div>
                    <div className="bg-dark-800 p-3 rounded-lg">
                      <p className="text-dark-400 text-xs">Starting Price</p>
                      <p className="font-semibold text-white">{formatCurrency(auction.startingPrice)}</p>
                    </div>
                  </div>

                  {/* Current bid section */}
                  <div className="border-t border-dark-700 pt-4 space-y-2">
                    {hasBids && !isZeroAddr ? (
                      <>
                        <div className="flex items-center justify-between">
                          <p className="text-primary-400 font-semibold text-sm">Current Highest Bid</p>
                          <p className="text-xl font-bold text-white">{formatCurrency(auction.currentBid)}</p>
                        </div>
                        <p className="text-xs text-dark-400">
                          by {formatAddress(auction.highestBidder, 6)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-dark-400 italic">No bids yet — Be the first!</p>
                    )}
                  </div>

                  {/* Status banners based on role */}
                  {role === 'highest-bidder' && !hasEnded && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-sm text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <p>You are the <strong>highest bidder</strong>! Your USDC is held until the auction ends.</p>
                    </div>
                  )}
                  {role === 'highest-bidder' && hasEnded && (
                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-sm text-emerald-400">
                      <Trophy className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1">
                        <p><strong>You won!</strong> Finalize to receive your {formatCarbonTonnes(auction.quantity)} CCT.</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleFinalize(auction.id)}
                        disabled={finalizingId === auction.id}
                        className="flex-shrink-0"
                      >
                        {finalizingId === auction.id ? 'Finalizing...' : 'Claim CCT'}
                      </Button>
                    </div>
                  )}
                  {role === 'outbid' && !hasEnded && (
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg text-sm text-orange-400">
                      <ArrowUp className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1">
                        <p><strong>You&apos;ve been outbid!</strong> Your USDC was refunded. Bid higher to win.</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedAuction(auction);
                          setBidAmount('');
                        }}
                        className="flex-shrink-0"
                      >
                        Bid Higher
                      </Button>
                    </div>
                  )}
                  {role === 'outbid' && hasEnded && (
                    <div className="flex items-center gap-2 bg-dark-800 border border-dark-700 p-3 rounded-lg text-sm text-dark-400">
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      <p>Auction ended. You were outbid — your USDC was refunded.</p>
                    </div>
                  )}

                  {/* Seller controls */}
                  {role === 'seller' && (
                    <div className="bg-purple-500/5 border border-purple-500/20 p-3 rounded-lg space-y-3">
                      <div className="flex items-center gap-2 text-sm text-purple-300">
                        <Crown className="w-4 h-4" />
                        <strong>Seller Controls</strong>
                      </div>

                      {hasBids && !isZeroAddr ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-dark-300">Highest Bid</span>
                            <span className="text-white font-bold">{formatCurrency(auction.currentBid)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-dark-300">Bidder</span>
                            <span className="text-dark-200 font-mono">{formatAddress(auction.highestBidder, 6)}</span>
                          </div>
                          {/* Bid history toggle */}
                          <button
                            onClick={() => {
                              const id = auction.id;
                              setShowBidHistoryFor(showBidHistoryFor === id ? null : id);
                              if (!bidHistory[id]) fetchBidHistory(id);
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 underline"
                          >
                            {showBidHistoryFor === auction.id ? 'Hide' : 'View'} bid history
                          </button>

                          {/* Bid history list */}
                          {showBidHistoryFor === auction.id && bidHistory[auction.id] && (
                            <div className="max-h-32 overflow-y-auto space-y-1 mt-1">
                              {bidHistory[auction.id].map((b, i) => (
                                <div
                                  key={i}
                                  className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                                    i === 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-dark-800 text-dark-400'
                                  }`}
                                >
                                  <span className="font-mono">{formatAddress(b.bidder, 4)}</span>
                                  <span className="font-medium">{formatCurrency(b.amount)}</span>
                                  {i === 0 && <Badge variant="success" size="sm">Highest</Badge>}
                                </div>
                              ))}
                              {bidHistory[auction.id].length === 0 && (
                                <p className="text-xs text-dark-500">No bid events found</p>
                              )}
                            </div>
                          )}

                          {hasEnded ? (
                            <Button
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => handleFinalize(auction.id)}
                              disabled={finalizingId === auction.id}
                              icon={<ShieldCheck className="w-4 h-4" />}
                            >
                              {finalizingId === auction.id ? 'Finalizing...' : `Accept & Finalize (${formatCurrency(auction.currentBid)})`}
                            </Button>
                          ) : (
                            <p className="text-xs text-dark-500 mt-1">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {getTimeLeftString(auction)} — you can finalize once the auction ends
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-dark-400 text-xs">No bids yet. You can cancel this auction.</p>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            onClick={() => handleCancel(auction.id)}
                            disabled={cancellingId === auction.id}
                          >
                            {cancellingId === auction.id ? 'Cancelling...' : 'Cancel Auction'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Time left bar */}
                  <div className="flex items-center gap-2 text-sm text-dark-300 bg-dark-800 p-3 rounded-lg">
                    <Clock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    <span>{getTimeLeftString(auction)}</span>
                  </div>

                  {/* Action button for non-sellers */}
                  {role !== 'seller' && (
                    <div className="flex gap-2">
                      {auction.status === 'active' && !hasEnded ? (
                        <Button
                          size="sm"
                          icon={<Gavel className="w-4 h-4" />}
                          onClick={() => {
                            setSelectedAuction(auction);
                            setBidAmount('');
                          }}
                          className="flex-1"
                        >
                          {role === 'outbid' ? 'Place Higher Bid' : role === 'highest-bidder' ? 'Increase Bid' : 'Place Bid'}
                        </Button>
                      ) : hasEnded && role === 'highest-bidder' ? (
                        <Button
                          size="sm"
                          icon={<Trophy className="w-4 h-4" />}
                          onClick={() => handleFinalize(auction.id)}
                          disabled={finalizingId === auction.id}
                          className="flex-1"
                        >
                          {finalizingId === auction.id ? 'Finalizing...' : 'Finalize & Claim CCT'}
                        </Button>
                      ) : hasEnded ? (
                        <Button size="sm" disabled className="flex-1">
                          Auction Ended
                        </Button>
                      ) : null}

                      {/* View bids button */}
                      {hasBids && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const id = auction.id;
                            setShowBidHistoryFor(showBidHistoryFor === id ? null : id);
                            if (!bidHistory[id]) fetchBidHistory(id);
                          }}
                        >
                          {showBidHistoryFor === auction.id ? 'Hide Bids' : 'View Bids'}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Bid history for non-sellers */}
                  {role !== 'seller' && showBidHistoryFor === auction.id && bidHistory[auction.id] && (
                    <div className="bg-dark-800 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-semibold text-dark-300 mb-2">Bid History</p>
                      {bidHistory[auction.id].map((b, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${
                            b.bidder.toLowerCase() === address?.toLowerCase()
                              ? 'bg-primary-500/10 text-primary-300'
                              : i === 0
                              ? 'bg-emerald-500/10 text-emerald-300'
                              : 'text-dark-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{formatAddress(b.bidder, 4)}</span>
                            {b.bidder.toLowerCase() === address?.toLowerCase() && (
                              <span className="text-[10px] text-primary-400 font-bold">(You)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{formatCurrency(b.amount)}</span>
                            {i === 0 && <Badge variant="success" size="sm">Highest</Badge>}
                          </div>
                        </div>
                      ))}
                      {bidHistory[auction.id].length === 0 && (
                        <p className="text-xs text-dark-500 text-center py-2">No bids recorded yet</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <div className="col-span-full">
              <EmptyState
                title="No auctions found"
                description={
                  filterStatus === 'my-bids'
                    ? "You haven't bid on any auctions yet"
                    : filterStatus === 'my-auctions'
                    ? "You haven't created any auctions"
                    : 'Try adjusting your search or filters'
                }
                icon="🔍"
              />
            </div>
          )}
        </div>

        {/* ═══ Bid Modal ═══ */}
        {selectedAuction && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Place Bid</h2>
                  <p className="text-dark-400 text-sm">
                    CCT Auction #{selectedAuction.id} · {formatCarbonTonnes(selectedAuction.quantity)}
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedAuction(null); setBidAmount(''); }}
                  className="p-2 rounded-lg hover:bg-dark-700 text-dark-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Seller info */}
              <div className="text-sm text-dark-400">
                Seller: <span className="font-mono text-dark-300">{formatAddress(selectedAuction.seller, 6)}</span>
              </div>

              {/* Current bid info */}
              <div className="bg-dark-800 p-4 rounded-lg space-y-2">
                <p className="text-sm text-dark-400">Current Highest Bid</p>
                <p className="text-3xl font-bold text-white">
                  {selectedAuction.currentBid > 0
                    ? formatCurrency(selectedAuction.currentBid)
                    : 'No bids'}
                </p>
                {selectedAuction.currentBid > 0 && (
                  <p className="text-xs text-dark-400">
                    by {formatAddress(selectedAuction.highestBidder, 6)}
                  </p>
                )}
              </div>

              {/* Outbid notice */}
              {getUserRole(selectedAuction) === 'outbid' && (
                <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 p-3 rounded-lg text-sm text-orange-400">
                  <ArrowUp className="w-4 h-4 flex-shrink-0" />
                  <p>You were outbid. Your previous USDC was <strong>refunded automatically</strong>. Place a higher bid to win!</p>
                </div>
              )}

              {getUserRole(selectedAuction) === 'highest-bidder' && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <p>You&apos;re already the highest bidder. You can increase your bid if you want.</p>
                </div>
              )}

              {/* Bid input */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-dark-400 mb-2 block">
                    Your Total Bid (USDC)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={
                      selectedAuction.currentBid > 0
                        ? `Must be > ${formatCurrency(selectedAuction.currentBid)}`
                        : `Min: ${formatCurrency(selectedAuction.startingPrice)}`
                    }
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {bidAmount && parseFloat(bidAmount) > 0 && (
                  <div className="bg-dark-800 p-3 rounded space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Your Bid</span>
                      <span className="font-medium text-white">{formatCurrency(parseFloat(bidAmount))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Quantity</span>
                      <span className="font-medium text-white">{formatCarbonTonnes(selectedAuction.quantity)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Price/Tonne</span>
                      <span className="font-medium text-white">
                        {formatCurrency(parseFloat(bidAmount) / selectedAuction.quantity)}
                      </span>
                    </div>
                    {parseFloat(bidAmount) > 0 && parseFloat(bidAmount) <= selectedAuction.currentBid && selectedAuction.currentBid > 0 && (
                      <p className="text-xs text-red-400 mt-1">⚠ Bid must be higher than {formatCurrency(selectedAuction.currentBid)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Alert */}
              <div className="flex gap-2 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded text-sm text-yellow-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Your USDC will be held until the auction ends. If outbid, you&apos;re <strong>refunded automatically</strong>.</p>
              </div>

              {/* Bid history mini in modal */}
              {bidHistory[selectedAuction.id] && bidHistory[selectedAuction.id].length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-dark-400">Recent Bids</p>
                  {bidHistory[selectedAuction.id].slice(0, 5).map((b, i) => (
                    <div key={i} className={`flex items-center justify-between text-xs px-2 py-1 rounded ${
                      b.bidder.toLowerCase() === address?.toLowerCase() ? 'bg-primary-500/10 text-primary-300' : 'bg-dark-800 text-dark-400'
                    }`}>
                      <span className="font-mono">
                        {formatAddress(b.bidder, 4)}
                        {b.bidder.toLowerCase() === address?.toLowerCase() && ' (You)'}
                      </span>
                      <span className="font-medium">{formatCurrency(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelectedAuction(null);
                    setBidAmount('');
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePlaceBid}
                  disabled={isSubmitting || !bidAmount || parseFloat(bidAmount) === 0}
                  className="flex-1"
                  icon={<Gavel className="w-4 h-4" />}
                >
                  {isSubmitting ? 'Placing Bid...' : 'Confirm Bid'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
