'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient, useBlockNumber } from 'wagmi';
import { parseAbi, PublicClient, zeroAddress } from 'viem';
import { CONTRACTS } from '@/config/contracts';
import { CarbonCredit, Order } from '@/types';

export const useContractInteraction = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const isValidAddress = (value?: string) => {
    if (!value) return false;
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) return false;
    return !/^0x0{40}$/.test(value);
  };

  const ensureContractAddress = (label: string, value: string) => {
    if (!isValidAddress(value)) {
      throw new Error(`${label} address is not configured. Update your .env.local and restart the dev server.`);
    }
  };

  const getErc20Balance = useCallback(
    async (tokenAddress: string, userAddress: string) => {
      if (!publicClient) return 0;
      try {
        ensureContractAddress('ERC20 token', tokenAddress);
        const balance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
          functionName: 'balanceOf',
          args: [userAddress as `0x${string}`],
        });
        return Number(balance) / 1e18;
      } catch (error) {
        console.error('Error fetching token balance:', error);
        return 0;
      }
    },
    [publicClient]
  );

  const getErc20Allowance = useCallback(
    async (tokenAddress: string, owner: string, spender: string) => {
      if (!publicClient) return 0;
      try {
        ensureContractAddress('ERC20 token', tokenAddress);
        const allowance = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: parseAbi(['function allowance(address owner, address spender) view returns (uint256)']),
          functionName: 'allowance',
          args: [owner as `0x${string}`, spender as `0x${string}`],
        });
        return Number(allowance) / 1e18;
      } catch (error) {
        console.error('Error fetching token allowance:', error);
        return 0;
      }
    },
    [publicClient]
  );

  const approveErc20 = useCallback(
    async (tokenAddress: string, spender: string, amount: number, waitForConfirmation = true) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('ERC20 token', tokenAddress);
        const hash = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: parseAbi(['function approve(address spender, uint256 amount) public returns (bool)']),
          functionName: 'approve',
          args: [spender as `0x${string}`, BigInt(Math.floor(amount * 1e18))],
          account: address,
        });
        if (hash && waitForConfirmation && publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
        return hash;
      } catch (error) {
        console.error('Error approving token:', error);
        return null;
      }
    },
    [walletClient, address, publicClient]
  );

  const approveNftForAll = useCallback(
    async (nftAddress: string, operator: string, approved: boolean) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Credit NFT (NEXT_PUBLIC_CARBON_CREDIT_NFT)', nftAddress);
        const hash = await walletClient.writeContract({
          address: nftAddress as `0x${string}`,
          abi: parseAbi(['function setApprovalForAll(address operator, bool approved) public']),
          functionName: 'setApprovalForAll',
          args: [operator as `0x${string}`, approved],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error approving NFT operator:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  const wrapCredit = useCallback(
    async (tokenId: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Credit Token (NEXT_PUBLIC_CARBON_CREDIT_TOKEN)', CONTRACTS.carbonCreditToken);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonCreditToken as `0x${string}`,
          abi: parseAbi(['function wrapCredit(uint256 tokenId) public returns (uint256)']),
          functionName: 'wrapCredit',
          args: [BigInt(tokenId)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error wrapping credit:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  // Carbon Credit NFT Functions
  const getCreditMetadata = useCallback(
    async (tokenId: bigint) => {
      if (!publicClient) return null;
      try {
        ensureContractAddress('Carbon Credit NFT (NEXT_PUBLIC_CARBON_CREDIT_NFT)', CONTRACTS.carbonCreditNFT);
        const result = await publicClient.readContract({
          address: CONTRACTS.carbonCreditNFT as `0x${string}`,
          abi: parseAbi([
            'function credits(uint256 tokenId) view returns (string projectId, string projectName, string methodology, uint256 co2Tonnes, uint256 vintageYear, string geography, bytes32 oracleProofHash, string satelliteDataCID, address verificationSource, uint256 verificationDate, bool isRetired, uint256 issuanceDate, string serialNumber)',
          ]),
          functionName: 'credits',
          args: [tokenId],
        });
        return result;
      } catch (error) {
        console.error('Error fetching credit metadata:', error);
        return null;
      }
    },
    [publicClient]
  );

  // Get all carbon credits for a user
  const getUserCredits = useCallback(
    async (userAddress: string) => {
      if (!publicClient) return [];
      try {
        ensureContractAddress('Carbon Credit NFT (NEXT_PUBLIC_CARBON_CREDIT_NFT)', CONTRACTS.carbonCreditNFT);
        const balance = await publicClient.readContract({
          address: CONTRACTS.carbonCreditNFT as `0x${string}`,
          abi: parseAbi(['function balanceOf(address owner) view returns (uint256)']),
          functionName: 'balanceOf',
          args: [userAddress as `0x${string}`],
        });
        
        const credits: CarbonCredit[] = [];
        for (let i = 0; i < Number(balance); i++) {
          const tokenId = await publicClient.readContract({
            address: CONTRACTS.carbonCreditNFT as `0x${string}`,
            abi: parseAbi(['function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)']),
            functionName: 'tokenOfOwnerByIndex',
            args: [userAddress as `0x${string}`, BigInt(i)],
          });
          
          const details: any = await getCreditMetadata(tokenId as bigint);
          if (details) {
            // details is [projectId, projectName, methodology, co2Tonnes, vintageYear, geography, oracleProofHash, satelliteDataCID, verificationSource, verificationDate, isRetired, issuanceDate, serialNumber]
            credits.push({
              id: Number(tokenId).toString(),
              tokenId: Number(tokenId),
              projectId: details[0] || `proj-${Number(tokenId)}`,
              projectName: details[1] || `Project ${Number(tokenId)}`,
              methodology: (details[2] || 'VERRA_VCS') as const,
              co2Tonnes: Number(details[3]) / 1e18,
              vintageYear: Number(details[4]),
              geography: details[5] || 'Unknown',
              verificationDate: Number(details[9]),
              isRetired: details[10],
              issuanceDate: Number(details[11]),
              serialNumber: details[12] || `SN-${Number(tokenId)}`,
              price: Math.random() * 50 + 10,
            });
          }
        }
        return credits;
      } catch (error) {
        console.error('Error fetching user credits:', error);
        return [];
      }
    },
    [publicClient, getCreditMetadata]
  );

  const getOrderById = useCallback(
    async (orderId: bigint) => {
      if (!publicClient) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const order = await publicClient.readContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function getOrder(uint256 orderId) view returns (uint256 orderId, address trader, bool isBuyOrder, uint256 amount, uint256 pricePerTonne, uint256 filled, bool isActive, uint256 createdAt, uint256 expiresAt, bool requiresKYC)',
          ]),
          functionName: 'getOrder',
          args: [orderId],
        });
        return order;
      } catch (error) {
        console.error('Error fetching order:', error);
        return null;
      }
    },
    [publicClient]
  );

  const getAuctionById = useCallback(
    async (auctionId: bigint) => {
      if (!publicClient) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const auction = await publicClient.readContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function getAuction(uint256 auctionId) view returns (uint256 auctionId, address seller, uint256 amount, uint256 startPrice, uint256 highestBid, address highestBidder, uint256 startTime, uint256 endTime, bool isActive)',
          ]),
          functionName: 'getAuction',
          args: [auctionId],
        });
        return auction;
      } catch (error) {
        console.error('Error fetching auction:', error);
        return null;
      }
    },
    [publicClient]
  );

  // Get marketplace orders from recent events
  const getMarketplaceOrders = useCallback(
    async () => {
      if (!publicClient) return [];
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 20000n ? latestBlock - 20000n : 0n;

        const logs = await publicClient.getLogs({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          event: parseAbi([
            'event OrderCreated(uint256 indexed orderId, address indexed trader, bool isBuyOrder, uint256 amount, uint256 pricePerTonne)',
          ])[0],
          fromBlock,
          toBlock: 'latest',
        });

        const orderIds = Array.from(
          new Set(logs.map((log: any) => Number(log.args.orderId)))
        );

        const orders: Order[] = [];
        for (const id of orderIds) {
          const order = await getOrderById(BigInt(id));
          if (!order) continue;
          const amount = Number(order[3]) / 1e18;
          const filled = Number(order[5]) / 1e18;
          orders.push({
            orderId: Number(order[0]),
            trader: order[1] as string,
            isBuyOrder: order[2] as boolean,
            amount,
            pricePerTonne: Number(order[4]) / 1e18,
            filled,
            isActive: order[6] as boolean,
            createdAt: Number(order[7]),
            expiresAt: Number(order[8]),
            requiresKYC: order[9] as boolean,
          });
        }

        return orders;
      } catch (error) {
        console.error('Error fetching orders:', error);
        return [];
      }
    },
    [publicClient, getOrderById]
  );

  // Get active auctions from recent events
  const getActiveAuctions = useCallback(
    async () => {
      if (!publicClient) return [];
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > 20000n ? latestBlock - 20000n : 0n;

        const logs = await publicClient.getLogs({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          event: parseAbi([
            'event AuctionCreated(uint256 indexed auctionId, address indexed seller, uint256 amount, uint256 startPrice, uint256 endTime)',
          ])[0],
          fromBlock,
          toBlock: 'latest',
        });

        const auctionIds = Array.from(
          new Set(logs.map((log: any) => Number(log.args.auctionId)))
        );

        const auctions = [] as Array<{
          auctionId: number;
          seller: string;
          amount: number;
          startPrice: number;
          highestBid: number;
          highestBidder: string;
          startTime: number;
          endTime: number;
          isActive: boolean;
        }>;

        for (const id of auctionIds) {
          const auction = await getAuctionById(BigInt(id));
          if (!auction) continue;
          auctions.push({
            auctionId: Number(auction[0]),
            seller: auction[1] as string,
            amount: Number(auction[2]) / 1e18,
            startPrice: Number(auction[3]) / 1e18,
            highestBid: Number(auction[4]) / 1e18,
            highestBidder: auction[5] as string,
            startTime: Number(auction[6]),
            endTime: Number(auction[7]),
            isActive: auction[8] as boolean,
          });
        }

        return auctions.filter((auction) => auction.isActive);
      } catch (error) {
        console.error('Error fetching auctions:', error);
        return [];
      }
    },
    [publicClient, getAuctionById]
  );

  // Get carbon price from oracle
  const getCarbonPrice = useCallback(
    async () => {
      if (!publicClient) return null;
      try {
        ensureContractAddress('Carbon Price Oracle (NEXT_PUBLIC_CARBON_PRICE_ORACLE)', CONTRACTS.carbonPriceOracle);
        const price = await publicClient.readContract({
          address: CONTRACTS.carbonPriceOracle as `0x${string}`,
          abi: parseAbi([
            'function getLatestPrice() view returns (uint256)',
          ]),
          functionName: 'getLatestPrice',
        });
        return Number(price) / 1e8; // Assuming 8 decimal places
      } catch (error) {
        console.error('Error fetching carbon price:', error);
        return null;
      }
    },
    [publicClient]
  );

  // Get company emissions data
  const getCompanyEmissions = useCallback(
    async (companyAddress: string) => {
      if (!publicClient) return null;
      try {
        ensureContractAddress('Emission Verifier (NEXT_PUBLIC_EMISSION_VERIFIER)', CONTRACTS.emissionVerifier);
        const result = await publicClient.readContract({
          address: CONTRACTS.emissionVerifier as `0x${string}`,
          abi: parseAbi([
            'function getEmissionData(address company) view returns (uint256 scope1, uint256 scope2, uint256 scope3, uint256 totalTarget)',
          ]),
          functionName: 'getEmissionData',
          args: [companyAddress as `0x${string}`],
        });
        
        if (result) {
          return {
            scope1: Number(result[0]) / 1e18,
            scope2: Number(result[1]) / 1e18,
            scope3: Number(result[2]) / 1e18,
            totalTarget: Number(result[3]) / 1e18,
          };
        }
        return null;
      } catch (error) {
        console.error('Error fetching emissions:', error);
        return null;
      }
    },
    [publicClient]
  );

  // Mint carbon credits (requires credentials from oracle)
  const mintCredit = useCallback(
    async (tonnes: number, expiryDate: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Credit NFT (NEXT_PUBLIC_CARBON_CREDIT_NFT)', CONTRACTS.carbonCreditNFT);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonCreditNFT,
          abi: parseAbi([
            'function mintCredit(uint256 tonnes, uint256 expiryDate) public returns (uint256)',
          ]),
          functionName: 'mintCredit',
          args: [BigInt(tonnes * 1e18), BigInt(expiryDate)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error minting credit:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  // Mint simple credits for company registration
  const mintSimpleCredits = useCallback(
    async (recipientAddress: string, amount: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Credit NFT (NEXT_PUBLIC_CARBON_CREDIT_NFT)', CONTRACTS.carbonCreditNFT);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonCreditNFT,
          abi: parseAbi([
            'function mintSimpleCredits(address to, uint256 amount) public returns (uint256[] memory)',
          ]),
          functionName: 'mintSimpleCredits',
          args: [recipientAddress as `0x${string}`, BigInt(amount)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error minting simple credits:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  // Register and claim free credits (public function, no role required)
  const registerAndClaimCredits = useCallback(
    async () => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Credit NFT (NEXT_PUBLIC_CARBON_CREDIT_NFT)', CONTRACTS.carbonCreditNFT);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonCreditNFT,
          abi: parseAbi([
            'function registerAndClaimCredits() public returns (uint256[] memory)',
          ]),
          functionName: 'registerAndClaimCredits',
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error claiming registration credits:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  // Create buy order
  const createBuyOrder = useCallback(
    async (
      quantity: number,
      pricePerTonne: number,
      expiresInSeconds = 0,
      requiresKYC = false
    ) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function createBuyOrder(uint256 amount, uint256 pricePerTonne, uint256 expiresIn, bool requiresKYC_) public returns (uint256 orderId)',
          ]),
          functionName: 'createBuyOrder',
          args: [
            BigInt(quantity * 1e18),
            BigInt(pricePerTonne * 1e18),
            BigInt(expiresInSeconds),
            requiresKYC,
          ],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error creating buy order:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  // Create sell order
  const createSellOrder = useCallback(
    async (
      quantity: number,
      pricePerTonne: number,
      expiresInSeconds = 0,
      requiresKYC = false
    ) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function createSellOrder(uint256 amount, uint256 pricePerTonne, uint256 expiresIn, bool requiresKYC_) public returns (uint256 orderId)',
          ]),
          functionName: 'createSellOrder',
          args: [
            BigInt(quantity * 1e18),
            BigInt(pricePerTonne * 1e18),
            BigInt(expiresInSeconds),
            requiresKYC,
          ],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error creating sell order:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  const fillOrder = useCallback(
    async (orderId: number, quantity: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function fillOrder(uint256 orderId, uint256 amount) public',
          ]),
          functionName: 'fillOrder',
          args: [BigInt(orderId), BigInt(quantity * 1e18)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error filling order:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  const cancelOrder = useCallback(
    async (orderId: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi(['function cancelOrder(uint256 orderId) public']),
          functionName: 'cancelOrder',
          args: [BigInt(orderId)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error canceling order:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  // Retire carbon credits (NFT token IDs, reason for ESG reporting)
  const retireCredits = useCallback(
    async (tokenIds: number[], reason: string = 'Voluntary retirement') => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Credit NFT (NEXT_PUBLIC_CARBON_CREDIT_NFT)', CONTRACTS.carbonCreditNFT);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonCreditNFT as `0x${string}`,
          abi: parseAbi([
            'function batchRetire(uint256[] calldata tokenIds, string memory reason) external',
          ]),
          functionName: 'batchRetire',
          args: [
            tokenIds.map(id => BigInt(id)),
            reason,
          ],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error retiring credits:', error);
        return null;
      }
    },
    [walletClient, address]
  );

  // Company Registration
  const registerCompany = useCallback(
    async (companyData: {
      companyName: string;
      legalEntityId: string;
      scope1Emissions: number;
      scope2Emissions: number;
      scope3Emissions: number;
      totalEmissions: number;
      email: string;
      phone: string;
      walletAddress: string;
    }) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Emission Verifier (NEXT_PUBLIC_EMISSION_VERIFIER)', CONTRACTS.emissionVerifier);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.emissionVerifier as `0x${string}`,
          abi: parseAbi([
            'function registerCompany(string memory name, string memory legalId, uint256 scope1, uint256 scope2, uint256 scope3, string memory email, string memory phone) public returns (bool)',
          ]),
          functionName: 'registerCompany',
          args: [
            companyData.companyName,
            companyData.legalEntityId,
            BigInt(companyData.scope1Emissions),
            BigInt(companyData.scope2Emissions),
            BigInt(companyData.scope3Emissions),
            companyData.email,
            companyData.phone,
          ],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error registering company:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  // Get Company Data
  const getCompanyData = useCallback(
    async (companyAddress: string) => {
      if (!publicClient) return null;
      try {
        ensureContractAddress('Emission Verifier (NEXT_PUBLIC_EMISSION_VERIFIER)', CONTRACTS.emissionVerifier);
        const result = await publicClient.readContract({
          address: CONTRACTS.emissionVerifier as `0x${string}`,
          abi: parseAbi([
            'function getCompanyData(address company) view returns (string memory name, string memory legalId, uint256 scope1, uint256 scope2, uint256 scope3, uint256 credits, bool verified)',
          ]),
          functionName: 'getCompanyData',
          args: [companyAddress as `0x${string}`],
        });
        return result;
      } catch (error) {
        console.error('Error fetching company data:', error);
        return null;
      }
    },
    [publicClient]
  );

  // Create auction for CCT
  const createAuction = useCallback(
    async (amount: number, startPrice: number, endTime: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function createAuction(uint256 amount, uint256 startPrice, uint256 endTime) public returns (uint256 auctionId)',
          ]),
          functionName: 'createAuction',
          args: [
            BigInt(amount * 1e18),
            BigInt(startPrice * 1e18),
            BigInt(endTime),
          ],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error creating auction:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  const placeBid = useCallback(
    async (auctionId: number, bidAmount: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function placeBid(uint256 auctionId, uint256 bidAmount) public',
          ]),
          functionName: 'placeBid',
          args: [BigInt(auctionId), BigInt(bidAmount * 1e18)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error placing bid:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  const finalizeAuction = useCallback(
    async (auctionId: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi(['function finalizeAuction(uint256 auctionId) public']),
          functionName: 'finalizeAuction',
          args: [BigInt(auctionId)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error finalizing auction:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  // AMM Swap - instant buy/sell when pool has liquidity
  const swapCarbon = useCallback(
    async (carbonToStable: boolean, amountIn: number, minAmountOut: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        if (carbonToStable) {
          const allowance = await getErc20Allowance(
            CONTRACTS.carbonCreditToken,
            address,
            CONTRACTS.carbonMarketplace
          );
          if (allowance < amountIn) {
            const approveTx = await approveErc20(
              CONTRACTS.carbonCreditToken,
              CONTRACTS.carbonMarketplace,
              amountIn
            );
            if (!approveTx) return null;
          }
        } else {
          const allowance = await getErc20Allowance(
            CONTRACTS.usdc,
            address,
            CONTRACTS.carbonMarketplace
          );
          if (allowance < amountIn) {
            const approveTx = await approveErc20(
              CONTRACTS.usdc,
              CONTRACTS.carbonMarketplace,
              amountIn
            );
            if (!approveTx) return null;
          }
        }
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi([
            'function swap(bool carbonToStable, uint256 amountIn, uint256 minAmountOut) external returns (uint256 amountOut)',
          ]),
          functionName: 'swap',
          args: [
            carbonToStable,
            BigInt(amountIn * 1e18),
            BigInt(minAmountOut * 1e18),
          ],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error swapping:', error);
        return null;
      }
    },
    [walletClient, address, approveErc20, getErc20Allowance]
  );

  const cancelAuction = useCallback(
    async (auctionId: number) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Carbon Marketplace (NEXT_PUBLIC_CARBON_MARKETPLACE)', CONTRACTS.carbonMarketplace);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi(['function cancelAuction(uint256 auctionId) public']),
          functionName: 'cancelAuction',
          args: [BigInt(auctionId)],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error canceling auction:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  // Register Trader
  const registerTrader = useCallback(
    async (traderData: {
      traderName: string;
      email: string;
      phone: string;
      country: string;
      investmentGoal?: string;
      tradingExperience: string;
      walletAddress: string;
    }) => {
      if (!walletClient || !address) return null;
      try {
        ensureContractAddress('Emission Verifier (NEXT_PUBLIC_EMISSION_VERIFIER)', CONTRACTS.emissionVerifier);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.emissionVerifier as `0x${string}`,
          abi: parseAbi([
            'function registerTrader(string memory name, string memory email, string memory phone, string memory country) public returns (bool)',
          ]),
          functionName: 'registerTrader',
          args: [
            traderData.traderName,
            traderData.email,
            traderData.phone,
            traderData.country,
          ],
          account: address,
        });
        return hash;
      } catch (error) {
        console.error('Error registering trader:', error);
        throw error;
      }
    },
    [walletClient, address]
  );

  // Get Trader Data
  const getTraderData = useCallback(
    async (traderAddress: string) => {
      if (!publicClient) return null;
      try {
        ensureContractAddress('Emission Verifier (NEXT_PUBLIC_EMISSION_VERIFIER)', CONTRACTS.emissionVerifier);
        const result = await publicClient.readContract({
          address: CONTRACTS.emissionVerifier as `0x${string}`,
          abi: parseAbi([
            'function getTraderData(address trader) view returns (string name, string email, string phone, string country, uint256 registrationDate, bool isActive)',
          ]),
          functionName: 'getTraderData',
          args: [traderAddress as `0x${string}`],
        });

        // Convert result tuple to object
        if (Array.isArray(result) && result.length === 6) {
          return {
            name: result[0] as string,
            email: result[1] as string,
            phone: result[2] as string,
            country: result[3] as string,
            walletAddress: traderAddress,
            registrationDate: Number(result[4]),
            totalInvested: 5000, // Mock data - replace with real contract data
            currentValue: 6200,
            totalProfit: 1200,
            creditCount: 250,
          };
        }
        
        return null;
      } catch (error) {
        console.error('Error fetching trader data:', error);
        return null;
      }
    },
    [publicClient]
  );

  // Listen for events
  const watchContractEvents = useCallback(
    async (callback: (eventData: any) => void) => {
      if (!publicClient) return;

      try {
        // Watch for CreditMinted events
        publicClient.watchContractEvent({
          address: CONTRACTS.carbonCreditNFT,
          abi: parseAbi(['event CreditMinted(address indexed creator, uint256 indexed tokenId, uint256 tonnes)']),
          eventName: 'CreditMinted',
          onLogs: (logs) => {
            callback({
              type: 'CreditMinted',
              logs,
            });
          },
        });

        // Watch for trades
        publicClient.watchContractEvent({
          address: CONTRACTS.carbonMarketplace as `0x${string}`,
          abi: parseAbi(['event OrderCreated(uint256 indexed orderId, address indexed creator, uint256 amount, uint256 price)']),
          eventName: 'OrderCreated',
          onLogs: (logs) => {
            callback({
              type: 'OrderCreated',
              logs,
            });
          },
        });
      } catch (error) {
        console.error('Error watching events:', error);
      }
    },
    [publicClient]
  );

  return {
    // State
    isConnected,
    address,
    blockNumber,
    
    // Read functions
    getCreditMetadata,
    getUserCredits,
    getMarketplaceOrders,
    getActiveAuctions,
    getErc20Balance,
    getErc20Allowance,
    approveNftForAll,
    getCarbonPrice,
    getCompanyEmissions,
    getCompanyData,
    getTraderData,
    
    // Write functions
    mintCredit,
    mintSimpleCredits,
    registerAndClaimCredits,
    createBuyOrder,
    createSellOrder,
    fillOrder,
    cancelOrder,
    approveErc20,
    wrapCredit,
    retireCredits,
    registerCompany,
    registerTrader,
    createAuction,
    placeBid,
    finalizeAuction,
    cancelAuction,
    swapCarbon,
    
    // Event listening
    watchContractEvents,
    
    // Loading state
    isLoading: false,
  };
};


