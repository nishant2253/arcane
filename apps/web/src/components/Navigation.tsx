'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useWalletStore } from '@/stores/walletStore';
import { BotIcon, WalletIcon, StoreIcon, LayoutDashboardIcon, MenuIcon, XIcon, PlusCircleIcon } from 'lucide-react';
import { WalletConnectButton } from './WalletConnect';

const NAV_LINKS = [
  { href: '/',            label: 'Dashboard',  icon: LayoutDashboardIcon, requiresWallet: false },
  { href: '/agents',      label: 'Agents',     icon: BotIcon,             requiresWallet: true  },
  { href: '/create',      label: 'Create',     icon: PlusCircleIcon,      requiresWallet: true  },
  { href: '/wallet',      label: 'Wallet',     icon: WalletIcon,          requiresWallet: true  },
  { href: '/marketplace', label: 'Marketplace',icon: StoreIcon,           requiresWallet: true  },
];

export function Navigation() {
  const pathname = usePathname();
  const { isConnected } = useWalletStore();
  const [menuOpen, setMenuOpen] = useState(false);
  // Prevent SSR/client mismatch from Zustand persist (localStorage unavailable on server)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visibleLinks = mounted
    ? NAV_LINKS.filter(l => !l.requiresWallet || isConnected)
    : NAV_LINKS.filter(l => !l.requiresWallet);

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <Image
            src="/arcane-logo.png"
            alt="Arcane"
            width={36}
            height={36}
            className="rounded-lg"
            style={{ objectFit: 'cover' }}
            priority
          />
          <span className="font-display text-sm font-bold tracking-widest" style={{ color: '#E2E8F0' }}>
            ARC<span style={{ color: '#00A9BA' }}>ANE</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  color: active ? '#00A9BA' : '#94A3B8',
                  background: active ? 'rgba(0,169,186,0.1)' : 'transparent',
                }}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Wallet connect */}
        <div className="hidden md:flex items-center gap-3">
          {mounted && <WalletConnectButton />}
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden p-2 rounded-lg cursor-pointer"
          style={{ color: '#94A3B8' }}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
        </button>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div
          className="md:hidden px-4 pb-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          {visibleLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium cursor-pointer"
              style={{ color: pathname === href ? '#00A9BA' : '#94A3B8' }}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          {mounted && !isConnected && (
            <p className="text-[11px] mt-3 px-3" style={{ color: '#94A3B8' }}>
              Connect your wallet to access all features.
            </p>
          )}
        </div>
      )}
    </nav>
  );
}
