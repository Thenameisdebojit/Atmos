'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMemo } from 'react';
import { useUIStore } from '@/store';
import { CONTRACTS } from '@/config/contracts';

export const Header: React.FC = () => {
  const { isSidebarOpen, toggleSidebar } = useUIStore();

  const missingConfig = useMemo(() => {
    const missing: string[] = [];
    const isMissingAddress = (value: string) => {
      if (!value || value === '0x') return true;
      return /^0x0{40}$/.test(value);
    };

    if (isMissingAddress(CONTRACTS.carbonCreditNFT)) missing.push('NEXT_PUBLIC_CARBON_CREDIT_NFT');
    if (isMissingAddress(CONTRACTS.carbonCreditToken)) missing.push('NEXT_PUBLIC_CARBON_CREDIT_TOKEN');
    if (isMissingAddress(CONTRACTS.carbonMarketplace)) missing.push('NEXT_PUBLIC_CARBON_MARKETPLACE');
    if (isMissingAddress(CONTRACTS.carbonPriceOracle)) missing.push('NEXT_PUBLIC_CARBON_PRICE_ORACLE');
    if (isMissingAddress(CONTRACTS.emissionVerifier)) missing.push('NEXT_PUBLIC_EMISSION_VERIFIER');
    if (isMissingAddress(CONTRACTS.usdc)) missing.push('NEXT_PUBLIC_USDC_ADDRESS');

    if (!process.env.NEXT_PUBLIC_BACKEND_URL) missing.push('NEXT_PUBLIC_BACKEND_URL');
    if (!process.env.NEXT_PUBLIC_RPC_URL) missing.push('NEXT_PUBLIC_RPC_URL');

    return missing;
  }, []);

  return (
    <header className="sticky top-0 z-40 glass border-b border-dark-700">
      {missingConfig.length > 0 && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 text-yellow-200 text-xs px-6 py-2">
          Missing config: {missingConfig.join(', ')}. Update .env.local and restart the dev server.
        </div>
      )}
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Logo/Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex flex-col leading-none">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-300 to-emerald-600 bg-clip-text text-transparent leading-tight">ATMOS</h1>
            <p className="text-xs text-emerald-500 uppercase tracking-wider leading-tight">Carbon Credit Marketplace</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="hidden lg:flex items-center gap-6">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/marketplace">Marketplace</NavLink>
          <NavLink href="/auctions">Auctions</NavLink>
          <NavLink href="/portfolio">Portfolio</NavLink>
          <div className="border-l border-slate-700 pl-6 flex items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Companies</span>
              <div className="flex items-center gap-4">
                <NavLink href="/company/register">Register</NavLink>
                <NavLink href="/company/dashboard">Dashboard</NavLink>
                <NavLink href="/credit-requests">Credits</NavLink>
                <NavLink href="/sell-credits">Sell</NavLink>
              </div>
            </div>
          </div>
          <div className="border-l border-slate-700 pl-6 flex items-center gap-6">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500 uppercase tracking-wider">Traders</span>
              <div className="flex items-center gap-4">
                <NavLink href="/trader/register">Register</NavLink>
                <NavLink href="/trader/dashboard">Dashboard</NavLink>
              </div>
            </div>
          </div>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* RainbowKit Connect Button */}
          <ConnectButton chainStatus="icon" showBalance={false} />
          
          {/* Mobile Menu Toggle */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            {isSidebarOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ href, children }) => (
  <Link
    href={href}
    className="text-dark-300 hover:text-primary-400 font-medium transition-colors duration-200"
  >
    {children}
  </Link>
);
