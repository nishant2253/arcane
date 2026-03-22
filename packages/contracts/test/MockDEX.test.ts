import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("MockDEX", function () {
  let mockDex: Contract;
  let owner: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const MockDEX = await ethers.getContractFactory("MockDEX");
    // Pass ZeroAddress since testnet HTS precompiles don't exist in Hardhat
    mockDex = await MockDEX.deploy(ethers.ZeroAddress);
  });

  describe("Pool State", function () {
    it("initializes with correct reserves", async function () {
      const [hbar, usdt] = await mockDex.getPoolState();
      expect(hbar).to.equal(1_000_000n * 100_000_000n); // 1M HBAR
      expect(usdt).to.equal(85_000n * 1_000_000n); // 85K USDT
    });
  });

  describe("getSwapQuote", function () {
    it("returns valid quote for HBAR_TO_USDT", async function () {
      const amountIn = 100n * 100_000_000n; // 100 HBAR
      const [amountOut, priceImpact, slippage] = await mockDex.getSwapQuote("HBAR_TO_USDT", amountIn);
      expect(amountOut).to.be.gt(0n);
      expect(priceImpact).to.be.lt(100n); // < 1% for small trade
      console.log(`\n      100 HBAR → ${amountOut / 1_000_000n} USDT`);
    });

    it("returns valid quote for USDT_TO_HBAR", async function () {
      const amountIn = 8n * 1_000_000n; // 8 USDT
      const [amountOut,,] = await mockDex.getSwapQuote("USDT_TO_HBAR", amountIn);
      expect(amountOut).to.be.gt(0n);
      console.log(`      8 USDT → ${amountOut / 100_000_000n} HBAR`);
    });

    it("rejects invalid direction", async function () {
      await expect(
        mockDex.getSwapQuote("INVALID", 100n)
      ).to.be.revertedWith("Invalid direction: HBAR_TO_USDT or USDT_TO_HBAR");
    });
  });

  describe("Swaps", function () {
    it("executes HBAR_TO_USDT swap and stores HCS sequence number", async function () {
      const agentId = "agent-test-123";
      const hcsSeq = "7"; // Simulates HCS seq#7 triggering this swap
      const topicId = "0.0.4823901";
      const amountIn = 100n * 100_000_000n; // 100 HBAR
      const [expectedOut,,] = await mockDex.getSwapQuote("HBAR_TO_USDT", amountIn);
      const minOut = expectedOut * 995n / 1000n;

      // Execute payable swap
      const tx = await mockDex.sellHBARforUSDT(
        agentId, minOut, hcsSeq, topicId, { value: amountIn }
      );
      const receipt = await tx.wait();

      // Verify SwapExecuted event was emitted
      const event = receipt.logs.find((l: any) => l.fragment?.name === "SwapExecuted");
      expect(event).to.not.be.undefined;

      // Verify HCS sequence number is stored in the swap record
      const agentSwaps = await mockDex.getAgentSwaps(agentId);
      expect(agentSwaps.length).to.equal(1);
      expect(agentSwaps[0].hcsSequenceNum).to.equal(hcsSeq);
      expect(agentSwaps[0].hcsTopicId).to.equal(topicId);
      console.log(`\n      ■ Swap stored with HCS seq #${agentSwaps[0].hcsSequenceNum}`);
    });

    it("updates pool reserves after HBAR_TO_USDT swap", async function () {
      const amountIn = 1000n * 100_000_000n; // 1000 HBAR
      const [expectedOut,,] = await mockDex.getSwapQuote("HBAR_TO_USDT", amountIn);
      const minOut = expectedOut * 990n / 1000n;

      const [hbarBefore] = await mockDex.getPoolState();

      await mockDex.sellHBARforUSDT(
        "agent-1", minOut, "1", "0.0.1", { value: amountIn }
      );

      const [hbarAfter] = await mockDex.getPoolState();

      // HBAR reserve should have increased
      expect(hbarAfter).to.be.gt(hbarBefore);
    });

    it("rejects when slippage exceeds 1%", async function () {
      // Use massive amount to force high slippage
      const hugeAmount = 500_000n * 100_000_000n; // 500K HBAR
      const [out,,] = await mockDex.getSwapQuote("HBAR_TO_USDT", hugeAmount);

      await expect(
        mockDex.sellHBARforUSDT(
          "agent-1", out, "1", "0.0.1", { value: hugeAmount }
        )
      ).to.be.revertedWith("Price impact > 1%");
    });
    
    it("executes USDT_TO_HBAR swap securely", async function () {
      const amountIn = 100n * 1_000_000n; // 100 USDT
      const [expectedOut,,] = await mockDex.getSwapQuote("USDT_TO_HBAR", amountIn);
      const minOut = expectedOut * 995n / 1000n;

      // Fund the mock dex with HBAR so it can send it back!
      // 100 USDT yields ~ 1176 HBAR, so fund it with 2000 HBAR
      await owner.sendTransaction({
        to: await mockDex.getAddress(),
        value: 2000n * 100_000_000n
      });

      const tx = await mockDex.buyHBARwithUSDT(
        "agent-test", amountIn, minOut, "2", "0.0.1"
      );
      await tx.wait();
      
      const agentSwaps = await mockDex.getAgentSwaps("agent-test");
      expect(agentSwaps.length).to.equal(1);
      expect(agentSwaps[0].direction).to.equal("USDT_TO_HBAR");
    });
  });
});
