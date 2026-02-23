const isHardhat =
  process.env.NEXT_PUBLIC_NETWORK === 'hardhat' ||
  process.env.NEXT_PUBLIC_CHAIN_ID === '31337';

// Fallback addresses (Hardhat deterministic - VERRA_VCS is the marketplace token)
const LOCAL_ADDRESSES = {
  carbonCreditNFT: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  carbonCreditToken: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0', // VERRA_VCS - marketplace trades this token
  carbonMarketplace: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
  carbonPriceOracle: '0x610178dA211FEF7D417bC0e6FeD39F05609AD788',
  emissionVerifier: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  usdc: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
} as const;

const normalizeAddress = (value?: string) => {
  if (!value || value === '0x') return '';
  return value;
};

const resolveAddress = (envValue?: string, fallback?: string) => {
  const resolved = normalizeAddress(envValue) || fallback || '0x';
  return resolved as `0x${string}`;
};

// Contract addresses - UPDATE THESE AFTER DEPLOYMENT
export const CONTRACTS = {
  carbonCreditNFT: resolveAddress(
    process.env.NEXT_PUBLIC_CARBON_CREDIT_NFT,
    isHardhat ? LOCAL_ADDRESSES.carbonCreditNFT : undefined
  ),
  carbonCreditToken: resolveAddress(
    process.env.NEXT_PUBLIC_CARBON_CREDIT_TOKEN,
    isHardhat ? LOCAL_ADDRESSES.carbonCreditToken : undefined
  ),
  carbonMarketplace: resolveAddress(
    process.env.NEXT_PUBLIC_CARBON_MARKETPLACE,
    isHardhat ? LOCAL_ADDRESSES.carbonMarketplace : undefined
  ),
  carbonPriceOracle: resolveAddress(
    process.env.NEXT_PUBLIC_CARBON_PRICE_ORACLE,
    isHardhat ? LOCAL_ADDRESSES.carbonPriceOracle : undefined
  ),
  emissionVerifier: resolveAddress(
    process.env.NEXT_PUBLIC_EMISSION_VERIFIER,
    isHardhat ? LOCAL_ADDRESSES.emissionVerifier : undefined
  ),
  usdc: resolveAddress(
    process.env.NEXT_PUBLIC_USDC_ADDRESS,
    isHardhat ? LOCAL_ADDRESSES.usdc : undefined
  ),
} as const;

// Chain configuration
export const CHAIN_CONFIG = {
  id: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '137', 10),
  name: 'Polygon',
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com',
  blockExplorer: 'https://polygonscan.com',
} as const;

// Minimal ABIs for contract interactions
export const ABI_CARBON_CREDIT_NFT = [
  {
    name: 'mintCredit',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'projectId', type: 'string' },
      { name: 'projectName', type: 'string' },
      { name: 'serialNumber', type: 'string' },
      { name: 'methodology', type: 'string' },
      { name: 'co2Tonnes', type: 'uint256' },
      { name: 'vintageYear', type: 'uint256' },
      { name: 'geography', type: 'string' },
      { name: 'oracleProofHash', type: 'bytes32' },
      { name: 'satelliteDataCID', type: 'string' },
      { name: 'tokenURI', type: 'string' },
    ],
    outputs: [{ name: 'tokenId', type: 'uint256' }],
  },
  {
    name: 'retireCredit',
    type: 'function',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'reason', type: 'string' },
    ],
  },
  {
    name: 'totalMintedTonnes',
    type: 'function',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'totalRetiredTonnes',
    type: 'function',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    name: 'CreditMinted',
    type: 'event',
    inputs: [
      { indexed: true, name: 'tokenId', type: 'uint256' },
      { indexed: true, name: 'projectId', type: 'string' },
      { indexed: true, name: 'recipient', type: 'address' },
      { indexed: false, name: 'co2Tonnes', type: 'uint256' },
      { indexed: false, name: 'methodology', type: 'string' },
    ],
  },
] as const;

export const ABI_CARBON_MARKETPLACE = [
  {
    name: 'createBuyOrder',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'pricePerTonne', type: 'uint256' },
      { name: 'expiresIn', type: 'uint256' },
      { name: 'requiresKYC_', type: 'bool' },
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }],
  },
  {
    name: 'createSellOrder',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'pricePerTonne', type: 'uint256' },
      { name: 'expiresIn', type: 'uint256' },
      { name: 'requiresKYC_', type: 'bool' },
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }],
  },
  {
    name: 'fillOrder',
    type: 'function',
    inputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    name: 'createAuction',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'startPrice', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
    ],
    outputs: [{ name: 'auctionId', type: 'uint256' }],
  },
  {
    name: 'placeBid',
    type: 'function',
    inputs: [
      { name: 'auctionId', type: 'uint256' },
      { name: 'bidAmount', type: 'uint256' },
    ],
  },
  {
    name: 'finalizeAuction',
    type: 'function',
    inputs: [{ name: 'auctionId', type: 'uint256' }],
  },
  {
    name: 'cancelAuction',
    type: 'function',
    inputs: [{ name: 'auctionId', type: 'uint256' }],
  },
  {
    name: 'cancelOrder',
    type: 'function',
    inputs: [{ name: 'orderId', type: 'uint256' }],
  },
  {
    name: 'addLiquidity',
    type: 'function',
    inputs: [
      { name: 'carbonAmount', type: 'uint256' },
      { name: 'stableAmount', type: 'uint256' },
    ],
  },
  {
    name: 'orders',
    type: 'function',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'trader', type: 'address' },
      { name: 'isBuyOrder', type: 'bool' },
      { name: 'amount', type: 'uint256' },
      { name: 'pricePerTonne', type: 'uint256' },
      { name: 'filled', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'requiresKYC', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getOrder',
    type: 'function',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [
      { name: 'orderId', type: 'uint256' },
      { name: 'trader', type: 'address' },
      { name: 'isBuyOrder', type: 'bool' },
      { name: 'amount', type: 'uint256' },
      { name: 'pricePerTonne', type: 'uint256' },
      { name: 'filled', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
      { name: 'requiresKYC', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getUserOrders',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    name: 'getAuction',
    type: 'function',
    inputs: [{ name: 'auctionId', type: 'uint256' }],
    outputs: [
      { name: 'auctionId', type: 'uint256' },
      { name: 'seller', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'startPrice', type: 'uint256' },
      { name: 'highestBid', type: 'uint256' },
      { name: 'highestBidder', type: 'address' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getUserAuctions',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    name: 'OrderCreated',
    type: 'event',
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'trader', type: 'address' },
      { indexed: false, name: 'isBuyOrder', type: 'bool' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'pricePerTonne', type: 'uint256' },
    ],
  },
  {
    name: 'OrderFilled',
    type: 'event',
    inputs: [
      { indexed: true, name: 'orderId', type: 'uint256' },
      { indexed: true, name: 'taker', type: 'address' },
      { indexed: false, name: 'amountFilled', type: 'uint256' },
      { indexed: false, name: 'totalCost', type: 'uint256' },
    ],
  },
  {
    name: 'AuctionCreated',
    type: 'event',
    inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'seller', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'startPrice', type: 'uint256' },
      { indexed: false, name: 'endTime', type: 'uint256' },
    ],
  },
  {
    name: 'BidPlaced',
    type: 'event',
    inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'bidder', type: 'address' },
      { indexed: false, name: 'bidAmount', type: 'uint256' },
    ],
  },
  {
    name: 'AuctionFinalized',
    type: 'event',
    inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'winningBid', type: 'uint256' },
    ],
  },
  {
    name: 'AuctionCancelled',
    type: 'event',
    inputs: [
      { indexed: true, name: 'auctionId', type: 'uint256' },
    ],
  },
] as const;
