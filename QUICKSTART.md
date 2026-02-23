# ATMOS Quick Start Guide 🚀

Get ATMOS running locally in 5 minutes!

## Prerequisites

- Node.js 18+ (`node --version`)
- npm 9+ (`npm --version`)
- Git installed
- A Web3 wallet (MetaMask recommended)

## Setup Instructions

### 1️⃣ Clone & Install Root Dependencies

```bash
# Navigate to project
cd d:\Atmos\Atmos

# Install dependencies
npm install
```

### 2️⃣ Compile Smart Contracts

```bash
# Compile Solidity contracts
npm run compile

# Verify compilation
# You should see: "contracts compiled successfully"
```

### 3️⃣ Deploy Contracts (Local)

```bash
# Start a local Hardhat node
npm run node

# In a NEW terminal, deploy contracts
npm run deploy:local

# Copy contract addresses from output
# You'll need these for frontend .env setup
```

Save the output addresses - you'll need them in the next step!

### 4️⃣ Setup Frontend Environment

```bash
# Navigate to frontend folder
cd frontend

# Create .env.local file
# Copy this template and fill in the addresses from step 3:
```

**Create `frontend/.env.local`:**
```env
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x[paste-from-deploy]
NEXT_PUBLIC_CARBON_CREDIT_TOKEN=0x[paste-from-deploy]
NEXT_PUBLIC_CARBON_MARKETPLACE=0x[paste-from-deploy]
NEXT_PUBLIC_CARBON_PRICE_ORACLE=0x[paste-from-deploy]
NEXT_PUBLIC_EMISSION_VERIFIER=0x[paste-from-deploy]
NEXT_PUBLIC_USDC_ADDRESS=0x[paste-from-deploy]
```

### 5️⃣ Install Frontend Dependencies

```bash
# Still in frontend folder
npm install

# Wait for installation to complete
# This may take 2-3 minutes
```

### 6️⃣ Start Frontend Dev Server

```bash
# Still in frontend folder
npm run dev

# You should see:
# ▲ Next.js 14.0.0
# - Local:        http://localhost:3000
```

### 7️⃣ Open in Browser

Open your browser and go to:
```
http://localhost:3000
```

✅ **You should see the ATMOS landing page!**

---

## 🧪 Testing Features

### 1. Connect Your Wallet
- Click "Launch App" button on landing page
- Connect MetaMask (or similar wallet)
- Accept the network request to switch to localhost

### 2. Explore Pages

**Dashboard** (`/dashboard`)
- View market statistics
- See real-time price charts
- Monitor emissions analysis

**Marketplace** (`/marketplace`)
- Browse available carbon credits
- View companies needing offsets
- See real-time company emission data

**Auctions** (`/auctions`)
- View live auctions
- Place competitive bids
- Track auction countdowns

**Portfolio** (`/portfolio`)
- View your holdings (mock data)
- See transaction history
- Monitor investments

### 3. Try Mock Transactions
- Click "Buy" on any marketplace listing
- Enter amount and confirm
- Watch toast notification
- Check portfolio for updates

---

## 📊 What's Included

### Backend (Smart Contracts)
✅ CarbonCreditNFT - Individual credit tokenization
✅ CarbonCreditToken - Fungible trading
✅ CarbonMarketplace - Order book + AMM
✅ CarbonPriceOracle - Real-time pricing
✅ EmissionVerifier - Chainlink oracle integration

### Frontend (React App)
✅ Landing Page - Marketing & hero section
✅ Dashboard - Market analytics & charts
✅ Marketplace - Browse & trade interface
✅ Auctions - Live bidding system
✅ Portfolio - Holdings & transactions
✅ Responsive Design - Mobile-friendly
✅ Dark Theme - Professional trader UI

---

## 🔧 Troubleshooting

### Issue: "Cannot find module"
```bash
# Clear dependencies and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port 3000 already in use
```bash
# Use a different port
npm run dev -- -p 3001
```

### Issue: Contract addresses not working
```bash
# Make sure:
# 1. Hardhat node is still running (npm run node)
# 2. .env.local has correct addresses
# 3. All smart contracts deployed successfully
```

### Issue: Wallet won't connect
```bash
# Clear MetaMask:
1. Open MetaMask
2. Click Settings → Advanced
3. Click "Clear activity tab data"
4. Refresh browser
5. Try connecting again
```

### Issue: "RPC Error"
```bash
# Verify:
1. Hardhat node is running
2. NEXT_PUBLIC_RPC_URL points to local node
3. Network chain ID is 31337
```

---

## 📁 File Structure Overview

```
ATMOS/
├── contracts/
│   ├── core/
│   │   ├── CarbonCreditNFT.sol ← Core NFT logic
│   │   ├── CarbonMarketplace.sol ← Trading engine
│   │   └── CarbonCreditToken.sol ← ERC-20 token
│   └── oracle/
│       ├── CarbonPriceOracle.sol ← Pricing
│       └── EmissionVerifier.sol ← Verification
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx ← Landing page
│   │   │   ├── dashboard/
│   │   │   ├── marketplace/
│   │   │   ├── auctions/
│   │   │   └── portfolio/
│   │   ├── components/
│   │   │   ├── UI.tsx ← Button, Card, etc.
│   │   │   └── Header.tsx ← Navigation
│   │   └── config/
│   │       └── contracts.ts ← Contract ABIs
│   └── package.json
├── scripts/
│   └── deploy/ ← Deployment scripts
├── README.md
└── hardhat.config.js
```

---

## 🎯 Next Steps After Setup

### 1. Integrate Real Data
- Replace mock data in components with real API calls
- Connect Chainlink oracles for live price feeds
- Implement Web3 wallet signing for transactions

### 2. Complete Smart Contract Integration
- Implement contract write functions (currently mock)
- Add event listeners for real-time updates
- Setup transaction monitoring

### 3. Add Backend Services
- Create Node.js API for off-chain data
- Setup database for company profiles
- Implement KYC/KYB verification

### 4. Deploy to Testnet
- Push contracts to Mumbai testnet
- Update frontend to Mumbai RPC
- Test with real testnet funds

### 5. Production Deployment
- Security audit of smart contracts
- Deploy to Polygon mainnet
- Setup monitoring & alerting
- Launch to public users

---

## 🎓 Learning Resources

### Understand the Architecture

1. **Smart Contracts**
   - Read [contracts/core/CarbonMarketplace.sol](contracts/core/CarbonMarketplace.sol)
   - Understand ERC-721 (NFT standard)
   - Learn about Chainlink oracles

2. **Frontend Code**
   - Review [frontend/src/app/marketplace/page.tsx](frontend/src/app/marketplace/page.tsx)
   - Check [frontend/src/types/index.ts](frontend/src/types/index.ts) for interfaces
   - Study [frontend/src/components/UI.tsx](frontend/src/components/UI.tsx) for components

3. **Web3 Integration**
   - Read INTEGRATION_GUIDE.md in frontend folder
   - Learn about Wagmi hooks
   - Understand contract ABIs & interactions

### Sample Code Patterns

**Reading contract data:**
```typescript
// In frontend/hooks.ts
const { data: price } = useContractRead({
  address: CONTRACTS.carbonPriceOracle,
  abi: ABI_PRICE_ORACLE,
  functionName: 'getLatestPrice',
});
```

**Writing to contract:**
```typescript
const { write: buyOrder } = useContractWrite({
  address: CONTRACTS.carbonMarketplace,
  abi: ABI_MARKETPLACE,
  functionName: 'createBuyOrder',
});
```

---

## 🚀 Common Development Tasks

### Add a New Page

```bash
# Create new page
mkdir -p frontend/src/app/new-page
touch frontend/src/app/new-page/page.tsx

# Edit the file:
# - Import Header component
# - Add your content
# - Style with Tailwind CSS
```

### Modify Smart Contract

```bash
# Edit contract file
nano contracts/core/CarbonMarketplace.sol

# Compile
npm run compile

# Redeploy
npm run deploy:local
```

### Update Frontend Styling

- Edit `frontend/src/globals.css` for global styles
- Modify `frontend/tailwind.config.ts` for theme colors
- Use Tailwind classes: `bg-red-500`, `text-white`, etc.

---

## 📊 Dashboard Walkthrough

```
┌─────────────────────────────────────────┐
│          ATMOS Dashboard                │
├─────────────────────────────────────────┤
│  [4 Stat Cards]                         │
│  • Market Price ($19.50)                │
│  • Total Offset (2.4M tonnes)          │
│  • Active Orders (1,245)                │
│  • Participants (8,432)                 │
├─────────────────────────────────────────┤
│  [Charts Grid - 2 columns]              │
│  • Price Trend (Line Chart)             │
│  • Trading Volume (Bar Chart)           │
├─────────────────────────────────────────┤
│  [Emissions Analysis]                   │
│  • Scope 1, 2, 3 breakdown              │
│  • Monthly trend visualization          │
└─────────────────────────────────────────┘
```

---

## 🎨 UI Theme

**Dark Mode Theme:**
- Background: Dark blue-gray (#0f172a)
- Cards: Glass morphism with transparency
- Primary Color: Green (#22c55e) for success/CTA
- Text: Light gray on dark background
- Borders: Subtle with transparency

**Responsive Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## 📈 Performance Tips

### Frontend Optimization
```bash
# Check bundle size
npm run analyze

# Optimize images
# Use Next.js Image component for automatic optimization

# Enable caching
# Configure Next.js ISR (Incremental Static Regeneration)
```

### Smart Contract Optimization
```bash
# Check contract size
npm run size

# Gas optimization
npm run test:gas
```

---

## ✅ Checklist - You're Ready When:

- [ ] Node.js and npm installed
- [ ] Smart contracts compiled without errors
- [ ] Hardhat node running in background
- [ ] Contracts deployed and addresses copied
- [ ] Frontend .env.local configured
- [ ] Frontend dependencies installed
- [ ] Dev server running on localhost:3000
- [ ] Can see landing page in browser
- [ ] Can view dashboard & marketplace
- [ ] Understand the component structure

---

## 🎉 Success!

You now have ATMOS running locally with:
- ✅ Working smart contracts
- ✅ Modern React frontend
- ✅ Real-time data visualization
- ✅ Mock trading interface
- ✅ Responsive design

## 🚀 What to do next?

1. **Explore the code** - Read smart contracts and frontend components
2. **Connect real data** - Integrate live price feeds from Chainlink
3. **Test transactions** - Implement Web3 wallet signing
4. **Deploy to testnet** - Push to Mumbai for testing
5. **Customize styling** - Add your branding and colors
6. **Add features** - Implement KYC, notifications, exports

---

## 📞 Need Help?

- Check [README.md](README.md) for project overview
- Read [frontend/README.md](frontend/README.md) for frontend details
- Review [frontend/INTEGRATION_GUIDE.md](frontend/INTEGRATION_GUIDE.md) for Web3 integration
- Check troubleshooting section above
- Review smart contract comments for function documentation

---

**Happy building! 🚀**

**Questions?** Open an issue or check the documentation.
