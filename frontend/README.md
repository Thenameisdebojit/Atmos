# ATMOS Frontend - Carbon Credit Marketplace

A production-grade, modern web interface for the ATMOS decentralized carbon credit marketplace platform.

## 🌟 Features

### Dashboard
- **Real-time Market Overview** - Price trends, trading volume, and emissions analysis
- **Interactive Charts** - Using Recharts for beautiful data visualization
- **Market Statistics** - Key metrics for portfolio tracking
- **Emission Scope Analysis** - Breakdown of Scope 1, 2, and 3 emissions

### Marketplace
- **Advanced Search & Filtering** - Find carbon credits by project, location, or methodology
- **Dual View Modes** - Browse available credits or discover companies needing offsets
- **Company Emission Status** - Real-time display of corporate emission gaps
- **Buy Orders** - Seamless purchasing interface with instant order confirmation
- **Price Discovery** - Transparent pricing per tonne of CO2e

### Auctions
- **Live Bidding** - Place competitive bids on carbon credit batches
- **Real-time Updates** - Auction countdown and bid tracking
- **Smart Bid Validation** - Prevents invalid bids below current price
- **Auction History** - Track all your bids and wins

### Portfolio Management
- **Asset Tracking** - Monitor all carbon credit holdings
- **Performance Analytics** - Unrealized gains, ROI, and portfolio allocation
- **Transaction History** - Complete audit trail of all trades
- **Investment Management** - Track active and completed investment pools
- **Retirement Tracking** - Monitor credits permanently retired

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- A Web3 wallet (MetaMask, WalletConnect, etc.)
- Environment variables configured

### Installation

```bash
cd frontend
npm install
```

### Configuration

Create a `.env.local` file:

```env
NEXT_PUBLIC_CHAIN_ID=137
NEXT_PUBLIC_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x...
NEXT_PUBLIC_CARBON_CREDIT_TOKEN=0x...
NEXT_PUBLIC_CARBON_MARKETPLACE=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## 📁 Project Structure

```
src/
├── app/              # Next.js pages and layouts
│   ├── dashboard/    # Dashboard page
│   ├── marketplace/  # Marketplace trading interface
│   ├── auctions/     # Auction bidding interface
│   ├── portfolio/    # User portfolio management
│   └── layout.tsx    # Root layout
├── components/       # Reusable UI components
│   ├── UI.tsx        # Core components (Button, Card, Badge, etc.)
│   └── Header.tsx    # Navigation header
├── config/          # Configuration files
│   └── contracts.ts # Smart contract ABIs and addresses
├── hooks/           # Custom React hooks
├── store/           # Zustand state management
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   └── format.ts    # Formatting utilities
└── globals.css      # Global styles with Tailwind
```

## 🛠️ Key Technologies

- **React 18** - Modern UI framework
- **Next.js 14** - Full-stack React framework with SSR
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Wagmi + Viem** - Web3 integration (replaceable with ethers.js)
- **Zustand** - Lightweight state management
- **Recharts** - Data visualization
- **React Hot Toast** - Toast notifications
- **Lucide React** - Beautiful icons

## 🔗 Smart Contract Integration

### Contract Interfaces

The frontend integrates with these smart contracts:

1. **CarbonCreditNFT** - ERC-721 for individual carbon credits
   - `mintCredit()` - Create new credits
   - `retireCredit()` - Permanently retire credits
   - `balanceOf()` - Check holdings

2. **CarbonMarketplace** - Hybrid order book + AMM
   - `createBuyOrder()` - Place buy bids
   - `createSellOrder()` - List credits for sale
   - `fillOrder()` - Execute trades
   - `addLiquidity()` - Provide liquidity

3. **CarbonPriceOracle** - Real-time pricing
   - `getLatestPrice()` - Current market price
   - `getPriceHistory()` - Historical data

### Contract ABIs

Minimal ABIs are pre-configured in `src/config/contracts.ts`. To use full ABIs:

```typescript
import { ABI_CARBON_MARKETPLACE } from '@/config/contracts';

const contract = useContract({
  address: CARBON_MARKETPLACE,
  abi: ABI_CARBON_MARKETPLACE,
});
```

## 🎨 Design System

### Colors

- **Primary Color** - Green (#22c55e) for success and CTA
- **Dark Background** - #0f172a for main background
- **Cards/Glass** - Dark with transparency and blur effect
- **Accent Colors** - Blue, Yellow, Red for status indicators

### Components

- **Button** - 4 variants (primary, secondary, outline, ghost)
- **Card** - Glass-morphism design with interactive states
- **Input** - With validation and icon support
- **Badge** - Status indicators (success, warning, error, info)
- **StatCard** - For displaying key metrics

## 📊 Data Visualization

Uses Recharts for interactive charts:

- **Line Charts** - Price trends
- **Bar Charts** - Trading volume, emissions by scope
- **Pie Charts** - Asset allocation
- **Area Charts** - Portfolio value progression

## 🔐 Web3 Integration

### Wallet Connection

```typescript
// Header component handles wallet connection
import { Header } from '@/components/Header';

<Header
  walletAddress={address}
  onConnect={handleConnect}
  onDisconnect={handleDisconnect}
/>
```

### Contract Interaction

```typescript
// Example: Place a buy order
const { write: createBuyOrder } = useContractWrite({
  address: CARBON_MARKETPLACE,
  abi: ABI_CARBON_MARKETPLACE,
  functionName: 'createBuyOrder',
});

createBuyOrder({
  args: [amount, pricePerTonne, expiresIn, requiresKYC],
});
```

## 🧪 Testing

Test components with mock data during development. Mock data is in each page component:

```typescript
const mockAuctions: AuctionItem[] = [
  // ... mock auction data
];
```

## 📈 Performance Optimization

- **Code Splitting** - Automatic with Next.js
- **Image Optimization** - Built-in Next.js Image component
- **CSS Optimization** - Tailwind CSS purging
- **Bundle Analysis** - Use `npm run analyze` to check bundle size
- **Lazy Loading** - Components load on demand

## 🚨 Common Issues & Solutions

### Issue: Wallet Not Connecting
**Solution**: Ensure the RPC URL is correct and your wallet is set to the correct network (Polygon).

### Issue: Contract Calls Failing
**Solution**: Verify contract addresses in `.env.local` match the deployed contracts.

### Issue: Styles Not Loading
**Solution**: Make sure Tailwind CSS is configured correctly. Clear `.next` folder and rebuild.

## 🔄 Integration Checklist

- [ ] Update contract addresses in `.env.local`
- [ ] Update contract ABIs with real deployment ABIs
- [ ] Implement wallet connection logic with rainbowkit or wagmi
- [ ] Connect all contract write/read functions
- [ ] Setup API endpoints for off-chain data
- [ ] Configure KYC verification flow
- [ ] Add ESG reporting export functionality
- [ ] Setup Chainlink oracle integrations
- [ ] Test end-to-end trading flow
- [ ] Deploy to production

## 📞 Support & Resources

- **Documentation**: See [docs](../docs)
- **Smart Contracts**: See `../contracts`
- **Backend API**: See `../backend`
- **Issues**: Report on GitHub Issues

## 📄 License

MIT License - See LICENSE file for details

---

**Built for the ATMOS Carbon Credit Marketplace** 🌍
