'use client';

import { getDefaultWallets } from '@rainbow-me/rainbowkit';
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

// Configure wallets
const { connectors } = getDefaultWallets({
  appName: 'ATMOS Carbon Credit Marketplace',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains,
});

// Create wagmi config
export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
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
