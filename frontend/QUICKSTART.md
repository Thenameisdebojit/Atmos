# ⚡ ATMOS Quick Start Guide

Get the ATMOS carbon credit marketplace running in 5 minutes!

## 🎯 Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org)
- **MetaMask** - [Chrome Extension](https://metamask.io)
- **Smart Contracts Deployed** - See backend README

## ⏱️ 5-Minute Setup

### 1️⃣ Install Dependencies (1 min)

```bash
cd Atmos/frontend
npm install --legacy-peer-deps
```

### 2️⃣ Configure Environment (1 min)

```bash
cp .env.example .env.local
```

**Edit `.env.local`** - Replace these with your deployed contract addresses:

```env
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x5FbDB2315678afecb367f032d93F642f64180aa3
NEXT_PUBLIC_CARBON_MARKETPLACE=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
NEXT_PUBLIC_CARBON_PRICE_ORACLE=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
NEXT_PUBLIC_EMISSION_VERIFIER=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
```

### 3️⃣ Start Dev Server (1 min)

```bash
npm run dev
```

### 4️⃣ Open in Browser (1 min)

Visit **http://localhost:3001**

### 5️⃣ Connect Wallet (1 min)

1. Click "Connect" in top right
2. Select MetaMask
3. Approve connection
4. You're in! 🎉

## 🔌 Working with Local Hardhat

### Start Hardhat Node

```bash
# From root directory
npx hardhat node
```

### Deploy Contracts

```bash
# In another terminal
npx hardhat run scripts/deploy/01_deploy_local.js --network localhost
```

### Add to MetaMask

- **Network Name:** Hardhat Local
- **RPC URL:** http://127.0.0.1:8545
- **Chain ID:** 31337
- **Symbol:** ETH

### Import Test Account

From Hardhat output, copy a private key and import to MetaMask (it gives you 10,000 test ETH).

## 🎮 Try It Out

### 1️⃣ View Dashboard

- See **Live Carbon Price** (from oracle)
- View **Trading Volume** (24h)
- Check **Active Orders**

### 2️⃣ Browse Marketplace

- Click "Marketplace" tab
- See available carbon credits
- Click "Buy" on any listing
- Enter amount and confirm transaction

### 3️⃣ Check Portfolio

- Click "Portfolio"
- See your carbon holdings
- Track P&L in real time
- View transaction history

### 4️⃣ Participate in Auctions

- Click "Auctions"
- View live bids
- Place bid (if wallet connected)
- Win and receive credits!

## 🚀 Deploy to Testnet

### Switch to Mumbai

**Edit `.env.local`:**

```env
NEXT_PUBLIC_NETWORK=mumbai
NEXT_PUBLIC_RPC_URL=https://rpc-mumbai.maticvigil.com
```

Get test MATIC: https://faucet.polygon.technology/

```bash
# Restart dev server
npm run dev
```

### Deploy Contracts to Mumbai

```bash
npx hardhat run scripts/deploy/02_deploy_mumbai.js --network mumbai
```

## 📊 Common Tasks

### Create a Carbon Order

```typescript
const { createOrder } = useContractInteraction();

// Buy 100 tonnes at $20/tonne
const tx = await createOrder(
  1,      // Token ID
  100,    // Quantity (tonnes)
  20,     // Price per tonne
  true    // Buy order
);
```

### Check Portfolio

```typescript
const { getUserCredits } = useContractInteraction();

const credits = await getUserCredits(userAddress);
console.log(`You own ${credits.length} carbon credits`);
```

### Listen for Events

```typescript
const { startListening } = useRealtimeEvents(
  (trade) => console.log('Trade:', trade),
  (credit) => console.log('Credit event:', credit)
);

startListening();
```

## ⚙️ Configuration

| Env Var | Purpose | Example |
|---------|---------|---------|
| `NEXT_PUBLIC_NETWORK` | Blockchain network | `hardhat\|mumbai\|polygon` |
| `NEXT_PUBLIC_RPC_URL` | RPC endpoint | `http://127.0.0.1:8545` |
| `NEXT_PUBLIC_CARBON_CREDIT_NFT` | NFT contract | `0x5FbDB...` |
| `NEXT_PUBLIC_CARBON_MARKETPLACE` | Trading contract | `0xe7f1...` |
| `NEXT_PUBLIC_CARBON_PRICE_ORACLE` | Price oracle | `0x9fE4...` |
| `NEXT_PUBLIC_EMISSION_VERIFIER` | Emissions tracker | `0xCf7E...` |

## 🧪 Build & Test

```bash
# Production build
npm run build

# Run production
npm start

# Lint code
npm run lint

# Type check
npm run type-check
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Contract not found" | Check .env.local addresses match deployed contracts |
| "Network mismatch" | Verify MetaMask network matches NEXT_PUBLIC_NETWORK |
| "Private site only" | Ensure http://127.0.0.1:8545 not https |
| "Insufficient funds" | Get test tokens from faucet (Mumbai) or import test account (Hardhat |
| Build fails with warnings | Run `npm install pino-pretty --save-dev` |

## 📚 Next Steps

- Read [COMPLETE_README.md](./COMPLETE_README.md) for full documentation
- Check [BLOCKCHAIN_INTEGRATION.md](./BLOCKCHAIN_INTEGRATION.md) for advanced integration
- Review [FILE_DIRECTORY.md](./FILE_DIRECTORY.md) for project structure
- Explore `src/hooks/useContractInteraction.ts` to customize contract interactions

## 🚨 First Time Tips

1. **Always test on testnet first** - Deploy to Mumbai before mainnet
2. **Verify contract addresses** - Double-check addresses before deploying
3. **Start with small amounts** - Test with 1-2 credits first
4. **Keep private keys safe** - Never share seed phrases or private keys
5. **Monitor gas prices** - High gas can make transactions expensive

## 🎉 You're Ready!

The ATMOS carbon marketplace is now running locally! 

**Next:** Deploy your smart contracts and connect them using the environment variables above.

**Questions?** Check the full documentation or reach out to the team.

---

**Happy trading! 🌱**
