'use client';

import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
  braveWallet,
  trustWallet,
  rabbyWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { configureChains, createConfig } from 'wagmi';
import { polygon, polygonMumbai, hardhat, sepolia } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';

// Configure chains based on environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Create a custom Hardhat chain configuration if needed
const localHardhat = {
  ...hardhat,
  id: 31337,
  name: 'Hardhat Local',
  network: 'hardhat',
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
    public: {
      http: ['http://127.0.0.1:8545'],
    },
  },
};

const network = process.env.NEXT_PUBLIC_NETWORK || (isDevelopment ? 'hardhat' : 'sepolia');

const getTargetChains = () => {
  switch (network) {
    case 'sepolia':
      return [sepolia];
    case 'mumbai':
      return [polygonMumbai];
    case 'polygon':
      return [polygon];
    case 'hardhat':
    default:
      return isDevelopment ? [localHardhat] : [sepolia];
  }
};

// Select chains based on environment
const targetChains = getTargetChains();

// Configure chains with providers
const { chains, publicClient } = configureChains(
  targetChains as any,
  [publicProvider()]
);

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id';
const appName = 'ATMOS Carbon Credit Marketplace';

// Explicit multi-wallet list: Connect modal will show all of these so users can choose.
const walletGroups = [
  {
    groupName: 'Popular',
    wallets: [
      metaMaskWallet({ chains, projectId }),
      rainbowWallet({ chains, projectId }),
      coinbaseWallet({ appName, chains }),
      walletConnectWallet({ chains, projectId }),
      braveWallet({ chains }),
      injectedWallet({ chains }),
    ],
  },
  {
    groupName: 'More options',
    wallets: [
      trustWallet({ chains, projectId }),
      rabbyWallet({ chains }),
    ],
  },
];

let resolvedConnectors: ReturnType<typeof connectorsForWallets> | any[] = [];
try {
  const connectors = connectorsForWallets(walletGroups);
  resolvedConnectors = typeof connectors === 'function' ? connectors() : connectors;
} catch (err) {
  console.warn('[ATMOS] Wallet connector init failed (likely a conflicting browser extension). Falling back to safe defaults.', err);
  // Fallback: only walletConnect + coinbase (no injected provider)
  try {
    const fallback = connectorsForWallets([
      {
        groupName: 'Available',
        wallets: [
          walletConnectWallet({ chains, projectId }),
          coinbaseWallet({ appName, chains }),
        ],
      },
    ]);
    resolvedConnectors = typeof fallback === 'function' ? fallback() : fallback;
  } catch {
    // absolute fallback: empty
  }
}

// Create wagmi config
export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: resolvedConnectors as any,
  publicClient,
});

export { chains };

export const supportedNetworks = {
  hardhat: localHardhat,
  sepolia,
  polygonMumbai,
  polygon,
};

// Network switcher helper
export const getNetworkFromEnv = () => {
  const network = process.env.NEXT_PUBLIC_NETWORK || (isDevelopment ? 'hardhat' : 'sepolia');
  switch (network) {
    case 'sepolia':
      return sepolia;
    case 'mumbai':
      return polygonMumbai;
    case 'polygon':
      return polygon;
    case 'hardhat':
    default:
      return localHardhat;
  }
};
