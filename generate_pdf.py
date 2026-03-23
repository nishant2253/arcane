"""
Arcane Concepts & Demo Guide  -  PDF Generator
Usage: /tmp/pptxenv/bin/python3 generate_pdf.py
Output: Arcane_Concepts_Demo_Guide.pdf
"""

from fpdf import FPDF
from fpdf.enums import XPos, YPos

OUTPUT = "Arcane_Concepts_Demo_Guide.pdf"

# ── Colour palette ────────────────────────────────────────────────────────────
BG          = (10,  20,  40)   # dark navy background
ACCENT      = (0,  169, 186)   # Hedera teal
ACCENT2     = (138, 43, 226)   # purple highlight
WHITE       = (226, 232, 240)
GREY        = (148, 163, 184)
YELLOW      = (251, 191,  36)
GREEN       = ( 34, 197,  94)
DARK_CARD   = ( 22,  38,  66)


class ArcanePDF(FPDF):

    # ── helpers ───────────────────────────────────────────────────────────────
    def set_fg(self, rgb):
        self.set_text_color(*rgb)

    def filled_rect(self, x, y, w, h, rgb):
        self.set_fill_color(*rgb)
        self.rect(x, y, w, h, style="F")

    def h1(self, text):
        self.set_font("Helvetica", "B", 22)
        self.set_fg(ACCENT)
        self.ln(6)
        self.cell(0, 10, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        # underline rule
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.5)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def h2(self, text, colour=ACCENT2):
        self.set_font("Helvetica", "B", 14)
        self.set_fg(colour)
        self.ln(3)
        self.cell(0, 8, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(1)

    def h3(self, text, colour=YELLOW):
        self.set_font("Helvetica", "B", 11)
        self.set_fg(colour)
        self.cell(0, 6, text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    def body(self, text, size=10):
        self.set_font("Helvetica", "", size)
        self.set_fg(WHITE)
        self.multi_cell(0, 5.5, text)
        self.ln(1)

    def bullet(self, text, colour=ACCENT, size=10):
        self.set_font("Helvetica", "", size)
        self.set_fg(colour)
        self.cell(6, 5.5, chr(149), new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_fg(WHITE)
        self.multi_cell(0, 5.5, text)

    def tag(self, text, bg=ACCENT, fg=BG):
        self.set_fill_color(*bg)
        self.set_text_color(*fg)
        self.set_font("Helvetica", "B", 9)
        self.cell(len(text) * 2.8 + 4, 6, text, fill=True,
                  new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_fg(WHITE)
        self.cell(3, 6, "", new_x=XPos.RIGHT, new_y=YPos.TOP)

    def section_divider(self):
        self.ln(4)
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.2)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def concept_card(self, title, tag_text, what, how, numbers):
        """Render a concept card with coloured header bar."""
        # header bar
        y0 = self.get_y()
        if y0 > 250:
            self.add_page()
            y0 = self.get_y()
        self.filled_rect(self.l_margin, y0, self.w - self.l_margin - self.r_margin, 8, DARK_CARD)
        self.set_xy(self.l_margin + 2, y0 + 1)
        self.set_font("Helvetica", "B", 12)
        self.set_fg(ACCENT)
        self.cell(80, 6, title, new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_font("Helvetica", "", 9)
        self.set_fg(GREY)
        self.cell(0, 6, tag_text, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(2)

        self.h3("What it is", colour=GREY)
        self.body(what)
        self.h3("How Arcane uses it", colour=GREEN)
        self.body(how)
        self.h3("Key numbers", colour=YELLOW)
        self.body(numbers)
        self.ln(3)

    def step_row(self, step, actor, what, hedera=""):
        """Render one demo step row as a simple formatted line."""
        if self.get_y() > 265:
            self.add_page()
        # step badge
        self.set_fill_color(*ACCENT)
        self.set_text_color(*BG)
        self.set_font("Helvetica", "B", 9)
        self.cell(10, 5.5, str(step), fill=True, align="C",
                  new_x=XPos.RIGHT, new_y=YPos.TOP)
        # actor
        self.set_text_color(*YELLOW)
        self.set_font("Helvetica", "B", 9)
        self.cell(26, 5.5, actor[:18], new_x=XPos.RIGHT, new_y=YPos.TOP)
        # what + hedera tag on same line area
        self.set_text_color(*WHITE)
        self.set_font("Helvetica", "", 9)
        svc_tag = f"  [{hedera}]" if hedera else ""
        full_text = what + svc_tag
        avail_w = self.w - self.l_margin - self.r_margin - 10 - 26
        self.multi_cell(avail_w, 5.5, full_text)
        self.ln(0.5)

    # ── header / footer ───────────────────────────────────────────────────────
    def header(self):
        # full dark background on every page
        self.filled_rect(0, 0, self.w, self.h, BG)
        self.filled_rect(0, 0, self.w, 14, DARK_CARD)
        self.set_xy(self.l_margin, 3)
        self.set_font("Helvetica", "B", 10)
        self.set_fg(ACCENT)
        self.cell(60, 8, "ARCANE", new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.set_fg(GREY)
        self.set_font("Helvetica", "", 9)
        self.cell(0, 8, "Concepts & Demo Guide  |  Hedera APEX Hackathon 2026",
                  align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)

    def footer(self):
        self.filled_rect(0, self.h - 14, self.w, 14, DARK_CARD)
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_fg(GREY)
        self.cell(0, 8, f"Page {self.page_no()}  |  Arcane  -  AI Trading on Hedera  |  nishantgupta1965@gmail.com",
                  align="C")

    def add_page_dark(self):
        self.add_page()


# ─────────────────────────────────────────────────────────────────────────────
# BUILD PDF
# ─────────────────────────────────────────────────────────────────────────────
pdf = ArcanePDF()
pdf.set_auto_page_break(auto=True, margin=15)
pdf.set_margins(14, 20, 14)


# ══════════════════════════════════════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page()
pdf.filled_rect(0, 0, pdf.w, pdf.h, BG)

pdf.set_xy(14, 55)
pdf.set_font("Helvetica", "B", 38)
pdf.set_fg(ACCENT)
pdf.cell(0, 16, "ARCANE", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.set_font("Helvetica", "", 16)
pdf.set_fg(WHITE)
pdf.cell(0, 9, "Concepts & Demo Guide", align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(4)
pdf.set_font("Helvetica", "", 11)
pdf.set_fg(GREY)
pdf.cell(0, 7, "AI-Powered Trading Agents on Hedera  |  APEX Hackathon 2026  |  AI & Agents Track",
         align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(14)
pdf.set_draw_color(*ACCENT)
pdf.set_line_width(0.5)
pdf.line(40, pdf.get_y(), pdf.w - 40, pdf.get_y())
pdf.ln(12)

# contents list
items = [
    "1.  Project Brief",
    "2.  Key Hedera Concepts  (HCS · HTS · HFS · HSCS · HCS-10 · Mirror Node · Pyth · SaucerSwap)",
    "3.  Why Only Hedera  (cost comparison + Web2 failures)",
    "4.  Hackathon Demo Script  (34-step trader journey  -  3 phases)",
    "5.  Key Numbers Cheat Sheet  (quick-reference for judges & Q&A)",
]
for item in items:
    pdf.set_xy(14, pdf.get_y())
    pdf.set_font("Helvetica", "", 11)
    pdf.set_fg(WHITE)
    pdf.cell(0, 7, item, new_x=XPos.LMARGIN, new_y=YPos.NEXT)

pdf.ln(16)
pdf.set_font("Helvetica", "B", 10)
pdf.set_fg(ACCENT)
pdf.cell(0, 6, "Nishant Gupta  |  nishantgupta1965@gmail.com  |  March 2026",
         align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1  -  PROJECT BRIEF
# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page_dark()
pdf.h1("SECTION 1  -  PROJECT BRIEF")

pdf.h2("What is Arcane?")
pdf.body(
    "Arcane is the first AI-powered trading platform built natively on Hedera Hashgraph. "
    "It allows any person  -  regardless of technical skill or trading experience  -  to create, "
    "deploy, and monetize autonomous trading agents whose every decision is permanently "
    "recorded on-chain with aBFT-guaranteed timestamps. Deploy a live agent in under 2 minutes. "
    "No code. No trust required."
)

pdf.h2("3 Ways to Create an Agent")

pdf.h3("1. Prompt-to-Agent  (AI-Powered via Gemini)")
pdf.body(
    "User describes strategy in plain English. Google Gemini 1.5 Flash (free tier, 1M tokens/day) "
    "via LangGraph converts it to a structured AgentConfig JSON with Zod validation in 1-2 seconds.\n"
    'Example: "Build a swing trader using 60-day EMA on HBAR/USDC with RSI confirmation and 3% stop loss."'
)

pdf.h3("2. Drag-and-Drop Visual Builder  (ReactFlow Canvas)")
pdf.body(
    "ReactFlow node canvas where users connect indicator blocks (EMA, RSI, MACD, Bollinger Bands), "
    "condition blocks (crosses above, greater than), and action blocks (BUY/SELL/HOLD). "
    "Produces the same AgentConfig JSON  -  both paths are fully interchangeable."
)

pdf.h3("3. Marketplace Purchase  (HTS NFT Licensing)")
pdf.body(
    "Browse verified agents as Hedera HTS NFTs. Performance data pulled live from Hedera Mirror Node "
    " -  cryptographically verifiable, NOT platform-reported. Buying a strategy NFT is one atomic "
    "HTS transaction: HBAR payment + NFT transfer simultaneously. Creator royalties (5%) enforced "
    "at protocol level  -  no marketplace can bypass them."
)

pdf.h2("Agent Lifecycle  (once deployed)")
steps_lc = [
    ("1. Fetch Price",     "Pyth Network via hak-pyth-plugin  -  cryptographically signed price attestations. 100+ pairs."),
    ("2. Calculate Indicators", "SMA, EMA, RSI, MACD, Bollinger Bands from OHLCV data. Stateless, deterministic."),
    ("3. AI Decision",    "Gemini 1.5 Flash + LangGraph returns BUY/SELL/HOLD with 0-100 confidence score + reasoning."),
    ("4. Log to HCS",     "CRITICAL: Decision written to HCS topic BEFORE any trade. aBFT timestamp = trust proof."),
    ("5. Execute Swap",   "hak-saucerswap-plugin executes on SaucerSwap V2. Quote -> slippage check (<1%) -> swap."),
    ("6. Log Execution",  "Fill price + tx hash logged back to HCS. Complete lifecycle sealed on-chain. Mirror Node indexes in 5-10s."),
]
for title, desc in steps_lc:
    pdf.h3(title)
    pdf.body(desc)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2  -  KEY HEDERA CONCEPTS
# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page_dark()
pdf.h1("SECTION 2  -  KEY HEDERA CONCEPTS")

pdf.concept_card(
    "HCS  -  Hedera Consensus Service",
    "The Audit Heart",
    "A decentralized, aBFT-ordered message sequencing service. Think of it as a public notary that "
    "stamps every message with a timestamp that is mathematically impossible to forge or alter. "
    "It records the ORDER and TIMESTAMP of messages using Hashgraph's virtual voting algorithm. "
    "Finality is reached in 3-5 seconds  -  guaranteed even if up to 1/3 of nodes are malicious.",
    "Every deployed agent gets its own dedicated HCS Topic (TopicCreateTransaction). "
    "BEFORE any trade executes, the full decision (signal, price, indicators, confidence, reasoning) "
    "is submitted to the topic. The aBFT timestamp proves the decision was made before the outcome. "
    "Anyone  -  trader, regulator, buyer  -  can query Mirror Node and verify the complete, unaltered history. "
    "HCS-10 additionally registers each agent for inter-agent communication in the Hedera ecosystem.",
    "Cost: $0.0001 per message\n"
    "Finality: 3-5 seconds (aBFT guaranteed)\n"
    "20 signals/day = $0.73/year on Hedera  vs  $50-$500/year on Ethereum\n"
    "Full history stored and queryable FREE via Mirror Node REST API + gRPC streaming"
)

pdf.concept_card(
    "HTS  -  Hedera Token Service",
    "The Strategy Marketplace",
    "Hedera's native tokenization layer  -  faster than ERC-721, cheaper, and with built-in compliance. "
    "HTS enforces royalty fees at the PROTOCOL level  -  they cannot be bypassed by any marketplace. "
    "Atomic swap means HBAR payment and NFT transfer happen in ONE transaction  -  either both succeed or neither does.",
    "Each strategy published to the marketplace is minted as an HTS NFT (serial number = one licensed copy). "
    "NFT metadata stores the IPFS CID pointing to full strategy config and performance stats (HIP-412). "
    "5% royalty fee set at collection creation  -  enforced by Hedera network, not Arcane's servers. "
    "Buyers must associate before receiving  -  prevents spam delivery. Token pause/freeze/wipe controls available natively.",
    "Transfer cost: $0.001  (vs $0.50-$5.00 on Ethereum)\n"
    "Transfer finality: 3-5 seconds guaranteed  (vs 12s avg probabilistic on Ethereum)\n"
    "Royalty enforcement: Protocol-level  -  CANNOT be bypassed  (vs voluntary on OpenSea)\n"
    "Atomic swap: HBAR + NFT in one tx  -  no escrow contract needed"
)

pdf.concept_card(
    "HFS  -  Hedera File Service",
    "On-Chain Config Storage",
    "Hedera's decentralized file storage service. Files are stored on the Hedera network with a "
    "unique File ID (0.0.XXXXX). Anyone can read a file via FileContentsQuery  -  public and free. "
    "Files are immutable once created unless the owner explicitly updates them.",
    "Full agent configurations are stored in HFS via FileCreateTransaction  -  not just a config hash. "
    "Each agent config gets a unique Hedera File ID stored in the AgentRegistry smart contract. "
    "Contract bytecode is also stored in HFS before deployment via ContractCreateTransaction. "
    "The HFS File ID is the permanent on-chain link between an agent's identity and its full config.",
    "Cost: $0.05 one-time per config  (not available on Ethereum  -  Hedera exclusive)\n"
    "Each config gets a unique Hedera File ID: 0.0.XXXXX\n"
    "Public read: FREE via FileContentsQuery  -  independently verifiable by anyone\n"
    "On-chain link: File ID stored in AgentRegistry smart contract"
)

pdf.concept_card(
    "HSCS  -  Hedera Smart Contract Service",
    "On-Chain Registry",
    "HSCS runs a full EVM (Hyperledger Besu). Any Solidity contract that works on Ethereum works on "
    "Hedera  -  with 3-5 second finality and sub-cent fees. Hedera-exclusive precompiles provide "
    "on-chain HBAR<->USD conversion and verifiable randomness without external oracles.",
    "AgentRegistry.sol stores: agentId, owner, configHash (keccak256), HCS topic ID, HFS config file ID, "
    "and strategy type. registerAgent() creates an immutable on-chain record. logExecution() emits "
    "AgentExecutionLogged events for leaderboard ranking. listOnMarketplace() / purchaseAgent() "
    "coordinate with HTS for atomic NFT marketplace transactions.",
    "Contract finality: 3-5 seconds  (vs 12s avg on Ethereum)\n"
    "Registration cost: $0.01 one-time  (vs $10-$100 on Ethereum)\n"
    "Exchange Rate Precompile (0x168): live HBAR<->USD on-chain  -  no external oracle\n"
    "Admin key on contracts: Hedera-exclusive  -  upgrades without proxy patterns"
)

pdf.concept_card(
    "HCS-10  -  OpenConvAI Standard",
    "Agent Identity & Discovery",
    "HCS-10 is a W3C-aligned agent communication standard on Hedera, implemented via "
    "@hashgraphonline/standards-sdk. It creates inbound and outbound HCS communication topics "
    "for each agent, making agents discoverable and messageable by other agents and wallets "
    "across the entire Hedera ecosystem.",
    "Every deployed Arcane agent is registered in the HCS-10 OpenConvAI directory. "
    "AgentBuilder profile includes: name, description, model (gemini-1.5-flash), capabilities "
    "(TEXT_GENERATION, DATA_ANALYSIS). Inbound topic receives messages from users or other agents. "
    "Outbound topic publishes signals and status updates to the ecosystem.",
    "Standard: W3C-aligned agent communication protocol on Hedera\n"
    "Discovery: Agents listed in HCS-10 directory are findable by any other Hedera agent\n"
    "Inter-agent comms: Agents can message each other via HCS topics\n"
    "SDK: @hashgraphonline/standards-sdk  -  official Hedera implementation"
)

pdf.concept_card(
    "Mirror Node",
    "The Free Intelligence Layer",
    "Mirror nodes store the COMPLETE history of all Hedera transactions, queryable via a free "
    "REST API and gRPC streaming. No SDK calls  -  just HTTP requests. No transaction fees  -  reads "
    "are completely free. This makes it economically viable to power entire dashboards from on-chain data.",
    "Powers Arcane's live signal feed via gRPC streaming (no polling). Leaderboard ranks agents by "
    "verified on-chain performance  -  impossible to fake. Public audit page per agent with complete "
    "HCS topic history. Marketplace shows token holder info, ownership history, royalty payment history. "
    "Frontend source-labels all data: 'Data from Hedera Mirror Node  -  not our servers'.",
    "Cost: FREE  -  unlimited reads, no transaction fees\n"
    "Latency: Indexes HCS messages within 5-10 seconds of consensus\n"
    "Access: REST API + gRPC streaming  -  standard HTTP, no SDK required\n"
    "Data integrity: Every data point is on-chain  -  leaderboard performance is mathematically unfakeable"
)

pdf.concept_card(
    "Pyth Oracle  (hak-pyth-plugin@0.1.1)",
    "Verified Price Feeds via Agent Kit",
    "Pyth Network provides low-latency, cryptographically signed price attestations via the Hermes "
    "REST API. Each attestation includes a confidence interval (uncertainty bounds) and publish "
    "timestamp for stale price detection. An official Hedera Agent Kit v3 plugin.",
    "Arcane uses Pyth to fetch real-time price data for 100+ pairs (HBAR/USD, BTC/USD, ETH/USD, "
    "SOL/USD, etc.) at the start of every agent cycle. If the price attestation is older than the "
    "configured threshold, the agent returns HOLD rather than act on stale data.",
    "Pairs: 100+ including HBAR/USD, BTC/USD, ETH/USD, SOL/USD\n"
    "Data includes: price, confidence interval, publish timestamp\n"
    "Stale detection: Agent returns HOLD if price older than configured threshold\n"
    "Cost: Zero on-chain verification contract needed  -  fetched off-chain via Hermes REST"
)

pdf.concept_card(
    "SaucerSwap  (hak-saucerswap-plugin@1.0.1)",
    "DEX Execution via Agent Kit",
    "SaucerSwap is Hedera's largest DEX (V2 AMM). The official Hedera Agent Kit plugin provides "
    "getSwapQuote() and executeSwap() as natural language tool calls. Slippage is checked before "
    "execution  -  if slippage exceeds threshold (default 1%), the swap does not execute.",
    "After HCS logs the BUY/SELL decision, Arcane calls getSwapQuote() to check price impact and "
    "slippage. If within limits, executeSwap() executes on SaucerSwap V2. The swap transaction hash "
    "is immediately logged back to HCS as a second message  -  completing the on-chain audit trail.",
    "Cost: ~$0.001 per swap  (vs $3-$30 on Uniswap/Ethereum)\n"
    "Slippage guard: Default 1% threshold  -  no execution if exceeded\n"
    "Confirmation: ~4 seconds on Hedera\n"
    "Natural language: Agent says 'Swap $X USDC to HBAR if slippage < 1%' via Agent Kit"
)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3  -  WHY ONLY HEDERA
# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page_dark()
pdf.h1("SECTION 3  -  WHY ONLY HEDERA")

pdf.h2("Cost Comparison: Hedera vs Ethereum per Operation")
pdf.ln(2)

# table
headers = ["Operation", "Hedera Cost", "Ethereum Cost", "Advantage"]
col_w   = [62, 32, 38, 50]
row_data = [
    ["HCS audit (20 signals/day)", "$0.06 / month", "$300-$1,500/mo", "5,000x cheaper"],
    ["HTS NFT mint per listing",   "$0.001",         "$5-$50",          "5,000x cheaper"],
    ["HSCS registration (one-time)","$0.01",          "$10-$100",        "1,000x cheaper"],
    ["HFS config storage",         "$0.05 one-time", "Not available",   "Hedera exclusive"],
    ["SaucerSwap swap",            "$0.001/swap",    "$3-$30 (Uniswap)","3,000x cheaper"],
    ["TOTAL per active agent/mo",  "~$0.07",         "$313-$1,580",     "Model only viable\non Hedera"],
]
# header row
pdf.set_fill_color(*DARK_CARD)
pdf.set_font("Helvetica", "B", 9)
pdf.set_fg(ACCENT)
for i, h in enumerate(headers):
    pdf.cell(col_w[i], 7, h, border=0, fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
pdf.ln(7)
# data rows
for ri, row in enumerate(row_data):
    bg = BG if ri % 2 == 0 else DARK_CARD
    pdf.set_fill_color(*bg)
    pdf.set_font("Helvetica", "B" if ri == len(row_data)-1 else "", 9)
    for ci, cell in enumerate(row):
        colour = GREEN if ci == 3 else WHITE
        if ri == len(row_data) - 1:
            colour = YELLOW
        pdf.set_fg(colour)
        pdf.multi_cell(col_w[ci], 6, cell, fill=True, new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.ln(6)

pdf.ln(4)
pdf.set_font("Helvetica", "I", 9)
pdf.set_fg(GREY)
pdf.body(
    "The $29/mo Pro subscription with 5 agents costs Arcane ~$0.35/month in Hedera fees. "
    "Even at 50% gross margin after hosting, that is $14.15/month per Pro user in gross profit. "
    "At Ethereum gas prices ($313-$1,580/month per agent), the entire retail market is inaccessible "
    " -  the product cannot exist on any other chain."
)

pdf.h2("4 Structural Web2 Failures  -  Hedera Eliminates Each")
failures = [
    (
        "1. Unverifiable Performance Data",
        "Web2 platforms store performance metrics in databases they control entirely. "
        "They can be back-filled, cherry-picked, or fabricated. No technical mechanism "
        "exists to prove a signal was issued BEFORE an outcome occurred.",
        "Arcane writes every decision to HCS BEFORE any trade executes. The aBFT consensus "
        "timestamp is the median of when ALL network nodes received the transaction. "
        "Not even Hedera itself can alter it retroactively. Performance stats are cryptographic facts."
    ),
    (
        "2. Front-Running by the Platform",
        "Centralized servers process every agent signal before it is acted upon. Nothing "
        "prevents the platform from seeing a BUY signal and purchasing ahead of its own users. "
        "Users have no way to detect or prove this is happening.",
        "Hedera's fair-ordering consensus determines transaction sequence by the median of all "
        "network node receipt times. No single node, operator, or company can reorder pending "
        "transactions for profit. Front-running is structurally and mathematically eliminated."
    ),
    (
        "3. No Enforceable Creator IP Protection",
        "Strategy creators must choose: show logic (enabling reverse-engineering) or hide it "
        "(destroying buyer trust). Royalty payments depend entirely on the platform's goodwill "
        " -  which can change at any time.",
        "HTS NFT royalties are enforced at Hedera protocol level. There is no technical path for "
        "any marketplace  -  including Arcane  -  to route around them. Creator royalties are "
        "unconditional, automatic, and permanent."
    ),
    (
        "4. Single Point of Failure",
        "When a centralized platform has downtime, all agents stop. When the company shuts down, "
        "every strategy, performance history, and portfolio disappears permanently. "
        "The 2022 crypto platform collapses took user funds with them.",
        "Every agent decision is stored on Hedera's distributed network. The HCS topic containing "
        "an agent's 3-year decision history continues to exist and be queryable regardless of "
        "whether Arcane's frontend, backend, or company even survives."
    ),
]
for title, problem, solution in failures:
    pdf.h3(title)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fg(ACCENT2)
    pdf.cell(0, 5, "Web2 Problem:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.body(problem, size=9)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fg(GREEN)
    pdf.cell(0, 5, "Hedera Solution:", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.body(solution, size=9)
    pdf.ln(2)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4  -  DEMO SCRIPT
# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page_dark()
pdf.h1("SECTION 4  -  HACKATHON DEMO SCRIPT")

pdf.body(
    "This is the exact 34-step sequence to demonstrate Arcane to judges. "
    "Follow these steps in order. Steps marked with a Hedera service involve a real on-chain transaction. "
    "Use HashScan (hashscan.io) to show live proof at any step.\n\n"
    "Meet Arjun. He is a retail trader who follows crypto markets. He wants a trading agent but cannot code."
)
pdf.ln(2)

# column headers
pdf.set_font("Helvetica", "B", 8)
pdf.set_fg(ACCENT)
pdf.cell(10, 6, "Step", new_x=XPos.RIGHT, new_y=YPos.TOP)
pdf.cell(26, 6, "Actor", new_x=XPos.RIGHT, new_y=YPos.TOP)
pdf.cell(0,  6, "What Happens  [Hedera Service]", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.set_draw_color(*ACCENT)
pdf.set_line_width(0.3)
pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
pdf.ln(2)

# ── Phase 1 ──
pdf.set_font("Helvetica", "B", 10)
pdf.set_fg(YELLOW)
pdf.cell(0, 7, "PHASE 1  -  Create & Deploy the Agent  (Steps 1-15)", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(1)

phase1 = [
    (1,  "Arjun",       'Types: "Create a swing trader for HBAR/USDC using 60-day EMA. Buy when price crosses above. 3% stop loss, 8% take profit." Clicks "Build with AI"', ""),
    (2,  "Frontend",    "Captures prompt. Sends POST /api/agents/build-from-prompt to backend. Framer Motion loading animation starts.", ""),
    (3,  "Gemini AI",   "Hedera Agent Kit v3 + LangGraph invoked. Gemini 1.5 Flash (FREE tier) returns AgentConfig JSON in 1-2 seconds. Zod validates.", "Gemini"),
    (4,  "Config",      '{strategyType:"swing", asset:"HBAR/USDC", indicators:{ema:{period:60}}, risk:{stopLoss:3, takeProfit:8, maxPosition:5}}', "Gemini"),
    (5,  "Validator",   "Zod validates stop loss <= 10%, position <= 20%. keccak256(config) = configHash. Returns to frontend.", ""),
    (6,  "Frontend",    'Displays config for Arjun to review. He clicks "Deploy to Hedera"  -  HashPack modal opens.', ""),
    (7,  "HashPack",    "Arjun approves. Returns accountId (0.0.XXXXX). WalletConnect session stored in Zustand.", ""),
    (8,  "API",         "POST /api/agents/deploy triggered. Backend begins 6-step Hedera deployment sequence.", ""),
    (9,  "Backend",     'FileCreateTransaction stores full AgentConfig on HFS. memo="Arcane:{agentId}". Gets hfsConfigId: "0.0.9876".', "HFS FileCreate"),
    (10, "Backend",     'TopicCreateTransaction with submitKey. Gets hcsTopicId: "0.0.4823901". This is Arjun\'s permanent aBFT audit log.', "HCS TopicCreate"),
    (11, "Backend",     "HCS-10 AgentBuilder via @hashgraphonline/standards-sdk registers agent. Creates inbound + outbound HCS topics.", "HCS-10 OpenConvAI"),
    (12, "Backend",     "registry.registerAgent(agentId, configHash, hcsTopicId, hfsConfigId) via ethers.js. Confirmed in ~4 seconds.", "HSCS registerAgent"),
    (13, "Supabase",    "Prisma creates Agent record: agentId, ownerId, configHash, hcsTopicId, hfsConfigId, contractTxHash.", ""),
    (14, "BullMQ",      'agentQueue.add with repeat:{pattern:"0 0 * * *"} (daily cron). JobId prevents duplicate scheduling.', ""),
    (15, "Frontend",    "Returns hashscanUrl. Success animation. Arjun clicks HashScan link  -  sees his live HCS topic on hashscan.io.", ""),
]
for row in phase1:
    pdf.step_row(*row)

# ── Phase 2 ──
pdf.ln(3)
pdf.set_font("Helvetica", "B", 10)
pdf.set_fg(YELLOW)
pdf.cell(0, 7, "PHASE 2  -  The Agent Wakes Up & Trades  (Steps 16-27)", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(1)

phase2 = [
    (16, "BullMQ",      "Cron fires at midnight UTC. Job dequeued: {agentId, config, hcsTopicId}. agentWorker processes with concurrency: 5.", ""),
    (17, "Pyth Oracle", "hak-pyth-plugin fetches HBAR/USDC via Hermes REST. Returns {price:0.0842, confidence:0.0001, publishTime:...}. Stale check: <60s.", "Pyth"),
    (18, "OHLCV",       "Fetches 90 days of HBAR/USDC data from CoinGecko. Needs 90-day lookback for accurate 60-day EMA calculation.", ""),
    (19, "Indicators",  "calculateEMA(closePrices, 60) -> {ema60: 0.0798, currentPrice: 0.0842}. Price is 5.5% above 60-day EMA. Positive signal.", ""),
    (20, "Gemini AI",   'LangGraph evaluates: returns {signal:"BUY", confidence:78, reasoning:"Price 5.5% above 60-day EMA. Momentum confirmed."}', "Gemini"),
    (21, "HCS",         "CRITICAL: BEFORE any trade  -  TopicMessageSubmitTransaction logs full decision. Gets consensusTimestamp: aBFT GUARANTEED.", "HCS MsgSubmit"),
    (22, "HSCS",        "registry.logExecution(agentId, 'BUY', price) emits AgentExecutionLogged on-chain. Mirror Node indexes for leaderboard.", "HSCS logExecution"),
    (23, "SaucerSwap",  "getSwapQuote('USDC -> HBAR', 5% of portfolio). Returns {priceImpact: 0.12%, slippage: 0.08%}. Slippage < 1% PASS.", "SaucerSwap"),
    (24, "SaucerSwap",  "executeSwap() called. SaucerSwap V2 AMM executes on Hedera. Fill price: 0.0843 HBAR. Confirmed ~4 seconds. Fee: $0.001.", "SaucerSwap DEX"),
    (25, "HCS",         "Second HCS message logs execution: {type:'EXECUTION', swapTxHash, fillPrice:0.0843, slippage:0.12%}. Lifecycle sealed.", "HCS MsgSubmit"),
    (26, "Mirror Node", "Within 5-10s, Mirror Node indexes both HCS messages. Permanently stored at /api/v1/topics/0.0.4823901/messages. Free forever.", "Mirror Node"),
    (27, "Dashboard",   '"BUY at $0.0842  -  78% confidence" in live feed. Click "View Proof" -> HashScan shows immutable aBFT timestamp. Shareable.', ""),
]
for row in phase2:
    pdf.step_row(*row)

# ── Phase 3 ──
pdf.ln(3)
pdf.set_font("Helvetica", "B", 10)
pdf.set_fg(YELLOW)
pdf.cell(0, 7, "PHASE 3  -  List on Marketplace & Sell  (Steps 28-34)", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
pdf.ln(1)

phase3 = [
    (28, "Arjun",       "After 30 days, agent has 30 HCS-verified decisions. Lists for 50 HBAR. Clicks 'List on Marketplace'.", ""),
    (29, "IPFS",        "Strategy metadata uploaded via nft.storage: name, strategyType, hcsTopicId, hfsConfigId, last-30-day-stats. Returns CID.", ""),
    (30, "HTS",         "TokenMintTransaction on strategy NFT collection. metadata=Buffer.from(ipfsCID). Gets serialNumber:42. 5% royalty enforced.", "HTS TokenMint"),
    (31, "HSCS",        "registry.listOnMarketplace(agentId, 5_000_000_000 tinybars) emits AgentListed. Appears in marketplace via Mirror Node.", "HSCS listMarket"),
    (32, "Priya",       "Finds agent. Sees 30-day performance from Mirror Node (NOT Arcane's DB). 5.5% above EMA, 78% avg confidence. Clicks Buy.", ""),
    (33, "HashPack",    "Atomic TransferTransaction: 50 HBAR -> Arjun + NFT serial 42 -> Priya. 5% royalty (2.5 HBAR) auto-deducted by HTS protocol.", "HTS Atomic Swap"),
    (34, "Backend",     "Associates config with Priya's account. New agent instance, new HCS topic, new HCS-10 registration, added to BullMQ queue.", "HCS TopicCreate"),
]
for row in phase3:
    pdf.step_row(*row)

pdf.ln(4)
pdf.set_font("Helvetica", "B", 10)
pdf.set_fg(GREEN)
pdf.body(
    "Demo talking point: Every step with a Hedera service column is a REAL on-chain transaction "
    "with real finality and real fees ($0.0001-$0.001 each). Open HashScan at any point to show "
    "live proof. The judges are seeing the ledger  -  not a mock-up."
)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5  -  CHEAT SHEET
# ══════════════════════════════════════════════════════════════════════════════
pdf.add_page_dark()
pdf.h1("SECTION 5  -  KEY NUMBERS CHEAT SHEET")
pdf.body("Quick-reference for judges, Q&A, and the demo. Have this page open during your pitch.")
pdf.ln(4)

cheat_sections = [
    ("Hedera Service Costs & Performance", ACCENT, [
        ("HCS message cost",       "$0.0001 per message"),
        ("HCS finality",           "3-5 seconds (aBFT guaranteed)"),
        ("HCS annual cost (20/day)","$0.73/year  vs  $50-$500/year on Ethereum"),
        ("HTS NFT transfer",       "$0.001  vs  $0.50-$5.00 on Ethereum"),
        ("HTS royalty",            "5%  -  protocol enforced, cannot be bypassed"),
        ("HSCS registration",      "$0.01 one-time  vs  $10-$100 on Ethereum"),
        ("HFS config storage",     "$0.05 one-time  -  Hedera exclusive"),
        ("SaucerSwap swap",        "$0.001  vs  $3-$30 on Uniswap"),
        ("Total per agent/month",  "~$0.07 on Hedera  vs  $313-$1,580 on Ethereum"),
        ("Mirror Node reads",      "FREE  -  unlimited, no fees, REST + gRPC"),
    ]),
    ("Market Size & Opportunity", ACCENT2, [
        ("Crypto owners globally", "741 Million (2025)  -  growing 12.4% YoY"),
        ("Crypto trading H1 2025", "$9.36 Trillion exchange volume"),
        ("Retail traders who lose money", "97%  -  $242.5B in losses in 2024"),
        ("Retail traders who cannot code", "85%  -  630M+ people locked out of algo trading"),
        ("Algo trading market 2030",  "$44.5 Billion (11.3% CAGR)"),
        ("Copy trading market 2033",  "$15.4 Billion (17.8% CAGR)"),
        ("DeFi market 2030",           "$256 Billion (43.3% CAGR)"),
        ("Competitor validation",      "Walbi: 2.9M users in 14 weeks  -  demand is proven"),
    ]),
    ("Technical Stack Highlights", GREEN, [
        ("AI engine",              "Google Gemini 1.5 Flash  -  FREE tier, 1M tokens/day"),
        ("Hedera services used",   "HCS + HTS + HFS + HSCS + HCS-10 + Mirror Node = 6 services"),
        ("Agent Kit plugins",      "hak-pyth-plugin@0.1.1 + hak-saucerswap-plugin@1.0.1"),
        ("Price feeds",            "Pyth Network  -  100+ pairs, cryptographically signed"),
        ("DEX execution",          "SaucerSwap V2 AMM  -  Hedera's largest DEX"),
        ("Smart contract",         "AgentRegistry.sol on Hedera EVM (Solidity 0.8.24)"),
        ("Trust invariant",        "HCS MUST be written BEFORE SaucerSwap swap  -  enforced in code"),
        ("Frontend",               "Next.js 15 + Tailwind v4 + Zustand + ReactFlow + Framer Motion"),
        ("Backend",                "Node.js + Express + Supabase + Prisma + BullMQ + Redis"),
    ]),
    ("Key Differentiators vs Competitors", YELLOW, [
        ("vs 3Commas / Cryptohopper", "HCS-verified signals  -  competitors have zero on-chain proof"),
        ("vs Walbi",                  "NFT strategy marketplace + 5% royalty  -  Walbi has neither"),
        ("vs all Web2 platforms",     "Performance history lives on Hedera forever, independent of Arcane"),
        ("vs Ethereum-based DeFi",    "500x-5000x cheaper per operation  -  retail market accessible"),
        ("Unique claim",              "First platform where performance is cryptographically provable"),
    ]),
]

for section_title, colour, items in cheat_sections:
    pdf.h2(section_title, colour=colour)
    val_w = pdf.w - pdf.l_margin - pdf.r_margin - 72
    for key, val in items:
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_fg(colour)
        pdf.cell(72, 5.5, key, new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_fg(WHITE)
        pdf.multi_cell(val_w, 5.5, val)
    pdf.ln(4)

# final tagline
pdf.section_divider()
pdf.set_font("Helvetica", "B", 12)
pdf.set_fg(ACCENT)
pdf.cell(0, 8,
         "Arcane doesn't ask you to trust us. The Hedera ledger makes trust unnecessary.",
         align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

# ── save ─────────────────────────────────────────────────────────────────────
pdf.output(OUTPUT)
print(f"Saved -> {OUTPUT}")
