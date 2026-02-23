'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { Header } from '@/components/Header';
import { Button, Card, Input } from '@/components/UI';
import toast from 'react-hot-toast';
import { useContractInteraction } from '@/hooks/useContractInteraction';
import { fetchCompanyProfile, saveCompanyProfile, CompanyProfile } from '@/utils/api';

export default function CompanyRegister() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { registerCompany, registerAndClaimCredits, approveNftForAll, getHasRegistered, isLoading } = useContractInteraction();
  const onChainEnabled = process.env.NEXT_PUBLIC_ENABLE_ONCHAIN_COMPANY_REGISTRATION === 'true';

  const [hasClaimedCredits, setHasClaimedCredits] = useState<boolean | null>(null);

  const [formData, setFormData] = useState({
    companyName: '',
    legalEntityId: '',
    scope1Emissions: '',
    scope2Emissions: '',
    scope3Emissions: '',
    email: '',
    phone: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingProfile, setExistingProfile] = useState<CompanyProfile | null>(null);
  const [isPrefilling, setIsPrefilling] = useState(false);
  const isFormDisabled = isSubmitting || isPrefilling;

  useEffect(() => {
    if (!isConnected || !address) return;

    const loadProfile = async () => {
      setIsPrefilling(true);
      try {
        const profile = await fetchCompanyProfile(address);
        if (profile) {
          setExistingProfile(profile);
          setFormData({
            companyName: profile.name || '',
            legalEntityId: profile.legalEntityId || '',
            scope1Emissions: String(profile.scope1Emissions ?? ''),
            scope2Emissions: String(profile.scope2Emissions ?? ''),
            scope3Emissions: String(profile.scope3Emissions ?? ''),
            email: profile.email || '',
            phone: profile.phone || '',
          });
        }
      } catch (error) {
        console.error('Failed to load company profile:', error);
      } finally {
        setIsPrefilling(false);
      }
    };

    loadProfile();
  }, [isConnected, address]);

  // Check on-chain if this wallet has already claimed registration credits
  useEffect(() => {
    if (!isConnected || !address || !getHasRegistered) return;
    getHasRegistered(address).then(setHasClaimedCredits).catch(() => setHasClaimedCredits(null));
  }, [isConnected, address, getHasRegistered]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.companyName.trim()) {
      toast.error('Company name is required');
      return false;
    }
    if (!formData.legalEntityId.trim()) {
      toast.error('Legal entity ID is required');
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

    const scope1 = parseFloat(formData.scope1Emissions) || 0;
    const scope2 = parseFloat(formData.scope2Emissions) || 0;
    const scope3 = parseFloat(formData.scope3Emissions) || 0;

    if (scope1 < 0 || scope2 < 0 || scope3 < 0) {
      toast.error('Emissions cannot be negative');
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
    const loadingToast = toast.loading('Registering company...');

    try {
      const scope1 = parseFloat(formData.scope1Emissions) || 0;
      const scope2 = parseFloat(formData.scope2Emissions) || 0;
      const scope3 = parseFloat(formData.scope3Emissions) || 0;
      const totalEmissions = scope1 + scope2 + scope3;

      // Step 1: Save company profile
      await saveCompanyProfile({
        walletAddress: address,
        name: formData.companyName,
        legalEntityId: formData.legalEntityId,
        email: formData.email,
        phone: formData.phone,
        scope1Emissions: scope1,
        scope2Emissions: scope2,
        scope3Emissions: scope3,
        registrationDate: Date.now(),
      });

      toast.dismiss(loadingToast);
      toast.success('Company profile saved!');

      // Step 2: Claim 5 free carbon credits (on-chain; wallet will prompt to sign)
      const alreadyClaimed = hasClaimedCredits ?? (address ? await getHasRegistered(address) : false);
      if (alreadyClaimed) {
        toast('You have already claimed your 5 registration credits.', { icon: '✅' });
      } else {
        const mintToast = toast.loading('Claiming 5 free carbon credits… Please approve the transaction in your wallet.');
        try {
          const mintTxHash = await registerAndClaimCredits();
          if (mintTxHash) {
            toast.dismiss(mintToast);
            toast.success(`5 credits minted to your wallet! TX: ${mintTxHash.slice(0, 10)}...`);
            setHasClaimedCredits(true);

            // Step 3: Approve NFTs for CCT wrapping
            const approveToast = toast.loading('Approving credits for trading...');
            try {
              const approveTxHash = await approveNftForAll(
                process.env.NEXT_PUBLIC_CARBON_CREDIT_NFT!,
                process.env.NEXT_PUBLIC_CARBON_CREDIT_TOKEN!,
                true
              );

              if (approveTxHash) {
                toast.dismiss(approveToast);
                toast.success('Credits approved! You can now wrap and trade them.');
              }
            } catch (approveError) {
              console.error('Approve error:', approveError);
              toast.dismiss(approveToast);
              toast('Credits claimed but approval failed. You can approve manually later.', {
                icon: '⚠️',
              });
            }
          }
        } catch (mintError: unknown) {
          console.error('Mint error:', mintError);
          toast.dismiss(mintToast);
          const msg = mintError instanceof Error ? mintError.message : String(mintError);
          if (msg.includes('Already claimed')) {
            toast.error('You have already claimed your registration credits.');
            setHasClaimedCredits(true);
          } else if (msg.includes('rejected') || msg.includes('denied')) {
            toast.error('Transaction was rejected. To receive your 5 credits, please approve the transaction when your wallet asks for a signature.');
          } else {
            toast.error('Failed to claim credits: ' + msg);
          }
        }
      }

      // Wait a bit then redirect
      setTimeout(() => {
        router.push('/company/dashboard');
      }, 2000);
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Registration error:', error);
      toast.error(error?.message || 'Failed to register company');
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
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Wallet Connection Required</h2>
              <p className="text-gray-400 mb-6">
                To register your company on the blockchain, you need to connect your Web3 wallet first.
              </p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3 text-left">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">1</div>
                <div>
                  <p className="text-white font-semibold">Click "Connect" Button</p>
                  <p className="text-gray-400 text-sm">Look for the Connect button in the top-right corner of this page</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 text-left">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">2</div>
                <div>
                  <p className="text-white font-semibold">Choose Your Wallet</p>
                  <p className="text-gray-400 text-sm">Select MetaMask, WalletConnect, or another supported wallet</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 text-left">
                <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">3</div>
                <div>
                  <p className="text-white font-semibold">Approve Connection</p>
                  <p className="text-gray-400 text-sm">Confirm the connection in your wallet app</p>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-700">
              <p className="text-xs text-gray-500">
                Don't have a wallet? <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Install MetaMask</a>
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
            Company Registration
          </h1>
          <p className="text-gray-400">
            Register your company and receive <span className="text-green-400 font-semibold">5 free carbon credits </span> 
            to start trading immediately on the blockchain marketplace
          </p>
        </div>

        <Card className="p-8">
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold">🎁</div>
              <div>
                <p className="text-green-300 font-semibold mb-1">Welcome Bonus!</p>
                <p className="text-green-200/80 text-sm">
                  Upon registration, you'll receive 5 carbon credits (NFTs) that will be automatically approved for trading. 
                  You can sell them to other companies or use them to offset emissions.
                </p>
              </div>
            </div>
          </div>
          {existingProfile && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-300 text-sm">
                We found an existing company profile for this wallet. Update details and save to overwrite.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Details */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Company Details</h2>
              <div className="space-y-4">
                <Input
                  label="Company Name"
                  name="companyName"
                  type="text"
                  placeholder="Enter your company name"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
                <Input
                  label="Legal Entity ID"
                  name="legalEntityId"
                  type="text"
                  placeholder="Tax ID, Registration Number, etc."
                  value={formData.legalEntityId}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            {/* Emissions Data */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Annual Emissions (Optional)</h2>
              <p className="text-sm text-gray-400 mb-4">
                Provide your annual CO₂ emissions for ESG reporting. You'll receive 5 free trading credits regardless.
              </p>
              <div className="space-y-4">
                <Input
                  label="Scope 1 (Direct Emissions)"
                  name="scope1Emissions"
                  type="number"
                  placeholder="e.g., 500"
                  value={formData.scope1Emissions}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
                <Input
                  label="Scope 2 (Indirect: Energy)"
                  name="scope2Emissions"
                  type="number"
                  placeholder="e.g., 300"
                  value={formData.scope2Emissions}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
                <Input
                  label="Scope 3 (Indirect: Other)"
                  name="scope3Emissions"
                  type="number"
                  placeholder="e.g., 200"
                  value={formData.scope3Emissions}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
              </div>
              {(formData.scope1Emissions || formData.scope2Emissions || formData.scope3Emissions) && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-400">
                    Total Annual Emissions:{' '}
                    <span className="font-bold">
                      {(
                        (parseFloat(formData.scope1Emissions) || 0) +
                        (parseFloat(formData.scope2Emissions) || 0) +
                        (parseFloat(formData.scope3Emissions) || 0)
                      ).toFixed(2)}{' '}
                      tonnes CO₂
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Contact Information */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">Contact Information</h2>
              <div className="space-y-4">
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="company@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
                <Input
                  label="Phone Number"
                  name="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                />
              </div>
            </div>

            {/* Wallet Info */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-gray-400">
                Registering wallet: <span className="text-blue-400 font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</span>
              </p>
            </div>

            {hasClaimedCredits && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg mb-4">
                <p className="text-sm text-green-400">
                  You have already claimed your 5 registration credits for this wallet. You can still update your company profile below.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full"
            >
              {isSubmitting
                ? 'Registering & Minting Credits...'
                : hasClaimedCredits
                  ? 'Update Company Profile'
                  : 'Register & Get 5 Free Credits'}
            </Button>

            {!hasClaimedCredits && (
              <p className="text-xs text-amber-400/90 text-center mt-2">
                Your wallet will ask you to sign one transaction to mint 5 credits to your address. Approve it to receive the credits.
              </p>
            )}
            <p className="text-xs text-gray-400 text-center mt-1">
              By registering, you'll receive 5 carbon credit NFTs that you can trade or sell immediately (one-time per wallet).
            </p>
          </form>
        </Card>
      </main>
    </div>
  );
}
