# Frontend-Backend Integration Guide

This guide explains how to connect the ATMOS frontend with the smart contracts and backend services.

## 1. Smart Contract Deployment & Integration

### Step 1: Deploy Smart Contracts

First, deploy all smart contracts to your target network (Polygon Mumbai for testnet):

```bash
cd ..
npm run deploy:mumbai
```

This will deploy:
- `CarbonCreditNFT.sol`
- `CarbonCreditToken.sol`
- `CarbonMarketplace.sol`
- `CarbonPriceOracle.sol`
- `EmissionVerifier.sol`

### Step 2: Record Deployment Addresses

After deployment, copy the contract addresses and update `.env.local`:

```env
NEXT_PUBLIC_CARBON_CREDIT_NFT=0x[deployed_address_from_tx]
NEXT_PUBLIC_CARBON_CREDIT_TOKEN=0x[deployed_address_from_tx]
NEXT_PUBLIC_CARBON_MARKETPLACE=0x[deployed_address_from_tx]
NEXT_PUBLIC_CARBON_PRICE_ORACLE=0x[deployed_address_from_tx]
NEXT_PUBLIC_EMISSION_VERIFIER=0x[deployed_address_from_tx]
```

### Step 3: Update Contract ABIs

Export full ABIs from Hardhat:

```bash
cd ..
npx hardhat typechain
```

Copy ABIs to `src/config/contracts.ts`:

```typescript
export const ABI_CARBON_NFT = require('../../../contracts/artifacts/CarbonCreditNFT.json').abi;
export const ABI_CARBON_MARKETPLACE = require('../../../contracts/artifacts/CarbonMarketplace.json').abi;
```

## 2. Web3 Wallet Integration

### Setup Wagmi Configuration

Create `src/config/wagmi.ts`:

```typescript
import { configureChains, createConfig } from 'wagmi';
import { polygon } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';

const { chains, publicClient } = configureChains(
  [polygon],
  [publicProvider()]
);

export const config = createConfig({
  autoConnect: true,
  publicClient,
});

export { chains };
```

### Wrap App with Wagmi Provider

Update `src/app/layout.tsx`:

```typescript
'use client';

import { WagmiConfig } from 'wagmi';
import { config } from '@/config/wagmi';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <WagmiConfig config={config}>
          {children}
        </WagmiConfig>
      </body>
    </html>
  );
}
```

## 3. Contract Write Functions

### Example: Place a Buy Order

Create `src/hooks/useMarketplace.ts`:

```typescript
import { useContractWrite, usePrepareContractWrite } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';
import { ABI_CARBON_MARKETPLACE } from '@/config/contracts';

export const useCreateBuyOrder = () => {
  const { config } = usePrepareContractWrite({
    address: CONTRACTS.carbonMarketplace,
    abi: ABI_CARBON_MARKETPLACE,
    functionName: 'createBuyOrder',
  });

  return useContractWrite(config);
};

// Usage in component:
function BuyOrderButton() {
  const { write: createBuyOrder, isLoading } = useCreateBuyOrder();

  const handleBuy = (amount: string, price: string) => {
    createBuyOrder?.({
      args: [
        ethers.parseUnits(amount),
        ethers.parseUnits(price, 6), // 6 decimals for USDC
        0, // no expiry
        false // KYC not required
      ],
    });
  };

  return <Button onClick={() => handleBuy('100', '18.5')} />;
}
```

### Example: Mint Carbon Credits

Create `src/hooks/useNFT.ts`:

```typescript
export const useMintCredit = () => {
  const { config } = usePrepareContractWrite({
    address: CONTRACTS.carbonCreditNFT,
    abi: ABI_CARBON_CREDIT_NFT,
    functionName: 'mintCredit',
  });

  return useContractWrite(config);
};
```

## 4. Contract Read Functions

### Access Real-Time Data

Create `src/hooks/useOracleData.ts`:

```typescript
import { useContractRead } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

export const useCarbonPrice = () => {
  const { data: price } = useContractRead({
    address: CONTRACTS.carbonPriceOracle,
    abi: ABI_PRICE_ORACLE,
    functionName: 'getLatestPrice',
    watch: true, // Real-time updates
  });

  return price ? Number(price) / 1e18 : 0;
};

export const useEmissionData = (companyAddress: string) => {
  const { data: emissions } = useContractRead({
    address: CONTRACTS.emissionVerifier,
    abi: ABI_EMISSION_VERIFIER,
    functionName: 'getCompanyEmissions',
    args: [companyAddress],
    watch: true,
  });

  return emissions;
};
```

### Use in Dashboard:

```typescript
// src/app/dashboard/page.tsx
function EmissionCard() {
  const emissions = useEmissionData(userAddress);
  const carbonPrice = useCarbonPrice();

  return (
    <Card>
      <p className="text-2xl font-bold">
        {emissions?.totalEmissions || 0}
      </p>
      <p>Carbon Intensity: {carbonPrice}/tonne</p>
    </Card>
  );
}
```

## 5. Event Listening & Real-Time Updates

### Listen to Contract Events

Create `src/hooks/useContractEvents.ts`:

```typescript
import { useContractEvent } from 'wagmi';
import { CONTRACTS } from '@/config/contracts';

export const useOrderFilled = () => {
  useContractEvent({
    address: CONTRACTS.carbonMarketplace,
    abi: ABI_CARBON_MARKETPLACE,
    eventName: 'OrderFilled',
    listener: (logs) => {
      console.log('Order filled:', logs);
      // Update UI with new order data
    },
  });
};

export const useCreditMinted = () => {
  useContractEvent({
    address: CONTRACTS.carbonCreditNFT,
    abi: ABI_CARBON_CREDIT_NFT,
    eventName: 'CreditMinted',
    listener: (logs) => {
      console.log('Credit minted:', logs);
      // Refresh chart data
    },
  });
};
```

### Real-Time Price Updates

```typescript
// src/components/PriceChart.tsx
function PriceChart() {
  const [prices, setPrices] = useState<PricePoint[]>([]);

  useCreditMinted();
  useOrderFilled();

  // Listen for price changes
  useContractRead({
    address: CONTRACTS.carbonPriceOracle,
    abi: ABI_PRICE_ORACLE,
    functionName: 'getPriceHistory',
    args: [7 * 24 * 3600], // Last 7 days
    watch: true,
    onSuccess: (data) => setPrices(data),
  });

  return (
    <ResponsiveContainer>
      <LineChart data={prices}>
        <Line dataKey="price" stroke="#22c55e" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## 6. Backend API Integration

### Setup API Client

Create `src/lib/api.ts`:

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
});

export const getCompanyEmissions = (companyId: string) => {
  return api.get(`/companies/${companyId}/emissions`);
};

export const getMarketData = () => {
  return api.get('/market/data');
};

export const submitKYC = (data: KYCData) => {
  return api.post('/kyc/submit', data);
};

export default api;
```

### Use in Components

```typescript
// src/app/dashboard/page.tsx
import { getMarketData } from '@/lib/api';
import { useAsync } from '@/hooks';

function Dashboard() {
  const { data: marketData, isLoading } = useAsync(() => getMarketData());

  return (
    <StatCard
      label="Market Price"
      value={`${marketData?.currentPrice}`}
      change={marketData?.priceChange24h}
    />
  );
}
```

## 7. Authentication & User Management

### Implement Wallet-Based Auth

Create `src/hooks/useAuth.ts`:

```typescript
import { useAccount, useSignMessage } from 'wagmi';
import { useUserStore } from '@/store';

export const useAuth = () => {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { setUser } = useUserStore();

  const authenticate = async () => {
    if (!address) return;

    // Sign message for verification
    const message = `Sign to authenticate on ATMOS: ${Date.now()}`;
    const signature = await signMessageAsync({ message });

    // Send to backend for verification
    const { data } = await api.post('/auth/verify', {
      address,
      message,
      signature,
    });

    setUser(data.user);
    return data.token;
  };

  return { authenticate, address };
};
```

## 8. Transaction Status Tracking

### Monitor Pending Transactions

```typescript
import { useWaitForTransaction } from 'wagmi';

function TradeConfirmation({ txHash }: { txHash: string }) {
  const { data, isLoading } = useWaitForTransaction({
    hash: txHash,
    onSuccess: (data) => {
      // Update portfolio
      refetchPortfolio();
      showSuccessNotification();
    },
  });

  return isLoading ? <LoadingSpinner /> : <SuccessCard />;
}
```

## 9. Error Handling

### Global Error Handler

```typescript
// src/lib/errorHandler.ts
export const handleContractError = (error: Error) => {
  if (error.message.includes('execution reverted')) {
    return 'Transaction failed. Check your input.';
  }
  if (error.message.includes('user rejected')) {
    return 'Transaction rejected by user.';
  }
  if (error.message.includes('insufficient funds')) {
    return 'Insufficient balance for this transaction.';
  }
  return 'An error occurred. Please try again.';
};
```

## 10. Deployment Checklist

- [ ] All contract addresses updated in `.env.local`
- [ ] ABIs exported and updated in `src/config/contracts.ts`
- [ ] Wagmi configured and provider added to layout
- [ ] All contract write functions implemented
- [ ] Event listeners setup for real-time updates
- [ ] Backend API endpoints integrated
- [ ] Authentication implemented
- [ ] Error handling tested
- [ ] Test with testnet (Mumbai)
- [ ] Deploy to production (Polygon mainnet)

## Testing Integration

### Test Buy Order Flow

```bash
# Start local blockchain (if using fork)
npx hardhat node

# In another terminal, start frontend
npm run dev

# Open http://localhost:3000/marketplace
# 1. Connect wallet
# 2. Search for a listing
# 3. Click "Buy"
# 4. Confirm transaction in wallet
# 5. Verify order appears in portfolio
```

### Test Real-Time Updates

```bash
# Monitor contract events
npx hardhat test --grep "OrderFilled"

# Open dashboard in browser
# Verify chart updates in real-time
```

## Troubleshooting

### Issue: "Contract not found at address"
**Solution**: Verify contract address in `.env.local` matches deployed address

### Issue: "Nonce too high"
**Solution**: Reset wallet in MetaMask settings

### Issue: "Gas estimation failed"
**Solution**: Check if contract function requires special approvals (ERC20, etc.)

---

For more details, see:
- [Smart Contracts Documentation](../../contracts)
- [Backend API Documentation](../../backend)
- [Wagmi Documentation](https://wagmi.sh)
