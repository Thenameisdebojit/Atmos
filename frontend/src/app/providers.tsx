'use client';

import React, { useState, useEffect } from 'react';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig, chains } from '@/config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider 
        chains={chains}
        theme={darkTheme({
          accentColor: '#22c55e',
          accentColorForeground: 'white',
          borderRadius: 'medium',
          fontStack: 'system',
        })}
      >
        <div style={{ visibility: mounted ? 'visible' : 'hidden' }}>
          {children}
        </div>
        <Toaster
          position="bottom-right"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
            },
          }}
        />
      </RainbowKitProvider>
    </WagmiConfig>
  );
}
