# TradeAgent: Step-by-Step Client Walkthrough

Welcome to **TradeAgent**! 

This guide provides a comprehensive step-by-step walkthrough for a new client onboarding onto the platform. TradeAgent is the first trading platform where every AI agent's decision is cryptographically sealed with aBFT-guaranteed timestamps on Hedera, making your trading performance a verifiable on-chain fact.

Here is exactly how to go from connecting your wallet to deploying and monetizing your first AI trading agent.

---

## Phase 1: Onboarding & Wallet Connection

1. **Prerequisites:** Ensure you have the **HashPack** Wallet extension installed on your browser and funded with Testnet HBAR.
2. **Launch the App:** Open the TradeAgent application (e.g., `http://localhost:3000` for local development).
3. **Connect Your Wallet:** 
   - Click the **Connect Wallet** button located in the top navigation bar.
   - The WalletConnect modal will open. 
   - Select **HashPack** and approve the pairing request inside your wallet extension.
4. **Verify Connection:** Once connected, the app will automatically redirect you to the `/wallet` dashboard. Your abbreviated account ID (e.g., `0.0.XXXXX`) and real-time HBAR balance should be visible in the top navigation bar.

---

## Phase 2: Building Your First Trading Agent

TradeAgent offers multiple ways to build an agent without needing to code. We will use the **AI Prompt Builder**.

1. **Navigate to the AI Builder:** Click on the **AI Builder** link from the sidebar or navigate to `/create`.
2. **Enter Your Strategy:** 
   - In the chat interface, use plain English to describe your trading strategy.
   - *Example Prompt:* `"Create a swing trading agent for HBAR/USDC using a 60-day EMA confirmation and set a 3% stop loss."`
3. **Review the Configuration:** 
   - The integrated Gemini 1.5 Flash AI will process your prompt and respond within seconds.
   - It will output a highly structured JSON `AgentConfig` (defining your strategy type, asset, timeframe, indicators, and risk limits) inside the chat bubble.
   - The UI will also display a **ConfigHash**—this is a unique cryptographic signature representing your exact strategy rules.

---

## Phase 3: Deploying to the Hedera Network

Unlike standard web2 platforms, deploying your agent anchors it permanently and securely to the blockchain.

1. **Deploy Action:** Below your agent's configuration in the chat interface, click the **Deploy to Hedera** button.
2. **Wallet Signature (If prompted):** If your wallet session requires it, you will approve the deployment via HashPack.
3. **The 6-Step Automated Deployment:** Behind the scenes, TradeAgent fires off a highly complex orchestration sequence seamlessly:
   - **HFS (Hedera File Service):** Your full strategy config is permanently saved on-chain.
   - **HCS (Hedera Consensus Service):** A dedicated logging topic is created to permanently audit this specific agent.
   - **HCS-10:** Your agent registers its identity in the OpenConvAI ecosystem.
   - **HSCS (Hedera Smart Contract Service):** The agent is officially registered into the `AgentRegistry` smart contract.
   - **Database & BullMQ:** Your agent is scheduled to run continuously on its assigned timeframe.
4. **Success!** You will be redirected to your agent's live dashboard (`/agents/[agentId]`), where it will await its scheduled intervals to execute trades.

---

## Phase 4: Verification & Autonomous Trading

Your agent is now active and monitoring the markets. Here is what happens during its lifecycle:

1. **Price Fetching:** The agent pulls real-time, signed attestations from the **Pyth Oracle**.
2. **Decision Making:** Gemini evaluates the latest indicators against your strategy rules to determine a `BUY`, `SELL`, or `HOLD` signal.
3. **Cryptographic Proof FIRST:** Before any trade is executed, the decision and its reasoning are instantly written to the **Hedera Consensus Service (HCS)**. 
   - You can click **View Proof** on your dashboard at any time. This will take you to **HashScan**, where you can see the immutable timestamp proving *exactly* when the decision was made. No data can ever be fabricated.
4. **DEX Execution:** If the signal is a `BUY` or `SELL`, the agent automatically routes the swap through **SaucerSwap** (Hedera's largest DEX).

---

## Phase 5: Monetization on the Marketplace

Once your agent has been running successfully, its verifiable performance becomes a highly valuable asset.

1. **List on Marketplace:** 
   - Navigate to your agent's dashboard and click **List on Marketplace**.
   - Input your desired list price in HBAR.
2. **NFT Minting:** Your strategy is instantly transformed into an **HTS NFT** (Hedera Token Service), and a 5% creator royalty is permanently attached to it at the protocol level.
3. **Atomic Swaps:** Other users browsing the `/marketplace` can view your agent's *provable* win rate pulled directly from the Hedera Mirror Node. 
   - If they purchase your agent, ownership transfers and your HBAR payment clears simultaneously in a single, trustless transaction.
4. **Earning Royalties:** Should they resell your strategy NFT later, you will automatically receive a 5% cut directly to your wallet, bypassing any middlemen.

---

## Phase 6: Live Testnet Execution (MockDEX Integration)

For testing purposes on the Hedera Testnet (where real SaucerSwap liquidity pools do not exist), TradeAgent is wired to a natively deployed **MockDEX** smart contract. This provides a 1-to-1 operational simulation of the mainnet execution environment.

1. **Manual Demo Trigger:** Instead of waiting for the BullMQ cron scheduler to hit its execution window, you can manually trigger an immediate cycle for demonstration purposes.
   - Fire a `POST` request to `http://localhost:3001/api/agents/YOUR_AGENT_ID/trigger`
2. **Execution Console Logs:** Watch your terminal (`apps/api npm run dev`). You will see an unbroken chain:
   - `[Price]` oracle values fetched.
   - `[Gemini]` reasoning out the signal (e.g., `BUY`).
   - `[HCS]` Decision cryptographically sealed to the Hedera ledger.
   - `[MockDEX]` Simulation AMM processing the token swap and checking slippage against the 1% maximum.
   - `[HCS]` Execution result logged securely.
3. **Validating the Audit Trail:**
   - In the API response or on your Agent Dashboard, click the **HashScan Topic URL**.
   - You will see the timestamped decision message logged securely. 
   - Search the MockDEX transaction hash on HashScan, and view the embedded `hcsSequenceNum` in the `SwapExecuted` event, structurally proving the AI decision preceded the actual trade execution by only seconds.

---

**Welcome to the future of verifiable, decentralized algorithmic trading.**
