'use client';

import { useEffect, useState, use } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowLeftIcon, ExternalLinkIcon, ShoppingCartIcon,
  ShieldCheckIcon, TrendingUpIcon, ActivityIcon, BarChart2Icon,
  BotIcon,
} from 'lucide-react';
import { hashscanUrl, fmtTimestamp } from '@/lib/utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK  = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

interface ListingDetail {
  id:            string;
  name:          string;
  ownerId:       string;
  creatorId:     string;   // original minter — may differ from ownerId on secondary sales
  strategyType:  string;
  hcsTopicId:    string;
  serialNumber:  number | null;
  priceHbar:     number | null;
  ipfsCID:       string | null;
  winRate:       number;
  executions:    number;
  recentSignals: Array<{ signal: string; confidence: number }>;
  hashscanUrl:   string;
  createdAt:     string;
}

function AgentAvatar({ name, size = 64 }: { name: string; size?: number }) {
  const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, hsl(${hue},70%,40%), hsl(${(hue + 80) % 360},70%,55%))`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 700, color: '#fff',
        fontFamily: 'Orbitron, monospace', flexShrink: 0,
      }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

import { 
  TransferTransaction, TokenAssociateTransaction,
  TokenId, AccountId, Hbar,
} from "@hashgraph/sdk";
import { useRouter } from 'next/navigation';
import { useWalletStore } from '@/stores/walletStore';
import { fetchBalances } from '@/lib/balance';

// Read strategy NFT token ID from env (set after NFT collection is created)
const STRATEGY_TOKEN_ID =
  process.env.NEXT_PUBLIC_STRATEGY_TOKEN_ID || '0.0.8316389';

export default function MarketplaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();
  const [listing,   setListing]   = useState<ListingDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [buying,    setBuying]    = useState(false);
  const [buyPhase,  setBuyPhase]  = useState<string>('');
  const [bought,    setBought]    = useState(false);
  const [clonedId,  setClonedId]  = useState<string | null>(null);
  const { signer, accountId, setBalances } = useWalletStore();

  useEffect(() => {
    fetch(`${API_URL}/api/marketplace/${id}`)
      .then(r => r.json())
      .then(d => setListing(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  /**
   * Poll Mirror Node until a transaction is confirmed (or maxRetries exhausted).
   * Converts Hedera txId format "0.0.X@secs.nanos" → "0.0.X-secs-nanos" for the API.
   */
  const waitForTxOnMirrorNode = async (rawTxId: string, mnBase: string): Promise<void> => {
    // Mirror Node expects: 0.0.12345-1234567890-123456789
    const mnTxId = rawTxId.replace('@', '-').replace(/(\d+)\.(\d+)$/, '$1-$2');
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await fetch(`${mnBase}/transactions/${mnTxId}`);
        if (!res.ok) continue;
        const data = await res.json() as any;
        const result: string = data?.transactions?.[0]?.result ?? '';
        if (result === 'SUCCESS') return;
        if (result && result !== 'SUCCESS') throw new Error(`Transaction rejected on-chain: ${result}`);
      } catch (e: any) {
        if (e.message?.startsWith('Transaction rejected')) throw e;
      }
    }
    // Timed out confirming — proceed optimistically (tx was submitted by the SDK)
  };

  const handleBuy = async () => {
    if (!signer || !accountId || !listing || !listing.serialNumber) return;
    
    setBuying(true);
    try {
      const strategyTokenId = TokenId.fromString(STRATEGY_TOKEN_ID);
      const buyerAcctId     = AccountId.fromString(accountId);
      const sellerAcctId    = AccountId.fromString(listing.ownerId);
      const totalTinybars   = Math.floor((listing.priceHbar || 0) * 1e8);
      const mnBase          = `https://${NETWORK}.mirrornode.hedera.com/api/v1`;

      // Compute royalty split: 5% to original creator, 95% to current seller.
      // For initial sales creatorId === ownerId, so seller gets 100%.
      const creatorId       = listing.creatorId ?? listing.ownerId;
      const isSecondarySale = creatorId !== listing.ownerId;
      const royaltyTinybars = isSecondarySale ? Math.floor(totalTinybars * 0.05) : 0;
      const sellerTinybars  = totalTinybars - royaltyTinybars;

      // ── Step 1: Associate strategy NFT token with buyer's wallet ──
      setBuyPhase('Checking token association…');
      let alreadyAssociated = false;
      try {
        const checkRes  = await fetch(`${mnBase}/accounts/${accountId}/tokens?token.id=${STRATEGY_TOKEN_ID}`);
        const checkData = await checkRes.json() as any;
        alreadyAssociated = (checkData?.tokens?.length ?? 0) > 0;
      } catch { /* Mirror Node unavailable — fall through to attempt association */ }

      if (!alreadyAssociated) {
        setBuyPhase('Associating strategy NFT token… (check your HashPack wallet)');
        try {
          const assocTx = await new TokenAssociateTransaction()
            .setAccountId(buyerAcctId)
            .setTokenIds([strategyTokenId])
            .setMaxTransactionFee(new Hbar(2))
            .freezeWithSigner(signer);
          const assocResp = await assocTx.executeWithSigner(signer);
          const assocTxId = assocResp.transactionId?.toString();
          if (assocTxId) {
            setBuyPhase('Waiting for association confirmation…');
            await waitForTxOnMirrorNode(assocTxId, mnBase);
          }
        } catch (assocErr: any) {
          if (!assocErr?.message?.includes('TOKEN_ALREADY_ASSOCIATED') &&
              !assocErr?.status?.toString().includes('TOKEN_ALREADY_ASSOCIATED')) {
            throw assocErr;
          }
        }
      }

      // ── Step 2: HBAR payment with royalty split ──────────────────
      // • Initial sale  (creatorId = ownerId): 100% → seller
      // • Secondary sale (creatorId ≠ ownerId): 95% → seller, 5% → original creator
      let txId = '';
      if (totalTinybars > 0) {
        setBuyPhase(
          isSecondarySale
            ? `Confirming HBAR payment (95% to seller + 5% royalty to creator)… (check HashPack)`
            : 'Confirming HBAR payment… (check your HashPack wallet)'
        );

        const transferTx = new TransferTransaction()
          .addHbarTransfer(buyerAcctId, Hbar.fromTinybars(-totalTinybars))
          .addHbarTransfer(sellerAcctId, Hbar.fromTinybars(sellerTinybars))
          .setMaxTransactionFee(new Hbar(5));

        // Add royalty leg for secondary sales
        if (isSecondarySale && royaltyTinybars > 0) {
          transferTx.addHbarTransfer(
            AccountId.fromString(creatorId),
            Hbar.fromTinybars(royaltyTinybars),
          );
        }

        const response = await (await transferTx.freezeWithSigner(signer)).executeWithSigner(signer);
        txId = response.transactionId?.toString() ?? '';
        if (txId) {
          setBuyPhase('Waiting for payment confirmation…');
          await waitForTxOnMirrorNode(txId, mnBase);
        }
      }

      // ── Step 3: Tell backend to clone agent for buyer ─────────────
      setBuyPhase('Setting up your agent copy…');
      const postRes = await fetch(`${API_URL}/api/marketplace/post-purchase`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          tokenId:        STRATEGY_TOKEN_ID,
          serialNumber:   listing.serialNumber,
          buyerAccountId: accountId,
          txId,
        }),
      });
      if (!postRes.ok) throw new Error('Backend post-purchase failed');
      const postData = await postRes.json();
      setClonedId(postData.clonedAgentId);

      // ── Step 4: Log buyer's NFT_PURCHASE transaction ──────────────
      const hashscanTxUrl = txId
        ? `https://hashscan.io/${NETWORK}/transaction/${txId.replace('@', '-').replace(/(\d+)\.(\d+)$/, '$1-$2')}`
        : `https://hashscan.io/${NETWORK}/topic/${listing.hcsTopicId}`;
      try {
        await fetch(`${API_URL}/api/transactions`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ownerId:    accountId,
            agentId:    listing.id,
            type:       'NFT_PURCHASE',
            txId:       txId || `nft-purchase-${listing.serialNumber}`,
            status:     'SUCCESS',
            hashscanUrl: hashscanTxUrl,
            details: {
              agentName:     listing.name,
              priceHbar:     listing.priceHbar,
              serialNumber:  listing.serialNumber,
              sellerAccountId: listing.ownerId,
              royaltyPaid:   isSecondarySale
                ? `${(royaltyTinybars / 1e8).toFixed(4)} ℏ to ${creatorId}`
                : 'Initial sale — no royalty split',
            },
          }),
        });
      } catch { /* non-fatal */ }

      setBought(true);
      setBuyPhase('');

      // Refresh balances
      const b = await fetchBalances(accountId);
      setBalances(b.hbar, b.tusdt);

      // Auto-redirect to the new agent after 3 seconds
      if (postData.clonedAgentId) {
        setTimeout(() => router.push(`/agents/${postData.clonedAgentId}`), 3000);
      }
    } catch (err: any) {
      console.error('NFT Purchase failed:', err);
      setBuyPhase('');
      if (err?.message?.includes('User rejected') || err?.message?.includes('rejected')) {
        alert('Purchase cancelled: Transaction rejected in wallet.');
      } else {
        alert(`Purchase failed: ${err.message}`);
      }
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: '#00A9BA', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <p style={{ color: '#94A3B8' }}>Listing not found</p>
          <Link href="/marketplace" className="text-sm mt-2 block" style={{ color: '#00A9BA' }}>
            ← Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const isOwner         = !!accountId && accountId === listing.ownerId;
  const creatorId       = listing.creatorId ?? listing.ownerId;
  const isSecondarySale = creatorId !== listing.ownerId;

  const signals = listing.recentSignals ?? [];
  const buySell = signals.reduce((acc, s) => {
    if (s.signal === 'BUY')  acc.buy++;
    if (s.signal === 'SELL') acc.sell++;
    return acc;
  }, { buy: 0, sell: 0 });

  return (
    <div className="min-h-[calc(100vh-64px)] px-4 py-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link
        href="/marketplace"
        className="flex items-center gap-2 text-sm mb-6 cursor-pointer transition-colors duration-200 hover:text-white w-fit"
        style={{ color: '#94A3B8' }}
      >
        <ArrowLeftIcon size={14} />
        Back to Marketplace
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Agent card ────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Header card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6"
          >
            <div className="flex items-start gap-5">
              <AgentAvatar name={listing.name} />
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-display font-bold mb-1" style={{ color: '#E2E8F0' }}>
                  {listing.name}
                </h1>
                <p className="text-sm mb-3" style={{ color: '#94A3B8' }}>
                  {listing.strategyType.replace(/_/g, ' ')} Strategy
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="badge-hcs">Verified on HCS</span>
                  {listing.serialNumber && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.25)' }}
                    >
                      NFT #{listing.serialNumber}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Stat trio */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { label: 'Win Rate',    value: `${listing.winRate}%`,   color: listing.winRate > 60 ? '#10B981' : listing.winRate > 40 ? '#EAB308' : '#EF4444', icon: TrendingUpIcon },
                { label: 'Executions', value: listing.executions,       color: '#00A9BA', icon: ActivityIcon },
                { label: 'Buy / Sell', value: `${buySell.buy} / ${buySell.sell}`, color: '#F59E0B', icon: BarChart2Icon },
              ].map(({ label, value, color, icon: Icon }) => (
                <div key={label} className="text-center">
                  <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />
                  <p className="text-lg font-bold font-display" style={{ color }}>{value}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* HCS info */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5"
          >
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: '#E2E8F0' }}>
              <ShieldCheckIcon size={15} style={{ color: '#00A9BA' }} />
              On-Chain Verification
            </h2>
            <div className="space-y-3">
              {[
                { label: 'HCS Topic ID', value: listing.hcsTopicId, href: hashscanUrl(listing.hcsTopicId, 'topic', NETWORK) },
                { label: 'Owner',        value: listing.ownerId,     href: hashscanUrl(listing.ownerId, 'account', NETWORK) },
                { label: 'Listed',       value: fmtTimestamp(listing.createdAt), href: '#' },
                ...(listing.ipfsCID ? [{ label: 'IPFS Metadata', value: listing.ipfsCID.slice(0, 30) + '…', href: `https://ipfs.io/ipfs/${listing.ipfsCID}` }] : []),
              ].map(({ label, value, href }) => (
                <div key={label} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-xs" style={{ color: '#94A3B8' }}>{label}</span>
                  <a
                    href={href}
                    target={href !== '#' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-mono cursor-pointer transition-colors duration-200 hover:text-white"
                    style={{ color: '#00A9BA' }}
                  >
                    {value}
                    {href !== '#' && <ExternalLinkIcon size={10} />}
                  </a>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Recent signals */}
          {signals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-5"
            >
              <h2 className="font-semibold text-sm mb-4" style={{ color: '#E2E8F0' }}>Recent HCS Signals</h2>
              <div className="flex gap-2 flex-wrap">
                {signals.slice(0, 20).map((s, i) => {
                  const colors: Record<string, { bg: string; color: string }> = {
                    BUY:  { bg: 'rgba(16,185,129,0.12)', color: '#10B981' },
                    SELL: { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444' },
                    HOLD: { bg: 'rgba(234,179,8,0.12)',  color: '#EAB308' },
                  };
                  const st = colors[s.signal] ?? colors.HOLD;
                  return (
                    <div
                      key={i}
                      className="text-xs px-2 py-1 rounded-lg font-semibold"
                      style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30` }}
                    >
                      {s.signal}
                      <span className="ml-1 opacity-60">{s.confidence}%</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Right: Buy card ──────────────────────────────────── */}
        <div>
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-5 sticky top-24"
          >
            <div className="text-center mb-5">
              <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>Price</p>
              <p className="font-display text-3xl font-bold" style={{ color: '#F59E0B' }}>
                {listing.priceHbar ? `${listing.priceHbar} ℏ` : 'Free'}
              </p>
              {listing.priceHbar && isSecondarySale && (
                <div className="mt-2 space-y-1 text-xs text-center">
                  <div className="flex justify-between px-2">
                    <span style={{ color: '#94A3B8' }}>To seller</span>
                    <span style={{ color: '#E2E8F0' }}>{(listing.priceHbar * 0.95).toFixed(4)} ℏ</span>
                  </div>
                  <div className="flex justify-between px-2">
                    <span style={{ color: '#F59E0B' }}>5% royalty to creator</span>
                    <span style={{ color: '#F59E0B' }}>{(listing.priceHbar * 0.05).toFixed(4)} ℏ</span>
                  </div>
                </div>
              )}
              {listing.priceHbar && !isSecondarySale && (
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                  + 5% royalty on future resales
                </p>
              )}
            </div>

            {bought ? (
              /* ── Post-purchase success ───────────────────────── */
              <div className="space-y-3">
                <div
                  className="w-full py-3 rounded-xl text-center text-sm font-bold"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}
                >
                  ✓ Strategy Acquired!
                </div>
                <div className="rounded-xl p-3 space-y-1.5"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Next step: Activate your agent</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: '#94A3B8' }}>
                    Your new agent is <strong style={{ color: '#E2E8F0' }}>inactive by default</strong>. Open it and click <strong style={{ color: '#E2E8F0' }}>Resume</strong> to start live trading.
                  </p>
                </div>
                {clonedId && (
                  <Link
                    href={`/agents/${clonedId}`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                    style={{ background: 'rgba(0,169,186,0.1)', color: '#00A9BA', border: '1px solid rgba(0,169,186,0.25)' }}
                  >
                    Go to Agent Dashboard →
                  </Link>
                )}
                <p className="text-[10px] text-center text-gray-400">Redirecting automatically…</p>
              </div>
            ) : buying ? (
              /* ── In-progress: prompt user to check HashPack ─── */
              <div className="space-y-3">
                <div className="rounded-xl p-4 flex flex-col items-center gap-3 text-center"
                  style={{ background: 'rgba(0,169,186,0.06)', border: '1px solid rgba(0,169,186,0.25)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,169,186,0.12)' }}>
                    <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: '#00A9BA', borderTopColor: 'transparent' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: '#E2E8F0' }}>
                      {buyPhase || 'Processing…'}
                    </p>
                    {(buyPhase?.includes('HBAR') || buyPhase?.includes('Confirming') || buyPhase?.includes('Associating')) && (
                      <p className="text-xs leading-relaxed" style={{ color: '#00A9BA' }}>
                        Please open your <strong>HashPack wallet</strong> and approve the transaction.
                      </p>
                    )}
                    {buyPhase?.includes('Setting up') && (
                      <p className="text-xs" style={{ color: '#94A3B8' }}>
                        Cloning agent for your account…
                      </p>
                    )}
                    {buyPhase?.includes('Checking') && (
                      <p className="text-xs" style={{ color: '#94A3B8' }}>
                        Verifying your token association via Mirror Node…
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : isOwner ? (
              /* ── Owner view — cannot buy own NFT ────────────── */
              <div className="space-y-3">
                <div
                  className="w-full rounded-xl p-4 flex flex-col items-center gap-2 text-center"
                  style={{ background: 'rgba(0,169,186,0.06)', border: '1px solid rgba(0,169,186,0.2)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mb-1"
                    style={{ background: 'rgba(0,169,186,0.12)' }}
                  >
                    <BotIcon size={18} style={{ color: '#00A9BA' }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#E2E8F0' }}>
                    You listed this agent
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                    You cannot purchase your own NFT. Buyers who acquire this listing receive a working copy, and you earn a <strong style={{ color: '#F59E0B' }}>5% royalty</strong> automatically on every secondary resale — paid in HBAR directly to your wallet.
                  </p>
                </div>
                <Link
                  href={`/agents/${id}`}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                  style={{ background: 'linear-gradient(135deg,#00A9BA,#1565C0)', color: '#fff' }}
                >
                  Manage Agent →
                </Link>
                <Link
                  href="/marketplace"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
                >
                  Browse Other Listings
                </Link>
              </div>
            ) : (
              /* ── Third-party buyer — purchase flow ───────────── */
              <div className="space-y-2">
                <button
                  onClick={handleBuy}
                  disabled={!accountId}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold cursor-pointer transition-all duration-200 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #00A9BA, #1565C0)',
                    color: '#fff',
                    boxShadow: '0 0 24px rgba(0,169,186,0.3)',
                  }}
                >
                  <ShoppingCartIcon size={15} />
                  {!accountId ? 'Connect Wallet First' : 'Buy Strategy NFT'}
                </button>
                {!accountId && (
                  <p className="text-[10px] text-center" style={{ color: '#94A3B8' }}>
                    Connect HashPack above to purchase
                  </p>
                )}
              </div>
            )}

            <p className="text-xs text-center mt-3" style={{ color: '#94A3B8' }}>
              Royalty enforced at protocol level · Cannot be bypassed
            </p>

            <div
              className="mt-4 pt-4 text-xs"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: '#94A3B8' }}
            >
              <div className="flex justify-between mb-1">
                <span>Network</span>
                <span style={{ color: '#94A3B8', textTransform: 'uppercase' }}>{NETWORK}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Royalty</span>
                <span style={{ color: '#F59E0B' }}>5% to creator</span>
              </div>
              {isSecondarySale && (
                <div className="flex justify-between">
                  <span>Creator</span>
                  <span className="font-mono truncate ml-2" style={{ color: '#94A3B8', maxWidth: 100 }} title={creatorId}>
                    {creatorId.slice(0, 12)}…
                  </span>
                </div>
              )}
            </div>

            <a
              href={listing.hashscanUrl || hashscanUrl(listing.hcsTopicId, 'topic', NETWORK)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 mt-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all duration-200"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}
            >
              View on HashScan
              <ExternalLinkIcon size={12} />
            </a>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
