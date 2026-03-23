'use client';

import { useEffect, useState, useCallback } from 'react';
import { ExternalLinkIcon, FileTextIcon, ActivityIcon, ShieldCheckIcon, ZapIcon, LinkIcon, CheckCircleIcon, XCircleIcon, CopyIcon, RefreshCwIcon } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface TxRecord {
  id:          string;
  ownerId:     string;
  agentId:     string | null;
  type:        string;
  txId:        string;
  status:      string;
  details:     Record<string, unknown> | null;
  hashscanUrl: string;
  createdAt:   string;
}

const TX_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  DEPLOY_HFS:       { label: 'File Upload',    icon: FileTextIcon,    color: '#60A5FA', bg: 'rgba(96,165,250,0.1)'  },
  DEPLOY_HCS:       { label: 'Audit Topic',    icon: ActivityIcon,    color: '#00A9BA', bg: 'rgba(0,169,186,0.1)'   },
  DEPLOY_HSCS:      { label: 'Registry',       icon: ShieldCheckIcon, color: '#C084FC', bg: 'rgba(192,132,252,0.1)' },
  TRADE_SWAP:       { label: 'Trade Swap',     icon: ZapIcon,         color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
  TOKEN_ASSOCIATE:  { label: 'Token Link',     icon: LinkIcon,        color: '#FDE047', bg: 'rgba(253,224,71,0.08)' },
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function truncateTxId(txId: string): string {
  if (txId.startsWith('0x')) {
    return `${txId.slice(0, 10)}…${txId.slice(-6)}`;
  }
  // Hedera tx ID format: 0.0.XXXXX@ts.nanos or 0.0.XXXXX-ts-nanos
  if (txId.length > 24) return `${txId.slice(0, 18)}…`;
  return txId;
}

interface Props {
  ownerId: string;
}

export function TxHistoryPanel({ ownerId }: Props) {
  const [txs,      setTxs]      = useState<TxRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [copied,   setCopied]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ownerId) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/api/transactions?ownerId=${encodeURIComponent(ownerId)}&limit=50`);
      const data = await res.json();
      setTxs(data.transactions ?? []);
    } catch {
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => { load(); }, [load]);

  function copyTxId(txId: string) {
    navigator.clipboard.writeText(txId).catch(() => {});
    setCopied(txId);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold flex items-center gap-2" style={{ color: '#E2E8F0' }}>
          <ShieldCheckIcon size={16} style={{ color: '#00A9BA' }} />
          Transaction Audit Log
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#94A3B8' }}>
            {txs.length} record{txs.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg transition-all disabled:opacity-40"
            style={{ background: 'rgba(0,169,186,0.08)', color: '#00A9BA' }}
            title="Refresh"
          >
            <RefreshCwIcon size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-10 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#00A9BA', borderTopColor: 'transparent' }} />
        </div>
      ) : txs.length === 0 ? (
        <div className="py-12 text-center">
          <ShieldCheckIcon size={28} className="mx-auto mb-3" style={{ color: '#94A3B8' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No transactions yet.</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
            Deploy an agent or execute a trade to see records here.
          </p>
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div
            className="hidden sm:grid grid-cols-[160px_1fr_180px_80px_100px_110px] gap-3 px-3 pb-2 mb-1 text-[10px] uppercase tracking-wider"
            style={{ color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
          >
            <span>Type</span>
            <span>Agent</span>
            <span>Transaction ID</span>
            <span>Status</span>
            <span>Time</span>
            <span className="text-right">Action</span>
          </div>

          <div className="space-y-1.5">
            {txs.map((tx) => {
              const meta    = TX_META[tx.type] ?? TX_META.DEPLOY_HFS;
              const Icon    = meta.icon;
              const isSwap  = tx.type === 'TRADE_SWAP';
              const details = tx.details as Record<string, unknown> | null;
              const agentName = String(details?.agentName ?? '—');
              const signal  = isSwap ? String(details?.signal ?? '') : '';

              return (
                <div
                  key={tx.id}
                  className="grid grid-cols-1 sm:grid-cols-[160px_1fr_180px_80px_100px_110px] gap-3 items-center px-3 py-2.5 rounded-xl transition-colors"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  {/* Type chip */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: meta.bg }}
                    >
                      <Icon size={12} style={{ color: meta.color }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>
                      {meta.label}
                    </span>
                  </div>

                  {/* Agent name + optional signal badge */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs truncate" style={{ color: '#94A3B8' }}>{agentName}</span>
                    {signal && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                        style={{
                          background: signal === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color:      signal === 'BUY' ? '#10B981' : '#EF4444',
                        }}
                      >
                        {signal}
                      </span>
                    )}
                  </div>

                  {/* Tx ID — truncated with copy */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[11px] font-mono truncate"
                      style={{ color: '#94A3B8' }}
                      title={tx.txId}
                    >
                      {truncateTxId(tx.txId)}
                    </span>
                    <button
                      onClick={() => copyTxId(tx.txId)}
                      className="flex-shrink-0 p-0.5 rounded transition-colors hover:text-white"
                      style={{ color: copied === tx.txId ? '#10B981' : '#334155' }}
                      title="Copy full tx ID"
                    >
                      <CopyIcon size={11} />
                    </button>
                  </div>

                  {/* Status badge */}
                  <div>
                    {tx.status === 'SUCCESS' ? (
                      <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: '#10B981' }}>
                        <CheckCircleIcon size={11} /> Success
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: '#EF4444' }}>
                        <XCircleIcon size={11} /> Failed
                      </span>
                    )}
                  </div>

                  {/* Relative time */}
                  <span className="text-[11px]" style={{ color: '#94A3B8' }}>
                    {timeAgo(tx.createdAt)}
                  </span>

                  {/* HashScan link */}
                  <div className="flex justify-end">
                    <a
                      href={tx.hashscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg transition-all hover:border-[#00A9BA]/60"
                      style={{
                        background: 'rgba(0,169,186,0.07)',
                        border:     '1px solid rgba(0,169,186,0.18)',
                        color:      '#00A9BA',
                      }}
                    >
                      HashScan
                      <ExternalLinkIcon size={10} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer note */}
      {txs.length > 0 && (
        <div
          className="mt-4 pt-4 flex items-center gap-2 text-xs"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#94A3B8' }}
        >
          <ShieldCheckIcon size={12} style={{ color: '#00A9BA' }} />
          All transactions are user-signed via HashPack and anchored on Hedera.
        </div>
      )}
    </div>
  );
}
