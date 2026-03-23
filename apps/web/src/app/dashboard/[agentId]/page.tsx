'use client';

import { useEffect, useState, use, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeftIcon, ExternalLinkIcon, ShieldCheckIcon,
  TrendingUpIcon, ActivityIcon, BarChart2Icon,
  RefreshCwIcon, AlertCircleIcon, PlayIcon, CandlestickChartIcon,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK  = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

// ── OHLCV types & candlestick helpers ──────────────────────────────
interface OHLCVBar {
  time:  number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
  label: string;
}

// Custom recharts shape: renders one candlestick candle.
// Bar dataKey="high" with baseValue=dataset-min so recharts gives us the
// full vertical span (high → baseValue) as y / height in pixel coords.
const CandleShape = (props: any) => {
  const { x, y, width, height, payload, background } = props;
  if (!payload || !height || height <= 0) return null;

  const { open, high, low, close } = payload as OHLCVBar;
  const priceSpan = high - low;
  if (priceSpan === 0) return null;

  // recharts: y = top pixel (price = high), y+height = bottom pixel (price = baseValue)
  // We need to map from high..baseValue, but we only have high..low in payload.
  // Use the bar's own high-to-low span to compute the sub-pixel positions.
  const fullSpanPx = height;                       // pixels for (high - baseValue)
  const baseValue  = payload._baseValue ?? low;
  const totalPriceRange = high - baseValue;
  if (totalPriceRange === 0) return null;

  const scale = fullSpanPx / totalPriceRange;       // px per price unit

  const yHigh  = y;
  const yOpen  = y + (high - open)  * scale;
  const yClose = y + (high - close) * scale;
  const yLow   = y + (high - low)   * scale;       // bottom of wick

  const isUp    = close >= open;
  const color   = isUp ? '#22C55E' : '#EF4444';
  const bodyTop = Math.min(yOpen, yClose);
  const bodyBot = Math.max(yOpen, yClose);
  const bodyH   = Math.max(1.5, bodyBot - bodyTop);
  const cx      = x + width / 2;
  const bx      = x + width * 0.15;
  const bw      = Math.max(2, width * 0.7);

  return (
    <g>
      <line x1={cx} y1={yHigh} x2={cx} y2={bodyTop}  stroke={color} strokeWidth={1.5} />
      <line x1={cx} y1={bodyBot} x2={cx} y2={yLow}  stroke={color} strokeWidth={1.5} />
      <rect x={bx} y={bodyTop} width={bw} height={bodyH}
        fill={isUp ? 'transparent' : color} stroke={color} strokeWidth={1.5} rx={1} />
    </g>
  );
};

interface EquityPoint    { timestamp: number; equity: number }
interface TradePair {
  entrySignal: { signal: string; price: number; confidence: number; timestamp: number };
  exitSignal:  { signal: string; price: number; confidence: number; timestamp: number };
  pnlPct: number;
}
interface AgentPerf {
  winRate: number; profitFactor: number; sharpeRatio: number;
  expectancy: number; maxDrawdown: number; totalTrades: number;
  avgWin: number; avgLoss: number; finalReturn: number; rMultiple: number;
  equityCurve: EquityPoint[];
  recentTrades: TradePair[];
  signalDist: { BUY: number; SELL: number; HOLD: number };
  hcsTopicId: string; totalHCSMsgs: number; source: string;
}
interface HCSEntry {
  seq: number;
  decision: { signal: string; price: number; confidence: number; reasoning: string };
  hashscanUrl: string;
}

// ── MetricCard ──────────────────────────────────────────────────────
function MetricCard({
  label, value, subtext, color, inverted = false,
}: {
  label: string; value: string | number; subtext: string; color: string; inverted?: boolean;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-[#0D1B2A] rounded-xl p-4 border border-gray-800/60"
    >
      <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color }}>
        {value ?? '—'}
      </p>
      <p className="text-[11px] text-gray-400 mt-1">{subtext}</p>
    </motion.div>
  );
}

// ── SignalBadge ─────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: string }) {
  const cls =
    signal === 'BUY'  ? 'bg-green-900/50 text-green-400 border-green-700/40' :
    signal === 'SELL' ? 'bg-red-900/50 text-red-400 border-red-700/40' :
                        'bg-gray-800 text-gray-400 border-gray-700/40';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cls}`}>
      {signal}
    </span>
  );
}

// ── DashboardSkeleton ───────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6 animate-pulse">
      <div className="h-10 bg-gray-800 rounded-lg w-64 mb-6" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-900 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-64 bg-gray-900 rounded-xl" />
        <div className="h-64 bg-gray-900 rounded-xl" />
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────
export default function AgentDashboard({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  const [perf,       setPerf]       = useState<AgentPerf | null>(null);
  const [history,    setHistory]    = useState<HCSEntry[]>([]);
  const [ohlcv,      setOhlcv]      = useState<OHLCVBar[]>([]);
  const [ohlcvDays,  setOhlcvDays]  = useState<7 | 14 | 30>(7);
  const [loading,    setLoading]    = useState(true);
  const [ohlcvLoading, setOhlcvLoading] = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [triggering,  setTriggering] = useState(false);

  async function loadData() {
    try {
      const [perfRes, histRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/${agentId}/performance`),
        fetch(`${API_URL}/api/agents/${agentId}/history?limit=50`),
      ]);
      if (!perfRes.ok) {
        const errData = await perfRes.json().catch(() => ({}));
        throw new Error((errData as any).error || `Analytics fetch failed (${perfRes.status})`);
      }
      const [p, h] = await Promise.all([perfRes.json(), histRes.json()]);
      setPerf(p);
      setHistory(h.history ?? []);
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const loadOhlcv = useCallback(async (days: 7 | 14 | 30) => {
    setOhlcvLoading(true);
    try {
      const url = `https://api.coingecko.com/api/v3/coins/hedera-hashgraph/ohlc?vs_currency=usd&days=${days}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('CoinGecko unavailable');
      const raw: number[][] = await res.json();
      const bars: OHLCVBar[] = raw.map(([t, o, h, l, c]) => ({
        time: t,
        open: o, high: h, low: l, close: c,
        label: new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }));
      setOhlcv(bars);
    } catch {
      setOhlcv([]);
    } finally {
      setOhlcvLoading(false);
    }
  }, []);

  // Trigger one manual agent cycle (dry-run = false for live signals)
  const triggerCycle = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`${API_URL}/api/agents/${agentId}/run`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dryRun: false }),
      });
      if (res.ok) {
        await new Promise(r => setTimeout(r, 2000));
        await loadData();
      }
    } catch { /* ignore */ } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    loadData();
    loadOhlcv(ohlcvDays);
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [agentId]);

  useEffect(() => {
    loadOhlcv(ohlcvDays);
  }, [ohlcvDays, loadOhlcv]);

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-center">
          <AlertCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 font-mono">{error}</p>
          <Link href={`/agents/${agentId}`} className="text-[#00A9BA] text-sm mt-4 block hover:underline">
            ← Back to agent
          </Link>
        </div>
      </div>
    );
  }

  if (!perf) return null;

  const donutData = [
    { name: 'BUY',  value: perf.signalDist.BUY  },
    { name: 'SELL', value: perf.signalDist.SELL },
    { name: 'HOLD', value: perf.signalDist.HOLD },
  ];
  const DONUT_COLORS = ['#22C55E', '#EF4444', '#374151'];

  // Format equity curve for Recharts
  const eqData = perf.equityCurve.map(p => ({
    ...p,
    label: p.timestamp ? new Date(p.timestamp).toLocaleDateString() : '',
  }));

  // Trade history bars
  const tradeBarData = perf.recentTrades.map((t, i) => ({
    name:   `T${i + 1}`,
    pnl:    parseFloat(t.pnlPct.toFixed(2)),
    signal: t.entrySignal.signal,
  }));

  // OHLCV candlestick prep: add _baseValue so CandleShape can compute pixel ratios
  const ohlcvBaseValue = ohlcv.length > 0 ? Math.min(...ohlcv.map(b => b.low)) * 0.998 : 0;
  const ohlcvCandleData = ohlcv.map(b => ({ ...b, _baseValue: ohlcvBaseValue }));

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <div className="border-b border-gray-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/agents/${agentId}`}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Agent
          </Link>
          <div className="h-5 w-px bg-gray-700" />
          <div className="flex items-center gap-2">
            <BarChart2Icon className="w-4 h-4 text-[#00A9BA]" />
            <span className="font-bold text-sm">Analytics Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-gray-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 text-xs text-[#00A9BA] hover:text-white transition-colors"
          >
            <RefreshCwIcon className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Mirror Node proof banner */}
        <div className="flex items-center gap-3 bg-[#00A9BA]/8 border border-[#00A9BA]/25 rounded-xl p-3">
          <ShieldCheckIcon className="w-4 h-4 text-[#00A9BA] shrink-0" />
          <span className="text-sm text-gray-300">
            All metrics sourced from{' '}
            <b className="text-[#00A9BA]">Hedera Mirror Node</b> — cryptographically verifiable.{' '}
            <span className="text-gray-400">{perf.totalHCSMsgs} HCS messages on topic {perf.hcsTopicId}</span>
          </span>
          <a
            href={`https://hashscan.io/${NETWORK}/topic/${perf.hcsTopicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[#00A9BA] text-xs hover:underline shrink-0"
          >
            Verify on HashScan
            <ExternalLinkIcon className="w-3 h-3" />
          </a>
        </div>

        {/* 8 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="Win Rate"
            value={`${perf.winRate.toFixed(1)}%`}
            subtext={`${perf.totalTrades} trades`}
            color={perf.winRate >= 50 ? '#22C55E' : '#EF4444'}
          />
          <MetricCard
            label="Profit Factor"
            value={perf.profitFactor.toFixed(2)}
            subtext="Total gain / total loss"
            color={perf.profitFactor >= 1.5 ? '#22C55E' : perf.profitFactor >= 1 ? '#F59E0B' : '#EF4444'}
          />
          <MetricCard
            label="Sharpe Ratio"
            value={perf.sharpeRatio.toFixed(2)}
            subtext="Risk-adjusted return"
            color={perf.sharpeRatio >= 1 ? '#22C55E' : '#F59E0B'}
          />
          <MetricCard
            label="Max Drawdown"
            value={`${perf.maxDrawdown.toFixed(1)}%`}
            subtext="Peak to trough"
            color={perf.maxDrawdown <= 15 ? '#22C55E' : '#EF4444'}
          />
          <MetricCard
            label="Avg Win"
            value={`+${perf.avgWin.toFixed(2)}%`}
            subtext="Per winning trade"
            color="#22C55E"
          />
          <MetricCard
            label="Avg Loss"
            value={`-${perf.avgLoss.toFixed(2)}%`}
            subtext="Per losing trade"
            color="#EF4444"
          />
          <MetricCard
            label="Expectancy"
            value={`${perf.expectancy >= 0 ? '+' : ''}${perf.expectancy.toFixed(3)}%`}
            subtext="Expected return / trade"
            color={perf.expectancy >= 0 ? '#22C55E' : '#EF4444'}
          />
          <MetricCard
            label="Total Signals"
            value={perf.totalHCSMsgs}
            subtext="HCS messages"
            color="#00A9BA"
          />
        </div>

        {/* ── HBAR/USD Candlestick Price Chart ────────────────────── */}
        <div className="bg-[#0D1B2A] rounded-xl p-5 border border-gray-800/60">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CandlestickChartIcon className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                HBAR / USD Price Chart
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {([7, 14, 30] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setOhlcvDays(d)}
                  className={`text-[10px] px-2 py-1 rounded transition-colors ${
                    ohlcvDays === d
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
                      : 'text-gray-400 border border-gray-700/40 hover:border-gray-600'
                  }`}
                >
                  {d}D
                </button>
              ))}
            </div>
          </div>

          {ohlcvLoading ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#F59E0B', borderTopColor: 'transparent' }} />
            </div>
          ) : ohlcv.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              Price data unavailable (CoinGecko rate-limited). Refresh in a moment.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={ohlcvCandleData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="label"
                  stroke="#374151"
                  tick={{ fontSize: 9, fill: '#6B7280' }}
                  tickLine={false}
                  interval={Math.floor(ohlcv.length / 6)}
                />
                <YAxis
                  domain={[ohlcvBaseValue, 'auto']}
                  stroke="#374151"
                  tick={{ fontSize: 9, fill: '#6B7280' }}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(4)}`}
                  width={56}
                />
                <Tooltip
                  contentStyle={{ background: '#0D1B2A', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number, name: string, item: any) => {
                    const d = item?.payload as OHLCVBar;
                    if (!d) return [v.toFixed(6), name];
                    return [
                      `O:$${d.open.toFixed(5)}  H:$${d.high.toFixed(5)}  L:$${d.low.toFixed(5)}  C:$${d.close.toFixed(5)}`,
                      'OHLC',
                    ];
                  }}
                  labelFormatter={(label) => `${label}`}
                />
                <Bar
                  dataKey="high"
                  shape={<CandleShape />}
                  isAnimationActive={false}
                  minPointSize={1}
                  baseValue={ohlcvBaseValue}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {ohlcv.length > 0 && (
            <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
              <span>
                Latest: <strong className="text-white">${ohlcv[ohlcv.length - 1]?.close.toFixed(5)}</strong>
              </span>
              <span>
                24h High: <strong className="text-green-400">${Math.max(...ohlcv.slice(-6).map(b => b.high)).toFixed(5)}</strong>
              </span>
              <span>
                24h Low: <strong className="text-red-400">${Math.min(...ohlcv.slice(-6).map(b => b.low)).toFixed(5)}</strong>
              </span>
              <span className="ml-auto text-gray-500">via CoinGecko</span>
            </div>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4">
          {/* Equity Curve — 2/3 width */}
          <div className="col-span-2 bg-[#0D1B2A] rounded-xl p-5 border border-gray-800/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Equity Curve
              </h3>
              <span className="text-xs text-gray-400">Indexed to 100</span>
            </div>
            {eqData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={eqData}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00A9BA" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00A9BA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis
                    dataKey="label"
                    stroke="#374151"
                    tick={{ fontSize: 9, fill: '#6B7280' }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#374151"
                    tick={{ fontSize: 9, fill: '#6B7280' }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#0D1B2A', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`${v.toFixed(2)}`, 'Equity']}
                  />
                  <ReferenceLine y={100} stroke="#374151" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="equity"
                    stroke="#00A9BA"
                    strokeWidth={2}
                    fill="url(#eqGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
                Not enough trade data yet. Run trade cycles to build the equity curve.
              </div>
            )}
          </div>

          {/* Signal Distribution Donut — 1/3 width */}
          <div className="bg-[#0D1B2A] rounded-xl p-5 border border-gray-800/60">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Signal Distribution
            </h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0D1B2A', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-around text-[10px] mt-2">
              <span className="text-green-400">● BUY: {perf.signalDist.BUY}</span>
              <span className="text-red-400">● SELL: {perf.signalDist.SELL}</span>
              <span className="text-gray-400">● HOLD: {perf.signalDist.HOLD}</span>
            </div>
          </div>
        </div>

        {/* Trade P&L Bar Chart + HCS Feed */}
        <div className="grid grid-cols-2 gap-4">
          {/* Trade P&L bars */}
          <div className="bg-[#0D1B2A] rounded-xl p-5 border border-gray-800/60">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              Recent Trade P&amp;L
            </h3>
            {tradeBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={tradeBarData} barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                  <XAxis dataKey="name" stroke="#374151" tick={{ fontSize: 9, fill: '#6B7280' }} tickLine={false} />
                  <YAxis stroke="#374151" tick={{ fontSize: 9, fill: '#6B7280' }} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: '#0D1B2A', border: '1px solid #1E293B', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [`${v > 0 ? '+' : ''}${v}%`, 'P&L']}
                  />
                  <ReferenceLine y={0} stroke="#374151" />
                  <Bar dataKey="pnl" fill="#00A9BA" radius={[3, 3, 0, 0]}
                    label={false}
                  >
                    {tradeBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#22C55E' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-gray-400 text-sm">
                No completed trade pairs yet.
              </div>
            )}
          </div>

          {/* Live HCS Decision Feed */}
          <div className="bg-[#0D1B2A] rounded-xl p-5 border border-gray-800/60 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Live HCS Decision Feed
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#00A9BA] font-mono">aBFT timestamped</span>
                {history.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                )}
              </div>
            </div>

            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,169,186,0.08)', border: '1px solid rgba(0,169,186,0.2)' }}>
                  <ActivityIcon className="w-5 h-5 text-[#00A9BA]" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-300 font-semibold mb-1">No HCS signals yet</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    Run the first agent cycle to generate<br />a decision and write it to Hedera.
                  </p>
                </div>
                <button
                  onClick={triggerCycle}
                  disabled={triggering}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg,#00A9BA,#1565C0)',
                    color: '#fff',
                    boxShadow: '0 0 12px rgba(0,169,186,0.25)',
                  }}
                >
                  {triggering ? (
                    <>
                      <div className="w-3 h-3 rounded-full border border-t-transparent animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                      Running…
                    </>
                  ) : (
                    <>
                      <PlayIcon className="w-3 h-3" />
                      Run Agent Cycle
                    </>
                  )}
                </button>
                <a
                  href={`https://hashscan.io/${NETWORK}/topic/${perf.hcsTopicId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#00A9BA] hover:underline flex items-center gap-1"
                >
                  Verify topic on HashScan <ExternalLinkIcon className="w-2.5 h-2.5" />
                </a>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                {history.map((msg, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-[#0A1628] hover:bg-[#0D2137] transition-colors"
                  >
                    <SignalBadge signal={msg.decision?.signal ?? '?'} />
                    <span className="text-[11px] text-gray-400 font-mono flex-1">
                      ${(msg.decision?.price ?? 0).toFixed(4)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {msg.decision?.confidence ?? 0}%
                    </span>
                    <a
                      href={msg.hashscanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#00A9BA] hover:underline shrink-0"
                    >
                      #{msg.seq}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trade History Table */}
        <div className="bg-[#0D1B2A] rounded-xl border border-gray-800/60">
          <div className="px-5 py-4 border-b border-gray-800/60 flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Trade History (last 20)
            </h3>
            <span className="text-[10px] text-gray-400">Entry → Exit → P&amp;L</span>
          </div>
          {perf.recentTrades.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400 text-sm">
              No closed trade pairs yet. Trade pairs are formed when two consecutive BUY/SELL signals appear.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800/40">
                    <th className="text-left px-5 py-2.5 text-gray-400 font-medium">Type</th>
                    <th className="text-right px-5 py-2.5 text-gray-400 font-medium">Entry Price</th>
                    <th className="text-right px-5 py-2.5 text-gray-400 font-medium">Exit Price</th>
                    <th className="text-right px-5 py-2.5 text-gray-400 font-medium">P&amp;L</th>
                    <th className="text-right px-5 py-2.5 text-gray-400 font-medium">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {perf.recentTrades.map((t, i) => (
                    <tr key={i} className="border-b border-gray-900/60 hover:bg-gray-900/20 transition-colors">
                      <td className="px-5 py-3">
                        <SignalBadge signal={t.entrySignal.signal} />
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-300">
                        ${t.entrySignal.price.toFixed(4)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-300">
                        ${t.exitSignal.price.toFixed(4)}
                      </td>
                      <td className={`px-5 py-3 text-right font-bold font-mono ${t.pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                      </td>
                      <td className="px-5 py-3 text-right text-gray-400">
                        {t.entrySignal.confidence}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom stats summary */}
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div className="bg-[#0D1B2A] rounded-xl p-4 border border-gray-800/60 flex items-start gap-3">
            <TrendingUpIcon className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 mb-0.5">R-Multiple</p>
              <p className="font-bold font-mono text-white text-base">{perf.rMultiple.toFixed(2)}×</p>
              <p className="text-gray-400 mt-0.5">Avg win / avg loss ratio</p>
            </div>
          </div>
          <div className="bg-[#0D1B2A] rounded-xl p-4 border border-gray-800/60 flex items-start gap-3">
            <ActivityIcon className="w-4 h-4 text-[#00A9BA] mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 mb-0.5">Final Return</p>
              <p className={`font-bold font-mono text-base ${perf.finalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {perf.finalReturn >= 0 ? '+' : ''}{perf.finalReturn.toFixed(1)}%
              </p>
              <p className="text-gray-400 mt-0.5">From start equity = 100</p>
            </div>
          </div>
          <div className="bg-[#0D1B2A] rounded-xl p-4 border border-gray-800/60 flex items-start gap-3">
            <ShieldCheckIcon className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-gray-400 mb-0.5">Data Source</p>
              <p className="font-bold text-white text-base">Mirror Node</p>
              <p className="text-gray-400 mt-0.5">{perf.totalHCSMsgs} HCS msgs verified</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
