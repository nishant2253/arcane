'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRightIcon, ShieldCheckIcon, ZapIcon, TrendingUpIcon,
  ActivityIcon, WalletIcon, BrainCircuitIcon, BarChart2Icon,
  TrendingDownIcon, CircleDotIcon, ArrowUpIcon, ArrowDownIcon,
  CheckCircle2Icon,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts';

// ── Animation variants ─────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.45 } } };
const stagger  = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };

// ── Ticker data ────────────────────────────────────────────────
const TICKERS = [
  { pair: 'HBAR/USDC',  price: '$0.0821', change: '+2.41%', up: true  },
  { pair: 'BTC/USDT',   price: '$67,420', change: '+0.83%', up: true  },
  { pair: 'ETH/USDC',   price: '$3,241',  change: '-0.34%', up: false },
  { pair: 'SOL/USDC',   price: '$172.4',  change: '+1.92%', up: true  },
  { pair: 'LINK/USDT',  price: '$14.82',  change: '+3.17%', up: true  },
  { pair: 'MATIC/USDC', price: '$0.892',  change: '-1.05%', up: false },
  { pair: 'AVAX/USDT',  price: '$38.61',  change: '+0.62%', up: true  },
  { pair: 'DOT/USDC',   price: '$7.43',   change: '-0.88%', up: false },
];

// ── Platform stats ─────────────────────────────────────────────
const STATS = [
  { value: '2.4M+',  label: 'HCS Messages',  sub: 'tamper-proof decisions', bars: [3, 5, 4, 7, 6, 8, 7] },
  { value: '18,432', label: 'AI Decisions',   sub: 'executed on-chain',      bars: [4, 6, 5, 8, 7, 9, 8] },
  { value: '347',    label: 'Active Agents',  sub: 'live & trading now',     bars: [2, 4, 3, 6, 5, 7, 8] },
  { value: '89',     label: 'Strategy NFTs',  sub: 'listed on marketplace',  bars: [5, 3, 6, 4, 7, 5, 6] },
];

// ── How it works steps ─────────────────────────────────────────
const STEPS = [
  {
    num: '01',
    icon: WalletIcon,
    title: 'Connect Wallet',
    desc: 'Connect HashPack in one click. Fund your agent\'s dedicated Hedera account with HBAR to begin trading.',
    color: '#00A9BA',
  },
  {
    num: '02',
    icon: BrainCircuitIcon,
    title: 'AI Decides',
    desc: 'Gemini + LangGraph ReAct loop analyzes live Pyth price feeds and writes the decision to HCS — before any trade.',
    color: '#8B5CF6',
  },
  {
    num: '03',
    icon: ActivityIcon,
    title: 'Swap Executes',
    desc: 'Only after HCS confirmation does the swap fire on MockDEX. Every execution is verifiable on HashScan forever.',
    color: '#10B981',
  },
];

// ── Static HBAR chart data (30 candles) ───────────────────────
const CHART_DATA = [
  { t: '00:00', p: 0.0791 }, { t: '01:00', p: 0.0798 }, { t: '02:00', p: 0.0784 },
  { t: '03:00', p: 0.0802 }, { t: '04:00', p: 0.0795 }, { t: '05:00', p: 0.0810 },
  { t: '06:00', p: 0.0823 }, { t: '07:00', p: 0.0819 }, { t: '08:00', p: 0.0831 },
  { t: '09:00', p: 0.0845 }, { t: '10:00', p: 0.0838 }, { t: '11:00', p: 0.0852 },
  { t: '12:00', p: 0.0847 }, { t: '13:00', p: 0.0861 }, { t: '14:00', p: 0.0858 },
  { t: '15:00', p: 0.0872 }, { t: '16:00', p: 0.0868 }, { t: '17:00', p: 0.0855 },
  { t: '18:00', p: 0.0841 }, { t: '19:00', p: 0.0849 }, { t: '20:00', p: 0.0863 },
  { t: '21:00', p: 0.0874 }, { t: '22:00', p: 0.0882 }, { t: '23:00', p: 0.0877 },
  { t: '24:00', p: 0.0891 }, { t: '25:00', p: 0.0886 }, { t: '26:00', p: 0.0901 },
  { t: '27:00', p: 0.0894 }, { t: '28:00', p: 0.0909 }, { t: '29:00', p: 0.0921 },
];
// signal dots: index → type
const BUY_SIGNALS  = [3, 9, 21, 26];
const SELL_SIGNALS = [11, 17];

// ── Strategy cards ─────────────────────────────────────────────
const STRATEGIES = [
  {
    icon: TrendingUpIcon,
    name: 'Trend Follow',
    tag: 'Active',
    tagColor: '#10B981',
    winRate: '64%',
    desc: 'EMA crossover with momentum confirmation. Rides sustained directional moves on HBAR.',
    color: '#00A9BA',
  },
  {
    icon: BarChart2Icon,
    name: 'Mean Revert',
    tag: 'Active',
    tagColor: '#10B981',
    winRate: '59%',
    desc: 'Bollinger Band squeeze + RSI extreme detection. Profits from overextended price swings.',
    color: '#8B5CF6',
  },
  {
    icon: ZapIcon,
    name: 'Breakout',
    tag: 'Active',
    tagColor: '#10B981',
    winRate: '61%',
    desc: 'Volume spike + consolidation breakout detection. Captures explosive momentum moves.',
    color: '#F59E0B',
  },
  {
    icon: TrendingDownIcon,
    name: 'Momentum',
    tag: 'Active',
    tagColor: '#10B981',
    winRate: '57%',
    desc: 'RSI + MACD divergence signals. Trades the acceleration and deceleration of price momentum.',
    color: '#EF4444',
  },
];

// ── Features ───────────────────────────────────────────────────
const FEATURES = [
  {
    icon: ZapIcon,
    title: 'AI Agent Engine',
    desc: 'Gemini 1.5 Flash + LangGraph ReAct loop makes trading decisions in milliseconds using live Pyth price feeds.',
    color: '#00A9BA',
  },
  {
    icon: ShieldCheckIcon,
    title: 'HCS Audit Trail',
    desc: 'Every decision is written to Hedera Consensus Service before any trade executes. aBFT-guaranteed, tamper-proof.',
    color: '#F59E0B',
  },
  {
    icon: TrendingUpIcon,
    title: 'SaucerSwap DEX',
    desc: 'Agents trade HBAR/USDC on SaucerSwap V2 via the Hedera Agent Kit — slippage-controlled, on-chain settlement.',
    color: '#10B981',
  },
  {
    icon: ActivityIcon,
    title: 'Strategy Marketplace',
    desc: 'List your agent as an HTS NFT with 5% royalty enforced at protocol level. Performance verified via Mirror Node.',
    color: '#8B5CF6',
  },
];

// ── Custom tooltip for chart ───────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 text-xs" style={{ minWidth: 110 }}>
      <p style={{ color: '#94A3B8' }}>{label}h</p>
      <p className="font-mono font-bold mt-0.5" style={{ color: '#00A9BA' }}>
        ${payload[0].value.toFixed(4)}
      </p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--ta-bg)' }}>

      {/* ══════════════════════════════════════════════════════════
          1. HERO
      ══════════════════════════════════════════════════════════ */}
      <section
        className="relative flex flex-col items-center justify-center text-center overflow-hidden grid-pattern"
        style={{ minHeight: '100vh', padding: '100px 24px 80px' }}
      >
        {/* Ambient glow orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div style={{
            position: 'absolute', top: '15%', left: '50%', transform: 'translateX(-50%)',
            width: 700, height: 700, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,169,186,0.13) 0%, transparent 65%)',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '5%',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(21,101,192,0.12) 0%, transparent 65%)',
          }} />
          <div style={{
            position: 'absolute', top: '30%', left: '5%',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)',
          }} />
        </div>

        {/* Live badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-semibold"
          style={{
            background: 'rgba(0,169,186,0.08)',
            border: '1px solid rgba(0,169,186,0.3)',
            color: '#00A9BA',
          }}
        >
          <span className="live-dot w-2 h-2 rounded-full inline-block" style={{ background: '#00A9BA' }} />
          LIVE · Hedera Testnet · APEX Hackathon 2026
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: 'clamp(2rem, 6vw, 5rem)',
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            marginBottom: 20,
            maxWidth: 900,
            color: '#E2E8F0',
          }}
        >
          Autonomous AI Trading
          <br />
          <span className="gradient-text">On-Chain. Verified. Unstoppable.</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          className="text-base md:text-lg max-w-2xl mb-10"
          style={{ color: '#94A3B8', lineHeight: 1.75 }}
        >
          Deploy AI agents that write every decision to Hedera HCS{' '}
          <em>before</em> any trade executes. aBFT-guaranteed audit trail —
          no trust required. Verify any execution on HashScan in one click.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.34 }}
          className="flex flex-col sm:flex-row items-center gap-4 mb-16"
        >
          <Link
            href="/agents"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-200 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #00A9BA, #1565C0)',
              color: '#fff',
              boxShadow: '0 0 28px rgba(0,169,186,0.4)',
            }}
          >
            Launch Your Agent
            <ArrowRightIcon size={16} />
          </Link>
          <Link
            href="/marketplace"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-200 hover:border-[rgba(0,169,186,0.5)]"
            style={{
              color: '#94A3B8',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            Explore Marketplace
          </Link>
        </motion.div>

        {/* Floating terminal card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.48 }}
          className="float-card glass-card px-5 py-4 w-full max-w-sm text-left"
          style={{
            background: 'rgba(10,14,22,0.85)',
            border: '1px solid rgba(0,169,186,0.2)',
            boxShadow: '0 0 40px rgba(0,169,186,0.1)',
          }}
        >
          {/* Terminal header */}
          <div className="flex items-center gap-2 mb-3 pb-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#EF4444' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#F59E0B' }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10B981' }} />
            <span className="text-[10px] ml-2 font-mono" style={{ color: '#94A3B8' }}>agent-terminal · live</span>
          </div>
          {/* Rows */}
          {[
            { label: 'HBAR/USDC',    value: '$0.0821',  color: '#10B981', icon: ArrowUpIcon },
            { label: 'Last Signal',  value: 'BUY ↑ 87%', color: '#00A9BA', icon: null },
            { label: 'HCS Seq #',    value: '1,847,291', color: '#8B5CF6', icon: null },
            { label: 'Agent Status', value: 'RUNNING',   color: '#10B981', icon: null },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-1.5">
              <span className="text-xs" style={{ color: '#94A3B8' }}>{row.label}</span>
              <span className="text-xs font-mono font-semibold flex items-center gap-1" style={{ color: row.color }}>
                {row.icon && <row.icon size={10} />}
                {row.value}
              </span>
            </div>
          ))}
          {/* Progress bar */}
          <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex justify-between text-[10px] mb-1.5" style={{ color: '#94A3B8' }}>
              <span>Cycle Progress</span>
              <span style={{ color: '#00A9BA' }}>73%</span>
            </div>
            <div className="w-full h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: '73%', background: 'linear-gradient(90deg, #00A9BA, #1565C0)' }} />
            </div>
          </div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
        >
          <span className="text-[10px] tracking-widest uppercase" style={{ color: '#94A3B8' }}>Scroll</span>
          <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, rgba(0,169,186,0.5), transparent)' }} />
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          2. TICKER STRIP
      ══════════════════════════════════════════════════════════ */}
      <div
        className="overflow-hidden relative"
        style={{
          background: 'rgba(6,10,16,0.9)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          padding: '12px 0',
        }}
      >
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, rgba(6,10,16,1), transparent)' }} />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, rgba(6,10,16,1), transparent)' }} />

        <div className="ticker-scroll">
          {/* Duplicate for seamless loop */}
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <div key={i} className="flex items-center gap-3 px-6 whitespace-nowrap">
              <span className="text-xs font-semibold font-mono" style={{ color: '#94A3B8' }}>{t.pair}</span>
              <span className="text-xs font-mono font-bold" style={{ color: '#E2E8F0' }}>{t.price}</span>
              <span className="text-xs font-mono flex items-center gap-0.5" style={{ color: t.up ? '#10B981' : '#EF4444' }}>
                {t.up ? <ArrowUpIcon size={10} /> : <ArrowDownIcon size={10} />}
                {t.change}
              </span>
              <span style={{ color: '#94A3B8', fontSize: 10 }}>●</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          3. PLATFORM STATS
      ══════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-5"
        >
          {STATS.map((s) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              className="glass-card p-6 text-center relative overflow-hidden"
            >
              {/* Background glow */}
              <div className="absolute inset-0 pointer-events-none" style={{
                background: 'radial-gradient(circle at 50% 0%, rgba(0,169,186,0.06) 0%, transparent 70%)',
              }} />
              {/* Sparkline bars */}
              <div className="flex items-end justify-center gap-0.5 h-6 mb-4">
                {s.bars.map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-sm"
                    style={{
                      height: `${h * 12}%`,
                      background: i === s.bars.length - 1
                        ? '#00A9BA'
                        : `rgba(0,169,186,${0.2 + i * 0.08})`,
                    }}
                  />
                ))}
              </div>
              <p
                className="font-display text-3xl font-bold mb-1"
                style={{
                  background: 'linear-gradient(135deg, #00A9BA, #60A5FA)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {s.value}
              </p>
              <p className="text-xs font-semibold font-display tracking-wider mb-1" style={{ color: '#E2E8F0' }}>
                {s.label}
              </p>
              <p className="text-[10px]" style={{ color: '#94A3B8' }}>{s.sub}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          4. HOW IT WORKS
      ══════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-14"
        >
          <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#00A9BA' }}>
            The Process
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: '#E2E8F0' }}>
            How <span style={{ color: '#00A9BA' }}>Arcane</span> Works
          </h2>
        </motion.div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Connecting line — desktop only */}
          <div
            className="hidden md:block absolute top-12 left-1/6 right-1/6 h-px"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(0,169,186,0.3), rgba(0,169,186,0.3), transparent)',
              top: '52px',
              left: '22%',
              right: '22%',
            }}
          />

          {STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.12 }}
              className="glass-card p-7 text-center relative"
            >
              {/* Step number */}
              <div
                className="font-display text-5xl font-bold mb-4 leading-none"
                style={{
                  background: `linear-gradient(135deg, ${step.color}, transparent)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  opacity: 0.4,
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  fontSize: 64,
                }}
              >
                {step.num}
              </div>
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `${step.color}18`, border: `1px solid ${step.color}30` }}
              >
                <step.icon size={24} style={{ color: step.color }} />
              </div>
              <h3 className="font-semibold font-display text-sm mb-2 tracking-wide" style={{ color: '#E2E8F0' }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          5. LIVE CHART SECTION
      ══════════════════════════════════════════════════════════ */}
      <section
        className="py-24 relative overflow-hidden"
        style={{ background: 'rgba(6,10,18,0.6)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        {/* Background grid */}
        <div className="absolute inset-0 grid-pattern opacity-40 pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#00A9BA' }}>
                Live Intelligence
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-5" style={{ color: '#E2E8F0' }}>
                Real-Time Price Analysis
                <br />
                <span style={{ color: '#00A9BA' }}>With AI Signal Overlay</span>
              </h2>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#94A3B8' }}>
                Every 15 minutes, the agent fetches the live HBAR/USDC price from
                the Pyth oracle, runs the full indicator stack (EMA, RSI, MACD, Bollinger),
                and emits a BUY / SELL / HOLD decision — all written to HCS before execution.
              </p>
              {/* Signal legend */}
              <div className="flex items-center gap-5 mb-7">
                {[
                  { label: 'BUY Signal',  color: '#10B981' },
                  { label: 'SELL Signal', color: '#EF4444' },
                  { label: 'Price Line',  color: '#00A9BA' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                    <span className="text-xs" style={{ color: '#94A3B8' }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <Link
                href="https://hashscan.io/testnet"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-80"
                style={{ color: '#00A9BA', border: '1px solid rgba(0,169,186,0.3)', background: 'rgba(0,169,186,0.06)' }}
              >
                View Live on HashScan
                <ArrowRightIcon size={14} />
              </Link>
            </motion.div>

            {/* Right: chart */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="glass-card p-5"
              style={{ background: 'rgba(10,14,22,0.8)' }}
            >
              {/* Chart header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm" style={{ color: '#E2E8F0' }}>HBAR/USDC</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}>
                    ▲ +1.42%
                  </span>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: '#00A9BA' }}>$0.0921</span>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={CHART_DATA} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00A9BA" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00A9BA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fill: '#334155', fontSize: 9 }} tickLine={false} axisLine={false} interval={5} />
                  <YAxis tick={{ fill: '#334155', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v.toFixed(3)} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="p"
                    stroke="#00A9BA"
                    strokeWidth={2}
                    fill="url(#chartGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#00A9BA', stroke: '#0A0A0F', strokeWidth: 2 }}
                  />
                  {BUY_SIGNALS.map(idx => (
                    <ReferenceDot key={`buy-${idx}`} x={CHART_DATA[idx].t} y={CHART_DATA[idx].p}
                      r={5} fill="#10B981" stroke="#0A0A0F" strokeWidth={1.5} />
                  ))}
                  {SELL_SIGNALS.map(idx => (
                    <ReferenceDot key={`sell-${idx}`} x={CHART_DATA[idx].t} y={CHART_DATA[idx].p}
                      r={5} fill="#EF4444" stroke="#0A0A0F" strokeWidth={1.5} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>

              {/* Footer stats */}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {[
                  { label: 'Signals Today', value: '6' },
                  { label: 'Win Rate',      value: '83%' },
                  { label: 'HCS Writes',    value: '48' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-sm font-bold font-mono" style={{ color: '#00A9BA' }}>{s.value}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          6. STRATEGY CARDS
      ══════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center mb-14"
        >
          <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#00A9BA' }}>
            Battle-Tested Algorithms
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: '#E2E8F0' }}>
            Four <span style={{ color: '#00A9BA' }}>Strategy</span> Types
          </h2>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {STRATEGIES.map((s) => (
            <motion.div
              key={s.name}
              variants={fadeUp}
              className="glass-card p-6 group cursor-default"
              style={{ borderTop: `3px solid ${s.color}40` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}
                  >
                    <s.icon size={20} style={{ color: s.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold font-display text-sm tracking-wide" style={{ color: '#E2E8F0' }}>{s.name}</h3>
                    <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Algorithmic Strategy</p>
                  </div>
                </div>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: `${s.tagColor}15`, color: s.tagColor, border: `1px solid ${s.tagColor}30` }}
                >
                  {s.tag}
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: '#94A3B8' }}>{s.desc}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CircleDotIcon size={11} style={{ color: s.color }} />
                  <span className="text-xs" style={{ color: '#94A3B8' }}>Avg Win Rate</span>
                </div>
                <span className="text-sm font-bold font-mono" style={{ color: s.color }}>{s.winRate}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          7. FEATURES GRID
      ══════════════════════════════════════════════════════════ */}
      <section
        className="py-24 relative"
        style={{ background: 'rgba(6,10,18,0.5)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-center mb-14"
          >
            <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#00A9BA' }}>
              Infrastructure
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-bold" style={{ color: '#E2E8F0' }}>
              Built on <span style={{ color: '#00A9BA' }}>Hedera</span>'s Full Stack
            </h2>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {FEATURES.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="glass-card p-7 flex gap-5 group cursor-default"
                style={{ borderTop: `3px solid ${f.color}30` }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                  style={{ background: `${f.color}18`, border: `1px solid ${f.color}28` }}
                >
                  <f.icon size={22} style={{ color: f.color }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-sm font-display tracking-wide" style={{ color: '#E2E8F0' }}>{f.title}</h3>
                    <ArrowRightIcon
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 -translate-x-1 group-hover:translate-x-0"
                      style={{ color: f.color, transition: 'all 0.2s' }}
                    />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          8. FINAL CTA — HCS Invariant
      ══════════════════════════════════════════════════════════ */}
      <section className="max-w-5xl mx-auto px-4 py-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="glass-card p-12 text-center relative overflow-hidden grid-pattern"
          style={{
            background: 'rgba(0,169,186,0.03)',
            border: '1px solid rgba(0,169,186,0.2)',
            boxShadow: '0 0 60px rgba(0,169,186,0.08)',
          }}
        >
          {/* Background orb */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 500, height: 500, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,169,186,0.07) 0%, transparent 70%)',
            }} />
          </div>

          {/* Shield icon with glow */}
          <div className="glow-pulse inline-block mb-6">
            <ShieldCheckIcon size={48} style={{ color: '#00A9BA' }} />
          </div>

          {/* Verified badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5 text-[10px] font-semibold"
            style={{ background: 'rgba(0,169,186,0.08)', border: '1px solid rgba(0,169,186,0.25)', color: '#00A9BA' }}>
            <CheckCircle2Icon size={10} />
            aBFT Guaranteed · Tamper-Proof
          </div>

          <h2 className="font-display text-2xl md:text-3xl font-bold mb-4 relative" style={{ color: '#E2E8F0' }}>
            Every Decision is{' '}
            <span className="gradient-text">Verifiable</span>
          </h2>

          <p className="text-sm max-w-2xl mx-auto mb-8 relative" style={{ color: '#94A3B8', lineHeight: 1.85 }}>
            The HCS Write-Before-Trade invariant is enforced in code — not policy. Every AI decision
            is written to Hedera Consensus Service <strong style={{ color: '#94A3B8' }}>before</strong> any
            swap executes on SaucerSwap. If HCS write fails, the trade does not happen.
            Verify any execution on HashScan in one click.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative">
            <Link
              href="/agents"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-200 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #00A9BA, #1565C0)',
                color: '#fff',
                boxShadow: '0 0 24px rgba(0,169,186,0.35)',
              }}
            >
              Launch Your Agent
              <ArrowRightIcon size={16} />
            </Link>
            <Link
              href="https://hashscan.io/testnet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ color: '#00A9BA', border: '1px solid rgba(0,169,186,0.3)', background: 'rgba(0,169,186,0.06)' }}
            >
              Open HashScan ↗
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer strip ────────────────────────────────────────── */}
      <footer
        className="text-center py-6 text-[11px]"
        style={{ color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        Arcane · Hedera APEX Hackathon 2026 · Track 1: AI &amp; Agents · Built with Hedera HCS · HTS · HSCS
      </footer>
    </div>
  );
}
