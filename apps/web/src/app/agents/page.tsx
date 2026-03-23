'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useAgentStore } from '@/stores/agentStore';
import { useWalletStore } from '@/stores/walletStore';
import Link from 'next/link';
import {
  BotIcon, ActivityIcon, ExternalLinkIcon, BarChart2Icon,
  ZapIcon, PlayIcon, PauseIcon, WalletIcon,
  ShieldCheckIcon, FileTextIcon, ClockIcon, ArrowRightLeftIcon,
  CheckCircle2Icon, PlusCircleIcon, Loader2,
  TrendingUpIcon, TrendingDownIcon, ArrowDownToLineIcon,
  StoreIcon, CpuIcon, RefreshCwIcon, TagIcon,
} from 'lucide-react';
import { hashscanUrl, fmtTimestamp } from '@/lib/utils';
import { TradeApprovalModal } from '@/components/TradeApprovalModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK  = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

/* ── Strategy color map ──────────────────────────────────────────── */
const STRATEGY_COLORS: Record<string, { color: string; bg: string }> = {
  TREND_FOLLOW: { color: '#00A9BA', bg: 'rgba(0,169,186,0.12)' },
  MEAN_REVERT:  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
  BREAKOUT:     { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  MOMENTUM:     { color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
};

/* ── Types ───────────────────────────────────────────────────────── */
interface AgentDetail {
  id:                     string;
  name:                   string;
  ownerId:                string;
  strategyType:           string;
  hcsTopicId:             string;
  hfsConfigId:            string | null;
  contractTxId:           string | null;
  active:                 boolean;
  listed:                 boolean;
  configHash:             string;
  createdAt:              string;
  executionMode:          'AUTO' | 'MANUAL';
  agentAccountId:         string | null;
  agentAccountEvmAddress: string | null;
  tradingBudgetHbar:      number;
  // API returns executions as an array (last 10) from the include: { executions }
  // clause in the Prisma query — we normalise it to a count for display.
  executions?:   unknown[] | number | null;
  // optional marketplace fields
  winRate?:      number | null;
  profitFactor?: number | null;
  sharpeRatio?:  number | null;
  avgWin?:       number | null;
  avgLoss?:      number | null;
  serialNumber?: number | null;
  priceHbar?:    number | null;
}

interface Portfolio {
  hbar:   number;
  tusdt:  number;
  pnlPct: number | null;
  pnlHbar: number | null;
}

interface HCSMsg {
  seq:        number;
  timestamp:  string;
  decision: {
    signal:     string;
    confidence: number;
    price:      number;
    reasoning:  string;
    indicators?: Record<string, number>;
  } | null;
  hashscanUrl: string;
}

interface PendingTrade {
  signal:         'BUY' | 'SELL';
  amount:         bigint;
  price:          number;
  confidence:     number;
  hcsSequenceNum: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */
function relTime(ts: string): string {
  const diff = Date.now() - parseFloat(ts) * 1000;
  if (diff < 60_000)    return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(parseFloat(ts) * 1000).toLocaleDateString();
}

function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    BUY:  { bg: 'rgba(16,185,129,0.15)',  color: '#10B981' },
    SELL: { bg: 'rgba(239,68,68,0.15)',   color: '#EF4444' },
    HOLD: { bg: 'rgba(234,179,8,0.15)',   color: '#EAB308' },
  };
  const s = map[signal] ?? map.HOLD;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }}>
      {signal}
    </span>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function AgentsPage() {
  const { agents, setAgents, liveSignals, isLoading, setLoading } = useAgentStore();
  const { accountId, isConnected, signer } = useWalletStore();
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [detail,        setDetail]        = useState<AgentDetail | null>(null);
  const [history,       setHistory]       = useState<HCSMsg[]>([]);
  const [portfolio,     setPortfolio]     = useState<Portfolio | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [running,       setRunning]       = useState(false);
  const [pausing,       setPausing]       = useState(false);
  const [pendingTrade,  setPendingTrade]  = useState<PendingTrade | null>(null);
  const [withdrawing,   setWithdrawing]   = useState(false);
  const [refreshTs,     setRefreshTs]     = useState(0);

  /* Load agents list */
  useEffect(() => {
    if (!isConnected || !accountId) return;
    setLoading(true);
    fetch(`${API_URL}/api/agents?ownerId=${accountId}`)
      .then(r => r.json())
      .then(d => { if (d.agents) setAgents(d.agents); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isConnected, accountId, setAgents, setLoading]);

  /* Fetch portfolio from Mirror Node */
  const fetchPortfolio = useCallback(async (agentAcctId: string, budget: number) => {
    const base      = `https://${NETWORK}.mirrornode.hedera.com/api/v1`;
    const tUSDTId   = process.env.NEXT_PUBLIC_TEST_USDT_TOKEN_ID;
    const userAcct  = useWalletStore.getState().accountId ?? agentAcctId;
    try {
      const [accRes, tokRes] = await Promise.all([
        fetch(`${base}/accounts/${agentAcctId}`),
        tUSDTId ? fetch(`${base}/accounts/${userAcct}/tokens?token.id=${tUSDTId}`) : Promise.resolve(null),
      ]);
      const accData = await accRes.json() as any;
      const hbar    = (accData?.balance?.balance ?? 0) / 1e8;
      let   tusdt   = 0;
      if (tokRes) {
        const tokData = await tokRes.json() as any;
        tusdt = (tokData?.tokens?.[0]?.balance ?? 0) / 1e6;
      }
      const pnlHbar = budget > 0 ? parseFloat((hbar - budget).toFixed(4)) : null;
      const pnlPct  = budget > 0 ? parseFloat((((hbar - budget) / budget) * 100).toFixed(2)) : null;
      setPortfolio({ hbar, tusdt, pnlPct, pnlHbar });
    } catch {
      setPortfolio({ hbar: 0, tusdt: 0, pnlPct: null, pnlHbar: null });
    }
  }, []);

  /* Fetch full detail when agent selected */
  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    setPortfolio(null);
    setHistory([]);
    Promise.all([
      fetch(`${API_URL}/api/agents/${selectedId}`).then(r => r.json()),
      fetch(`${API_URL}/api/agents/${selectedId}/history?limit=30`).then(r => r.json()),
    ]).then(([agentData, historyData]) => {
      setDetail(agentData);
      setHistory(historyData.history ?? []);
      if (agentData.agentAccountId) {
        fetchPortfolio(agentData.agentAccountId, agentData.tradingBudgetHbar);
      }
    }).catch(console.error)
      .finally(() => setDetailLoading(false));
  }, [selectedId, fetchPortfolio, refreshTs]);

  /* Actions */
  const triggerRun = async (dryRun = true) => {
    if (!selectedId || !detail) return;
    setRunning(true);
    try {
      const res  = await fetch(`${API_URL}/api/agents/${selectedId}/run`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      const newEntry: HCSMsg = {
        seq:       parseInt(data.hcsSequenceNumber),
        timestamp: data.hcsTimestamp,
        decision:  { signal: data.signal, confidence: data.confidence, price: data.price, reasoning: data.reasoning },
        hashscanUrl: `https://hashscan.io/${NETWORK}/topic/${detail.hcsTopicId}`,
      };
      setHistory(h => [newEntry, ...h]);
      if (!dryRun && (data.signal === 'BUY' || data.signal === 'SELL')) {
        const tradeAmount = data.signal === 'SELL' ? BigInt(Math.round(5 * 1e8)) : BigInt(Math.round(1 * 1e6));
        setPendingTrade({ signal: data.signal, amount: tradeAmount, price: data.price, confidence: data.confidence, hcsSequenceNum: String(data.hcsSequenceNumber) });
      }
    } catch (e) { console.error(e); }
    finally { setRunning(false); }
  };

  const togglePause = async () => {
    if (!detail || !selectedId) return;
    setPausing(true);
    await fetch(`${API_URL}/api/agents/${selectedId}/pause`, { method: 'PUT' });
    setDetail(d => d ? { ...d, active: !d.active } : d);
    setPausing(false);
  };

  const withdraw = async () => {
    if (!detail?.agentAccountId || !accountId) return;
    setWithdrawing(true);
    try {
      const res  = await fetch(`${API_URL}/api/agents/${selectedId}/withdraw`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerAccountId: accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      alert(`Withdrawal complete! Tx: ${data.txIds?.[0] ?? ''}`);
      await fetchPortfolio(detail.agentAccountId, detail.tradingBudgetHbar);
    } catch (err: any) { alert(`Withdrawal failed: ${err.message}`); }
    finally { setWithdrawing(false); }
  };

  /* ── Not connected ───────────────────────────────────────────── */
  if (!isConnected) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,169,186,0.1)', border: '1px solid rgba(0,169,186,0.2)' }}>
            <BotIcon size={28} style={{ color: '#00A9BA' }} />
          </div>
          <p className="font-semibold mb-2" style={{ color: '#E2E8F0' }}>Not connected</p>
          <Link href="/wallet" className="text-sm" style={{ color: '#00A9BA' }}>
            Connect wallet to view agents →
          </Link>
        </div>
      </div>
    );
  }

  const sc = STRATEGY_COLORS[detail?.strategyType ?? ''] ?? { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' };

  /* ── Layout ──────────────────────────────────────────────────── */
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden" style={{ background: 'var(--ta-bg)' }}>

      {/* ══════════════════════════════════════════════════════════
          LEFT SIDEBAR — Agents list
      ══════════════════════════════════════════════════════════ */}
      <aside
        className="w-72 flex-shrink-0 flex flex-col overflow-hidden"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,14,20,0.8)' }}
      >
        {/* Header */}
        <div className="px-4 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Image
              src="/arcane-logo.png"
              alt="Arcane"
              width={28}
              height={28}
              className="rounded-lg flex-shrink-0"
              style={{ objectFit: 'cover' }}
            />
            <div>
              <h2 className="text-sm font-bold font-display" style={{ color: '#E2E8F0' }}>My Agents</h2>
              <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
                {agents.filter(a => a.active).length} active · {agents.length} total
              </p>
            </div>
          </div>
          <Link href="/create"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
            style={{ background: 'rgba(0,169,186,0.12)', border: '1px solid rgba(0,169,186,0.25)', color: '#00A9BA' }}>
            <PlusCircleIcon size={12} />
            New
          </Link>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="space-y-2 p-2">
              {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl shimmer" />)}
            </div>
          ) : agents.length === 0 ? (
            <div className="p-6 text-center">
              <BotIcon size={32} className="mx-auto mb-3" style={{ color: '#94A3B8' }} />
              <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>No agents yet.</p>
              <Link href="/create" className="text-xs font-semibold" style={{ color: '#00A9BA' }}>
                Create your first agent →
              </Link>
            </div>
          ) : (
            agents.map(agent => {
              const active = agent.id === selectedId;
              const sc2 = STRATEGY_COLORS[agent.strategyType] ?? { color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' };
              return (
                <button key={agent.id} onClick={() => setSelectedId(agent.id)}
                  className="w-full text-left p-3 rounded-xl mb-1 transition-all duration-200 group"
                  style={{
                    background: active ? 'rgba(0,169,186,0.08)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(0,169,186,0.3)' : 'rgba(255,255,255,0.04)'}`,
                  }}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                        style={{ background: agent.active ? '#10B981' : '#475569',
                          boxShadow: agent.active ? '0 0 6px #10B98180' : 'none' }} />
                      <span className="text-sm font-semibold truncate" style={{ color: active ? '#E2E8F0' : '#CBD5E1' }}>
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                      style={{ background: sc2.bg, color: sc2.color }}>
                      {agent.strategyType.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                      {agent.executions} execution{agent.executions !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px]" style={{ color: agent.listed ? '#F59E0B' : '#475569' }}>
                      {agent.listed ? '● Listed' : '○ Unlisted'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════
          MAIN PANEL — Agent detail
      ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        {!selectedId ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(0,169,186,0.08)', border: '1px solid rgba(0,169,186,0.15)' }}>
              <CpuIcon size={36} style={{ color: '#00A9BA' }} />
            </div>
            <div className="text-center">
              <p className="font-semibold mb-1" style={{ color: '#E2E8F0' }}>Select an agent</p>
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                Click an agent on the left to view P&amp;L, signals, and portfolio
              </p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="flex items-center justify-center h-full gap-3" style={{ color: '#94A3B8' }}>
            <Loader2 size={18} className="animate-spin" style={{ color: '#00A9BA' }} />
            <span className="text-sm">Loading agent data…</span>
          </div>
        ) : detail ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-5 max-w-4xl"
            >
              {/* ── Header card ─────────────────────────────────── */}
              <div className="glass-card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Left: name, strategy, owner */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1.5">
                      <h1 className="text-xl font-display font-bold" style={{ color: '#E2E8F0' }}>
                        {detail.name}
                      </h1>
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background: detail.active ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)',
                          color: detail.active ? '#10B981' : '#94A3B8',
                          border: `1px solid ${detail.active ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.2)'}` }}>
                        {detail.active ? '● Active' : '○ Paused'}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                        style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}>
                        {detail.strategyType.replace('_', ' ')}
                      </span>
                      {detail.listed && (
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                          ★ Listed
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>
                      {detail.executionMode === 'AUTO' ? 'Auto Trade' : 'Manual Sign'}
                      {' · '}
                      Owner: <span style={{ color: '#00A9BA' }}>{detail.ownerId}</span>
                      {' · '}
                      Created {new Date(detail.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <button onClick={() => triggerRun(false)} disabled={running || !detail.active || detail.executionMode === 'AUTO'}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(0,169,186,0.15))', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
                      <ZapIcon size={12} />{running ? 'Running…' : 'Run Trade'}
                    </button>
                    <button onClick={() => triggerRun(true)} disabled={running}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      style={{ background: 'rgba(0,169,186,0.1)', border: '1px solid rgba(0,169,186,0.25)', color: '#00A9BA' }}>
                      <PlayIcon size={12} />{running ? '…' : 'Test Run'}
                    </button>
                    <button onClick={togglePause} disabled={pausing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#CBD5E1' }}>
                      <PauseIcon size={12} />{detail.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => setRefreshTs(Date.now())}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#94A3B8' }}>
                      <RefreshCwIcon size={12} />
                    </button>
                    <Link href={`/agents/${selectedId}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                      style={{ background: 'rgba(0,169,186,0.12)', border: '1px solid rgba(0,169,186,0.3)', color: '#00A9BA' }}>
                      <BarChart2Icon size={12} />Full Analytics
                    </Link>
                  </div>
                </div>

                {/* Key stats row */}
                <div className="grid grid-cols-4 gap-3 mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {[
                    { label: 'Total Executions', value: Array.isArray(detail.executions) ? detail.executions.length : (detail.executions ?? 0), color: '#00A9BA' },
                    { label: 'Mode',  value: detail.executionMode === 'AUTO' ? 'Auto' : 'Manual', color: detail.executionMode === 'AUTO' ? '#8B5CF6' : '#F59E0B' },
                    { label: 'Listed', value: detail.listed ? 'Yes' : 'No', color: detail.listed ? '#F59E0B' : '#475569' },
                    { label: 'Signals (24h)', value: history.filter(h => parseFloat(h.timestamp) * 1000 > Date.now() - 86_400_000).length, color: '#94A3B8' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>{label}</p>
                      <p className="text-lg font-bold font-mono" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Portfolio & P&L card ─────────────────────────── */}
              {detail.agentAccountId && (
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#E2E8F0' }}>
                      <WalletIcon size={14} style={{ color: '#00A9BA' }} />
                      Portfolio &amp; P&amp;L
                    </h2>
                    <a href={`https://hashscan.io/${NETWORK}/account/${detail.agentAccountId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[10px] flex items-center gap-1 transition-colors hover:text-white"
                      style={{ color: '#94A3B8' }}>
                      {detail.agentAccountId} <ExternalLinkIcon size={9} />
                    </a>
                  </div>

                  {!portfolio ? (
                    <div className="flex items-center gap-2 py-6 justify-center" style={{ color: '#94A3B8' }}>
                      <Loader2 size={14} className="animate-spin" style={{ color: '#00A9BA' }} />
                      <span className="text-xs">Fetching balances from Mirror Node…</span>
                    </div>
                  ) : (
                    <>
                      {/* Big P&L display */}
                      <div className="flex items-center gap-5 mb-5 p-4 rounded-2xl"
                        style={{
                          background: portfolio.pnlPct == null ? 'rgba(255,255,255,0.02)' : portfolio.pnlPct >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                          border: `1px solid ${portfolio.pnlPct == null ? 'rgba(255,255,255,0.06)' : portfolio.pnlPct >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: portfolio.pnlPct == null ? 'rgba(148,163,184,0.1)' : portfolio.pnlPct >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                          {portfolio.pnlPct == null
                            ? <TrendingUpIcon size={20} style={{ color: '#94A3B8' }} />
                            : portfolio.pnlPct >= 0
                              ? <TrendingUpIcon size={20} style={{ color: '#10B981' }} />
                              : <TrendingDownIcon size={20} style={{ color: '#EF4444' }} />}
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#94A3B8' }}>P&amp;L vs Initial Budget</p>
                          <p className="text-3xl font-bold font-mono" style={{
                            color: portfolio.pnlPct == null ? '#475569' : portfolio.pnlPct >= 0 ? '#10B981' : '#EF4444',
                          }}>
                            {portfolio.pnlPct == null ? '—' : `${portfolio.pnlPct >= 0 ? '+' : ''}${portfolio.pnlPct}%`}
                          </p>
                          {portfolio.pnlHbar !== null && (
                            <p className="text-xs font-mono" style={{ color: '#94A3B8' }}>
                              {portfolio.pnlHbar >= 0 ? '+' : ''}{portfolio.pnlHbar} ℏ vs {detail.tradingBudgetHbar.toFixed(2)} ℏ budget
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Balance grid */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl p-3" style={{ background: 'rgba(0,169,186,0.06)', border: '1px solid rgba(0,169,186,0.12)' }}>
                          <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>HBAR Balance</p>
                          <p className="text-xl font-bold font-mono" style={{ color: '#E2E8F0' }}>{portfolio.hbar.toFixed(4)}</p>
                          <p className="text-[10px]" style={{ color: '#94A3B8' }}>ℏ (agent wallet)</p>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                          <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>tUSDT Balance</p>
                          <p className="text-xl font-bold font-mono" style={{ color: '#10B981' }}>{portfolio.tusdt.toFixed(4)}</p>
                          <p className="text-[10px]" style={{ color: '#94A3B8' }}>tUSDT (your wallet)</p>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>Initial Budget</p>
                          <p className="text-xl font-bold font-mono" style={{ color: '#CBD5E1' }}>{detail.tradingBudgetHbar.toFixed(2)}</p>
                          <p className="text-[10px]" style={{ color: '#94A3B8' }}>ℏ funded</p>
                        </div>
                      </div>

                      {/* Withdraw */}
                      <div className="flex items-center justify-between pt-4 mt-4"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                          Operator-signed — no HashPack required. Returns funds to{' '}
                          <span style={{ color: '#00A9BA' }}>{detail.ownerId}</span>.
                        </p>
                        <button onClick={withdraw} disabled={withdrawing || (portfolio.hbar < 0.1 && portfolio.tusdt < 0.01)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-all"
                          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                          {withdrawing ? <Loader2 size={11} className="animate-spin" /> : <ArrowDownToLineIcon size={11} />}
                          Withdraw All
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Performance metrics ──────────────────────────── */}
              {history.length > 0 && (() => {
                const trades    = history.filter(h => h.decision?.signal === 'BUY' || h.decision?.signal === 'SELL');
                const buys      = trades.filter(h => h.decision?.signal === 'BUY').length;
                const sells     = trades.filter(h => h.decision?.signal === 'SELL').length;
                const holds     = history.filter(h => h.decision?.signal === 'HOLD').length;
                const avgConf   = trades.length > 0
                  ? (trades.reduce((s, h) => s + (h.decision?.confidence ?? 0), 0) / trades.length).toFixed(1)
                  : null;
                const lastPrice = history.find(h => h.decision?.price)?.decision?.price;
                return (
                  <div className="glass-card p-5">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#E2E8F0' }}>
                      <BarChart2Icon size={14} style={{ color: '#00A9BA' }} />
                      Signal Performance
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'BUY Signals',  value: buys,   color: '#10B981', bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.15)' },
                        { label: 'SELL Signals', value: sells,  color: '#EF4444', bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.15)' },
                        { label: 'HOLD Signals', value: holds,  color: '#EAB308', bg: 'rgba(234,179,8,0.06)',   border: 'rgba(234,179,8,0.15)' },
                        { label: 'Avg Confidence', value: avgConf ? `${avgConf}%` : '—', color: '#00A9BA', bg: 'rgba(0,169,186,0.06)', border: 'rgba(0,169,186,0.15)' },
                      ].map(({ label, value, color, bg, border }) => (
                        <div key={label} className="rounded-xl p-3" style={{ background: bg, border: `1px solid ${border}` }}>
                          <p className="text-[9px] uppercase tracking-widest mb-1" style={{ color: '#94A3B8' }}>{label}</p>
                          <p className="text-2xl font-bold font-mono" style={{ color }}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {lastPrice && (
                      <div className="mt-3 p-3 rounded-xl flex items-center gap-3"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] uppercase tracking-widest" style={{ color: '#94A3B8' }}>Latest Price</p>
                        <p className="text-sm font-bold font-mono ml-auto" style={{ color: '#E2E8F0' }}>
                          ${lastPrice.toFixed(6)}
                        </p>
                        <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                          HBAR/USDC · {history.length} signals logged
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Live HCS Signal Feed ─────────────────────────── */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#E2E8F0' }}>
                    <ActivityIcon size={14} style={{ color: '#00A9BA' }} />
                    HCS Signal Feed
                    {history.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                        style={{ background: 'rgba(0,169,186,0.1)', color: '#00A9BA', border: '1px solid rgba(0,169,186,0.2)' }}>
                        {history.length} msgs
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#94A3B8' }}>
                    <ShieldCheckIcon size={11} style={{ color: '#00A9BA' }} />
                    aBFT · Mirror Node
                  </div>
                </div>

                {history.length === 0 ? (
                  <div className="py-10 text-center">
                    <ClockIcon size={28} className="mx-auto mb-3" style={{ color: '#94A3B8' }} />
                    <p className="text-sm mb-1" style={{ color: '#CBD5E1' }}>No signals yet</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>
                      {detail.executionMode === 'AUTO'
                        ? 'Agent runs automatically on its BullMQ schedule.'
                        : 'Click "Run Trade" or "Test Run" above to execute a cycle.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 20).map((msg, i) => {
                      const isExec  = msg.decision?.signal === 'EXECUTION_RESULT';
                      const amtIn   = msg.decision?.indicators?.amountIn;
                      const amtOut  = msg.decision?.indicators?.amountOut;
                      const swapDir = msg.decision?.reasoning?.includes('HBAR_TO_USDC') ? 'HBAR → tUSDT' : msg.decision?.reasoning?.includes('USDC_TO_HBAR') ? 'tUSDT → HBAR' : '';
                      return (
                        <motion.div key={msg.seq}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          className="flex items-start gap-3 p-3 rounded-xl"
                          style={{
                            background: isExec ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.02)',
                            border: isExec ? '1px solid rgba(16,185,129,0.1)' : '1px solid rgba(255,255,255,0.03)',
                          }}>
                          {isExec ? (
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 whitespace-nowrap"
                              style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                              <CheckCircle2Icon size={10} />SWAP DONE
                            </span>
                          ) : (
                            <SignalBadge signal={msg.decision?.signal ?? '—'} />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-0.5">
                              <span className="text-xs font-mono" style={{ color: '#E2E8F0' }}>#{msg.seq}</span>
                              {msg.decision?.confidence != null && !isExec && (
                                <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                                  Confidence: <span style={{ color: '#CBD5E1' }}>{msg.decision.confidence}%</span>
                                </span>
                              )}
                              {msg.decision?.price != null && !isExec && (
                                <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                                  Price: <span style={{ color: '#CBD5E1' }}>${msg.decision.price.toFixed(6)}</span>
                                </span>
                              )}
                              {isExec && swapDir && (
                                <span className="text-[10px] flex items-center gap-1" style={{ color: '#94A3B8' }}>
                                  <ArrowRightLeftIcon size={10} style={{ color: '#10B981' }} />{swapDir}
                                </span>
                              )}
                              {isExec && amtIn != null && amtOut != null && (
                                <span className="text-[10px]" style={{ color: '#94A3B8' }}>
                                  <span style={{ color: '#CBD5E1' }}>{(Number(amtIn)/1e8).toFixed(4)}</span>
                                  {' → '}
                                  <span style={{ color: '#10B981' }}>{(Number(amtOut)/1e6).toFixed(4)}</span>
                                </span>
                              )}
                            </div>
                            {!isExec && msg.decision?.reasoning && (
                              <p className="text-[10px] leading-relaxed line-clamp-1" style={{ color: '#94A3B8' }}>
                                {msg.decision.reasoning}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="text-[10px]" style={{ color: '#94A3B8' }}>{relTime(msg.timestamp)}</span>
                            <a href={msg.hashscanUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-0.5 text-[10px] transition-colors hover:text-white"
                              style={{ color: '#94A3B8' }}>
                              HCS <ExternalLinkIcon size={9} />
                            </a>
                          </div>
                        </motion.div>
                      );
                    })}

                    {history.length > 20 && (
                      <Link href={`/agents/${selectedId}`}
                        className="w-full block text-center py-2 rounded-lg text-xs transition-all hover:opacity-80"
                        style={{ background: 'rgba(0,169,186,0.06)', border: '1px solid rgba(0,169,186,0.15)', color: '#00A9BA' }}>
                        View all {history.length} signals in Full Analytics →
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* ── Hedera IDs ───────────────────────────────────── */}
              <div className="glass-card p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: '#E2E8F0' }}>
                  <ShieldCheckIcon size={14} style={{ color: '#00A9BA' }} />
                  Hedera On-Chain IDs
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'HCS Topic ID', value: detail.hcsTopicId, href: `https://hashscan.io/${NETWORK}/topic/${detail.hcsTopicId}`, icon: ActivityIcon },
                    { label: 'HFS Config',   value: detail.hfsConfigId, href: detail.hfsConfigId ? `https://hashscan.io/${NETWORK}/file/${detail.hfsConfigId}` : '#', icon: FileTextIcon },
                    { label: 'Contract TxID',value: detail.contractTxId, href: detail.contractTxId ? `https://hashscan.io/${NETWORK}/transaction/${detail.contractTxId}` : '#', icon: ShieldCheckIcon },
                    { label: 'Config Hash',  value: detail.configHash ? detail.configHash.slice(0, 22) + '…' : null, href: '#', icon: ShieldCheckIcon },
                  ].map(({ label, value, href, icon: Icon }) => (
                    <div key={label} className="flex items-start gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(0,169,186,0.08)' }}>
                        <Icon size={13} style={{ color: '#00A9BA' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] mb-0.5" style={{ color: '#94A3B8' }}>{label}</p>
                        {value ? (
                          <a href={href} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs font-mono truncate transition-colors hover:text-white"
                            style={{ color: '#00A9BA' }}>
                            {value}<ExternalLinkIcon size={9} className="flex-shrink-0" />
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: '#475569' }}>—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── NFT Marketplace (if owner) ────────────────────── */}
              {detail.ownerId === accountId && (
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#E2E8F0' }}>
                      <StoreIcon size={14} style={{ color: '#00A9BA' }} />
                      NFT Marketplace
                    </h2>
                    {detail.listed ? (
                      <span className="text-[10px] px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                        ● Listed — {(detail as any).priceHbar ?? '?'} ℏ
                      </span>
                    ) : (
                      <span className="text-[10px] px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#94A3B8', border: '1px solid rgba(255,255,255,0.08)' }}>
                        Not listed
                      </span>
                    )}
                  </div>
                  {detail.listed ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                      <CheckCircle2Icon size={16} style={{ color: '#10B981' }} />
                      <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: '#10B981' }}>Listed on Marketplace</p>
                        <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
                          Serial #{(detail as any).serialNumber} · {(detail as any).priceHbar} ℏ · 5% royalty enforced
                        </p>
                      </div>
                      <Link href={`/marketplace/${selectedId}`}
                        className="text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all hover:opacity-80"
                        style={{ background: 'rgba(0,169,186,0.1)', color: '#00A9BA', border: '1px solid rgba(0,169,186,0.2)' }}>
                        View <ExternalLinkIcon size={10} />
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed mb-3" style={{ color: '#94A3B8' }}>
                      Mint this agent&apos;s strategy as an HTS NFT. Every resale pays you a 5% royalty — enforced at the Hedera protocol level.
                    </p>
                  )}
                  <Link href={`/agents/${selectedId}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs transition-all hover:opacity-80"
                    style={{ color: '#00A9BA' }}>
                    <TagIcon size={12} />
                    {detail.listed ? 'Manage listing in Full Detail →' : 'List on marketplace in Full Detail →'}
                  </Link>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        ) : null}
      </div>

      {/* Trade Approval Modal */}
      {pendingTrade && detail && (
        <TradeApprovalModal
          {...pendingTrade}
          agentId={selectedId!}
          agentName={detail.name}
          hcsTopicId={detail.hcsTopicId}
          onApprove={() => {
            setPendingTrade(null);
            fetch(`${API_URL}/api/agents/${selectedId}/history?limit=30`)
              .then(r => r.json()).then(d => setHistory(d.history ?? []));
            if (detail.agentAccountId) fetchPortfolio(detail.agentAccountId, detail.tradingBudgetHbar);
          }}
          onReject={() => setPendingTrade(null)}
        />
      )}
    </div>
  );
}
