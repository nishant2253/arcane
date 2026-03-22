# TradeAgent — AI-Powered Trading Agent Platform on Hedera

> **Hedera APEX Hackathon 2026 · Track 1: AI & Agents**

TradeAgent is a decentralized AI trading agent platform. Users create, deploy, and monetize autonomous trading agents whose every decision is permanently recorded on Hedera with aBFT-guaranteed timestamps.

Each agent:
- Is described in plain English → Gemini 2.5 Flash generates a structured `AgentConfig`
- Gets a dedicated Hedera ECDSA account to trade autonomously — no per-trade signing required
- Logs every AI decision to HCS *before* any swap executes (tamper-proof audit trail)
- Is registered as an NFT on HTS and listed in the on-chain marketplace

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22+** and **npm 10+**
- Hedera testnet account (ECDSA key) → [portal.hedera.com](https://portal.hedera.com)
- Gemini API key (free) → [aistudio.google.com](https://aistudio.google.com)
- Supabase project (free) → [supabase.com](https://supabase.com)
- Redis (local Docker or [Redis Cloud free tier](https://redis.io/try-free))
- HashPack wallet (browser extension) → [hashpack.app](https://www.hashpack.app)

### 1. Clone & Install

```bash
git clone <your-repo>
cd hbarb
npm install
```

### 2. Configure Environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env with your credentials
```

**Required values in `apps/api/.env`:**

| Variable | Where to get it |
|---|---|
| `OPERATOR_ACCOUNT_ID` | [portal.hedera.com](https://portal.hedera.com) → Testnet account (ECDSA) |
| `OPERATOR_PRIVATE_KEY` | Same portal — ECDSA hex key (starts with 0x or 302e…) |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API Key |
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_ANON_KEY` | Same page |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (Transaction pooler) |
| `MOCK_DEX_ADDRESS` | `0x…` EVM address of the deployed `MockDEX.sol` on testnet |
| `TEST_USDT_TOKEN_ID` | Hedera token ID for the testnet tUSDT token (e.g. `0.0.XXXXXX`) |
| `AGENT_REGISTRY_ADDRESS` | `0x…` EVM address of the deployed `AgentRegistry.sol` |
| `REDIS_URL` | `redis://localhost:6379` (local) or Redis Cloud URL |

**Required values in `apps/web/.env.local`:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |
| `NEXT_PUBLIC_HEDERA_NETWORK` | `testnet` |
| `NEXT_PUBLIC_MOCK_DEX_ADDRESS` | Same as `MOCK_DEX_ADDRESS` above |
| `NEXT_PUBLIC_TEST_USDT_TOKEN_ID` | Same as `TEST_USDT_TOKEN_ID` above |
| `NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS` | Same as `AGENT_REGISTRY_ADDRESS` above |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | [cloud.walletconnect.com](https://cloud.walletconnect.com) |

### 3. Set Up Database

```bash
cd apps/api
npx prisma generate      # Generate Prisma client
npx prisma db push       # Apply schema to Supabase (no migration file needed)
```

### 4. Start Development Servers

```bash
# Terminal 1 — Redis
redis-server

# Terminal 2 — API (port 3001)
npm run dev:api

# Terminal 3 — Frontend (port 3000)
npm run dev:web
```

---

## 🏗️ Monorepo Structure

```
hbarb/                               # npm workspaces root
├── apps/
│   ├── web/                         # Next.js 15 frontend
│   │   └── src/
│   │       ├── app/                 # App Router pages
│   │       │   ├── create/          # AI agent builder
│   │       │   ├── agents/[id]/     # Agent dashboard
│   │       │   ├── marketplace/     # Browse & buy agents
│   │       │   └── wallet/          # Portfolio + TX audit log
│   │       ├── components/          # Shared UI components
│   │       ├── lib/                 # wallet.ts, balance.ts, hashpackEthers.ts
│   │       └── stores/              # Zustand stores (walletStore)
│   └── api/                         # Node.js + Express API (port 3001)
│       ├── src/
│       │   ├── index.ts             # Server entry, route registration
│       │   ├── config/env.ts        # Typed env loader
│       │   ├── agent/               # AI engine
│       │   │   ├── agentRunner.ts   # EMA/RSI + Gemini decision loop
│       │   │   └── tradeExecutor.ts # MockDEX swap logic (auto + manual)
│       │   └── routes/              # API routes
│       │       ├── agents.ts        # CRUD, finalize-deploy, fund, withdraw
│       │       ├── transactions.ts  # TX audit log
│       │       └── marketplace.ts   # Listing + purchase
│       └── prisma/schema.prisma     # DB schema (Agent, Transaction, Listing models)
├── packages/
│   ├── contracts/                   # Solidity smart contracts
│   │   ├── contracts/
│   │   │   ├── AgentRegistry.sol    # On-chain agent registry (HSCS)
│   │   │   └── MockDEX.sol          # Testnet AMM (x*y=k, HTS precompile)
│   │   └── scripts/deployNative.ts  # Hedera-native deployment
│   ├── hedera/                      # Hedera SDK wrappers
│   │   └── src/
│   │       ├── client.ts            # SDK singleton + operator key
│   │       ├── hcs.ts               # HCS topic creation + messaging
│   │       ├── hts.ts               # HTS NFT minting
│   │       ├── hfs.ts               # HFS file storage
│   │       └── openconvai.ts        # HCS-10 AI registration
│   └── shared/                      # Shared TypeScript types
│       └── src/index.ts             # AgentConfig, AgentDecision, Zod schemas
└── verificationflow.md              # Full demo walkthrough
```

---

## 🔑 Architecture Highlights

### User-Pays vs Operator-Pays

| Action | Who Signs | Who Pays |
|--------|-----------|----------|
| Deploy agent (HFS + HCS + HSCS) | User (3× HashPack) | User HBAR |
| Fund agent account | User (1× HashPack) | User HBAR |
| AUTO trade execution | Agent account key | Agent HBAR |
| MANUAL trade execution | User (1× HashPack per trade) | User HBAR |
| HCS decision logging | Operator | Operator HBAR |
| HCS-10 registration | Operator | Operator HBAR |
| Agent account creation | Operator | Operator HBAR (~0.1 seed) |

### Decision → Trade Proof Chain

```
1. Binance 1h candles → compute EMA/RSI
2. Gemini 2.5 Flash → BUY/SELL/HOLD + reasoning
3. HCS message #N  ← decision logged BEFORE swap (aBFT timestamp)
4. MockDEX.swap()  ← embeds HCS sequence #N in SwapExecuted event
5. HCS message #N+1 ← execution result logged with txHash
```

Every swap is cryptographically linked to the AI decision that triggered it.

---

## 🛠️ Implementation Status

| Feature | Status |
|---------|--------|
| AI agent builder (Gemini 2.5 Flash) | ✅ Complete |
| 3-step HashPack deployment (HFS + HCS + HSCS) | ✅ Complete |
| AgentRegistry smart contract | ✅ Complete |
| Agent dedicated ECDSA account | ✅ Complete |
| tUSDT auto-association per agent | ✅ Complete |
| Fund Agent modal (one-time) | ✅ Complete |
| EMA/RSI/MACD from Binance candles | ✅ Complete |
| Gemini decision with real indicators | ✅ Complete |
| HCS decision logging (aBFT) | ✅ Complete |
| MockDEX swap (sellHBARforUSDT / buyHBARwithUSDT) | ✅ Complete |
| AUTO mode autonomous trading (agent key) | ✅ Complete |
| MANUAL mode (HashPack trade approval) | ✅ Complete |
| Test Run (dry run, no swap) | ✅ Complete |
| Agent Portfolio (balance + P&L + Withdraw All) | ✅ Complete |
| Transaction Audit Log (/wallet) | ✅ Complete |
| Rich HCS Execution History | ✅ Complete |
| HCS-10 OpenConvAI registration (background) | ✅ Complete |
| Marketplace listing + NFT minting | ✅ Complete |
| Wallet rehydration (no re-prompt on refresh) | ✅ Complete |
| Mainnet / SaucerSwap integration | ⏳ Post-hackathon |

---

## 🔗 Key Links

- Hedera testnet HBAR faucet: [portal.hedera.com](https://portal.hedera.com)
- HashScan explorer: [hashscan.io/testnet](https://hashscan.io/testnet)
- API health check: [localhost:3001/health](http://localhost:3001/health)
- Full demo walkthrough: [`verificationflow.md`](./verificationflow.md)

---

## 📜 Tech Stack

**Frontend:** Next.js 15 · TypeScript · Tailwind v4 · Lucide React · Zustand · Framer Motion

**Backend:** Node.js 22 · Express 4 · Supabase (PostgreSQL) · Prisma v6 · BullMQ · Redis · Zod

**AI Engine:** Gemini 2.5 Flash · Binance REST API (price history) · EMA/RSI/MACD (custom impl.)

**Blockchain:** Hedera HCS · HTS · HFS · HSCS · HCS-10 · Mirror Node API · @hashgraph/sdk v2

**Contracts:** Solidity 0.8.24 · OpenZeppelin 5.x · Hardhat (compile only) · MockDEX (AMM + HTS precompile)

**Wallet:** HashPack · @hashgraph/hedera-wallet-connect v1 · WalletConnect v2

**Deployment:** Vercel (frontend) · Railway (API) · Supabase (DB) · Redis Cloud
