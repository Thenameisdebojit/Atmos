'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Button, Card, Input } from '@/components/UI';
import toast from 'react-hot-toast';
import { useContractInteraction } from '@/hooks/useContractInteraction';

export default function TraderRegister() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { registerTrader, isLoading } = useContractInteraction();

  const [formData, setFormData] = useState({
    traderName: '',
    email: '',
    phone: '',
    country: '',
    investmentGoal: '',
    tradingExperience: 'beginner',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.traderName.trim()) {
      toast.error('Name is required');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Valid email is required');
      return false;
    }
    if (!formData.phone.trim()) {
      toast.error('Phone number is required');
      return false;
    }
    if (!formData.country.trim()) {
      toast.error('Country is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    if (!address) {
      toast.error('Wallet address not found');
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Registering trader account...');

    try {
      const txHash = await registerTrader({
        traderName: formData.traderName,
        email: formData.email,
        phone: formData.phone,
        country: formData.country,
        investmentGoal: formData.investmentGoal,
        tradingExperience: formData.tradingExperience,
        walletAddress: address,
      });

      toast.dismiss(loadingToast);
      toast.success(`Trader account created! TX: ${txHash?.slice(0, 10)}...`);

      setTimeout(() => {
        router.push('/trader/dashboard');
      }, 1500);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Registration error:', error);
      toast.error(error?.message || 'Failed to register trader account');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header />
        <div className="flex items-center justify-center min-h-[80vh] px-4">
          <Card className="p-12 text-center max-w-lg">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Start Trading Carbon Credits</h2>
              <p className="text-gray-400 mb-6">
                Connect your wallet to register as a trader and start investing in carbon credits.
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 text-left">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">1</div>
                <div>
                  <p className="text-white font-semibold">Click "Connect" Button</p>
                  <p className="text-gray-400 text-sm">Look for the Connect button in the top-right corner</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 text-left">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">2</div>
                <div>
                  <p className="text-white font-semibold">Choose Your Wallet</p>
                  <p className="text-gray-400 text-sm">MetaMask, WalletConnect, or Coinbase Wallet</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 text-left">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">3</div>
                <div>
                  <p className="text-white font-semibold">Start Trading</p>
                  <p className="text-gray-400 text-sm">Buy, sell, and profit from carbon credits</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-700">
              <p className="text-xs text-gray-500">
                New to crypto? <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Get MetaMask</a>
              </p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent mb-2">
            Trader Registration
          </h1>
          <p className="text-gray-400">
            Register as a carbon credit trader to buy, sell, and invest in verified carbon offsets
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Details */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Personal Information</h2>
              <div className="space-y-4">
                <Input
                  label="Full Name / Trading Name"
                  name="traderName"
                  type="text"
                  placeholder="John Doe"
                  value={formData.traderName}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="trader@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                <Input
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
                <Input
                  label="Country / Region"
                  name="country"
                  type="text"
                  placeholder="United States"
                  value={formData.country}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Trading Profile */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Trading Profile</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Trading Experience
                  </label>
                  <select
                    name="tradingExperience"
                    value={formData.tradingExperience}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="beginner">Beginner - New to carbon trading</option>
                    <option value="intermediate">Intermediate - Some experience</option>
                    <option value="advanced">Advanced - Professional trader</option>
                    <option value="expert">Expert - Institutional level</option>
                  </select>
                </div>

                <Input
                  label="Investment Goal (Optional)"
                  name="investmentGoal"
                  type="text"
                  placeholder="e.g., Long-term investment, $10,000 portfolio"
                  value={formData.investmentGoal}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Benefits Info */}
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <h3 className="text-white font-semibold mb-2">✓ Trader Benefits</h3>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Buy verified carbon credits at market prices</li>
                <li>• Sell credits when prices rise for profit</li>
                <li>• Portfolio tracking and investment analytics</li>
                <li>• Participate in auctions and competitive bidding</li>
                <li>• Real-time market data and price alerts</li>
              </ul>
            </div>

            {/* Wallet Info */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-gray-400">
                Connected wallet: <span className="text-blue-400 font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full"
            >
              {isSubmitting ? 'Registering...' : 'Register as Trader'}
            </Button>

            <p className="text-xs text-gray-400 text-center">
              By registering, you agree to our Terms of Service and acknowledge the risks of trading digital assets
            </p>
          </form>
        </Card>
      </main>
    </div>
  );
}
