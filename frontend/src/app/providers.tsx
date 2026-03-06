'use client';

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import { WagmiConfig } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { wagmiConfig, chains } from '@/config/wagmi';
import '@rainbow-me/rainbowkit/styles.css';

/* ─── ProviderErrorBoundary ─────────────────────────
 * Catches errors thrown during WagmiConfig / RainbowKit
 * initialisation (e.g. a broken injected wallet extension).
 * Renders a recovery UI so the user never sees a blank page.
 */
interface PEBProps { children: ReactNode }
interface PEBState { hasError: boolean; errorMsg: string }

class ProviderErrorBoundary extends Component<PEBProps, PEBState> {
  constructor(props: PEBProps) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message || 'Unknown error' };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ATMOS] Provider crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', backgroundColor: '#0b1120', color: '#f1f5f9',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif', padding: '2rem',
        }}>
          <div style={{
            maxWidth: '28rem', width: '100%', background: '#1e293b', borderRadius: '12px',
            border: '1px solid #334155', padding: '2.5rem', textAlign: 'center',
          }}>
            <div style={{
              width: '4rem', height: '4rem', margin: '0 auto 1.5rem',
              background: 'rgba(234,179,8,0.15)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
            }}>⚠️</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Wallet Provider Error</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
              A browser wallet extension may be interfering with ATMOS.&nbsp;
              Try disabling extensions or using a different browser.
            </p>
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
              {this.state.errorMsg}
            </p>
            <button onClick={() => window.location.reload()} style={{
              width: '100%', padding: '0.75rem', background: '#22c55e', color: 'white',
              border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
            }}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Providers ─────────────────────────────────── */
interface ProvidersProps { children: ReactNode }

export default function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ProviderErrorBoundary>
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
    </ProviderErrorBoundary>
  );
}
