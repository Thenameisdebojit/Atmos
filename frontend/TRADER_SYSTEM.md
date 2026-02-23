# ATMOS Trader System

## Overview
The **Trader System** is designed for individual investors and traders who want to trade carbon credits for profit, without the emissions tracking requirements of companies. Traders can buy credits at lower prices, hold them in a portfolio, and sell them at higher prices.

---

## Features

### 1. **Trader Registration** (`/trader/register`)
- **Profile Information:**
  - Trader Name
  - Email Address  
  - Phone Number
  - Country
  - Investment Goals (optional)
  - Trading Experience Level: Beginner, Intermediate, Advanced, Expert
  
- **Benefits:**
  - No emissions tracking required
  - Quick registration process
  - Investment-focused interface
  
- **Page Location:** `src/app/trader/register/page.tsx`

### 2. **Trader Dashboard** (`/trader/dashboard`)
- **Portfolio Overview:**
  - Total Portfolio Value
  - Total Invested Capital
  - Total Profit/Loss
  - Number of Credits Owned
  
- **4 Dashboard Tabs:**
  1. **Overview:** Portfolio growth charts, quick actions, market price tracker
  2. **Portfolio:** List of all owned credits with values and details
  3. **Trading:** Trading history (coming soon)
  4. **Analytics:** P&L charts, ROI metrics (coming soon)
  
- **Quick Actions:**
  - Buy Credits (→ Marketplace)
  - Sell Credits (→ Sell Credits Page)
  - View Auctions
  - View Portfolio
  
- **Visual Components:**
  - Portfolio Value Growth Chart (Area Chart)
  - Carbon Price Tracker (Line Chart)
  - Asset Allocation Pie Chart
  - Account Information Card
  
- **Page Location:** `src/app/trader/dashboard/page.tsx`

---

## Smart Contract Integration

### Hooks Added to `useContractInteraction.ts`

#### 1. **registerTrader()**
```typescript
const registerTrader = async (traderData: {
  traderName: string;
  email: string;
  phone: string;
  country: string;
  investmentGoal?: string;
  tradingExperience: string;
  walletAddress: string;
}) => Promise<string | null>
```

**Contract Function:**
```solidity
function registerTrader(
  string memory name, 
  string memory email, 
  string memory phone, 
  string memory country
) public returns (bool)
```

**Usage:**
```typescript
const hash = await registerTrader({
  traderName: 'John Doe',
  email: 'john@example.com',
  phone: '+1 555-0123',
  country: 'United States',
  tradingExperience: 'intermediate',
  walletAddress: address
});
```

#### 2. **getTraderData()**
```typescript
const getTraderData = async (traderAddress: string) => Promise<{
  name: string;
  email: string;
  phone: string;
  country: string;
  walletAddress: string;
  registrationDate: number;
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  creditCount: number;
} | null>
```

**Contract Function:**
```solidity
function getTraderData(address trader) view returns (
  string name, 
  string email, 
  string phone, 
  string country, 
  uint256 registrationDate, 
  bool isActive
)
```

**Usage:**
```typescript
const traderData = await getTraderData('0x123...');
```

---

## Navigation Updates

### Header Component (`src/components/Header.tsx`)
Added two separate sections:

**Companies Section:**
- Register
- Dashboard
- Credits (Credit Requests)
- Sell

**Traders Section:**
- Register
- Dashboard

Both sections are clearly separated with labels for easy navigation.

---

## Landing Page Updates

### New Trader Section (`src/app/page.tsx`)
Added a dedicated **"For Individual Traders & Investors"** section featuring:

**Benefits Highlighted:**
- 💹 Investment Focused - Trade like stocks
- 📈 Portfolio Analytics - Real-time ROI tracking
- 🎯 Experience Levels - Beginner to expert
- 🛒 Easy Trading - Simple buy/sell process
- 💰 Profit Tracking - Monitor gains/losses
- 🔒 Secure & Transparent - Blockchain verified

**Call-to-Action Card:**
- Green-themed design (vs orange for companies)
- "Register as Trader" button (green)
- "View Trader Dashboard" button
- Clear messaging about no emissions tracking needed

---

## Differences: Traders vs Companies

| Feature | Traders | Companies |
|---------|---------|-----------|
| **Purpose** | Investment & Profit | Compliance & Emissions |
| **Registration Data** | Name, email, experience | Legal ID, emissions data |
| **Dashboard Focus** | Portfolio, P&L, ROI | Emissions, compliance, credits |
| **Emissions Tracking** | ❌ Not required | ✅ Scope 1, 2, 3 required |
| **Primary Actions** | Buy low, sell high | Request credits, offset |
| **UI Theme** | Green (investment) | Orange (enterprise) |
| **Target Users** | Individual investors | Businesses, enterprises |

---

## User Flow

### Trader Registration Flow
1. Visit `/trader/register`
2. Connect wallet (MetaMask/WalletConnect)
3. Fill registration form:
   - Personal info (name, email, phone, country)
   - Trading profile (experience level, investment goals)
4. Submit to blockchain
5. Redirect to `/trader/dashboard`

### Trading Flow
1. **Buy Credits:**
   - Visit `/marketplace` or `/auctions`
   - Browse available credits
   - Purchase with fixed price or bid in auction
   - Credits added to portfolio

2. **View Portfolio:**
   - Dashboard shows all owned credits
   - Real-time value calculation
   - P&L tracking per credit

3. **Sell Credits:**
   - Visit `/sell-credits`
   - List credits for fixed price or auction
   - Receive proceeds after sale

---

## Technical Stack

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.3
- **Styling:** Tailwind CSS
- **Charts:** Recharts 2.10
- **Web3:** Wagmi, Viem, RainbowKit
- **State:** Zustand

### Smart Contracts
- **EmissionVerifier.sol:** Trader registration functions
- **CarbonMarketplace.sol:** Trading functions (shared with companies)
- **CarbonCreditNFT.sol:** Credit ownership (shared)

---

## Pages Summary

### Created Pages
1. **`src/app/trader/register/page.tsx`** (312 lines)
   - Registration form with validation
   - Wallet connection guard
   - Benefits showcase
   
2. **`src/app/trader/dashboard/page.tsx`** (400+ lines)
   - 4-tab dashboard
   - Portfolio charts and analytics
   - Quick action buttons
   - Account information

### Modified Files
1. **`src/hooks/useContractInteraction.ts`**
   - Added `registerTrader()` function
   - Added `getTraderData()` function
   
2. **`src/components/Header.tsx`**
   - Added Companies section
   - Added Traders section
   - Improved navigation structure
   
3. **`src/app/page.tsx`**
   - Added Trader Features section
   - Green-themed CTA card
   - Investment-focused messaging

---

## Next Steps (Future Enhancements)

### Phase 1: Analytics
- [ ] Trading history tab with transaction log
- [ ] Advanced analytics with profit/loss charts
- [ ] Price alerts and notifications
- [ ] ROI calculator per credit

### Phase 2: Social Features
- [ ] Leaderboard (top traders)
- [ ] Public trader profiles
- [ ] Copy trading functionality
- [ ] Trading signals and tips

### Phase 3: Advanced Trading
- [ ] Limit orders and stop-loss
- [ ] Automated trading strategies
- [ ] Portfolio rebalancing tools
- [ ] Risk management features

### Phase 4: Education
- [ ] Trading tutorials for beginners
- [ ] Market analysis reports
- [ ] Carbon credit education hub
- [ ] Demo trading mode

---

## Testing

### Manual Testing Checklist
- [ ] Trader registration form validation
- [ ] Wallet connection on both pages
- [ ] Navigation links work correctly
- [ ] Dashboard loads trader data
- [ ] Charts render properly
- [ ] Quick action buttons navigate correctly
- [ ] Responsive design on mobile
- [ ] Portfolio tab displays credits

### Integration Testing
- [ ] `registerTrader()` writes to blockchain
- [ ] `getTraderData()` reads correct data
- [ ] Credit purchases update portfolio
- [ ] Sales reduce credit count
- [ ] P&L calculations accurate

---

## Developer Notes

### Mock Data (Temporary)
Currently using mock data in trader dashboard for:
- `totalInvested: 5000`
- `currentValue: 6200`
- `totalProfit: 1200`
- `creditCount: 250`
- Price history charts
- Asset allocation data

**Replace with real contract data when available.**

### Smart Contract Requirements
The following contract functions need to be implemented:
- `registerTrader()` in EmissionVerifier.sol
- `getTraderData()` view function
- Optional: Trading statistics (volume, count, etc.)
- Optional: Portfolio value calculation helper

---

## Support

For issues or questions:
- Check [QUICKSTART.md](../QUICKSTART.md) for setup
- See [COMPANY_SYSTEM.md](./COMPANY_SYSTEM.md) for company features
- Review [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for Web3 setup

---

**Last Updated:** 2024
**Version:** 1.0
**Status:** ✅ Trader Registration & Dashboard Complete
