'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Card, Button, Input, StatCard } from '@/components/UI';
import toast from 'react-hot-toast';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { CONTRACTS } from '@/config/contracts';

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
    createSellOrder,
    createAuction,
  } = useContractInteraction();

  const [tab, setTab] = useState<'list' | 'active'>('list');
  const [userCredits, setUserCredits] = useState<any[]>([]);
  const [activeListings, setActiveListings] = useState<ActiveListing[]>([]);
  const [cctBalance, setCctBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<ListingForm>({
    amount: '',
    pricePerTonne: '',
    saleType: 'fixed-price',
    auctionEndTime: '',
    auctionStartPrice: '',
  });

  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }

    const fetchCredits = async () => {
      try {
        const credits = await getUserCredits(address);
        setUserCredits(credits || []);

        const balance = await getErc20Balance(CONTRACTS.carbonCreditToken, address);
        setCctBalance(balance || 0);

        const orders = await getMarketplaceOrders();
        const auctions = await getActiveAuctions();

        const activeOrders = (orders || [])
          .filter((order) => !order.isBuyOrder && order.trader.toLowerCase() === address.toLowerCase())
          .map((order) => ({
            id: order.orderId.toString(),
            amount: order.amount,
            pricePerTonne: order.pricePerTonne,
            saleType: 'fixed-price' as const,
            listedAt: order.createdAt * 1000,
            status: order.isActive ? 'active' : 'pending',
            totalValue: order.amount * order.pricePerTonne,
          }));

        const activeAuctionListings = (auctions || [])
          .filter((auction) => auction.seller.toLowerCase() === address.toLowerCase())
          .map((auction) => ({
            id: auction.auctionId.toString(),
            amount: auction.amount,
            pricePerTonne: auction.startPrice,
            saleType: 'auction' as const,
            listedAt: auction.startTime * 1000,
            status: auction.isActive ? 'active' : 'pending',
            totalValue: auction.amount * auction.startPrice,
          }));

        setActiveListings([...activeOrders, ...activeAuctionListings]);

        setLoading(false);
      } catch (error) {
        console.error('Error:', error);
        setLoading(false);
      }
    };

    fetchCredits();
  }, [isConnected, address]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.pricePerTonne) {
      toast.error('Please fill required fields');
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

      const allowance = await getErc20Allowance(
        CONTRACTS.carbonCreditToken,
        address,
        CONTRACTS.carbonMarketplace
      );

      if (allowance < amount) {
        const approveTx = await approveErc20(CONTRACTS.carbonCreditToken, CONTRACTS.carbonMarketplace, amount);
        if (!approveTx) {
          toast.error('CCT approval failed');
          throw new Error('Approval failed');
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

      toast.dismiss(loadingToast);
      toast.success('Listing created successfully!');

      // Add to active listings
      const newListing: ActiveListing = {
        id: Date.now().toString(),
        amount,
        pricePerTonne,
        saleType: formData.saleType,
        listedAt: Date.now(),
        status: 'active',
        totalValue: amount * pricePerTonne,
      };
      setActiveListings([...activeListings, newListing]);

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
      toast.error(error?.message || 'Failed to create listing');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelListing = (listingId: string) => {
    toast.promise(
      new Promise(resolve => setTimeout(() => {
        setActiveListings(activeListings.filter(l => l.id !== listingId));
        resolve(null);
      }, 1500)),
      {
        loading: 'Canceling listing...',
        success: 'Listing canceled',
        error: 'Failed to cancel',
      }
    );
  };

  // Calculate stats
  const totalValue = activeListings.reduce((sum, l) => sum + l.totalValue, 0);
  const activeSales = activeListings.filter(l => l.saleType === 'fixed-price').length;
  const activeAuctions = activeListings.filter(l => l.saleType === 'auction').length;

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
            subtext="tonnes"
            change={2}
          />
          <StatCard
            label="Active Listings"
            value={activeListings.length.toString()}
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
            value={activeListings.length > 0 ? `$${(totalValue / activeListings.reduce((sum, l) => sum + l.amount, 0)).toFixed(2)}` : '$0'}
            subtext="per tonne"
            change={3}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-700">
          {['list', 'active'].map(t => (
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
                <p className="text-gray-400 mb-4">You have no CCT balance to sell</p>
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
                      onClick={() => handleCancelListing(listing.id)}
                      variant="secondary"
                      size="sm"
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
