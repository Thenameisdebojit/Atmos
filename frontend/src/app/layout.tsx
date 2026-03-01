import { ReactNode } from 'react';
import '@/globals.css';
import Providers from './providers';

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
      <body className="bg-dark-950 text-dark-50 antialiased m-0 p-0">
        <Providers>
          <div className="min-h-screen flex flex-col w-full">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
