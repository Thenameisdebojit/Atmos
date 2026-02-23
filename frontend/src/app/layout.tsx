'use client';

import React from 'react';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig, chains } from '@/config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';
import '@/globals.css';

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="ATMOS - Decentralized Carbon Credit Marketplace"
        />
        <meta name="theme-color" content="#0f172a" />
        <title>ATMOS - Carbon Credit Marketplace</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className="bg-dark-950 text-dark-50 antialiased">
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
            <div className="min-h-screen flex flex-col">
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
      </body>
    </html>
  );
}
