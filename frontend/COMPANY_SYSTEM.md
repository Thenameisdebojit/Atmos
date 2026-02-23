# 🏢 Company Registration & Carbon Credit Trading System

Complete documentation for the ATMOS company credit trading platform with registration, emissions tracking, and auction/sales system.

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Company Registration](#company-registration)
- [Company Dashboard](#company-dashboard)
- [Carbon Credit Features](#carbon-credit-features)
- [Smart Contract Integration](#smart-contract-integration)
- [Data Flow](#data-flow)
- [Setup & Configuration](#setup--configuration)

---

## System Overview

The ATMOS platform enables companies to:

✅ **Register** with emissions data (Scope 1, 2, 3)  
✅ **Track** their annual carbon footprint  
✅ **Request** carbon credits when emissions exceed their current holdings  
✅ **Buy** credits at fixed prices from the marketplace  
✅ **Sell** excess credits via auctions or at fixed prices  
✅ **Bid** on auction listings in real-time  
✅ **Retire** credits against their emissions  

---

## Company Registration

### The Process

1. **Browse to** `/company/register`
2. **Connect Wallet** - Required for company identification
3. **Fill Company Details**:
   - Company Name
   - Legal Entity ID (Tax ID, Registration Number)
   - Annual Emissions:
     - Scope 1: Direct emissions (owned facilities)
     - Scope 2: Indirect energy emissions (purchased electricity)
     - Scope 3: Indirect other emissions (supply chain, travel)
   - Email and Phone Contact

4. **Submit Registration** - Triggers blockchain transaction via EmissionVerifier contract
5. **Verifier Validation** - EmissionVerifier smart contract validates and sets verification status

### Registration Data On-Chain

```solidity
struct CompanyRegistry {
    address walletAddress;
    string companyName;
    string legalEntityId;
    uint256 scope1Emissions;  // tonnes CO2 (wei scaled)
    uint256 scope2Emissions;
    uint256 scope3Emissions;
    uint256 totalEmissions;
    string email;
    string phone;
    uint256 registrationDate;
    bool isVerified;
    uint256 approvalDeadline;
}
```

### Hook: `registerCompany()`

```typescript
const { registerCompany } = useContractInteraction();

const txHash = await registerCompany({
  companyName: 'TechCorp Inc',
  legalEntityId: 'US-2024-001',
  scope1Emissions: 500 * 1e18,    // 500 tonnes
  scope2Emissions: 300 * 1e18,
  scope3Emissions: 200 * 1e18,
  totalEmissions: 1000 * 1e18,
  email: 'contact@techcorp.com',
  phone: '+1 (555) 123-4567',
  walletAddress: address,
});
```

---

## Company Dashboard

### Route: `/company/dashboard`

**Features:**

- **Overview Tab**
  - Company profile information
  - Verification status badge
  - Contact details
  - Quick action buttons
  - Status indicators (compliant, credits needed, etc.)

- **Emissions Tab**
  - Monthly emissions trend chart
  - Scope 1/2/3 breakdown with progress bars
  - Historical data visualization
  - Emissions patterns

- **Credits Tab**
  - List of owned carbon credits
  - Credit details (methodology, vintage year, amount)
  - Available quantity tracking
  - Retirement status

- **Requests Tab**
  - Pending credit requests
  - Request status and progress
  - Deadline information
  - Quick buy links for remaining amounts

### Key Metrics

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| **Total Emissions** | Scope 1 + 2 + 3 | Compliance baseline |
| **Available Credits** | Sum of owned credits | Coverage available |
| **Credits Needed** | Max(0, Total - Available) | Gap to fill |
| **Coverage %** | (Available / Total) × 100 | Compliance status |

### Hook: `getCompanyData()`

```typescript
const { getCompanyData } = useContractInteraction();

const companyData = await getCompanyData(userAddress);
// Returns: {
//   name: string,
//   legalId: string,
//   scope1: number,
//   scope2: number,
//   scope3: number,
//   credits: number,
//   verified: boolean
// }
```

---

## Carbon Credit Features

### 1. Credit Requests System

#### Submit Request

**Route:** `/credit-requests` (tab: "Submit Request")

Companies can request specific amounts of credits:

```typescript
const { submitCreditRequest } = useContractInteraction();

await submitCreditRequest({
  creditAmount: 500 * 1e18,          // Need 500 tonnes
  maxPricePerTonne: 25 * 1e18,       // Pay max $25/tonne
  deadline: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,  // 30 days
});
```

**Request Data On-Chain:**

```solidity
struct CreditRequest {
    uint256 requestId;
    address requester;
    uint256 amountNeeded;
    uint256 maxPrice;
    uint256 deadline;
    uint256 amountFilled;
    bool isFulfilled;
}
```

#### Browse & Match

**Route:** `/credit-requests` (tab: "Browse Market")

- View all available credits from sellers
- Two sale types:
  - **Fixed Price**: Immediate purchase at listed price
  - **Auction**: Competitive bidding
- Filter by price, methodology, seller
- Instant purchase for fixed-price credits

#### My Requests Tab

View submitted requests with:
- Total amount requested
- Amount already filled
- Remaining amount needed
- Deadline countdown
- Purchase status progress bar

### 2. Fixed-Price Sales

**Route:** `/sell-credits`

Companies with excess credits can sell at fixed prices:

```typescript
const { listCreditsForSale } = useContractInteraction();

await listCreditsForSale({
  creditIds: ['1', '2', '3'],      // Credit token IDs
  amount: 250 * 1e18,              // 250 tonnes
  pricePerTonne: 22 * 1e18,        // $22/tonne
});
```

**Buyer Interaction:**

```typescript
const { buyCreditsFixedPrice } = useContractInteraction();

await buyCreditsFixedPrice({
  creditId: '1',
  amount: 100 * 1e18,            // 100 tonnes
  pricePerTonne: 22 * 1e18,      // $22/tonne
  // Send payment value = 100 * 22 = $2200
});
```

### 3. Auction System

**Route:** `/auctions` & `/sell-credits` (auction tab)

Companies can auction credits to highest bidder:

```typescript
const { createAuction } = useContractInteraction();

await createAuction({
  creditIds: ['1', '2'],
  startPrice: 20 * 1e18,         // Starting $20/tonne
  endTime: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
});
```

**Auction Features:**
- Live bidding with countdown timer
- Real-time highest bid tracking
- Bid history and bidder addresses
- Automatic winner determination
- Gas-efficient bid handling

---

## Smart Contract Integration

### Required Contract Functions

#### EmissionVerifier Contract

```solidity
// Company registration and verification
function registerCompany(
    string memory name,
    string memory legalId,
    uint256 scope1,
    uint256 scope2,
    uint256 scope3,
    string memory email,
    string memory phone
) public returns (bool);

// Get company data
function getCompanyData(address company) 
    public view returns (
        string memory name,
        string memory legalId,
        uint256 scope1,
        uint256 scope2,
        uint256 scope3,
        uint256 credits,
        bool verified
    );

// Verify company registration
function verifyCompany(address company) 
    public onlyVerifier returns (bool);

// Track emissions updates
function updateEmissions(
    address company,
    uint256 scope1,
    uint256 scope2,
    uint256 scope3
) public onlyOracle returns (bool);
```

#### CarbonMarketplace Contract

```solidity
// Credit requests
function submitCreditRequest(
    uint256 amount,
    uint256 maxPrice,
    uint256 deadline
) public returns (uint256 requestId);

// Fixed price sales
function listCreditsForSale(
    uint256[] memory creditIds,
    uint256 amount,
    uint256 pricePerTonne
) public returns (uint256 listingId);

function buyCreditsFixedPrice(
    uint256 creditId,
    uint256 amount,
    uint256 pricePerTonne
) public payable returns (bool);

// Auctions
function createAuction(
    uint256[] memory creditIds,
    uint256 startPrice,
    uint256 endTime
) public returns (uint256 auctionId);

function placeBid(uint256 auctionId, uint256 bidAmount) 
    public payable returns (bool);

function finalizeAuction(uint256 auctionId) 
    public returns (bool);
```

---

## Data Flow

### Company Registration Flow

```
User fills form
    ↓
Input validation (client-side)
    ↓
Connect wallet via RainbowKit
    ↓
Call registerCompany() hook
    ↓
SmartContract: EmissionVerifier.registerCompany()
    ↓
Emit CompanyRegistered event
    ↓
Show success toast + redirect to dashboard
    ↓
Company data cached locally
```

### Credit Request Flow

```
Company submits request
    ↓
Specify: amount, max price, deadline
    ↓
Call submitCreditRequest() hook
    ↓
SmartContract: CarbonMarketplace.submitCreditRequest()
    ↓
Request stored with ID
    ↓
Listed on marketplace for sellers
    ↓
Other companies can view & fulfill
```

### Fixed-Price Purchase Flow

```
Buyer browses available credits
    ↓
Sees fixed-price listing + price per tonne
    ↓
Clicks "Buy Now"
    ↓
Call buyCreditsFixedPrice() hook with total amount
    ↓
SmartContract: Transfer NFTs + record transaction
    ↓
Emit CreditTransferred event
    ↓
Buyer receives credits in portfolio
    ↓
Seller receives payment
```

### Auction Flow

```
Seller lists credits for auction
    ↓
Set start price and end time
    ↓
SmartContract: createAuction()
    ↓
Auction listed publicly with countdown
    ↓↓
[Multiple bidders place bids]
    ↓↓
SmartContract: placeBid() [tracks highest bid]
    ↓↓
Real-time updates to UI
    ↓
Auction deadline reached
    ↓
Call finalizeAuction()
    ↓
Credits transfer to highest bidder
    ↓
Previous bids refunded
```

---

## Setup & Configuration

### 1. Update Environment Variables

In `.env.local`:

```env
NEXT_PUBLIC_EMISSION_VERIFIER=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
NEXT_PUBLIC_CARBON_MARKETPLACE=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 2. Deploy Updated Contracts

```bash
# Deploy EmissionVerifier with company registry
npx hardhat run scripts/deploy/01_deploy_local.js --network hardhat

# Verify and get addresses
npx hardhat verify --network mumbai <ADDRESS> <CONSTRUCTOR_ARGS>
```

### 3. Test Company Registration

```bash
# 1. Go to http://localhost:3001/company/register
# 2. Connect MetaMask with Hardhat local account
# 3. Fill company details
# 4. Submit and sign transaction
# 5. Verify emissions on-chain:
```

```bash
# In hardhat console
const company = await emissionVerifier.getCompanyData('0x...')
console.log(company)
```

### 4. Test Credit Trading

```javascript
// Buy Credits at Fixed Price
const tx = await marketplace.buyCreditsFixedPrice(1, 100n * 10n**18n, 22n * 10n**18n, {
  value: 2200n * 10n**18n  // $2200
});

// Create Auction
const auctionTx = await marketplace.createAuction([1, 2], 20n * 10n**18n, Math.floor(Date.now() / 1000) + 604800);

// Place Bid
const bidTx = await marketplace.placeBid(1, 25n * 10n**18n, { value: 25n * 10n**18n });
```

---

## Key Features Summary

| Feature | Route | Smart Contract | Status |
|---------|-------|---|--------|
| **Company Register** | `/company/register` | EmissionVerifier | ✅ Ready |
| **View Dashboard** | `/company/dashboard` | EmissionVerifier | ✅ Ready |
| **Request Credits** | `/credit-requests` | CarbonMarketplace | ✅ Ready |
| **Buy Fixed Price** | `/credit-requests` | CarbonMarketplace | ✅ Ready |
| **Sell Credits** | `/sell-credits` | CarbonMarketplace | ✅ Ready |
| **Create Auction** | `/sell-credits` (auction) | CarbonMarketplace | ✅ Ready |
| **Bid Auctions** | `/auctions` | CarbonMarketplace | ✅ Ready |

---

## Next Steps

1. **Deploy Smart Contracts** with new company functions
2. **Configure .env.local** with contract addresses
3. **Test Company Registration** E2E
4. **Test Credit Transactions** with real data
5. **Monitor Events** for real-time updates
6. **Add Analytics** dashboard for company metrics
7. **Implement Notifications** for requests/bids/sales
8. **Add Compliance Reports** generation

---

**Status:** 🟢 READY FOR TESTING

All frontend pages and hooks are implemented and ready to integrate with smart contracts. The system supports:
- Company registration with emissions tracking
- Credit request matching
- Dual sales model (fixed-price + auction)
- Real-time bidding
- Blockchain verification

Deploy contracts and update `.env.local` to activate the live integration!
