'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { parseAbi } from 'viem';
import { CONTRACTS } from '@/config/contracts';

interface TradeEvent {
  type: 'buy' | 'sell';
  orderId: number;
  amount: number;
  pricePerTonne: number;
  trader: string;
  taker: string;
  timestamp: number;
}

interface CreditEvent {
  type: 'minted' | 'retired';
  tokenId: number;
  amount: number;
  creator: string;
  timestamp: number;
}

export const useRealtimeEvents = (onTrade?: (event: TradeEvent) => void, onCredit?: (event: CreditEvent) => void) => {
  const publicClient = usePublicClient();
  const unsubscribersRef = useRef<Array<() => void>>([]);

  const startListening = useCallback(() => {
    if (!publicClient) return;

    try {
      // Listen for order events
      const unsubscribeTrades = publicClient.watchContractEvent({
        address: CONTRACTS.carbonMarketplace,
        abi: parseAbi([
          'event OrderCreated(uint256 indexed orderId, address indexed trader, bool isBuyOrder, uint256 amount, uint256 pricePerTonne)',
          'event OrderFilled(uint256 indexed orderId, address indexed taker, uint256 amountFilled, uint256 totalCost)',
        ]),
        eventName: 'OrderFilled',
        onLogs: (logs: any[]) => {
          logs.forEach((log) => {
            if (onTrade) {
              onTrade({
                type: 'buy',
                orderId: Number(log.args.orderId),
                amount: Number(log.args.amountFilled) / 1e18,
                pricePerTonne: 0,
                trader: '',
                taker: log.args.taker,
                timestamp: Date.now(),
              });
            }
          });
        },
      });

      unsubscribersRef.current.push(unsubscribeTrades);

      // Listen for CreditMinted events
      const unsubscribeMinted = publicClient.watchContractEvent({
        address: CONTRACTS.carbonCreditNFT,
        abi: parseAbi([
          'event CreditMinted(address indexed creator, uint256 indexed tokenId, uint256 tonnes)',
          'event CreditRetired(address indexed retiree, uint256 indexed tokenId, uint256 amount)',
        ]),
        eventName: 'CreditMinted',
        onLogs: (logs: any[]) => {
          logs.forEach((log) => {
            if (onCredit) {
              onCredit({
                type: 'minted',
                tokenId: Number(log.args.tokenId),
                amount: Number(log.args.tonnes) / 1e18,
                creator: log.args.creator,
                timestamp: Date.now(),
              });
            }
          });
        },
      });

      unsubscribersRef.current.push(unsubscribeMinted);

      // Listen for CreditRetired events
      const unsubscribeRetired = publicClient.watchContractEvent({
        address: CONTRACTS.carbonCreditNFT,
        abi: parseAbi([
          'event CreditRetired(address indexed retiree, uint256 indexed tokenId, uint256 amount)',
        ]),
        eventName: 'CreditRetired',
        onLogs: (logs: any[]) => {
          logs.forEach((log) => {
            if (onCredit) {
              onCredit({
                type: 'retired',
                tokenId: Number(log.args.tokenId),
                amount: Number(log.args.amount) / 1e18,
                creator: log.args.retiree,
                timestamp: Date.now(),
              });
            }
          });
        },
      });

      unsubscribersRef.current.push(unsubscribeRetired);
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }, [publicClient, onTrade, onCredit]);

  const stopListening = useCallback(() => {
    unsubscribersRef.current.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (error) {
        console.error('Error unsubscribing from events:', error);
      }
    });
    unsubscribersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    startListening,
    stopListening,
  };
};

