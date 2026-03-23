import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'Arcane — AI Trading Platform on Hedera',
  description: 'Deploy AI trading agents on Hedera Hashgraph. HCS-verified execution, NFT strategy marketplace, on-chain audit trail.',
  icons: {
    icon:    '/arcane-logo.png',
    apple:   '/arcane-logo.png',
    shortcut: '/arcane-logo.png',
  },
  openGraph: {
    title: 'Arcane — AI Trading Platform on Hedera',
    description: 'Deploy AI trading agents with tamper-proof HCS audit trails',
    type: 'website',
    images: [{ url: '/arcane-logo.png', width: 1024, height: 1024, alt: 'Arcane Logo' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen antialiased"
        suppressHydrationWarning
        style={{ background: '#0A0A0F', color: '#E2E8F0' }}
      >
        <Navigation />
        <main style={{ paddingTop: '64px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
