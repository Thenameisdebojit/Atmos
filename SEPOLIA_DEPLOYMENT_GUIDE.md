# Sepolia Testnet Deployment Guide

## Prerequisites ✅

- [x] LINK tokens received on Sepolia (Transaction: 0xa9d6...e155)
- [x] Wallet with Sepolia ETH for gas fees
- [ ] Chainlink Functions Subscription created
- [ ] Etherscan API key (optional, for contract verification)

## Step-by-Step Deployment

### 1. Configure Environment Variables

Edit `.env` file and add your private key:

```bash
PRIVATE_KEY=your_wallet_private_key_here
```

**⚠️ IMPORTANT:** This should be the private key of the wallet that received the 25 LINK tokens.

**How to get your private key:**
- MetaMask: Settings → Security & Privacy → Show Private Key
- **NEVER share this with anyone or commit to git!**

### 2. Create Chainlink Functions Subscription

1. Visit: https://functions.chain.link/sepolia
2. Connect your wallet (the one with LINK tokens)
3. Click "Create Subscription"
4. Fund subscription with ~5-10 LINK tokens
5. Copy your Subscription ID

Update `.env`:
```bash
CHAINLINK_SUBSCRIPTION_ID=YOUR_SUBSCRIPTION_ID_HERE
```

### 3. Get Sepolia ETH for Gas

You need ~0.5-1 ETH on Sepolia for deployment gas fees.

**Sepolia Faucets:**
- https://sepoliafaucet.com/
- https://www.alchemy.com/faucets/ethereum-sepolia
- https://faucet.quicknode.com/ethereum/sepolia

### 4. Deploy Contracts

Run the deployment script:

```bash
npx hardhat run scripts/deploy/03_deploy_sepolia.js --network sepolia
```

**Expected output:**
```
🚀 Starting Sepolia deployment...
📍 Deploying from: 0xYourAddress
💰 Balance: 0.5 ETH

[1/6] Deploying CarbonCreditNFT...
✅ CarbonCreditNFT deployed to: 0x...

[2/6] Deploying CarbonCreditTokens...
✅ CCT-ICM deployed to: 0x...
✅ CCT-VCS deployed to: 0x...
✅ CCT-GS deployed to: 0x...

💵 Deploying Mock USDC...
✅ Mock USDC deployed to: 0x...

[3/6] Deploying CarbonMarketplace...
✅ CarbonMarketplace deployed to: 0x...

[4/6] Deploying Oracle Infrastructure...
✅ EmissionVerifier deployed to: 0x...
✅ RegistrySync deployed to: 0x...
✅ CarbonPriceOracle deployed to: 0x...

[5/6] Configuring Chainlink Functions...
✅ Configured EmissionVerifier
✅ Configured RegistrySync
✅ Configured CarbonPriceOracle

[6/6] Configuring roles...
✅ Granted ISSUER_ROLE to EmissionVerifier

✅ Sepolia deployment complete!
📄 Deployment data saved to deployments/sepolia.json
```

### 5. Add Consumer Contracts to Subscription

After deployment, go back to https://functions.chain.link/sepolia:

1. Select your subscription
2. Click "Add Consumer"
3. Add these three contract addresses (from deployment output):
   - EmissionVerifier: 0x...
   - RegistrySync: 0x...
   - CarbonPriceOracle: 0x...

### 6. Update Frontend Configuration

Edit `frontend/.env.local` with the deployed addresses:

```bash
# Copy from deployments/sepolia.json
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x...
NEXT_PUBLIC_CARBON_CREDIT_TOKEN=0x...  # Use VERRA_VCS address
NEXT_PUBLIC_CARBON_MARKETPLACE=0x...
NEXT_PUBLIC_CARBON_PRICE_ORACLE=0x...
NEXT_PUBLIC_EMISSION_VERIFIER=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x...         # Mock USDC address
```

**Quick update script:**
```javascript
// Read deployments/sepolia.json and update automatically
const fs = require('fs');
const deployment = JSON.parse(fs.readFileSync('deployments/sepolia.json'));

const envContent = `
NEXT_PUBLIC_CARBON_CREDIT_NFT=${deployment.contracts.CarbonCreditNFT}
NEXT_PUBLIC_CARBON_CREDIT_TOKEN=${deployment.contracts.CarbonCreditTokens.VERRA_VCS}
NEXT_PUBLIC_CARBON_MARKETPLACE=${deployment.contracts.CarbonMarketplace}
NEXT_PUBLIC_CARBON_PRICE_ORACLE=${deployment.contracts.CarbonPriceOracle}
NEXT_PUBLIC_EMISSION_VERIFIER=${deployment.contracts.EmissionVerifier}
NEXT_PUBLIC_USDC_ADDRESS=${deployment.contracts.USDC}
`;

console.log('Update your frontend/.env.local with:');
console.log(envContent);
```

### 7. Test the Deployment

Start your application:

```bash
# Run both backend and frontend
./run-dev.bat
```

**Test checklist:**
- [ ] Frontend connects to Sepolia network
- [ ] Can register a company profile
- [ ] Mock USDC balance shows correctly
- [ ] Can request verification (EmissionVerifier)
- [ ] Can create marketplace orders
- [ ] Can create auctions

### 8. Fund Test Accounts with Mock USDC

The deployment minted 100,000 USDC to your deployer address.

**Transfer USDC to test accounts:**

```javascript
// In Hardhat console or script
const usdc = await ethers.getContractAt("MockERC20", "0xYourUSDCAddress");
await usdc.transfer("0xTestAccount", ethers.parseUnits("1000", 6)); // 1000 USDC
```

### 9. Verify Contracts (Optional)

Get Etherscan API key: https://etherscan.io/apis

Update `.env`:
```bash
ETHERSCAN_API_KEY=your_api_key_here
```

Verify each contract:
```bash
npx hardhat verify --network sepolia DEPLOYED_ADDRESS [constructor args]
```

**Example:**
```bash
npx hardhat verify --network sepolia 0xMarketplaceAddress "0xUSDC" "0xCCT" "0xNFT"
```

## Troubleshooting

### "Insufficient funds for gas"
- Get more Sepolia ETH from faucets listed in Step 3

### "Cannot add consumer: Subscription not funded"
- Add more LINK to your subscription (minimum 2-5 LINK)

### "Transaction underpriced"
- Sepolia gas prices fluctuate. Wait a moment and retry
- Or increase gas in hardhat.config.js:
  ```javascript
  sepolia: {
    gasPrice: 30000000000, // 30 gwei
  }
  ```

### "Contract already deployed"
- If deployment fails midway, comment out completed sections in the script
- Or delete `deployments/sepolia.json` and start fresh

### Frontend shows "Missing Config"
- Ensure all addresses in `frontend/.env.local` are valid (not 0x)
- Restart frontend: Ctrl+C and re-run `./run-dev.bat`

## Next Steps After Deployment

1. **Multi-Company Testing:**
   - Use 2 different wallets in browser
   - Register Company A, get verification, wrap NFT to CCT
   - Create sell order or auction from Company A
   - Switch to Company B wallet, see listing, buy/bid
   - Verify USDC transfers and CCT balances update

2. **Chainlink Functions Testing:**
   - Submit verification request
   - Check Chainlink subscription for request activity
   - Monitor transaction on Sepolia Etherscan

3. **Production Preparation:**
   - Once tested on Sepolia, plan mainnet deployment
   - Estimate gas costs from Sepolia deployment
   - Secure proper API keys for oracles
   - Set up monitoring and alerts

## Resources

- **Sepolia Explorer:** https://sepolia.etherscan.io
- **Chainlink Functions:** https://functions.chain.link/sepolia
- **Sepolia Faucets:** https://sepoliafaucet.com
- **RainbowKit Chains:** https://www.rainbowkit.com/docs/chains
- **Our Deployment:** `deployments/sepolia.json`

---

**Need Help?** Check deployment logs in `deployments/sepolia.json` for all contract addresses.
