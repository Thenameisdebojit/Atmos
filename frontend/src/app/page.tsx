'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Lock,
  Users,
  Zap,
  Globe,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { Button, Card } from '@/components/UI';

const features = [
  {
    icon: <Lock className="w-8 h-8" />,
    title: 'Verified Blockchain',
    description:
      'All carbon credits verified on-chain with Chainlink oracles ensuring authenticity',
  },
  {
    icon: <TrendingUp className="w-8 h-8" />,
    title: 'Real-Time Pricing',
    description: 'Dynamic pricing engine powered by market demand and supply data',
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: 'Enterprise Grade',
    description: 'Built for institutions, governments, and global corporations',
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: 'Instant Settlement',
    description: 'Blockchain-based transactions settle in minutes, not days',
  },
  {
    icon: <Globe className="w-8 h-8" />,
    title: 'Global Reach',
    description: 'Trade carbon credits from verified projects worldwide',
  },
  {
    icon: <Lock className="w-8 h-8" />,
    title: 'Compliant',
    description: 'Aligned with India Carbon Market, Verra, and Gold Standard',
  },
];

const stats = [
  { number: '2.4M+', label: 'Tonnes Offset' },
  { number: '$4.8B', label: 'Total Market Cap' },
  { number: '8,432', label: 'Active Users' },
  { number: '1,245', label: 'Active Orders' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-40 glass border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex flex-col leading-none">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-emerald-300 to-emerald-600 bg-clip-text text-transparent leading-tight">ATMOS</h1>
              <p className="text-xs text-emerald-500 uppercase tracking-wider leading-tight">Carbon Credit Marketplace</p>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="#features"
              className="text-dark-300 hover:text-primary-400 transition-colors"
            >
              Features
            </Link>
            <Link
              href="#stats"
              className="text-dark-300 hover:text-primary-400 transition-colors"
            >
              Impact
            </Link>
          </div>
          <Button icon={<ArrowRight className="w-4 h-4" />}>Launch App</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-500/10 border border-primary-500/20">
            <span className="text-sm text-primary-400 font-medium">
              🌍 Welcome to ATMOS
            </span>
            <ChevronRight className="w-4 h-4 text-primary-400" />
          </div>

          <h1 className="text-5xl md:text-7xl font-bold">
            <span className="gradient-text">The Future of</span>
            <br />
            Carbon Markets
          </h1>

          <p className="text-xl text-dark-400 max-w-2xl mx-auto">
            ATMOS is the world's first production-grade blockchain marketplace for verified
            carbon credits. Trade, invest, and retire credits with complete transparency and enterprise-grade security.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Button size="lg" icon={<Zap className="w-5 h-5" />}>
              Get Started Now
            </Button>
            <Button
              size="lg"
              variant="outline"
              icon={<Globe className="w-5 h-5" />}
            >
              Learn More
            </Button>
          </div>

          {/* Stats Preview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-16 border-t border-dark-700">
            {stats.map((stat, idx) => (
              <div key={idx} className="space-y-2">
                <p className="text-3xl md:text-4xl font-bold gradient-text">
                  {stat.number}
                </p>
                <p className="text-dark-400 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Why ATMOS?</h2>
          <p className="text-dark-400 text-lg">
            Built for the future of carbon markets
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <Card key={idx} className="text-center space-y-4">
              <div className="inline-flex p-3 rounded-lg bg-primary-500/10 text-primary-400">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="text-dark-400">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">How It Works</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              number: '01',
              title: 'Connect Wallet',
              description: 'Link your Web3 wallet to start trading',
            },
            {
              number: '02',
              title: 'Browse & Trade',
              description: 'Explore verified carbon credits from global projects',
            },
            {
              number: '03',
              title: 'Track Impact',
              description: 'Monitor your carbon offset and investments in real-time',
            },
          ].map((step, idx) => (
            <div key={idx} className="space-y-4">
              <div className="text-5xl font-bold text-primary-500/30">{step.number}</div>
              <h3 className="text-2xl font-semibold">{step.title}</h3>
              <p className="text-dark-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Company Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">For Companies & Enterprises</h2>
          <p className="text-dark-400 text-lg">
            Manage emissions, request credits, and trade on the blockchain
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Features */}
          <div className="space-y-6">
            {[
              {
                title: '📝 Easy Registration',
                description: 'Register with just your company details and emissions data',
              },
              {
                title: '📊 Track Emissions',
                description: 'Monitor Scope 1, 2, and 3 emissions in real-time',
              },
              {
                title: '🔍 Request Credits',
                description: 'Submit requests and get auto-matched with available credits',
              },
              {
                title: '💰 Dual Sales Model',
                description: 'Sell excess credits via fixed-price listings or auctions',
              },
              {
                title: '🔨 Live Bidding',
                description: 'Participate in real-time auctions for competitive pricing',
              },
              {
                title: '✅ Compliance Ready',
                description: 'Full audit trail and verification on blockchain',
              },
            ].map((feature, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex-shrink-0 text-2xl">{feature.title.split(' ')[0]}</div>
                <div>
                  <h4 className="font-semibold mb-1">
                    {feature.title.replace(/^[^ ]+ /, '')}
                  </h4>
                  <p className="text-dark-400 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: CTA Card */}
          <div className="flex flex-col justify-center">
            <Card className="p-8 bg-gradient-to-br from-primary-900/30 to-primary-800/20 border border-primary-500/30">
              <h3 className="text-2xl font-bold mb-4">Ready to Go Carbon Neutral?</h3>
              <p className="text-dark-300 mb-4">
                Register your company today and start managing your carbon footprint on blockchain.
              </p>
              <p className="text-dark-400 text-sm mb-6">
                Join enterprise customers and governments using ATMOS to meet sustainability targets.
              </p>
              <div className="space-y-3">
                <Link href="/company/register" className="block">
                  <Button className="w-full" size="lg">
                    Register Your Company
                  </Button>
                </Link>
                <Link href="/company/dashboard" className="block">
                  <Button className="w-full" variant="secondary">
                    View Company Dashboard
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-dark-500 mt-6 text-center">
                No credit card required. Blockchain verification included.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Trader Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">For Individual Traders & Investors</h2>
          <p className="text-dark-400 text-lg">
            Trade carbon credits for profit with portfolio tracking and analytics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: CTA Card */}
          <div className="flex flex-col justify-center order-2 lg:order-1">
            <Card className="p-8 bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-500/30">
              <h3 className="text-2xl font-bold mb-4">Start Trading Carbon Credits</h3>
              <p className="text-dark-300 mb-4">
                Join the carbon credit market as an individual trader. Buy low, sell high, and track your portfolio.
              </p>
              <p className="text-dark-400 text-sm mb-6">
                No emissions tracking required. Just invest, trade, and profit from the growing carbon economy.
              </p>
              <div className="space-y-3">
                <Link href="/trader/register" className="block">
                  <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
                    Register as Trader
                  </Button>
                </Link>
                <Link href="/trader/dashboard" className="block">
                  <Button className="w-full" variant="secondary">
                    View Trader Dashboard
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-dark-500 mt-6 text-center">
                Connect with MetaMask, Coinbase, Rainbow, or any supported wallet. Beginner-friendly.
              </p>
            </Card>
          </div>

          {/* Right: Features */}
          <div className="space-y-6 order-1 lg:order-2">
            {[
              {
                title: '💹 Investment Focused',
                description: 'Trade carbon credits like stocks - buy low, sell high for profit',
              },
              {
                title: '📈 Portfolio Analytics',
                description: 'Track ROI, P&L, and portfolio value in real-time',
              },
              {
                title: '🎯 Experience Levels',
                description: 'From beginners to experts - everyone can start trading',
              },
              {
                title: '🛒 Easy Trading',
                description: 'Buy from marketplace or auctions with just a few clicks',
              },
              {
                title: '💰 Profit Tracking',
                description: 'Monitor gains and losses on every credit you own',
              },
              {
                title: '🔒 Secure & Transparent',
                description: 'All transactions verified on blockchain with full audit trail',
              },
            ].map((feature, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex-shrink-0 text-2xl">{feature.title.split(' ')[0]}</div>
                <div>
                  <h4 className="font-semibold mb-1">
                    {feature.title.replace(/^[^ ]+ /, '')}
                  </h4>
                  <p className="text-dark-400 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <Card className="space-y-6 text-center">
          <h2 className="text-3xl font-bold">
            Ready to Make a Climate Impact?
          </h2>
          <p className="text-dark-400 text-lg">
            Join thousands of organizations already trading verified carbon credits
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
              Start Trading Now
            </Button>
            <Button
              size="lg"
              variant="secondary"
              icon={<Zap className="w-5 h-5" />}
            >
              Watch Demo
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-700 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-dark-400 text-sm">
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Marketplace
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Portfolio
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-dark-400 text-sm">
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-dark-400 text-sm">
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Docs
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    API
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-dark-400 text-sm">
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-primary-400">
                    Compliance
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-dark-800">
            <p className="text-dark-500 text-sm">
              © 2024 ATMOS. All rights reserved.
            </p>
            <div className="flex gap-4 mt-4 md:mt-0">
              {['Twitter', 'GitHub', 'Discord'].map((social) => (
                <Link
                  key={social}
                  href="#"
                  className="text-dark-400 hover:text-primary-400 text-sm"
                >
                  {social}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
