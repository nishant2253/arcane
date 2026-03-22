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
**Root Cause:** `DAppSigner` in `@hashgraph/hedera-wallet-connect` v1.x expects a Hedera SDK `Transaction` object — not a raw EVM transaction object from ethers. Passing a raw `{ to, data, gasLimit }` object caused silent failures.
**Resolution:** Removed `hashpackEthers.ts` bridge entirely. Replaced with native `ContractExecuteTransaction` + `ContractFunctionParameters` from `@hashgraph/sdk`. This is the correct pattern for HSCS calls via HashPack.

### 7. Missing agentId During HSCS Registration
**Symptom:** Deployment crashed with `invalid string value (argument="str", value=null)` from ethers during TX3.
**Root Cause:** `config.agentId` was `undefined` because the `/api/agents/build` endpoint did not include `agentId` in its response, so `finalConfig.agentId` was always `undefined` going into the contract call.
**Resolution:** Generate `agentId` using `crypto.randomUUID()` at the very start of `deployAgent()` in `create/page.tsx`, before any transactions are sent. This ensures agentId is always set and matches across all 3 transactions.

### 8. INSUFFICIENT_GAS on ContractExecuteTransaction
**Symptom:** TX3 (Smart Contract Execute for `registerAgent()`) rejected with `INSUFFICIENT_GAS` after user approval in HashPack.
**Root Cause:** Initial gas limit of `300,000` was too low. `AgentRegistry.sol`'s `registerAgent` function stores 5 string fields, 1 bytes32, 1 address, pushes to 2 arrays, checks a `nonReentrant` guard, and emits an event — all expensive EVM operations on Hedera.
**Resolution:** Increased `setGas(800_000)` and `setMaxTransactionFee(new Hbar(5))` in `create/page.tsx`.

### 9. Missing `finalize-deploy` Endpoint
**Symptom:** Frontend successfully completed all 3 HashPack transactions, then received a 404 from the backend.
**Root Cause:** The `POST /api/agents/finalize-deploy` route was called by the frontend but never defined in `apps/api/src/routes/agents.ts`.
**Resolution:** Added the complete `finalize-deploy` handler including Prisma `agent.create()`, BullMQ scheduling via `scheduleAgentJob()`, and fire-and-forget HCS-10 registration.

### 10. finalize-deploy Blocking for 60+ Seconds
**Symptom:** After approving all 3 HashPack transactions, the frontend spinner ran for over 60 seconds before redirecting. Backend logs showed the delay was the `registerAgentHCS10()` inscription SDK call, which times out on WebSocket and falls back to HTTP.
**Root Cause:** `registerAgentHCS10()` was awaited synchronously inside the HTTP handler, blocking the response.
**Resolution:** Wrapped `registerAgentHCS10()` in `setImmediate()` so it runs as a background task after the response is sent. DB and BullMQ scheduling are done first (fast, ~50ms), then `res.json()` is sent immediately. When HCS-10 finishes in the background, a `prisma.agent.update()` patches the `hcs10TopicId` column.

### 11. Wrong Redirect Path After Deployment
**Symptom:** After successful deployment, the frontend redirected to `/dashboard/${agentId}` which returned a 404.
**Root Cause:** Route was renamed during development from `/dashboard/[id]` to `/agents/[agentId]`.
**Resolution:** Updated redirect in `create/page.tsx` to `router.push('/agents/${agentId}')`.
