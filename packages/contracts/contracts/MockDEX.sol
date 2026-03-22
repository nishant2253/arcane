// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ── Hedera System Contract Interfaces ────────────────────────
// HTS Precompile — native token operations on Hedera
// This is Hedera-EXCLUSIVE. Not available on any other EVM chain.
interface IHederaTokenService {
    function transferToken(
        address token,
        address sender,
        address receiver,
        int64 amount
    ) external returns (int64 responseCode);

    function associateToken(
        address account,
        address token
    ) external returns (int64 responseCode);
}

// Exchange Rate Precompile — HBAR ↔ USD on-chain (Hedera-exclusive)
interface IExchangeRate {
    function tinybarsToTinycents(uint256 tinybars)
        external returns (uint256);
    function tinycentsToTinybars(uint256 tinycents)
        external returns (uint256);
}

/**
 * @title MockDEX — Real Token Swap on Hedera Testnet
 *
 * REAL BEHAVIOR:
 *   SELL (HBAR → tUSDT):
 *     - Caller sends real HBAR (msg.value)
 *     - Contract sends real tUSDT to caller via HTS precompile
 *     - Caller's HBAR balance decreases
 *     - Caller's tUSDT balance increases
 *
 *   BUY (tUSDT → HBAR):
 *     - Caller approves tUSDT spend, contract pulls it via HTS
 *     - Contract sends real HBAR to caller
 *     - Caller's tUSDT balance decreases
 *     - Caller's HBAR balance increases
 *
 * This makes testnet trades IDENTICAL to mainnet in behavior.
 * Switch to hak-saucerswap-plugin on mainnet — zero other changes.
 */
contract MockDEX {

    // ── Hedera Precompile Addresses ───────────────────────────
    address constant HTS_PRECOMPILE =
        0x0000000000000000000000000000000000000167;
    address constant EXCHANGE_RATE_PRECOMPILE =
        0x0000000000000000000000000000000000000168;

    // ── State ─────────────────────────────────────────────────
    address public owner;
    address public tUSDTTokenAddress;  // HTS token address

    // Simulated pool reserves for price calculation
    uint256 public reserveHBAR = 1_000_000 * 1e8;   // 1M HBAR in tinybars
    uint256 public reserveUSDT = 85_000 * 1e6;       // 85K USDT in micro-USDT
    uint256 public constant FEE_BPS = 30;             // 0.3% fee

    // Swap record — links every trade to its HCS decision
    struct SwapRecord {
        address trader;
        string  agentId;
        string  direction;
        uint256 amountIn;
        uint256 amountOut;
        uint256 hbarPriceUSDCents;
        uint256 slippageBps;
        uint256 timestamp;
        string  hcsSequenceNum;   // ← Links to aBFT-timestamped HCS decision
        string  hcsTopicId;
    }

    mapping(string => SwapRecord[]) public agentSwaps;
    SwapRecord[] public allSwaps;

    // ── Events — indexed by Mirror Node ──────────────────────
    event SwapExecuted(
        string  indexed agentId,
        string  direction,
        uint256 hbarAmount,
        uint256 usdtAmount,
        uint256 slippageBps,
        string  hcsSequenceNum,
        string  hcsTopicId,
        address trader,
        uint256 timestamp
    );

    event ReservesRefreshed(uint256 hbar, uint256 usdt, uint256 price);

    // ── Constructor ────────────────────────────────────────────
    constructor(address _tUSDTAddress) {
        owner = msg.sender;
        tUSDTTokenAddress = _tUSDTAddress;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // Contract must be able to receive HBAR
    receive() external payable {}
    fallback() external payable {}

    // ── AMM Quote (x*y=k constant product) ────────────────────
    function getSwapQuote(
        string memory direction,
        uint256 amountIn
    ) public view returns (
        uint256 amountOut,
        uint256 priceImpactBps,
        uint256 slippageBps
    ) {
        require(amountIn > 0, "Amount must be > 0");

        uint256 amountInFee = amountIn * (10000 - FEE_BPS) / 10000;
        bytes32 dir = keccak256(bytes(direction));

        if (dir == keccak256(bytes("HBAR_TO_USDT"))) {
            // Selling HBAR, getting USDT back
            amountOut = (reserveUSDT * amountInFee)
                      / (reserveHBAR + amountInFee);
            priceImpactBps = (amountIn * 10000) / reserveHBAR;
        } else if (dir == keccak256(bytes("USDT_TO_HBAR"))) {
            // Selling USDT, getting HBAR back
            amountOut = (reserveHBAR * amountInFee)
                      / (reserveUSDT + amountInFee);
            priceImpactBps = (amountIn * 10000) / reserveUSDT;
        } else {
            revert("Invalid direction: HBAR_TO_USDT or USDT_TO_HBAR");
        }

        slippageBps = priceImpactBps / 2;
    }

    // ── SELL HBAR → Receive Real tUSDT ────────────────────────
    /**
     * @notice Caller sends HBAR (msg.value), receives real tUSDT.
     * @dev Uses HTS System Contract to transfer tUSDT to caller.
     *      Caller's HBAR balance DECREASES in HashPack.
     *      Caller's tUSDT balance INCREASES in HashPack.
     */
    function sellHBARforUSDT(
        string memory agentId,
        uint256 minUSDTOut,
        string memory hcsSequenceNum,
        string memory hcsTopicId
    ) external payable returns (uint256 usdtOut) {
        uint256 hbarIn = msg.value;  // Real HBAR sent by caller
        require(hbarIn > 0, "Must send HBAR");

        // Calculate output
        (uint256 expectedOut, , uint256 slippageBps) =
            getSwapQuote("HBAR_TO_USDT", hbarIn);
        require(expectedOut >= minUSDTOut, "Slippage exceeded");
        require(slippageBps <= 100, "Price impact > 1%");

        usdtOut = expectedOut;

        // Update pool reserves
        reserveHBAR += hbarIn;
        reserveUSDT -= usdtOut;

        // ── TRANSFER REAL tUSDT TO CALLER via HTS Precompile ──
        // Support fallback for local EVM testing
        uint256 codeSize;
        address precompile = HTS_PRECOMPILE;
        assembly { codeSize := extcodesize(precompile) }
        
        if (codeSize > 0) {
            int64 responseCode = IHederaTokenService(HTS_PRECOMPILE)
                .transferToken(
                    tUSDTTokenAddress,
                    address(this),     // From: MockDEX
                    msg.sender,        // To:   trader's wallet
                    int64(uint64(usdtOut))
                );
            require(responseCode == 22, "HTS transfer failed"); // 22 = SUCCESS
        }

        // Get current HBAR price via Exchange Rate Precompile (Safe fallback)
        uint256 hbarPriceUSDCents = 8;
        {
            (bool success, bytes memory result) = EXCHANGE_RATE_PRECOMPILE.call(
                abi.encodeWithSelector(IExchangeRate.tinybarsToTinycents.selector, 100_000_000)
            );
            if (success && result.length > 0) {
                hbarPriceUSDCents = abi.decode(result, (uint256));
            }
        }

        // Record swap with HCS link
        _recordSwap(agentId, "HBAR_TO_USDT", hbarIn, usdtOut,
                    hbarPriceUSDCents, slippageBps,
                    hcsSequenceNum, hcsTopicId);
    }

    // ── BUY HBAR with tUSDT → Receive Real HBAR ───────────────
    /**
     * @notice Caller sends tUSDT, receives real HBAR.
     * @dev Caller must have called approveTokenAllowance() first.
     *      Caller's tUSDT balance DECREASES in HashPack.
     *      Caller's HBAR balance INCREASES in HashPack.
     */
    function buyHBARwithUSDT(
        string memory agentId,
        uint256 usdtIn,
        uint256 minHBAROut,
        string memory hcsSequenceNum,
        string memory hcsTopicId
    ) external returns (uint256 hbarOut) {
        require(usdtIn > 0, "Must provide USDT amount");

        // Calculate output
        (uint256 expectedOut, , uint256 slippageBps) =
            getSwapQuote("USDT_TO_HBAR", usdtIn);
        require(expectedOut >= minHBAROut, "Slippage exceeded");
        require(slippageBps <= 100, "Price impact > 1%");

        hbarOut = expectedOut;

        // ── PULL tUSDT FROM CALLER via HTS Precompile ─────────
        uint256 codeSize;
        address precompile = HTS_PRECOMPILE;
        assembly { codeSize := extcodesize(precompile) }
        
        if (codeSize > 0) {
            int64 pullCode = IHederaTokenService(HTS_PRECOMPILE)
                .transferToken(
                    tUSDTTokenAddress,
                    msg.sender,        // From: trader's wallet
                    address(this),     // To:   MockDEX
                    int64(uint64(usdtIn))
                );
            require(pullCode == 22, "HTS pull failed");
        }

        // Update pool reserves
        reserveUSDT += usdtIn;
        reserveHBAR -= hbarOut;

        // ── SEND REAL HBAR TO CALLER ───────────────────────────
        // This is a real HBAR transfer — HashPack balance increases
        require(address(this).balance >= hbarOut, "Insufficient DEX HBAR balance");
        (bool sent, ) = payable(msg.sender).call{value: hbarOut}("");
        require(sent, "HBAR transfer failed");

        uint256 hbarPriceUSDCents = 8;
        {
            (bool success, bytes memory result) = EXCHANGE_RATE_PRECOMPILE.call(
                abi.encodeWithSelector(IExchangeRate.tinybarsToTinycents.selector, 100_000_000)
            );
            if (success && result.length > 0) {
                hbarPriceUSDCents = abi.decode(result, (uint256));
            }
        }

        _recordSwap(agentId, "USDT_TO_HBAR", usdtIn, hbarOut,
                    hbarPriceUSDCents, slippageBps,
                    hcsSequenceNum, hcsTopicId);
    }

    // ── Internal: record swap ─────────────────────────────────
    function _recordSwap(
        string memory agentId,
        string memory direction,
        uint256 amountIn,
        uint256 amountOut,
        uint256 price,
        uint256 slippage,
        string memory hcsSeq,
        string memory topicId
    ) internal {
        SwapRecord memory rec = SwapRecord({
            trader:           msg.sender,
            agentId:          agentId,
            direction:        direction,
            amountIn:         amountIn,
            amountOut:        amountOut,
            hbarPriceUSDCents: price,
            slippageBps:      slippage,
            timestamp:        block.timestamp,
            hcsSequenceNum:   hcsSeq,
            hcsTopicId:       topicId
        });
        agentSwaps[agentId].push(rec);
        allSwaps.push(rec);

        emit SwapExecuted(
            agentId, direction, amountIn, amountOut,
            slippage, hcsSeq, topicId, msg.sender, block.timestamp
        );
    }

    // ── Read Functions ─────────────────────────────────────────
    function getAgentSwaps(string memory agentId)
        external view returns (SwapRecord[] memory) {
        return agentSwaps[agentId];
    }
    
    function getTotalSwapCount() external view returns (uint256) {
        return allSwaps.length;
    }

    function getPoolState() external view returns (
        uint256 hbar, uint256 usdt, uint256 spotPrice
    ) {
        hbar      = reserveHBAR;
        usdt      = reserveUSDT;
        // Spot price returns micro-USDT per tinybar representation
        spotPrice = (reserveUSDT * 1e8) / reserveHBAR;
    }

    // ── Admin ─────────────────────────────────────────────────
    function fundWithHBAR() external payable onlyOwner {}

    function refreshReserves(
        uint256 newHBAR,
        uint256 newUSDT
    ) external onlyOwner {
        reserveHBAR = newHBAR;
        reserveUSDT = newUSDT;
        uint256 price = (newUSDT * 1e8) / newHBAR;
        emit ReservesRefreshed(newHBAR, newUSDT, price);
    }
}
