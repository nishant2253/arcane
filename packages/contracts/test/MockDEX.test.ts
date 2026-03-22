import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("MockDEX", function () {
  let mockDex: Contract;
  let owner: any;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const MockDEX = await ethers.getContractFactory("MockDEX");
    mockDex = await MockDEX.deploy();
  });

  describe("Pool State", function () {
    it("initializes with correct reserves", async function () {
      const [hbar, usdc] = await mockDex.getPoolState();
      expect(hbar).to.equal(1_000_000n * 100_000_000n); // 1M HBAR
      expect(usdc).to.equal(85_000n * 1_000_000n); // 85K USDC
    });
  });

  describe("getSwapQuote", function () {
    it("returns valid quote for HBAR_TO_USDC", async function () {
      const amountIn = 100n * 100_000_000n; // 100 HBAR
      const [amountOut, priceImpact, slippage] = await mockDex.getSwapQuote("HBAR_TO_USDC", amountIn);
      expect(amountOut).to.be.gt(0n);
      expect(priceImpact).to.be.lt(100n); // < 1% for small trade
      console.log(`\n      100 HBAR → ${ethers.formatUnits(amountOut, 6)} USDC`);
    });

    it("returns valid quote for USDC_TO_HBAR", async function () {
      const amountIn = 8n * 1_000_000n; // 8 USDC
      const [amountOut,,] = await mockDex.getSwapQuote("USDC_TO_HBAR", amountIn);
      expect(amountOut).to.be.gt(0n);
      console.log(`      8 USDC → ${ethers.formatUnits(amountOut, 8)} HBAR`);
    });

    it("rejects invalid direction", async function () {
      await expect(
        mockDex.getSwapQuote("INVALID", 100n)
      ).to.be.revertedWith("Invalid direction: use HBAR_TO_USDC or USDC_TO_HBAR");
    });
  });

  describe("executeSwap", function () {
    it("executes swap and stores HCS sequence number", async function () {
      const agentId = "agent-test-123";
      const hcsSeq = "7"; // Simulates HCS seq#7 triggering this swap
      const topicId = "0.0.4823901";
      const amountIn = 100n * 100_000_000n; // 100 HBAR
      const [expectedOut,,] = await mockDex.getSwapQuote("HBAR_TO_USDC", amountIn);
      const minOut = expectedOut * 995n / 1000n;

      // Execute swap
      const tx = await mockDex.executeSwap(
        agentId, "HBAR_TO_USDC", amountIn, minOut, hcsSeq, topicId
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

    it("updates pool reserves after swap", async function () {
      const amountIn = 1000n * 100_000_000n; // 1000 HBAR
      const [expectedOut,,] = await mockDex.getSwapQuote("HBAR_TO_USDC", amountIn);
      const minOut = expectedOut * 990n / 1000n;

      const [hbarBefore] = await mockDex.getPoolState();

      await mockDex.executeSwap(
        "agent-1", "HBAR_TO_USDC", amountIn, minOut, "1", "0.0.1"
      );

      const [hbarAfter] = await mockDex.getPoolState();

      // HBAR reserve should have increased
      expect(hbarAfter).to.be.gt(hbarBefore);
    });

    it("rejects when slippage exceeds 1%", async function () {
      // Use massive amount to force high slippage (expect it to throw custom error if slippage > 100bps or equivalent)
      const hugeAmount = 500_000n * 100_000_000n; // 500K HBAR
      const [out,,] = await mockDex.getSwapQuote("HBAR_TO_USDC", hugeAmount);

      await expect(
        mockDex.executeSwap(
          "agent-1", "HBAR_TO_USDC", hugeAmount, out, "1", "0.0.1"
        )
      ).to.be.revertedWith("Price impact > 1% - trade rejected for safety");
    });
  });
});
