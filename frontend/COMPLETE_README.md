# 🌱 ATMOS - Decentralized Carbon Credit Marketplace

> **A complete production-grade frontend for trading, retiring, and investing in verified carbon credits on the blockchain.**

## 🎯 What is ATMOS?

ATMOS is a next-generation platform that bridges the carbon offset market with blockchain technology, enabling:

- **Real-time Carbon Trading**: Buy and sell verified carbon credits instantly
- **Emission Tracking**: Companies can track Scope 1, 2, and 3 emissions
- **Credit Retirement**: Permanently retire carbon credits on-chain
- **Decentralized Auctions**: Bid on carbon credit batches
- **Investment Pools**: Earn returns by investing in future carbon credit generation
- **Oracle Integration**: Real-time price feeds via Chainlink

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript 5
- **Blockchain**: Wagmi 1.4 + Viem + Web3.js
- **Wallet**: RainbowKit 1.3 (MetaMask, WalletConnect, etc.)
- **Styling**: Tailwind CSS 3.3 + Custom dark theme
- **State**: Zustand 4.4
- **Charting**: Recharts 2.10
- **Network**: Polygon (mainnet), Mumbai (testnet), (local Hardhat support)

## 🚀 Features

### Dashboard
- **Live Market Price**: Real-time carbon price from oracle
- **Trading Volume**: 24h marketplace activity
- **Active Orders**: Buy/sell orders on blockchain
- **Emission Data**: Company emission tracking by scope
- **Block Height**: Current blockchain state indicator

### Marketplace
- **Browse Credits**: Search and filter verified carbon projects
- **Place Orders**: Create buy/sell orders on-chain
- **Company Profiles**: Companies needing offset credits
- **Real-time Matching**: Order fulfillment with on-chain execution
- **KYC Support**: Optional verification for compliance

### Auctions
- **Live Auctions**: Bid on carbon credit batches
- **Countdown Timers**: Auction status and timing
- **Bid History**: Track all bids and bidders
- **Winner Payout**: Automated settlement

### Portfolio
- **Holdings Management**: Track owned carbon credits
- **Portfolio Value**: Real-time P&L tracking
- **Transaction History**: All trades and retirements
- **Investment Pools**: Passive yield opportunities
- **Retirement Verification**: Proof of permanent offset

## 📊 Data Flow

```
Frontend (Next.js)
    ↓
Wagmi/Viem (Web3 Client)
    ↓
RPC Provider (Ethereum/Polygon)
    ↓
Smart Contracts (Solidity)
    ├─ CarbonCreditNFT (ERC-721 implementation)
    ├─ CarbonMarketplace (Order matching)
    ├─ CarbonPriceOracle (Chainlink integration)
    └─ EmissionVerifier (Scope 1/2/3 tracking)
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or other Web3 wallet
- Smart contracts deployed to a network

### Step 1: Clone and Install

```bash
git clone <repo>
cd Atmos/frontend
npm install --legacy-peer-deps
```

### Step 2: Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Network (hardhat | mumbai | polygon)
NEXT_PUBLIC_NETWORK=hardhat
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545

# Replace with your deployed contract addresses
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CARBON_MARKETPLACE=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_CARBON_PRICE_ORACLE=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NEXT_PUBLIC_EMISSION_VERIFIER=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

# WalletConnect (get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
```

### Step 3: Start Development Server

```bash
npm run dev
```

Visit **http://localhost:3001** and connect your wallet!

## 🔗 Smart Contract Integration

### useContractInteraction Hook

The primary hook for all blockchain interactions:

```typescript
import { useContractInteraction } from '@/hooks/useContractInteraction';

export function MyComponent() {
  const {
    getCarbonPrice,
    createOrder,
    retireCredits,
    isConnected,
    address,
  } = useContractInteraction();

  // Fetch live price
  const price = await getCarbonPrice();

  // Create a buy order
  const tx = await createOrder(
    tokenId,      // Carbon credit NFT ID
    quantity,     // Tonnes to buy
    pricePerTonne, // Price in USDC
    true          // isBuying
  );
}
```

### useRealtimeEvents Hook

Listen for real-time blockchain events:

```typescript
import { useRealtimeEvents } from '@/hooks/useRealtimeEvents';

useEffect(() => {
  const { startListening } = useRealtimeEvents(
    (trade) => {
      console.log('New trade:', trade);
      // Update UI
    },
    (credit) => {
      console.log('New credit:', credit);
      // Update portfolio
    }
  );

  startListening();
}, []);
```

## 📱 Pages & Components

### Pages (`src/app/`)

- **`page.tsx`** - Landing page with platform overview
- **`dashboard/page.tsx`** - Real-time market data & analytics
- **`marketplace/page.tsx`** - Buy/sell carbon credits
- **`auctions/page.tsx`** - Auction bidding interface
- **`portfolio/page.tsx`** - User holdings & transactions

### Components (`src/components/`)

- **`UI.tsx`** - Reusable components (Button, Card, Badge, etc.)
- **`Header.tsx`** - Navigation with wallet connection (RainbowKit)

### Hooks (`src/hooks/`)

- **`useContractInteraction.ts`** - Smart contract read/write functions
- **`useRealtimeEvents.ts`** - Event listeners for blockchain updates
- **`useAsync.ts`** - Async data fetching
- **`useDebounce.ts`** - Debounce search input
- **`useNotification.ts`** - Toast notifications
- Plus 10+ other utility hooks

### Stores (`src/store/`)

- **`useUserStore`** - User wallet & portfolio state
- **`useCompanyStore`** - Company emission data
- **`useMarketplaceStore`** - Filter/sort state
- **`useUIStore`** - UI state (sidebar, modals)

## 🌐 Network Support

### Local Hardhat

```bash
# Terminal 1: Start Hardhat node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy/01_deploy_local.js --network localhost

# Terminal 3: Start frontend
npm run dev
```

### Mumbai Testnet

```env
NEXT_PUBLIC_NETWORK=mumbai
NEXT_PUBLIC_RPC_URL=https://rpc-mumbai.maticvigil.com
```

Get test MATIC: https://faucet.polygon.technology/

### Polygon Mainnet

```env
NEXT_PUBLIC_NETWORK=polygon
NEXT_PUBLIC_RPC_URL=https://polygon-rpc.com
```

## 💰 Transactions & Gas

- **Local**: Instant, free (test tokens)
- **Mumbai**: ~5-10 seconds, free MATIC
- **Mainnet**: ~15-30 seconds, real MATIC required

All transactions require gas fees. Connect wallet and approve spending when prompted.

## 📊 Real Data Example

When connected to blockchain with deployed contracts:

```
Dashboard shows:
✓ Live carbon price: $19.50/tonne (from oracle)
✓ 24h volume: $2,450,000 (from executed orders)
✓ Active orders: 1,245 (from contract state)
✓ Block: 52,847,291 (current blockchain block)

Marketplace shows:
✓ Available credits in real time
✓ Company demand without credits
✓ Live order book

Portfolio shows:
✓ Your NFT holdings
✓ Purchase history from transactions
✓ Real-time P&L based on market price
✓ Events for mints, retirements, trades
```

## 🎨 Customization

### Theme

Edit `src/globals.css` and `src/tailwind.config.ts`:

```typescript
// Dark theme with green accent
backgroundColor: {
  primary: {
    400: '#22c55e',  // Green
    500: '#16a34a',
    600: '#15803d',
  },
  dark: {
    950: '#0f172a',  // Almost black
  },
}
```

### Add Custom Page

```typescript
// src/app/my-feature/page.tsx
'use client';

import { useContractInteraction } from '@/hooks/useContractInteraction';

export default function MyFeaturePage() {
  const { getCarbonPrice } = useContractInteraction();
  
  return (
    <div className="p-8">
      {/* Your UI here */}
    </div>
  );
}
```

## 🧪 Testing

### Build

```bash
npm run build
```

### Run Production Build

```bash
npm start
```

### Lint

```bash
npm run lint
```

### Type Check

```bash
npm run type-check
```

## 📚 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── page.tsx           # Landing page
│   │   ├── dashboard/         # Dashboard page
│   │   ├── marketplace/       # Marketplace page
│   │   ├── auctions/          # Auctions page
│   │   ├── portfolio/         # Portfolio page
│   │   └── layout.tsx         # Root layout (Wagmi + RainbowKit)
│   │
│   ├── components/
│   │   ├── UI.tsx             # Reusable UI components
│   │   └── Header.tsx         # Navigation header
│   │
│   ├── hooks/
│   │   ├── useContractInteraction.ts  # Smart contract functions
│   │   ├── useRealtimeEvents.ts       # Event listeners
│   │   └── index.ts                  # 10+ utility hooks
│   │
│   ├── config/
│   │   ├── contracts.ts       # Contract addresses & ABIs
│   │   └── wagmi.ts           # Wagmi configuration
│   │
│   ├── store/                 # Zustand state
│   ├── types/                 # TypeScript interfaces
│   ├── utils/                 # Helper functions
│   └── globals.css            # Global styles & animations
│
├── public/                    # Static assets
├── scripts/
│   └── setup-dev.js          # Development setup helper
├── .env.example              # Environment template
├── package.json              # Dependencies
├── next.config.js            # Next.js config
├── tsconfig.json             # TypeScript config
├── tailwind.config.ts        # Tailwind configuration
└── postcss.config.js         # PostCSS config
```

## 🔒 Security Considerations

- ✅ Private keys never stored in frontend
- ✅ Wallets handle all transaction signing
- ✅ RPC endpoints are read-only (writes via wallet)
- ✅ Contract addresses verified on-chain
- ⚠️ Always verify smart contract addresses before deployment
- ⚠️ Never share your private keys or seed phrases

## 📖 Documentation

See detailed guides:

- **[BLOCKCHAIN_INTEGRATION.md](./BLOCKCHAIN_INTEGRATION.md)** - Smart contract integration
- **[README.md](./README.md)** - Project overview
- **[BUILD_SUMMARY.md](./BUILD_SUMMARY.md)** - Build process details
- **[FILE_DIRECTORY.md](./FILE_DIRECTORY.md)** - Complete file listing

## 🚨 Troubleshooting

### "Contract not found at address"

```bash
# Verify contract addresses in .env.local
# Ensure contracts are deployed to the correct network
npx hardhat run scripts/deploy/01_deploy_local.js --network localhost
```

### "MetaMask not detecting network"

```bash
# Add manually to MetaMask:
# - Network Name: Hardhat Local
# - RPC URL: http://127.0.0.1:8545
# - Chain ID: 31337
```

### "Transaction reverted"

- Insufficient gas: Fund wallet with more tokens
- Insufficient allowance: Approve token spending
- Invalid parameters: Check contract ABI arguments

### "Build fails with pino-pretty error"

```bash
# This is a harmless warning from WalletConnect
# It doesn't affect functionality
npm install pino-pretty --save-dev
```

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add amazing feature'`
3. Push: `git push origin feature/amazing-feature`
4. Open pull request

## 📈 Roadmap

- [ ] Multiple blockchain support (Ethereum L1)
- [ ] Fiat on-ramp integration
- [ ] Advanced charting & technical analysis
- [ ] Mobile app (React Native)
- [ ] DAO governance
- [ ] Cross-chain bridges
- [ ] NFT gallery & verification

## 📝 License

Licensed under the MIT License - see LICENSE file for details

## 🤙 Support

- 📧 Email: support@atmos.carbon
- 💬 Discord: [Join our community](https://discord.gg/atmos)
- 📱 Twitter: [@ATMOSCarbon](https://twitter.com/ATMOSCarbon)

---

**Built with ❤️ for sustainable blockchain development**

*Disclaimer: This project is for educational purposes. Ensure compliance with local regulations before trading carbon credits.*
