# TradeAgent Bug Tracker & Resolutions

This document tracks bugs encountered during the TradeAgent development lifecycle.

---

## Resolved Bugs

### 1. Next.js 15 Routing Types Mismatch
**Symptom:** Type error on dynamic route params.
**Resolution:** Updated dynamic route params to use `Promise` and `use(params)`.

### 2. Missing shadcn/ui Button Component
**Symptom:** Import error at build time.
**Resolution:** Replaced with standard HTML buttons styled with Tailwind.

### 3. Syntax Error: Duplicate Closing Tags
**Symptom:** JSX parse error crashing the page.
**Resolution:** Restored correct JSX structure in `CreatePage`.

### 4. Missing Next.js Link Import
**Symptom:** `Link` is not defined.
**Resolution:** Re-added the `import Link from 'next/link'`.

### 5. SDK Bug: Query.fromBytes() Recursion
**Symptom:** `Query.fromBytes() not implemented for type getByKey`.
**Resolution:** Bypassed `getReceiptWithSigner` for certain steps using propagation delay and direct Mirror Node check in `src/lib/tokenAssociation.ts`.

### 6. Ethers.js v6 Custom Signer Incompatibility
**Symptom:** `TypeError: Cannot read properties of undefined (reading 'then')` when routing HSCS calls through the HashPack ethers bridge.
**Root Cause:** `DAppSigner` in `@hashgraph/hedera-wallet-connect` v1.x expects a Hedera SDK `Transaction` object — not a raw EVM transaction object from ethers.
**Resolution:** Removed `hashpackEthers.ts` bridge entirely. Replaced with native `ContractExecuteTransaction` + `ContractFunctionParameters` from `@hashgraph/sdk`.

### 7. Missing agentId During HSCS Registration
**Symptom:** Deployment crashed with `invalid string value (argument="str", value=null)` from ethers during TX3.
**Root Cause:** `config.agentId` was `undefined` because `/api/agents/build` did not include `agentId` in its response.
**Resolution:** Generate `agentId` using `crypto.randomUUID()` at the very start of `deployAgent()` in `create/page.tsx` before any transactions.

### 8. INSUFFICIENT_GAS on ContractExecuteTransaction
**Symptom:** TX3 (Smart Contract Execute for `registerAgent()`) rejected with `INSUFFICIENT_GAS`.
**Root Cause:** Initial gas limit of `300,000` too low for `AgentRegistry.sol`'s `registerAgent` function.
**Resolution:** Increased `setGas(800_000)` and `setMaxTransactionFee(new Hbar(5))` in `create/page.tsx`.

### 9. Missing `finalize-deploy` Endpoint
**Symptom:** Frontend completed all 3 HashPack transactions, then received 404.
**Resolution:** Added the complete `finalize-deploy` handler including `prisma.agent.create()`, `scheduleAgentJob()`, and fire-and-forget HCS-10 registration.

### 10. finalize-deploy Blocking for 60+ Seconds
**Symptom:** Frontend spinner ran 60+ seconds after HashPack approvals.
**Root Cause:** `registerAgentHCS10()` was awaited synchronously inside the HTTP handler.
**Resolution:** Wrapped `registerAgentHCS10()` in `setImmediate()`. DB and BullMQ are saved first, `res.json()` fires immediately, HCS-10 runs in background.

### 11. Wrong Redirect Path After Deployment
**Symptom:** Redirect to `/dashboard/${agentId}` returned 404.
**Resolution:** Updated to `router.push('/agents/${agentId}')`.

### 12. Gemini Always Returns HOLD — No Trades Executing
**Symptom:** Every agent run returns HOLD with "EMA value not provided" reasoning.
**Root Cause:** The decision prompt sent the indicator *config* (e.g. `{type:"EMA", period:60}`) but not actual computed values. Gemini could not make a BUY/SELL decision without real EMA/RSI numbers.
**Resolution:** Added `fetchPriceHistory()` (80 Binance 1h candles), `computeEMA()`, and `computeRSI()` in `agentRunner.ts`. Gemini now receives computed values like `EMA_60: 0.08843`, `RSI_14: 52.3` and cites them in the reasoning.

### 13. WalletConnect Double-Init / "No Signer for Account" After Reconnect
**Symptom:** After disconnecting and reconnecting, required 2 clicks. Console showed:
- `Error: No signer for account`
- `WalletConnect Core is already initialized`
- `WalletConnect is not initialized`
**Root Cause:** Three independent race conditions: (1) `dAppConnector` was nulled on disconnect, causing re-init on reconnect; (2) signer population is async and wasn't retried; (3) `useEffect` called `connectWallet` (modal-opening) instead of silent rehydration.
**Resolution:**
- `disconnectWallet()` no longer nulls `dAppConnector`
- Added `waitForSigner()` with up to 10 retries (100ms delay each)
- Added `rehydrateWallet()` — silent, no modal, checks existing sessions
- `connectWallet()` calls `rehydrateWallet()` first before opening modal
- `WalletConnect.tsx` `useEffect` calls `rehydrateWallet()` on mount; if it returns null, calls `disconnect()` to clear stale Zustand state

### 14. MockDEX ABI Mismatch — `executeSwap` Function Not Found
**Symptom:** AUTO mode trade failed with "function not found" or silent revert on MockDEX calls.
**Root Cause:** `tradeExecutor.ts` was calling `executeSwap(agentId, direction, amountIn, ...)` which does not exist in `MockDEX.sol`. The actual functions are `sellHBARforUSDT(...)` and `buyHBARwithUSDT(...)`. Direction strings were also wrong (`USDC_TO_HBAR` vs `USDT_TO_HBAR`).
**Resolution:** Updated `MOCK_DEX_ABI` in `tradeExecutor.ts` to use the correct function signatures. Updated direction strings to `HBAR_TO_USDT` / `USDT_TO_HBAR`. Separated execution into two conditional paths using the correct function per trade direction.

### 15. TypeScript: `bigint` Not Assignable to `Hbar.fromTinybars` Parameter
**Symptom:** API server crashed with `TSError: TS2345: Argument of type 'bigint' is not assignable to parameter of type 'string | number | Long | BigNumber'` on the `/withdraw` endpoint.
**Root Cause:** `Hbar.fromTinybars()` from `@hashgraph/sdk` does not accept native `bigint` — it expects `string`, `number`, `Long`, or `BigNumber`.
**Resolution:** Convert `withdrawAmount` to string via `.toString()` before passing to `Hbar.fromTinybars()`. Use string prefix `"-"` for the debit side.
