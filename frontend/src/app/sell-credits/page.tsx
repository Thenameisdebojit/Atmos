'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Card, Button, Input, StatCard } from '@/components/UI';
import toast from 'react-hot-toast';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';
import { fetchDepositoryCredits } from '@/utils/api';
import { notifyTradeSuccess, requestNotificationPermission } from '@/utils/notifications';

interface ListingForm {
  amount: string;
  pricePerTonne: string;
  saleType: 'fixed-price' | 'auction';
  auctionEndTime: string;
  auctionStartPrice: string;
}

interface ActiveListing {
  id: string;
  amount: number;
  pricePerTonne: number;
  saleType: 'fixed-price' | 'auction';
  listedAt: number;
  status: 'active' | 'pending' | 'sold';
  totalValue: number;
}

export default function SellCredits() {
  const { address, isConnected } = useAccount();
  const {
    getUserCredits,
    getMarketplaceOrders,
    getActiveAuctions,
    getErc20Balance,
    getErc20Allowance,
    approveErc20,
    approveNftForAll,
    wrapCredit,
    createSellOrder,
    createAuction,
    cancelOrder,
    cancelAuction,
    publicClient,
  } = useContractInteraction();

  const [tab, setTab] = useState<'list' | 'active'>('list');
  const [userCredits, setUserCredits] = useState<any[]>([]);
  const [activeListings, setActiveListings] = useState<ActiveListing[]>([]);
  const [cctBalance, setCctBalance] = useState(0);
  const [unwrappedEquivalent, setUnwrappedEquivalent] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wrappingTokenId, setWrappingTokenId] = useState<number | null>(null);

  const [formData, setFormData] = useState<ListingForm>({
    amount: '',
    pricePerTonne: '',
    saleType: 'fixed-price',
    auctionEndTime: '',
    auctionStartPrice: '',
  });

  const refreshSellData = useCallback(async () => {
    if (!isConnected || !address) {
      setLoading(false);
      return;
    }

    try {
      const [credits, depositoryRes] = await Promise.all([
        getUserCredits(address),
        fetchDepositoryCredits(address, false).catch(() => null),
      ]);
      setUserCredits(credits || []);

      const nftCreditTonnes = (credits || [])
        .filter((credit: any) => !credit?.isRetired)
        .reduce((sum: number, credit: any) => sum + Number(credit?.co2Tonnes || 0), 0);
      const depositoryTonnes = (depositoryRes?.credits || [])
        .filter((credit: any) => credit?.status === 'Active')
        .reduce((sum: number, credit: any) => sum + Number(credit?.co2Amount || 0), 0);
      const walletCreditEquivalent = nftCreditTonnes > 0 ? nftCreditTonnes : depositoryTonnes;

      const balance = await getErc20Balance(CONTRACTS.carbonCreditToken, address);
      const realCctBalance = Number(balance || 0);
      setCctBalance(realCctBalance);
      setUnwrappedEquivalent(walletCreditEquivalent);

      const usdc = await getErc20Balance(CONTRACTS.usdc, address);
      setUsdcBalance(Number(usdc || 0));

      const orders = await getMarketplaceOrders();
      const auctions = await getActiveAuctions();

      const activeOrders = (orders || [])
        .filter((order) => !order.isBuyOrder && order.trader.toLowerCase() === address.toLowerCase())
        .map((order) => ({
          id: order.orderId.toString(),
          amount: Math.max(order.amount - order.filled, 0),
          pricePerTonne: order.pricePerTonne,
          saleType: 'fixed-price' as const,
          listedAt: order.createdAt * 1000,
          status: (order.isActive ? 'active' : (order.filled >= order.amount ? 'sold' : 'pending')) as ActiveListing['status'],
          totalValue: Math.max(order.amount - order.filled, 0) * order.pricePerTonne,
        }));

      const activeAuctionListings = (auctions || [])
        .filter((auction) => auction.seller.toLowerCase() === address.toLowerCase())
        .map((auction) => ({
          id: auction.auctionId.toString(),
          amount: auction.amount,
          pricePerTonne: auction.startPrice,
          saleType: 'auction' as const,
          listedAt: auction.startTime * 1000,
          status: (auction.isActive ? 'active' : 'pending') as ActiveListing['status'],
          totalValue: auction.amount * auction.startPrice,
        }));

      setActiveListings([...activeOrders, ...activeAuctionListings]);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [
    isConnected,
    address,
    getUserCredits,
    getMarketplaceOrders,
    getActiveAuctions,
    getErc20Balance,
  ]);

  useEffect(() => {
    requestNotificationPermission();
    setLoading(true);
    refreshSellData();
  }, [refreshSellData]);

  const handleWrapCredit = async (tokenId: number) => {
    if (!address) return;

    setWrappingTokenId(tokenId);
    const loadingToast = toast.loading(`Wrapping credit #${tokenId}...`);

    try {
      const approvalTx = await approveNftForAll(CONTRACTS.carbonCreditNFT, CONTRACTS.carbonCreditToken, true);
      if (!approvalTx) throw new Error('NFT approval failed');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approvalTx });
      }

      const wrapTx = await wrapCredit(tokenId);
      if (!wrapTx) throw new Error('Wrap transaction failed');
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: wrapTx });
      }

      toast.dismiss(loadingToast);
      toast.success(`Credit #${tokenId} wrapped to CCT`);
      await refreshSellData();
    } catch (error: any) {
      toast.dismiss(loadingToast);
      toast.error(error?.message || 'Failed to wrap credit');
    } finally {
      setWrappingTokenId(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount) {
      toast.error('Please enter an amount');
      return;
    }

    if (formData.saleType === 'fixed-price' && !formData.pricePerTonne) {
      toast.error('Please enter a price per tonne');
      return;
    }

    if (formData.saleType === 'auction' && (!formData.auctionEndTime || !formData.auctionStartPrice)) {
      toast.error('Please fill auction details');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Creating listing...');

    try {
      let txHash;
      const amount = parseFloat(formData.amount);
      const pricePerTonne = parseFloat(formData.pricePerTonne);

      if (amount > cctBalance) {
        throw new Error(`Insufficient CCT balance. You can list up to ${cctBalance.toFixed(2)} tonnes.`);
      }

      const allowance = await getErc20Allowance(
        CONTRACTS.carbonCreditToken,
        address as string,
        CONTRACTS.carbonMarketplace
      );

      if (allowance < amount) {
        const approveTx = await approveErc20(CONTRACTS.carbonCreditToken, CONTRACTS.carbonMarketplace, amount);
        if (!approveTx) {
          throw new Error('CCT approval was cancelled or failed');
        }
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        toast.success('CCT approved! Creating listing...');
      }

      if (formData.saleType === 'fixed-price') {
        txHash = await createSellOrder(amount, pricePerTonne);
      } else {
        const endTime = Math.floor(new Date(formData.auctionEndTime).getTime() / 1000);
        const startPrice = parseFloat(formData.auctionStartPrice);
        txHash = await createAuction(amount, startPrice, endTime);
      }

      if (!txHash) {
        throw new Error('Listing transaction was cancelled or failed');
      }
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
          throw new Error('Listing transaction reverted');
        }
      }

      toast.dismiss(loadingToast);
      toast.success('Listing created successfully!');
      notifyTradeSuccess('sell', amount, pricePerTonne, txHash);

      await refreshSellData();

      // Reset form
      setFormData({
        amount: '',
        pricePerTonne: '',
        saleType: 'fixed-price',
        auctionEndTime: '',
        auctionStartPrice: '',
      });

      setTab('active');
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Error:', error);
      const errorMessage = error?.shortMessage || error?.message || 'Failed to create listing';
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

  const handleCancelListing = async (listingId: string, saleType: 'fixed-price' | 'auction') => {
    const loadingToast = toast.loading('Canceling listing...');
    try {
      const parsedId = Number(listingId);
      if (!Number.isFinite(parsedId)) {
        throw new Error('Invalid listing id');
      }

      const txHash = saleType === 'fixed-price'
        ? await cancelOrder(parsedId)
        : await cancelAuction(parsedId);

      if (!txHash) {
        throw new Error('Cancellation transaction was cancelled or failed');
      }

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        if (receipt.status !== 'success') {
          throw new Error('Cancellation transaction reverted');
        }
      }

      toast.dismiss(loadingToast);
      toast.success('Listing canceled');
      await refreshSellData();
    } catch (error: any) {
      toast.dismiss(loadingToast);
      const errorMessage = error?.shortMessage || error?.message || 'Failed to cancel listing';
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
    }
  };

  // Calculate stats
  const totalValue = activeListings.reduce((sum, l) => sum + l.totalValue, 0);
  const activeSales = activeListings.filter(l => l.saleType === 'fixed-price').length;
  const activeAuctions = activeListings.filter(l => l.saleType === 'auction').length;
  const wrappableCredits = userCredits.filter((credit: any) => !credit?.isRetired);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <Card className="p-12 text-center max-w-lg">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Connect Wallet to List Credits</h2>
            <p className="text-gray-400 mb-6">
              Click the <strong>"Connect"</strong> button in the top-right corner to sell your carbon credits.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <Card className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your credits...</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-2">
            Sell Carbon Credits
          </h1>
          <p className="text-gray-400">List your surplus credits at fixed price or auction</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="NFT Credits"
            value={userCredits.length.toString()}
            subtext="available"
            change={5}
          />
          <StatCard
            label="CCT Balance"
            value={cctBalance.toFixed(2)}
            subtext="on-chain tonnes"
            change={2}
          />
          <StatCard
            label="Need Wrapping"
            value={Math.max(unwrappedEquivalent - cctBalance, 0).toFixed(2)}
            subtext="wallet tonnes"
            change={4}
          />
          <StatCard
            label="Active Listings"
            value={activeListings.filter((listing) => listing.status === 'active').length.toString()}
            subtext="listings"
            change={8}
          />
          <StatCard
            label="Total Listed Value"
            value={`$${totalValue.toFixed(0)}`}
            subtext="USD"
            change={12}
          />
          <StatCard
            label="Avg Price"
            value={activeListings.length > 0 && activeListings.reduce((sum, l) => sum + l.amount, 0) > 0
              ? `$${(totalValue / activeListings.reduce((sum, l) => sum + l.amount, 0)).toFixed(2)}`
              : '$0'}
            subtext="per tonne"
            change={3}
          />
          <StatCard
            label="USDC Balance"
            value={`$${usdcBalance.toFixed(2)}`}
            subtext="seller proceeds"
            change={usdcBalance > 0 ? 10 : 0}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          {(['list', 'active'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 font-semibold transition-colors capitalize ${
                tab === t
                  ? 'text-green-400 border-b-2 border-green-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {t === 'list' ? 'Create Listing' : 'Active Listings'}
            </button>
          ))}
        </div>

        {/* List Tab */}
        {tab === 'list' && (
          <Card className="p-6">
            {cctBalance > 0 ? (
              <form onSubmit={handleSubmitListing} className="space-y-6">
                <Input
                  label="Amount to Sell (tonnes)"
                  name="amount"
                  type="number"
                  placeholder="e.g., 100"
                  value={formData.amount}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Sale Type</label>
                  <div className="flex gap-4">
                    {['fixed-price', 'auction'].map(type => (
                      <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="saleType"
                          value={type}
                          checked={formData.saleType === type}
                          onChange={handleInputChange}
                          disabled={isSubmitting}
                          className="w-4 h-4"
                        />
                        <span className="text-gray-300 capitalize">{type === 'fixed-price' ? 'Fixed Price' : 'Auction'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {formData.saleType === 'fixed-price' ? (
                  <Input
                    label="Price per Tonne ($)"
                    name="pricePerTonne"
                    type="number"
                    placeholder="e.g., 25"
                    step="0.01"
                    value={formData.pricePerTonne}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                ) : (
                  <>
                    <Input
                      label="Starting Bid (USDC total)"
                      name="auctionStartPrice"
                      type="number"
                      placeholder="e.g., 20"
                      step="0.01"
                      value={formData.auctionStartPrice}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                    <Input
                      label="Auction End Date"
                      name="auctionEndTime"
                      type="datetime-local"
                      value={formData.auctionEndTime}
                      onChange={handleInputChange}
                      disabled={isSubmitting}
                    />
                  </>
                )}

                {formData.saleType === 'fixed-price' && formData.amount && formData.pricePerTonne && (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-sm text-gray-400">Expected Revenue:</p>
                    <p className="text-green-400 font-bold text-lg">
                      ${(parseFloat(formData.amount) * parseFloat(formData.pricePerTonne)).toFixed(2)}
                    </p>
                  </div>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Creating...' : 'Create Listing'}
                </Button>
              </form>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-2">You have no wrapped on-chain CCT available to sell yet</p>
                <p className="text-gray-500 text-sm">Your Carbon Wallet credits are visible, but selling requires wrapped CCT.</p>
                {wrappableCredits.length > 0 && (
                  <div className="mt-6 space-y-3 text-left max-w-xl mx-auto">
                    <p className="text-gray-300 text-sm">Wrap one of your active NFT credits to unlock selling:</p>
                    {wrappableCredits.slice(0, 5).map((credit: any) => (
                      <div
                        key={credit.tokenId}
                        className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700 rounded-lg"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">Token #{credit.tokenId}</p>
                          <p className="text-gray-400 text-xs">
                            {Number(credit.co2Tonnes || 0).toFixed(2)} tCO₂ • {credit.methodology}
                          </p>
                        </div>
                        <Button
                          onClick={() => handleWrapCredit(credit.tokenId)}
                          disabled={wrappingTokenId !== null}
                          className="px-4 py-2"
                        >
                          {wrappingTokenId === credit.tokenId ? 'Wrapping...' : 'Wrap to CCT'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Active Listings Tab */}
        {tab === 'active' && (
          <div className="space-y-4">
            {activeListings.length > 0 ? (
              activeListings.map(listing => (
                <Card key={listing.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="text-lg font-semibold text-white">
                          {listing.amount} tonnes
                        </h3>
                        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          listing.saleType === 'fixed-price'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-orange-500/20 text-orange-400'
                        }`}>
                          {listing.saleType === 'fixed-price' ? '💰 Fixed' : '🔨 Auction'}
                        </div>
                        <div className="text-xs text-gray-400">
                          Listed {Math.floor((Date.now() - listing.listedAt) / (60 * 60 * 1000))} hours ago
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Price per Tonne</p>
                          <p className="text-white font-bold">${listing.pricePerTonne}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Total Value</p>
                          <p className="text-white font-bold">${listing.totalValue.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Status</p>
                          <p className="text-green-400 font-bold">{listing.status.toUpperCase()}</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => handleCancelListing(listing.id, listing.saleType)}
                      variant="secondary"
                      size="sm"
                      disabled={listing.status !== 'active'}
                    >
                      Cancel
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="text-gray-400 mb-4">You have no active listings</p>
                <Button onClick={() => setTab('list')}>Create First Listing</Button>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
