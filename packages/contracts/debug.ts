import { ethers } from "hardhat";
async function main() {
  const MockDEX = await ethers.getContractFactory("MockDEX");
  const mockDex = await MockDEX.deploy(ethers.ZeroAddress);
  const owner = (await ethers.getSigners())[0];
  await owner.sendTransaction({ to: await mockDex.getAddress(), value: 1000n * 100_000_000n });
  console.log("funded");
  const amountIn = 1n * 1_000_000n;
  const [expectedOut] = await mockDex.getSwapQuote("USDT_TO_HBAR", amountIn);
  console.log("expectedOut", expectedOut);
  await mockDex.buyHBARwithUSDT("test", amountIn, 0, "2", "0.0.1");
  console.log("success");
}
main().catch(console.error);
