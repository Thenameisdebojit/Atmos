# 🔧 Fixed: "Failed to Mint Credit" Error

## What Was Wrong?
The previous implementation required `ISSUER_ROLE` to mint credits, but regular users don't have that role. 

## What Changed?
✅ Added a **public function** `registerAndClaimCredits()` that **anyone can call**
✅ Each address can claim **5 free credits once**  
✅ No special permissions needed - just connect your wallet!

---

## 🚀 How to Test (Quick Steps)

### Option 1: Fresh Start 

```bash
# Terminal 1: Start blockchain
npx hardhat node

# Terminal 2: Deploy contracts (wait for blockchain to be ready)
npm run deploy:local

# Terminal 3: Start services
./run-dev.bat
```

### Option 2: Already Running?

If you already have Hardhat node running:

```bash
# Just redeploy contracts
npm run deploy:local

# Stop and restart frontend (Ctrl+C then)
./run-dev.bat
```

---

## ✅ Test Registration Now

### Step 1: Open App
- Go to http://localhost:3001
- Click **"Connect"** in top right
- Choose MetaMask

### Step 2: Register Company
- Go to **Company Registration** page
- Fill out the form:
  - Company Name: "Test Corp"
  - Legal ID: "123456"
  - Email: test@example.com
  - Phone: +1234567890
  - (Emissions are optional)
- Click **"Register & Get 5 Free Credits"**

### Step 3: Approve Transactions
You'll see 2 MetaMask popups:

**1st Transaction: Claim Credits**
- Function: `registerAndClaimCredits()`
- This mints 5 NFTs to your wallet
- Click "Confirm"

**2nd Transaction: Approve for Trading**
- Function: `setApprovalForAll()`
- This allows the CCT contract to wrap your NFTs
- Click "Confirm"

### Step 4: Success! 🎉
- You'll see: "Credits claimed!"
- Then: "Credits approved!"
- Redirect to dashboard
- Check your **Portfolio** - you'll have 5 carbon credits!

---

## 🧪 Test Multi-Company Trading

### Company A (Seller):
1. Register as above → Get 5 credits
2. Go to **Sell Credits** page
3. Create listing: 2 credits @ $50/tonne
4. Approve CCT spending
5. Order created!

### Company B (Buyer):
1. **Use different wallet** (Account #2 in MetaMask)
2. Register as Company B → Get 5 credits  
3. Get USDC:
   ```javascript
   // In Hardhat console
   npx hardhat console --network localhost
   
   const usdc = await ethers.getContractAt("MockERC20", "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9");
   await usdc.transfer("YOUR_WALLET_ADDRESS", ethers.parseUnits("10000", 6));
   ```
4. Go to **Marketplace** → See Company A's listing
5. Click "Buy Now" → Approve USDC → Buy!
6. ✅ **Real transfer:** A gets USDC, B gets CCT!

---

## 🐛 Troubleshooting

### "Already claimed registration credits"
**Cause:** You already called `registerAndClaimCredits()` with this wallet

**Solution:** 
- Use a different wallet address
- Or reset: Deploy fresh contracts with `npm run deploy:local`

### "Transaction failed" 
**Cause:** Hardhat node might have reset

**Solution:**
```bash
# Restart everything
npx hardhat node  # Terminal 1
npm run deploy:local  # Terminal 2 (wait for node to be ready)
./run-dev.bat  # Terminal 3
```

### Still showing "Failed to mint credit"
**Cause:** Frontend using old contract deployment

**Solution:**
1. Stop frontend (Ctrl+C)
2. Redeploy: `npm run deploy:local`
3. Restart: `./run-dev.bat`
4. Hard refresh browser (Ctrl+Shift+R)
5. Clear MetaMask transactions (Settings → Advanced → Clear activity)

---

## 📋 What Happens Behind the Scenes

```solidity
function registerAndClaimCredits() external {
    // ✅ Check: Not already claimed
    require(!hasRegistered[msg.sender], "Already claimed");
    
    // ✅ Mark as registered
    hasRegistered[msg.sender] = true;
    
    // ✅ Mint 5 NFTs to msg.sender
    for (uint i = 0; i < 5; i++) {
        _safeMint(msg.sender, tokenId);
        // Create credit metadata...
    }
    
    // ✅ Emit event
    emit CreditBatchMinted(...);
}
```

**Key Points:**
- ✅ **Public function** - anyone can call
- ✅ **One-time only** per address
- ✅ **No roles required**
- ✅ **Auto-mints to caller**
- ✅ **Creates 5 NFTs** with metadata

---

## 🎯 Quick Test Checklist

- [ ] Hardhat node running (`npx hardhat node`)
- [ ] Contracts deployed (`npm run deploy:local`)
- [ ] Frontend running (`./run-dev.bat`)
- [ ] MetaMask connected to localhost:8545
- [ ] Registered company → Got 5 credits
- [ ] Approved for trading
- [ ] Can see credits in Portfolio
- [ ] Can create sell listing
- [ ] Second wallet can buy from first wallet

---

**Fixed and ready to test!** 🚀

Just run these 3 commands in order:
```bash
npx hardhat node             # Terminal 1
npm run deploy:local         # Terminal 2  
./run-dev.bat                # Terminal 3
```

Then register a company and claim your 5 free credits! 🌱
