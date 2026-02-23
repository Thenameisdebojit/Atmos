# Simple Carbon Credit Trading - Quick Start Guide

## 🎯 What This System Does

**Simplified blockchain carbon credit marketplace where companies can:**
1. ✅ Register and **automatically get 5 free carbon credits**
2. ✅ **Sell credits** to other companies using real blockchain transactions  
3. ✅ **Buy credits** from other companies using USDC payments
4. ✅ **Place bids** in real-time auctions
5. ✅ All transactions are **real** - no dummy data!

---

## 🚀 Quick Start (3 Steps)

### Step 1: Start Local Blockchain & Services

```bash
# Terminal 1: Start Hardhat blockchain
npx hardhat node

# Terminal 2: Deploy contracts
npm run deploy:local

# Terminal 3: Run backend & frontend together
./run-dev.bat
```

**Or use the batch file to run everything:**
```bash
./run-dev.bat
```

### Step 2: Setup MetaMask

1. **Import Hardhat Test Account:**
   - In MetaMask → Import Account
   - Use one of the private keys from `npx hardhat node` output
   - Example: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

2. **Add Local Network:**
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `ETH`

3. **Get Test USDC:**
   - Open browser console on the app
   - Run this script to mint USDC:
   ```javascript
   // The deployer already has 1M USDC
   // For other test accounts, you can transfer from deployer
   ```

### Step 3: Register Companies & Trade

#### **Company A (Seller):**
1. Connect wallet in app → Go to **Company Registration**
2. Fill out form:
   - Name: "Green Energy Corp"
   - Email: company-a@example.com
   - Other required fields
3. Click **"Register & Get 5 Free Credits"**
4. ✅ You'll receive **5 carbon credit NFTs** automatically
5. ✅ They'll be **approved for trading**
6. Go to **Sell Credits** page
7. Create a sell listing:
   - Amount: 3 credits
   - Price: $50 per tonne
   - Click **Create Fixed-Price Listing**

#### **Company B (Buyer):**
1. **Open a new browser (or incognito window)**
2. Connect **different MetaMask account**
3. Register as "Tech Solutions Ltd"
4. ✅ Receive 5 credits automatically
5. Go to **Marketplace** page
6. You'll see Company A's listing (3 credits @ $50)
7. Click **Buy Now**
8. Approve USDC spending
9. Complete purchase
10. ✅ **Real blockchain transfer:** Company A gets USDC, Company B gets CCT tokens!

---

## 💡 Key Features Explained

### **1. Automatic Credit Minting**
When you register:
- Smart contract mints **5 NFT carbon credits** to your wallet
- Each NFT = 1 tonne CO₂ offset
- Credits are **approved for the CCT wrapper contract**
- You can immediately trade them

### **2. Real Blockchain Transactions**
Everything is on-chain:
- **USDC payments** - ERC20 token transfers
- **CCT tokens** - Wrapped carbon credits (ERC20)
- **Orders & Auctions** - Stored in smart contract
- **Event listeners** - Real-time updates via blockchain events

### **3. Two Trading Methods**

**Fixed-Price Orders:**
- Set your price per tonne
- Instant settlement when someone buys
- Like an "order book" exchange

**Auctions:**
- Set starting price & end time
- Companies bid against each other
- Highest bidder wins when auction ends

---

## 📝 Test Scenarios

### Scenario 1: Basic Trade
```
Company A → Sells 2 credits @ $50
Company B → Buys them with 100 USDC
✅ Company A: +100 USDC, -2 CCT
✅ Company B: -100 USDC, +2 CCT
```

### Scenario 2: Auction
```
Company A → Creates auction: 3 credits, starts at $40
Company B → Bids $120 total ($40/credit)
Company C → Bids $150 total ($50/credit)  
[Auction ends]
Company A → Finalizes auction
✅ Company A: +150 USDC, -3 CCT
✅ Company C: -150 USDC, +3 CCT
✅ Company B: Gets refund of 120 USDC
```

### Scenario 3: Buy Request
```
Company B → Posts buy order: Need 5 credits @ $45
Company A → Sees order in marketplace
Company A → Fills order (sells 5 credits)
✅ Real blockchain transfer happens
```

---

## 🔧 Troubleshooting

### "Insufficient Funds" Error
**Problem:** Trying to buy but don't have USDC

**Solution:** 
1. Get Mock USDC from the deployment
2. The deployer wallet has 1M USDC at address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
3. Use Hardhat console to transfer:
   ```javascript
   npx hardhat console --network localhost
   
   const usdc = await ethers.getContractAt("MockERC20", "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9");
   await usdc.transfer("YOUR_WALLET_ADDRESS", ethers.parseUnits("10000", 6)); // 10k USDC
   ```

### "Transaction Failed" When Buying
**Problem:** Didn't approve USDC spending

**Solution:**
- When buying, there's a popup asking to approve USDC
- Click "Approve" → Wait for transaction
- Then click "Buy" again

### Can't See Other Company's Listings
**Problem:** Both wallets are the same

**Solution:**
- Use **different MetaMask accounts** for each company
- Or use different browsers (Chrome + Firefox)
- Or use Incognito mode

### Blockchain State Reset
**Problem:** Hardhat node restarted, all data gone

**Solution:**
```bash
# Re-deploy contracts
npm run deploy:local

# Update frontend/.env.local with new addresses (they change on each deployment)
# OR just use the batch file which handles this
./run-dev.bat
```

---

## 📊 How to View Transactions

### On Blockchain:
- Hardhat node terminal shows all transactions
- Check transaction hash on local block explorer (if running one)

### In App:
- **Portfolio** page shows your holdings
- **Marketplace** page shows all active orders
- **Auctions** page shows live auctions
- Toast notifications confirm each transaction

---

## 🎓 Understanding the Flow

```
┌─────────────────────────────────────────────────────┐
│  COMPANY REGISTRATION                               │
│  1. Fill form → 2. Mint 5 NFTs → 3. Auto-approve   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  SELLING OPTIONS                                    │
│  ├─ Create Fixed-Price Order (instant sale)        │
│  └─ Create Auction (competitive bidding)           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  BUYING OPTIONS                                     │
│  ├─ Fill Sell Order (pay USDC, get CCT)           │
│  ├─ Place Auction Bid (compete with others)        │
│  └─ Post Buy Request (wait for seller)             │
└─────────────────────────────────────────────────────┘
```

### Smart Contract Flow:
1. **CarbonCreditNFT** - Mints credits as ERC721 NFTs
2. **CarbonCreditToken (CCT)** - Wraps NFTs into ERC20 for trading
3. **CarbonMarketplace** - Handles orders, auctions, settlements
4. **Mock USDC** - Payment token (6 decimals)

### Token Approvals Needed:
- **Selling**: Approve CCT to marketplace
- **Buying**: Approve USDC to marketplace
- **Wrapping**: Approve NFT to CCT contract

---

## 🏆 Success Checklist

After setup, you should be able to:
- [ ] Register a company and receive 5 credits automatically
- [ ] See credits in your portfolio
- [ ] Create a sell listing
- [ ] Switch to another wallet
- [ ] Register second company  
- [ ] See first company's listing in marketplace
- [ ] Buy credits with USDC (real transaction)
- [ ] See updated balances in both wallets
- [ ] Create and bid on auctions
- [ ] Finalize auction and see winner get credits

---

## 🆘 Need Help?

**Check Logs:**
```bash
# Backend logs
cd backend && npm run dev

# Frontend logs
cd frontend && npm run dev

# Blockchain logs
npx hardhat node
```

**Common Issues:**
1. **Port already in use** → Run `./run-dev.bat` (includes port cleanup)
2. **Contract addresses are 0x** → Deploy contracts: `npm run deploy:local`
3. **MetaMask shows wrong network** → Switch to Hardhat Local (Chain ID 31337)
4. **Transaction pending forever** → Reset MetaMask account (Settings → Advanced → Reset Account)

**Everything else working?**
- Check browser console for errors (F12)
- Check MetaMask for pending transactions
- Ensure Hardhat node is running
- Verify contract addresses in `.env.local`

---

**Enjoy your carbon credit marketplace! 🌱⛓️**
