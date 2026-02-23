# ATMOS Backend Integration Guide

This guide explains how to integrate the ATMOS frontend with your deployed smart contracts and run the full system with real blockchain data.

## 🎯 Overview

The frontend is now fully integrated with blockchain functionality:
- ✅ Real-time smart contract interactions
- ✅ Live event listeners for trades and credits
- ✅ Dynamic data fetching from blockchain
- ✅ Wallet connection via RainbowKit
- ✅ Multi-network support (Hardhat, Mumbai, Polygon)

## 🚀 Quick Start

### 1. Deploy Smart Contracts

First, ensure your smart contracts are deployed to a network (local Hardhat or testnet):

```bash
# From the root Atmos directory
cd ..
npx hardhat node  # Start local blockchain (keep this running)

# In a new terminal, deploy contracts
npx hardhat run scripts/deploy/01_deploy_local.js --network localhost
```

**Save the deployed contract addresses!** You'll need them in step 2.

### 2. Configure Environment Variables

Copy the example environment file and update with your contract addresses:

```bash
# In the frontend directory
cd frontend
cp .env.example .env.local
```

Edit `.env.local` with your deployed contract addresses:

```env
# Network Configuration
NEXT_PUBLIC_NETWORK=hardhat
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545

# Your Deployed Contract Addresses (from step 1)
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CARBON_MARKETPLACE=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_CARBON_PRICE_ORACLE=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NEXT_PUBLIC_EMISSION_VERIFIER=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

# WalletConnect Project ID (optional - get from https://cloud.walletconnect.com)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### 3. Update Contract Configuration

Update the contract addresses in `src/config/contracts.ts`:

```typescript
export const CONTRACTS = {
  CARBON_CREDIT_NFT: process.env.NEXT_PUBLIC_CARBON_CREDIT_NFT as `0x${string}`,
  CARBON_MARKETPLACE: process.env.NEXT_PUBLIC_CARBON_MARKETPLACE as `0x${string}`,
  CARBON_PRICE_ORACLE: process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE as `0x${string}`,
  EMISSION_VERIFIER: process.env.NEXT_PUBLIC_EMISSION_VERIFIER as `0x${string}`,
};
```

### 4. Start the Frontend

```bash
npm run dev
```

Visit http://localhost:3001 and connect your wallet!

## 🔧 Network Configurations

### Local Hardhat Network

```env
NEXT_PUBLIC_NETWORK=hardhat
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545
```

**Setup:**
1. Run `npx hardhat node` in the root directory
2. Import a test account to MetaMask using a private key from Hardhat output
3. Connect wallet in the app

### Polygon Mumbai Testnet

```env
NEXT_PUBLIC_NETWORK=mumbai
NEXT_PUBLIC_CHAIN_ID=80001
NEXT_PUBLIC_RPC_URL=https://rpc-mumbai.maticvigil.com
```

**Setup:**
1. Deploy contracts: `npx hardhat run scripts/deploy/02_deploy_mumbai.js --network mumbai`
2. Get Mumbai MATIC from https://faucet.polygon.technology/
3. Update contract addresses in `.env.local`

### Polygon Mainnet

```env
NEXT_PUBLIC_NETWORK=polygon
NEXT_PUBLIC_CHAIN_ID=137
NEXT_PUBLIC_RPC_URL=https://polygon-rpc.com
```

## 📊 Real-time Features

### Dashboard
- **Live Carbon Price**: Fetched from `CarbonPriceOracle` contract
- **Block Height**: Current blockchain block number updates in real-time
- **Active Orders**: Number of open marketplace orders
- **Trading Volume**: Calculated from on-chain order execution events

### Marketplace
- **Buy Carbon Credits**: 
  - Click "Buy" on any listing
  - Enter quantity
  - Transaction sent to `CarbonMarketplace.createOrder()`
  - Toast notification on success with transaction hash
  
- **Real-time Listings**: Fetched from contract events and state

### Portfolio
- **User Holdings**: 
  - Automatically fetches credits owned by connected wallet
  - Uses `CarbonCreditNFT.balanceOf()` and `tokenOfOwnerByIndex()`
  - Displays quantity, project, methodology
  
- **Live Event Updates**:
  - Listens for `CreditMinted` events
  - Listens for `OrderExecuted` events
  - Portfolio updates automatically on new trades

### Auctions
- Currently displays mock data
- Ready for integration with auction contract once deployed

## 🔌 Smart Contract Integration Details

### Contract Interaction Hook (`useContractInteraction`)

Located in `src/hooks/useContractInteraction.ts`, this hook provides:

**Read Functions:**
- `getCarbonPrice()` - Get latest price from oracle
- `getUserCredits(address)` - Get all credits owned by user
- `getMarketplaceOrders(status)` - Get active marketplace orders
- `getCompanyEmissions(address)` - Get emission data for a company

**Write Functions:**
- `createOrder(tokenId, quantity, price, isBuying)` - Create buy/sell order
- `mintCredit(tonnes, expiryDate)` - Mint new carbon credit NFT
- `retireCredits(tokenIds, quantities)` - Retire credits permanently

**Example Usage:**
```typescript
const { getCarbonPrice, createOrder, isConnected } = useContractInteraction();

// Fetch price
const price = await getCarbonPrice();

// Create order
const tx = await createOrder(1, 100, 18.5, true);
```

### Real-time Events Hook (`useRealtimeEvents`)

Located in `src/hooks/useRealtimeEvents.ts`, this hook listens for:

- `OrderExecuted` - Trade completed
- `CreditMinted` - New credit created
- `CreditRetired` - Credit permanently retired

**Example Usage:**
```typescript
const { startListening, stopListening } = useRealtimeEvents(
  (tradeEvent) => {
    console.log('Trade:', tradeEvent);
    // Update UI with new trade
  },
  (creditEvent) => {
    console.log('Credit event:', creditEvent);
    // Update portfolio
  }
);

useEffect(() => {
  startListening();
  return () => stopListening();
}, []);
```

## 🧪 Testing the Integration

### 1. Test Wallet Connection
- Click "Connect Wallet" in header
- Select MetaMask/WalletConnect
- Approve connection
- ✅ Address should appear in header

### 2. Test Dashboard
- Navigate to `/dashboard`
- Check "Market Price (Live)" - should show oracle price
- Check "Block Height" - should show current block
- ✅ Real-time indicator should show "Connected to blockchain"

### 3. Test Marketplace
- Navigate to `/marketplace`
- Click "Buy" on any listing
- Enter quantity (e.g., 100)
- Click "Buy Now"
- Approve transaction in wallet
- ✅ Toast notification with transaction hash

### 4. Test Portfolio
- Navigate to `/portfolio`
- Should show "Connect wallet" banner if not connected
- After connecting:
  - Portfolio loads user's credits
  - Holdings displayed with current prices
- ✅ Real-time updates when new trades occur

## 🐛 Troubleshooting

### "Contract not deployed at address"
- Verify contract addresses in `.env.local` match deployed addresses
- Check correct network is selected in MetaMask
- Redeploy contracts if needed

### "User rejected transaction"
- Normal - user cancelled in MetaMask
- Try again

### "Insufficient funds"
- Need native token (ETH/MATIC) for gas
- Local: Use Hardhat test accounts
- Mumbai: Get from faucet
- Mainnet: Bridge tokens

### "Network mismatch"
- MetaMask network must match `NEXT_PUBLIC_NETWORK`
- Switch network in MetaMask
- Or update `.env.local`

### Events not firing
- Check Hardhat node is running (`npx hardhat node`)
- Verify WebSocket support in RPC endpoint
- Check browser console for errors

## 📝 Notes

1. **First-time Setup**: The first contract interaction may require two transactions:
   - First: Approve spending (if needed)
   - Second: Actual transaction

2. **Gas Fees**: All transactions require gas:
   - Local: Free (test ETH)
   - Mumbai: Free test MATIC
   - Mainnet: Real MATIC required

3. **Mock Data Fallback**: If no credits found or wallet not connected, app shows mock data for demonstration

4. **Block Confirmations**: Transactions may take time:
   - Local: Instant
   - Mumbai: ~5-10 seconds
   - Mainnet: ~2-30 seconds

## 🎓 Architecture Overview

```
Frontend (Next.js + React)
    ↓
Wagmi/Viem (Web3 library)
    ↓
RPC Provider (HTTP/WebSocket)
    ↓
Blockchain Network (Hardhat/Mumbai/Polygon)
    ↓
Smart Contracts (Solidity)
```

### Data Flow

1. **User Action** → Click "Buy"
2. **Hook Call** → `createOrder()` in `useContractInteraction`
3. **Web3 Library** → Wagmi formats transaction
4. **Wallet** → MetaMask prompts user to sign
5. **Blockchain** → Transaction submitted to network
6. **Event Listener** → `useRealtimeEvents` detects `OrderExecuted`
7. **UI Update** → Portfolio/Dashboard refreshes with new data

## 🚀 Production Deployment

### Environment Variables for Production

Create `.env.production`:

```env
NEXT_PUBLIC_NETWORK=polygon
NEXT_PUBLIC_CHAIN_ID=137
NEXT_PUBLIC_RPC_URL=https://polygon-rpc.com
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id

# Production contract addresses
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x...
NEXT_PUBLIC_CARBON_MARKETPLACE=0x...
NEXT_PUBLIC_CARBON_PRICE_ORACLE=0x...
NEXT_PUBLIC_EMISSION_VERIFIER=0x...
```

### Build and Deploy

```bash
npm run build
npm start  # or deploy to Vercel/Netlify
```

## 📚 Additional Resources

- **Wagmi Docs**: https://wagmi.sh
- **RainbowKit**: https://www.rainbowkit.com
- **Hardhat**: https://hardhat.org
- **Polygon**: https://polygon.technology

---

**Questions?** Check the console logs - they show all contract interactions and events in real-time.

**Happy Building! 🌱**
