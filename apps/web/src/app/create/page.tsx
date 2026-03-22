'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  SendIcon, BotIcon, UserIcon, ZapIcon, 
  SparklesIcon, Loader2 
} from 'lucide-react';
import { 
  TopicCreateTransaction, 
  FileCreateTransaction, 
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar 
} from '@hashgraph/sdk';

import { useAgentStore, AgentConfig } from '@/stores/agentStore';
import { useWalletStore } from '@/stores/walletStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK  = process.env.NEXT_PUBLIC_HEDERA_NETWORK || 'testnet';

function recordTx(payload: {
  ownerId:    string;
  agentId?:   string;
  type:       string;
  txId:       string;
  status?:    string;
  details?:   Record<string, unknown>;
}) {
  const hashscanUrl = `https://hashscan.io/${NETWORK}/transaction/${payload.txId}`;
  fetch(`${API_URL}/api/transactions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...payload, hashscanUrl }),
  }).catch(() => { /* non-fatal — audit log is best-effort */ });
}

const EXAMPLE_PROMPTS = [
  'BTCUSD, medium risk, RSI>55, exit at +2%',
  'Build a swing trader using 60-day EMA on HBAR/USDC with RSI confirmation',
  'Trend follower: buy when 20 EMA crosses above 50 EMA on 15m chart',
  'Breakout strategy on HBAR/USDC, tight stop-loss at 1%',
];

interface Message {
  role:    'user' | 'assistant';
  content: string;
  config?: AgentConfig;
  configHash?: string;
  error?:  boolean;
}

function DeployingModal({ step }: { step: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0D1B2A] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center">
        <Loader2 className="w-12 h-12 text-[#00A9BA] animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">Deploying Agent</h3>
        <p className="text-gray-400 text-sm">{step}</p>
        <div className="mt-6 flex justify-center gap-1">
           {[0, 1, 2].map(i => (
             <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#00A9BA]/30 animate-pulse" />
           ))}
        </div>
      </div>
    </div>
  );
}

function ConfigProposalCard({ config, configHash, onDeploy }: {
  config: AgentConfig;
  configHash: string;
  onDeploy: () => void;
}) {
  const ind = config.indicators ?? {};
  const risk = config.risk ?? { stopLossPct: 3, takeProfitPct: 8, maxPositionSizePct: 10 };

  const timeframeLabel: Record<string, string> = {
    '1m': '1 min', '5m': '5 min', '15m': '15 min',
    '1h': '1 hour', '4h': '4 hour', '1d': '1 day',
  };

  const strategyLabel: Record<string, string> = {
    TREND_FOLLOW: 'Trend Follow', MEAN_REVERT: 'Mean Revert',
    BREAKOUT: 'Breakout', MOMENTUM: 'Momentum', CUSTOM: 'Custom',
  };

  return (
    <div className="mt-4 rounded-xl bg-black/50 overflow-hidden" style={{ border: '1px solid rgba(0,169,186,0.2)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(0,169,186,0.08)', borderBottom: '1px solid rgba(0,169,186,0.1)' }}>
        <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#00A9BA' }}>Agent Proposal</span>
        <span className="text-[10px] font-mono" style={{ color: '#475569' }}>{configHash.slice(0, 14)}…</span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Agent name */}
        <div>
          <p className="text-white font-bold text-sm">{config.name}</p>
        </div>

        {/* Core params row */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase text-gray-500 mb-0.5">Strategy</p>
            <p className="text-white font-semibold">{strategyLabel[config.strategyType] ?? config.strategyType}</p>
          </div>
          <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase text-gray-500 mb-0.5">Asset</p>
            <p className="text-white font-semibold">{config.asset}</p>
          </div>
          <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] uppercase text-gray-500 mb-0.5">Timeframe</p>
            <p className="text-white font-semibold">{timeframeLabel[config.timeframe] ?? config.timeframe}</p>
          </div>
        </div>

        {/* Indicators */}
        {(ind.rsi || ind.movingAverage || ind.macd) && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Indicators</p>
            <div className="flex flex-wrap gap-1.5">
              {ind.movingAverage && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(21,101,192,0.2)', color: '#60A5FA', border: '1px solid rgba(21,101,192,0.3)' }}>
                  {ind.movingAverage.type}({ind.movingAverage.period})
                </span>
              )}
              {ind.rsi && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(168,85,247,0.15)', color: '#C084FC', border: '1px solid rgba(168,85,247,0.25)' }}>
                  RSI({ind.rsi.period}) OB:{ind.rsi.overbought} OS:{ind.rsi.oversold}
                </span>
              )}
              {ind.macd && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: 'rgba(234,179,8,0.12)', color: '#FDE047', border: '1px solid rgba(234,179,8,0.2)' }}>
                  MACD({ind.macd.fast},{ind.macd.slow},{ind.macd.signal})
                </span>
              )}
            </div>
          </div>
        )}

        {/* Risk management */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Risk Management</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center rounded-lg py-1.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <p className="text-[10px] text-red-400 mb-0.5">Stop-Loss</p>
              <p className="text-red-300 font-bold">{risk.stopLossPct}%</p>
            </div>
            <div className="text-center rounded-lg py-1.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
              <p className="text-[10px] text-emerald-400 mb-0.5">Take-Profit</p>
              <p className="text-emerald-300 font-bold">{risk.takeProfitPct}%</p>
            </div>
            <div className="text-center rounded-lg py-1.5" style={{ background: 'rgba(0,169,186,0.08)', border: '1px solid rgba(0,169,186,0.15)' }}>
              <p className="text-[10px] text-[#00A9BA] mb-0.5">Max Position</p>
              <p className="text-[#00A9BA] font-bold">{risk.maxPositionSizePct}%</p>
            </div>
          </div>
        </div>

        {/* Deploy button */}
        <button
          onClick={onDeploy}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold transition-all text-xs cursor-pointer mt-1"
          style={{ background: 'linear-gradient(135deg, #00A9BA, #1565C0)' }}
        >
          <ZapIcon size={12} />
          Deploy Agent on Hedera
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onDeploy }: { msg: Message, onDeploy: (config: AgentConfig, hash: string) => void }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
        style={{ background: isUser ? 'rgba(0,169,186,0.15)' : 'rgba(21,101,192,0.15)', border: `1px solid ${isUser ? 'rgba(0,169,186,0.3)' : 'rgba(21,101,192,0.3)'}` }}
      >
        {isUser
          ? <UserIcon size={14} style={{ color: '#00A9BA' }} />
          : <BotIcon  size={14} style={{ color: '#1565C0' }} />
        }
      </div>

      {/* Bubble */}
      <div className="flex flex-col gap-2 max-w-[85%]">
        <div 
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-[#00A9BA]/10 rounded-tr-none' : 'bg-white/5 rounded-tl-none'}`}
          style={{ border: isUser ? '1px solid rgba(0,169,186,0.15)' : '1px solid rgba(255,255,255,0.06)' }}
        >
          <p style={{ color: isUser ? '#E2E8F0' : '#CBD5E1' }}>{msg.content}</p>

          {msg.config && msg.configHash && (
            <ConfigProposalCard
              config={msg.config}
              configHash={msg.configHash}
              onDeploy={() => onDeploy(msg.config!, msg.configHash!)}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function CreatePage() {
  const router = useRouter();
  const { setBuildingConfig } = useAgentStore();
  const { signer, accountId } = useWalletStore();
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm your TradeAgent AI. Describe the trading strategy you want to deploy on Hedera. I'll configure the agent and prepare it for deployment." },
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [deployStep, setDeployStep] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function deployAgent(config: AgentConfig, configHash: string) {
    if (!signer || !accountId) {
      alert("Please connect your wallet first!");
      return;
    }

    // Generate agentId BEFORE any transactions — prevents "missing agentId" after wallet approvals
    const agentId = config.agentId || crypto.randomUUID();
    const deployConfig = { ...config, agentId };

    try {
      // ── TX 1: HFS FileCreate — user signs, user pays ──────────────
      setDeployStep("Step 1/3: Storing strategy on Hedera File Service...");
      const configBytes = Buffer.from(JSON.stringify(deployConfig));
      const fileCreateTx = await new FileCreateTransaction()
        .setContents(configBytes)
        .setFileMemo(`TradeAgent:${agentId}`)
        .setMaxTransactionFee(new Hbar(5))
        .freezeWithSigner(signer);
      
      const fileResponse = await fileCreateTx.executeWithSigner(signer);
      const fileReceipt = await fileResponse.getReceiptWithSigner(signer);
      const hfsFileId = fileReceipt.fileId!.toString();
      const hfsTxId   = fileResponse.transactionId.toString();
      console.log("[HFS] File created:", hfsFileId);
      recordTx({ ownerId: accountId, agentId, type: 'DEPLOY_HFS', txId: hfsTxId, details: { agentName: deployConfig.name, hfsFileId } });

      // ── TX 2: HCS TopicCreate — user signs, user pays ─────────────
      setDeployStep("Step 2/3: Creating HCS audit topic...");
      const topicTx = await new TopicCreateTransaction()
        .setTopicMemo(`TradeAgent:${agentId}`)
        .setMaxTransactionFee(new Hbar(5))
        .freezeWithSigner(signer);
      
      const topicResponse = await topicTx.executeWithSigner(signer);
      const topicReceipt = await topicResponse.getReceiptWithSigner(signer);
      const hcsTopicId = topicReceipt.topicId!.toString();
      const hcsTxId    = topicResponse.transactionId.toString();
      console.log("[HCS] Topic created:", hcsTopicId);
      recordTx({ ownerId: accountId, agentId, type: 'DEPLOY_HCS', txId: hcsTxId, details: { agentName: deployConfig.name, hcsTopicId } });

      // ── TX 3: ContractExecuteTransaction (registerAgent) — user signs, user pays ──
      // Uses Hedera SDK directly — same pattern as HFS/HCS, no ethers bridge needed
      setDeployStep("Step 3/3: Registering agent on AgentRegistry...");
      const registryAddress = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS!;
      const contractId = ContractId.fromEvmAddress(0, 0, registryAddress);
      const configHashBytes = Buffer.from(configHash.slice(2), 'hex'); // strip 0x → 32 bytes

      const contractParams = new ContractFunctionParameters()
        .addString(agentId)
        .addBytes32(configHashBytes)
        .addString(hcsTopicId)
        .addString(hfsFileId)
        .addString(deployConfig.strategyType);

      const contractTx = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(800000)
        .setFunction("registerAgent", contractParams)
        .setMaxTransactionFee(new Hbar(5))
        .freezeWithSigner(signer);

      const contractResponse = await contractTx.executeWithSigner(signer);
      await contractResponse.getReceiptWithSigner(signer);
      const contractTxHash = contractResponse.transactionId.toString();
      console.log("[HSCS] Agent registered:", contractTxHash);
      recordTx({ ownerId: accountId, agentId, type: 'DEPLOY_HSCS', txId: contractTxHash, details: { agentName: deployConfig.name, strategyType: deployConfig.strategyType } });

      // ── Backend: HCS-10 + DB save + BullMQ (operator pays, silent) ─
      setDeployStep("Finalizing agent configuration...");
      const finalizeRes = await fetch(`${API_URL}/api/agents/finalize-deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          config: deployConfig,
          configHash,
          hcsTopicId,
          hfsFileId,
          contractTxHash,
          ownerAccountId: accountId,
        }),
      });

      if (!finalizeRes.ok) {
        const errData = await finalizeRes.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error || 'Backend finalization failed');
      }

      router.push(`/agents/${agentId}`);
    } catch (err: any) {
      console.error("Deployment failed:", err);
      if (err?.message?.includes('User rejected') || err?.message?.includes('rejected')) {
        alert("Deployment cancelled: Transaction rejected in wallet.");
      } else {
        alert(`Deployment failed: ${err.message}`);
      }
    } finally {
      setDeployStep(null);
    }
  }

  async function sendMessage(prompt = input) {
    if (!prompt.trim() || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: prompt }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/agents/build`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to build agent');

      const finalConfig = { ...data.config };
      setBuildingConfig(finalConfig);

      // Build a natural-language summary of the indicators
      const ind = data.config.indicators ?? {};
      const indParts: string[] = [];
      if (ind.movingAverage) indParts.push(`${ind.movingAverage.type}(${ind.movingAverage.period})`);
      if (ind.rsi) indParts.push(`RSI(${ind.rsi.period})`);
      if (ind.macd) indParts.push(`MACD`);
      const indSummary = indParts.length ? ` using ${indParts.join(' + ')}` : '';

      const strategyLabel: Record<string, string> = {
        TREND_FOLLOW: 'trend-following', MEAN_REVERT: 'mean-reversion',
        BREAKOUT: 'breakout', MOMENTUM: 'momentum', CUSTOM: 'custom',
      };

      setMessages(m => [
        ...m,
        {
          role: 'assistant',
          content: `✓ Configured "${data.config.name}" — a ${strategyLabel[data.config.strategyType] ?? data.config.strategyType} strategy for ${data.config.asset}${indSummary}. Stop-loss ${data.config.risk?.stopLossPct}%, take-profit ${data.config.risk?.takeProfitPct}%. Review the full proposal below and deploy to Hedera when ready.`,
          config: finalConfig, 
          configHash: data.configHash,
        },
      ]);
    } catch (err) {
      setMessages(m => [
        ...m,
        { role: 'assistant', content: `Error: ${(err as Error).message}`, error: true },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)]" style={{ background: 'var(--ta-bg)' }}>
      {deployStep && <DeployingModal step={deployStep} />}

      {/* ── Left Sidebar ───────────────────────────────────────── */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col p-4 hidden md:flex"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,27,42,0.5)' }}
      >
        {/* Active tab */}
        <div
          className="flex items-center gap-3 p-3 rounded-xl mb-2 cursor-default"
          style={{ background: 'rgba(0,169,186,0.1)', border: '1px solid rgba(0,169,186,0.2)' }}
        >
          <BotIcon size={14} style={{ color: '#00A9BA' }} />
          <span className="text-sm font-semibold" style={{ color: '#E2E8F0' }}>AI Builder</span>
        </div>
        <Link
          href="/marketplace"
          className="flex items-center gap-3 p-3 rounded-xl mb-4 cursor-pointer transition-all duration-200 hover:bg-white/5"
          style={{ color: '#64748B' }}
        >
          <SparklesIcon size={14} />
          <span className="text-sm">Marketplace</span>
        </Link>

        {/* Prompt starters */}
        <div
          className="p-3 rounded-xl mb-4"
          style={{ background: 'rgba(21,101,192,0.12)', border: '1px solid rgba(21,101,192,0.2)' }}
        >
          <p className="text-xs font-semibold mb-2" style={{ color: '#60A5FA' }}>Try a prompt:</p>
          {EXAMPLE_PROMPTS.slice(0, 2).map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="w-full text-left text-xs p-2 rounded-lg mb-1 cursor-pointer transition-all duration-200 hover:bg-white/5"
              style={{ color: '#64748B' }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-auto">
          <div
            className="p-3 rounded-xl text-xs"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <p style={{ color: '#475569' }}>Tired of trading manually?</p>
            <p style={{ color: '#475569' }} className="mt-1">Create or choose an AI agent!</p>
            <Link
              href="/marketplace"
              className="w-full mt-2 block text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200"
              style={{ background: 'rgba(0,169,186,0.15)', color: '#00A9BA' }}
            >
              Browse Agents
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Chat Panel ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,169,186,0.12)' }}
          >
            <BotIcon size={16} style={{ color: '#00A9BA' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#E2E8F0' }}>TradeAgent AI</p>
            <p className="text-xs" style={{ color: '#475569' }}>Powered by Gemini · Deploys on Hedera</p>
          </div>
          <div
            className="ml-auto px-2 py-1 rounded-full text-xs flex items-center gap-1"
            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
            Live
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onDeploy={deployAgent} />
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(21,101,192,0.15)' }}>
                <BotIcon size={14} style={{ color: '#1565C0' }} />
              </div>
              <div className="px-4 py-3 rounded-xl" style={{ background: 'rgba(21,101,192,0.08)' }}>
                <div className="flex gap-1">
                  {[0, 0.15, 0.3].map(delay => (
                    <motion.div
                      key={delay}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay }}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: '#1565C0' }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Example prompts */}
        <div
          className="px-6 py-3 flex gap-2 overflow-x-auto"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          {EXAMPLE_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 hover:border-teal-500/50"
              style={{
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#64748B',
                background: 'rgba(255,255,255,0.02)',
                maxWidth: 200,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Input bar */}
        <div
          className="px-6 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(13,27,42,0.5)' }}
        >
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Describe your trading strategy... (e.g. HBAR/USDC momentum 15m RSI>60)"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: '#E2E8F0' }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #00A9BA, #1565C0)', color: '#fff' }}
              aria-label="Send"
            >
              <SendIcon size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
